import { createHash } from "node:crypto";
import {
  reportStatuses, reportTypes, validateResearchReport,
  type ReportStatus, type ReportType, type ResearchReport
} from "../../../packages/community-pulse/src/research.ts";
import type { IntakeReceipt } from "../../../packages/community-pulse/src/transport.ts";

export interface IntakeObject {
  key: string;
  etag: string;
  size: number;
  uploaded: Date;
  customMetadata?: Record<string, string>;
}

interface IntakeObjectBody extends IntakeObject {
  json<T>(): Promise<T>;
}

/** Structural subset of the Cloudflare R2 Workers binding used by the staging inbox. */
export interface IntakeBucket {
  get(key: string): Promise<IntakeObjectBody | null>;
  put(key: string, value: string, options: {
    onlyIf: Headers;
    customMetadata?: Record<string, string>;
  }): Promise<IntakeObject | null>;
  list(options: { prefix: string; limit: number; include?: string[]; cursor?: string }): Promise<{
    objects: IntakeObject[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete(keys: string[]): Promise<void>;
}

export interface IntakeStoreOptions {
  retentionDays?: number;
  emailPerHour?: number;
  quarantinePerHour?: number;
  hourlyExpectedSince?: string;
}

type Disposition = "accepted" | "duplicate" | "quarantined";

export interface DeliveryResult {
  disposition: Disposition;
  reasonCode: string | null;
  receiptId: string;
}

interface StagingReceipt {
  ingestion_id: string;
  received_at: string;
  content_sha256: string | null;
  transport: "email";
  status: Disposition;
  reason_code: string | null;
  provider: "instinct-staging-email";
  review_status: "pending" | "rejected" | "none";
}

export interface StagingInboxEntry {
  receipt: StagingReceipt;
  report: ResearchReport | null;
}

interface RunSummary extends Record<ReportStatus, number> {
  last_success_at: string | null;
  last_delivery_at: string | null;
  missed: boolean | null;
}

export interface StagingInbox {
  schema_version: "0.2.1";
  inbox: StagingInboxEntry[];
  metrics: {
    as_of: string;
    window_hours: number;
    last_success_at: string | null;
    runs: Record<ReportType, RunSummary>;
  };
}

interface ProgressEntry {
  success: string | null;
  delivery: string | null;
}

type Progress = Partial<Record<ReportType, ProgressEntry>>;

interface DeliveryClaim {
  receiptId: string;
  receivedAt: string;
  reportDigest: string;
  rawDigest: string;
}

interface RunObject {
  digest: string;
  receiptId: string;
  report: ResearchReport;
}

interface Journal {
  stage: "pending" | "ready";
  receipt: StagingReceipt;
  runKey: string | null;
  digest: string | null;
  type: ReportType | null;
  outcome: ReportStatus | null;
}

const ROOT = "s0/";
const JOURNAL = ROOT + "journal/";
const PROGRESS = ROOT + "progress.json";
const DAY = 24 * 60 * 60 * 1000;
const HOUR = DAY / 24;
const WINDOW_HOURS = 24;
const MAX_INBOX = 10; // Keep the maximum serialized projection comfortably below 1 MiB.
const RETRIES = 8;
const MAX_TIMESTAMP = 9_999_999_999_999;
const DEFAULT_MAX_OBJECT = 96 * 1024;
const encoder = new TextEncoder();
const SHA = /^[a-f0-9]{64}$/u;
const RECEIPT_ID = /^[A-Za-z0-9_-]{1,120}$/u;
const REASON = /^[a-z0-9_]{1,120}$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

function hash(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Same sorted, no-whitespace JSON representation as the Phase F transport. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const record = value as Record<string, unknown>;
  return "{" + Object.keys(record).sort().map(key => JSON.stringify(key) + ":" + canonical(record[key])).join(",") + "}";
}

function instant(value: string): number {
  const parsed = Date.parse(value);
  if (!ISO.test(value) || !Number.isFinite(parsed) || parsed < 0 || parsed > MAX_TIMESTAMP) {
    throw Error("Invalid trusted intake timestamp");
  }
  return parsed;
}

function newer(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return Date.parse(b) > Date.parse(a) ? b : a;
}

function noOlderThan(value: string | null | undefined, cutoff: number): string | null {
  return value && Date.parse(value) >= cutoff ? value : null;
}

function backwards(timestamp: number): string {
  return String(MAX_TIMESTAMP - timestamp).padStart(13, "0");
}

function journalKey(receipt: StagingReceipt): string {
  return JOURNAL + backwards(instant(receipt.received_at)) + "-" + receipt.ingestion_id;
}

function positiveInteger(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < minimum || result > maximum) throw Error("Invalid staging inbox setting");
  return result;
}

function isSuccess(status: ReportStatus): boolean {
  return status === "completed" || status === "no_change";
}

function oneOf<T extends string>(value: string | undefined, options: readonly T[]): value is T {
  return options.some(option => option === value);
}

function row(receipt: IntakeReceipt, id: string, received: string): StagingReceipt {
  return {
    ingestion_id: id,
    received_at: received,
    content_sha256: receipt.rawSha256 && SHA.test(receipt.rawSha256) ? receipt.rawSha256 : null,
    transport: "email",
    status: "accepted",
    reason_code: null,
    provider: "instinct-staging-email",
    review_status: "pending"
  };
}

function quarantine(ready: StagingReceipt, value: string | undefined): StagingReceipt {
  return {
    ...ready, status: "quarantined", review_status: "rejected",
    reason_code: value && REASON.test(value) ? value : "invalid_report"
  };
}

function duplicate(ready: StagingReceipt): StagingReceipt {
  return { ...ready, status: "duplicate", review_status: "none", reason_code: "already_received" };
}

function outcome(ready: StagingReceipt): DeliveryResult {
  return { disposition: ready.status, reasonCode: ready.reason_code, receiptId: ready.ingestion_id };
}

function metadata(journal: Journal): Record<string, string> {
  return {
    stage: journal.stage,
    received_at: journal.receipt.received_at,
    disposition: journal.receipt.status,
    type: journal.type ?? "",
    outcome: journal.outcome ?? ""
  };
}

export function createIntakeStore(bucket: IntakeBucket, options: IntakeStoreOptions = {}) {
  const retentionDays = positiveInteger(options.retentionDays, 7, 90, 30);
  const limits = {
    email: positiveInteger(options.emailPerHour, 1, 12, 12),
    quarantine: positiveInteger(options.quarantinePerHour, 1, 4, 4)
  };
  const expectHourly = options.hourlyExpectedSince === undefined ? null : instant(options.hourlyExpectedSince);

  async function read<T>(key: string): Promise<{ data: T; etag: string } | null> {
    const object = await bucket.get(key);
    if (!object) return null;
    if (object.size > DEFAULT_MAX_OBJECT) throw Error("Staging object exceeds its read limit");
    return { data: await object.json<T>(), etag: object.etag };
  }

  function write(key: string, value: unknown, etag: string | null, customMetadata?: Record<string, string>) {
    return bucket.put(key, JSON.stringify(value), {
      onlyIf: new Headers(etag === null ? { "If-None-Match": "*" } : { "If-Match": '"' + etag + '"' }),
      ...(customMetadata ? { customMetadata } : {})
    });
  }

  async function tryConsumeRate(now: Date, kind: "email" | "quarantine"): Promise<boolean> {
    const key = ROOT + "rate/" + now.toISOString().slice(0, 13) + "/" + kind;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      const existing = await read<{ count: number }>(key);
      const count = existing?.data.count ?? 0;
      if (!Number.isInteger(count) || count < 0 || count >= limits[kind]) return false;
      if (await write(key, { count: count + 1 }, existing?.etag ?? null)) return true;
    }
    return false;
  }

