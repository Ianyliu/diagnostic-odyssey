import {
  reportTypes,
  validateEventSnapshot,
  validateResearchReport,
  type EventSnapshot,
  type ResearchReport,
  type ReportType,
} from "../../../../packages/community-pulse/src/index.ts";

export type InboxReceipt = {
  ingestion_id: string;
  received_at: string;
  content_sha256: string | null;
  transport: "email" | "manual_file" | "webhook";
  status: "accepted" | "duplicate" | "quarantined";
  reason_code: string | null;
  provider: string | null;
  review_status: "pending" | "needs_verification" | "rejected" | "none";
};

export type InboxEntry = {
  receipt: InboxReceipt;
  report: ResearchReport | null;
  candidate_claims?: {
    text: string;
    verification: "unverified" | "unsupported" | "conflicting";
  }[];
};

export type CommunityPulseResponse = {
  schema_version: "0.2.1";
  snapshot: EventSnapshot;
  inbox: InboxEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.some(option => option === value);
}

function displayText(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= limit;
}

function parseEntry(value: unknown): InboxEntry | null {
  if (!isRecord(value) || !isRecord(value.receipt)) return null;
  const r = value.receipt;
  if (
    !displayText(r.ingestion_id, 150) ||
    !isTimestamp(r.received_at) ||
    !(r.content_sha256 === null || (typeof r.content_sha256 === "string" && /^[a-f0-9]{64}$/.test(r.content_sha256))) ||
    !isOneOf(r.transport, ["email", "manual_file", "webhook"]) ||
    !isOneOf(r.status, ["accepted", "duplicate", "quarantined"]) ||
    !isOneOf(r.review_status, ["pending", "needs_verification", "rejected", "none"]) ||
    !(r.reason_code === null || displayText(r.reason_code, 120)) ||
    !(r.provider === null || displayText(r.provider, 120))
  ) return null;
  const receipt: InboxReceipt = {
    ingestion_id: r.ingestion_id,
    received_at: r.received_at,
    content_sha256: r.content_sha256,
    transport: r.transport,
    status: r.status,
    reason_code: r.reason_code,
    provider: r.provider,
    review_status: r.review_status,
  };

  // Outcomes without an admitted report cannot expose quarantined content.
  if (receipt.status !== "accepted") {
    return value.report === null && value.candidate_claims === undefined ? {receipt, report: null} : null;
  }

  if (receipt.content_sha256 === null) return null;
  const report = validateResearchReport(value.report);
  if (!report.ok) return null;
  if (value.candidate_claims === undefined) return {receipt, report: report.value};
  if (!Array.isArray(value.candidate_claims) || value.candidate_claims.length > 32) return null;
  const claims: NonNullable<InboxEntry["candidate_claims"]> = [];
  for (const claim of value.candidate_claims) {
    if (!isRecord(claim) || !displayText(claim.text, 1000) ||
      !isOneOf(claim.verification, ["unverified", "unsupported", "conflicting"])) return null;
    claims.push({text: claim.text, verification: claim.verification});
  }
  return {receipt, report: report.value, candidate_claims: claims};
}

function parseInbox(value: unknown): InboxEntry[] | null {
  if (!Array.isArray(value) || value.length > 80) return null;
  const inbox: InboxEntry[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    const entry = parseEntry(item);
    if (!entry || ids.has(entry.receipt.ingestion_id)) return null;
    ids.add(entry.receipt.ingestion_id);
    inbox.push(entry);
  }
  return inbox;
}

export function parseCommunityPulseResponse(value: unknown): CommunityPulseResponse | null {
  if (!isRecord(value) || value.schema_version !== "0.2.1") return null;
  const snapshot = validateEventSnapshot(value.snapshot);
  const inbox = parseInbox(value.inbox);
  if (!snapshot.ok || !inbox) return null;
  return {schema_version: "0.2.1", snapshot: snapshot.value, inbox};
}

export type StagingRunMetrics = {
  completed: number;
  no_change: number;
  partial: number;
  failed: number;
  last_success_at: string | null;
  last_delivery_at: string | null;
  missed: boolean | null;
};

export type StagingInboxMetrics = {
  as_of: string;
  window_hours: number;
  last_success_at: string | null;
  runs: Record<ReportType, StagingRunMetrics>;
};

export type StagingInboxResponse = {
  schema_version: "0.2.1";
  inbox: InboxEntry[];
  metrics: StagingInboxMetrics;
};

function isTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseRun(value: unknown): StagingRunMetrics | null {
  if (!isRecord(value) ||
    !isCount(value.completed) || !isCount(value.no_change) || !isCount(value.partial) || !isCount(value.failed) ||
    !(value.last_success_at === null || isTimestamp(value.last_success_at)) ||
    !(value.last_delivery_at === null || isTimestamp(value.last_delivery_at)) ||
    !(value.missed === null || typeof value.missed === "boolean")
  ) return null;
  return {
    completed: value.completed, no_change: value.no_change, partial: value.partial, failed: value.failed,
    last_success_at: value.last_success_at, last_delivery_at: value.last_delivery_at, missed: value.missed,
  };
}

export function parseStagingInboxResponse(value: unknown): StagingInboxResponse | null {
  if (!isRecord(value) || value.schema_version !== "0.2.1" || !isRecord(value.metrics) || "snapshot" in value) return null;
  const metrics = value.metrics;
  if (!isTimestamp(metrics.as_of) || !isCount(metrics.window_hours) || metrics.window_hours < 1 ||
    metrics.window_hours > 2160 || !(metrics.last_success_at === null || isTimestamp(metrics.last_success_at)) ||
    !isRecord(metrics.runs)) return null;
  const runs = {} as Record<ReportType, StagingRunMetrics>;
  for (const type of reportTypes) {
    const row = parseRun(metrics.runs[type]);
    if (!row) return null;
    runs[type] = row;
  }
  const inbox = parseInbox(value.inbox);
  if (!inbox || inbox.some(entry => entry.candidate_claims !== undefined)) return null;
  return {
    schema_version: "0.2.1", inbox,
    metrics: {as_of: metrics.as_of, window_hours: metrics.window_hours, last_success_at: metrics.last_success_at, runs},
  };
}

/** A single bounded, opaque validator is enough for this private projection. */
export function inboxETag(value: string | null): string | null {
  return value && /^(?:W\/)?"[a-zA-Z0-9:_.-]{1,100}"$/.test(value) ? value : null;
}

const maxProjectionBytes = 1_048_576;

export async function boundedInboxText(response: Response): Promise<string> {
  const length = response.headers.get("Content-Length");
  if (!response.body || (length !== null && Number(length) > maxProjectionBytes)) throw new Error("Invalid inbox body");
  const stream = response.body.getReader();
  const decoder = new TextDecoder("utf-8", {fatal: true});
  let size = 0;
  let text = "";
  try {
    while (true) {
      const {done, value} = await stream.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > maxProjectionBytes) throw new Error("Inbox response exceeds limit");
      text += decoder.decode(value, {stream: true});
    }
  } finally {
    try {
      await stream.cancel();
    } finally {
      stream.releaseLock();
    }
  }
}