  function recordProgress(progress: Progress, type: ReportType, outcome: ReportStatus, at: string): void {
    const current = progress[type];
    progress[type] = {
      delivery: newer(current?.delivery ?? null, at),
      success: newer(current?.success ?? null, isSuccess(outcome) ? at : null)
    };
  }

  async function mergeProgress(incoming: Progress, cutoff = 0): Promise<void> {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      const existing = await read<Progress>(PROGRESS);
      const saved = existing?.data ?? {};
      const next: Progress = {};
      for (const type of reportTypes) {
        const delivery = noOlderThan(newer(saved[type]?.delivery ?? null, incoming[type]?.delivery ?? null), cutoff);
        const success = noOlderThan(newer(saved[type]?.success ?? null, incoming[type]?.success ?? null), cutoff);
        if (delivery || success) next[type] = { delivery, success };
      }
      if (canonical(saved) === canonical(next)) return;
      if (await write(PROGRESS, next, existing?.etag ?? null)) return;
    }
    throw Error("Staging inbox progress contended");
  }

  async function updateProgress(journal: Journal): Promise<void> {
    if (journal.receipt.status !== "accepted" || journal.type === null || journal.outcome === null) return;
    const update: Progress = {};
    recordProgress(update, journal.type, journal.outcome, journal.receipt.received_at);
    await mergeProgress(update);
  }

  /** Finish a pending journal entry only after its logical run object and payload are durable. */
  async function finish(
    key: string, pending: { data: Journal; etag: string }, actual: RunObject
  ): Promise<Journal> {
    const intended = pending.data;
    const accepted = actual.receiptId === intended.receipt.ingestion_id;
    const conflicting = actual.digest !== intended.digest || (accepted && intended.runKey === null);
    let receipt = quarantine(intended.receipt, "run_id_conflict");
    if (!conflicting) receipt = accepted ? intended.receipt : duplicate(intended.receipt);
    const ready: Journal = { ...intended, stage: "ready", receipt, runKey: receipt.status === "accepted" ? intended.runKey : null };
    if (await write(key, ready, pending.etag, metadata(ready))) return ready;
    const stored = await read<Journal>(key);
    if (stored?.data.stage === "ready") return stored.data;
    throw Error("Staging receipt contention");
  }

  async function saveQuarantine(receipt: StagingReceipt): Promise<DeliveryResult> {
    const value: Journal = {
      stage: "ready", receipt, runKey: null, digest: null, type: null, outcome: null
    };
    const key = journalKey(receipt);
    if (await write(key, value, null, metadata(value))) return outcome(receipt);
    const stored = await read<Journal>(key);
    if (!stored || stored.data.stage !== "ready") throw Error("Staging quarantine contention");
    return outcome(stored.data.receipt);
  }

  async function saveDelivery(parsed: IntakeReceipt, report: ResearchReport | null): Promise<DeliveryResult> {
    if (parsed.channel !== "email") throw Error("Staging inbox accepts email deliveries only");
    const time = new Date(instant(parsed.receivedAt)).toISOString();
    if (!RECEIPT_ID.test(parsed.receiptId)) throw Error("Invalid trusted receipt identifier");
    const initial = row(parsed, parsed.receiptId, time);
    if (parsed.disposition !== "accepted" || !report) {
      return saveQuarantine(quarantine(initial, parsed.reasonCodes[0]));
    }

    const checked = validateResearchReport(report);
    if (!checked.ok || parsed.rawSha256 === null || !SHA.test(parsed.rawSha256) ||
      parsed.reportSha256 !== hash(canonical(report)) || parsed.runId !== report.run_id ||
      parsed.reportType !== report.report_type || parsed.reportedRunStatus !== report.status ||
      !parsed.provider || !parsed.deliveryId) {
      return saveQuarantine(quarantine(initial, "intake_receipt_mismatch"));
    }

    const candidateSize = encoder.encode(JSON.stringify({ digest: parsed.reportSha256, receiptId: parsed.receiptId, report: checked.value })).byteLength;
    if (candidateSize > DEFAULT_MAX_OBJECT) return saveQuarantine(quarantine(initial, "oversized_normalized_report"));

    // Bind the signed identity to the validated report across retries with new mail trace headers.
    const aliasKey = ROOT + "delivery/" + hash(JSON.stringify([parsed.provider, parsed.deliveryId]));
    const claim: DeliveryClaim = {
      receiptId: initial.ingestion_id, receivedAt: time, reportDigest: parsed.reportSha256, rawDigest: parsed.rawSha256
    };
    let chosen = claim;
    if (!await write(aliasKey, claim, null)) {
      const prior = await read<DeliveryClaim>(aliasKey);
      if (!prior) throw Error("Staging delivery claim disappeared");
      if (prior.data.reportDigest !== claim.reportDigest) {
        const id = "conflict-" + hash(JSON.stringify([aliasKey, claim.reportDigest]));
        const conflictKey = ROOT + "delivery/" + id;
        const conflict = { ...claim, receiptId: id };
        const observed = await write(conflictKey, conflict, null)
          ? conflict
          : (await read<DeliveryClaim>(conflictKey))?.data;
        if (!observed) throw Error("Staging conflict claim disappeared");
        return saveQuarantine(quarantine(row(parsed, observed.receiptId, observed.receivedAt), "delivery_id_conflict"));
      }
      chosen = prior.data;
    }

    const entry = row({ ...parsed, rawSha256: chosen.rawDigest }, chosen.receiptId, chosen.receivedAt);
    const key = journalKey(entry);
    const runKey = ROOT + "runs/" + hash(report.run_id);
    const wanted: Journal = {
      stage: "pending", receipt: entry, runKey, digest: parsed.reportSha256,
      type: report.report_type, outcome: report.status
    };
    const created = await write(key, wanted, null, metadata(wanted));
    const pending = created ? { data: wanted, etag: created.etag } : await read<Journal>(key);
    if (!pending) throw Error("Staging pending receipt disappeared");
    if (pending.data.stage === "ready") {
      await updateProgress(pending.data);
      return outcome(pending.data.receipt.status === "accepted" ? duplicate(pending.data.receipt) : pending.data.receipt);
    }

    if (pending.data.runKey !== runKey || pending.data.digest !== parsed.reportSha256) {
      throw Error("Staging pending receipt differs from its delivery");
    }

    // A losing logical run condition never persists its candidate payload.
    const candidate: RunObject = { digest: parsed.reportSha256, receiptId: chosen.receiptId, report: checked.value };
    const committed = await write(runKey, candidate, null);
    const actual = committed ? candidate : (await read<RunObject>(runKey))?.data;
    if (!actual) throw Error("Staging run disappeared");
    const ready = await finish(key, pending, actual);
    await updateProgress(ready);
    return outcome(ready.receipt);
  }

  /** R2 lists newest-first by trusted inverted timestamp. Keys and metadata have no mail addresses. */
  async function recentObjects(cutoff: number): Promise<IntakeObject[]> {
    const recent: IntakeObject[] = [];
    const endKey = JOURNAL + backwards(Math.max(0, cutoff)) + "-\uffff";
    let cursor: string | undefined;
    // The two durable hourly caps permit at most 400 distinct admissions in a rolling day.
    // Continue through smaller Cloudflare metadata pages, then fail closed rather than show a partial result.
    for (let page = 0; page < 8; page++) {
      const batch = await bucket.list({ prefix: JOURNAL, limit: 450, include: ["customMetadata"], ...(cursor ? { cursor } : {}) });
      for (const object of batch.objects) {
        if (object.key > endKey) return recent;
        recent.push(object);
      }
      if (!batch.truncated) return recent;
      if (!batch.cursor) throw Error("Missing staging continuation cursor");
      cursor = batch.cursor;
    }
    throw Error("Staging inbox history scan exceeded its bound");
  }

  async function recoverPending(now: Date, limit = 16): Promise<number> {
    positiveInteger(limit, 1, 32, 16);
    const recent = await recentObjects(now.getTime() - DAY);
    const updates: Progress = {};
    for (const row of recent) {
      const m = row.customMetadata;
      if (m?.stage === "ready" && m.disposition === "accepted" && m.received_at &&
        oneOf(m.type, reportTypes) && oneOf(m.outcome, reportStatuses)) {
        recordProgress(updates, m.type, m.outcome, m.received_at);
      }
    }
    let visited = 0;
    let finished = 0;
    for (const row of recent) {
      if (row.customMetadata?.stage !== "pending") continue;
      if (++visited > limit) break;
      const journal = await read<Journal>(row.key);
      if (!journal || journal.data.stage !== "pending" || !journal.data.runKey) continue;
      const data = await read<RunObject>(journal.data.runKey);
      if (!data) continue; // Requires the original delivery again. No receipt claims acceptance.
      const result = await finish(row.key, journal, data.data);
      if (result.type && result.outcome && result.receipt.status === "accepted") {
        recordProgress(updates, result.type, result.outcome, result.receipt.received_at);
      }
      finished++;
    }
    await mergeProgress(updates, now.getTime() - retentionDays * DAY);
    return finished;
  }

  /** Bounded operator sweep. R2 lifecycle is the independent expiry backstop, including orphaned objects. */
  async function purgeExpired(now: Date, cursor?: string): Promise<{ deleted: number; cursor: string | null }> {
    const cutoff = now.getTime() - retentionDays * DAY;
    if (!cursor) await mergeProgress({}, cutoff);
    const batch = await bucket.list({ prefix: ROOT, limit: 100, ...(cursor ? { cursor } : {}) });
    const expired = batch.objects.filter(object =>
      object.key !== PROGRESS && object.uploaded.getTime() < (object.key.startsWith(ROOT + "rate/") ? now.getTime() - 2 * DAY : cutoff)
    );
    if (expired.length) await bucket.delete(expired.map(row => row.key));
    return { deleted: expired.length, cursor: batch.truncated ? batch.cursor ?? null : null };
  }

  async function readInboxIfChanged(now: Date, ifNoneMatch?: string): Promise<{ etag: string; data: StagingInbox | null }> {
    const cutoff = now.getTime() - WINDOW_HOURS * HOUR;
    const retained = now.getTime() - retentionDays * DAY;
    const [rows, progress] = await Promise.all([recentObjects(cutoff), read<Progress>(PROGRESS)]);
    const runs = Object.fromEntries(reportTypes.map(type => [type, {
      completed: 0, no_change: 0, partial: 0, failed: 0,
      last_success_at: noOlderThan(progress?.data[type]?.success, retained),
      last_delivery_at: noOlderThan(progress?.data[type]?.delivery, retained), missed: null
    }])) as Record<ReportType, RunSummary>;
    const selected: IntakeObject[] = [];
    for (const item of rows) {
      const m = item.customMetadata;
      if (!m || m.stage !== "ready" || !m.received_at || Date.parse(m.received_at) > now.getTime()) continue;
      if (selected.length < MAX_INBOX) selected.push(item);
      if (m.disposition === "accepted" && oneOf(m.type, reportTypes) && oneOf(m.outcome, reportStatuses)) {
        const run = runs[m.type];
        run[m.outcome]++;
        run.last_delivery_at = newer(run.last_delivery_at, m.received_at);
        if (isSuccess(m.outcome)) run.last_success_at = newer(run.last_success_at, m.received_at);
      }
    }

    if (expectHourly !== null && expectHourly <= now.getTime()) {
      const last = runs.hourly_scout.last_delivery_at;
      const anchor = last === null ? expectHourly : Math.max(expectHourly, Date.parse(last));
      runs.hourly_scout.missed = now.getTime() - anchor >= HOUR + 30 * 60 * 1000;
    }
    const lastSuccess = reportTypes.reduce<string | null>((last, type) => newer(last, runs[type].last_success_at), null);
    const etag = '"' + hash(canonical([runs, selected.map(item => [item.key, item.etag])])) + '"';
    if (ifNoneMatch === etag) return { etag, data: null };

    const inbox = await Promise.all(selected.map(async (item): Promise<StagingInboxEntry> => {
      const stored = await read<Journal>(item.key);
      if (!stored || stored.data.stage !== "ready") throw Error("Staging receipt no longer available");
      const journal = stored.data;
      if (journal.receipt.status !== "accepted") return { receipt: journal.receipt, report: null };
      if (!journal.runKey) throw Error("Ready staging receipt missing run reference");
      const candidate = await read<RunObject>(journal.runKey);
      const checked = validateResearchReport(candidate?.data.report);
      if (!candidate || !checked.ok || candidate.data.receiptId !== journal.receipt.ingestion_id ||
        candidate.data.digest !== journal.digest || candidate.data.digest !== hash(canonical(checked.value))) {
        throw Error("Staging run failed verification");
      }
      return { receipt: journal.receipt, report: checked.value };
    }));
    return {
      etag,
      data: {
        schema_version: "0.2.1", inbox,
        metrics: { as_of: now.toISOString(), window_hours: WINDOW_HOURS, last_success_at: lastSuccess, runs }
      }
    };
  }

  async function readInbox(now: Date): Promise<StagingInbox> {
    const result = await readInboxIfChanged(now);
    if (!result.data) throw Error("Staging projection unexpectedly unchanged");
    return result.data;
  }

  return { tryConsumeRate, saveDelivery, readInbox, readInboxIfChanged, recoverPending, purgeExpired };
}
