import { createHash } from "node:crypto";
import {
  createResearchIntakeState, ingestResearchDelivery, MAX_DELIVERY_BYTES, MAX_REPORT_BYTES, normalizedMailbox,
  providerPlainTextTransport, type IntakeReceipt,
} from "../../../packages/community-pulse/src/transport.ts";
import { equalSecret, isPrivateRecipient } from "./authentication.ts";
import type { ReceiverStore } from "./email.ts";
import type { IntakeBucket } from "./storage.ts";
import {
  AgentMailTooLarge, agentMailMessages, asRecord, decodeAgentMailJson, isAgentMailMessageId, isAgentMailPageToken,
  readBoundedBytes, svixEnvelope, svixSigningKey, validSvixSignature,
} from "./agentmailProtocol.ts";

export const agentMailWebhookPath = "/v1/agentmail/webhook";
export const agentMailRecoveryCron = "*/15 * * * *";
const PROVIDER = "agentmail";
const MAX_WEBHOOK_BYTES = 128 * 1024;
const RECOVERY_WINDOW_MS = 48 * 60 * 60 * 1000;
const RECOVERY_OVERLAP_MS = 2 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const RECOVERY_PAGE_SIZE = 2;
const HASH = /^[a-f0-9]{64}$/u;
const LABEL_DENY = new Set(["spam", "blocked", "unauthenticated", "trash"]);
const encoder = new TextEncoder();

export interface AgentMailEnvironment {
  PULSE_STAGING_ENABLED?: string;
  PULSE_INTAKE: IntakeBucket;
  PULSE_EXPECTED_SENDER?: string;
  PULSE_AGENTMAIL_MODE?: string;
  PULSE_AGENTMAIL_INBOX_ID?: string;
  PULSE_AGENTMAIL_API_KEY?: string;
  PULSE_AGENTMAIL_WEBHOOK_SECRET?: string;
  PULSE_AGENTMAIL_DKIM_DOMAIN?: string;
  PULSE_AGENTMAIL_SYNTHETIC_REPORT_SHA256?: string;
  PULSE_AGENTMAIL_RECONCILE?: string;
}

type AgentMailPolicy = NonNullable<ReturnType<typeof getPolicy>>;
type MessageMarker = { firstSeen: string; complete: boolean };
type RecoveryState = { anchor: number; lowerBound: number; token: string };
type MessageResult = "completed" | "duplicate" | "rate_limited";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getPolicy(env: AgentMailEnvironment) {
  const mode = env.PULSE_AGENTMAIL_MODE;
  const inbox = env.PULSE_AGENTMAIL_INBOX_ID;
  const expected = env.PULSE_EXPECTED_SENDER;
  const from = normalizedMailbox(expected ?? null);
  const key = env.PULSE_AGENTMAIL_API_KEY;
  const signingKey = svixSigningKey(env.PULSE_AGENTMAIL_WEBHOOK_SECRET);
  const syntheticDigest = env.PULSE_AGENTMAIL_SYNTHETIC_REPORT_SHA256;
  if (env.PULSE_STAGING_ENABLED !== "on" || (mode !== "synthetic" && mode !== "qualified") ||
    !inbox || normalizedMailbox(inbox) !== inbox || !inbox.endsWith("@agentmail.to") ||
    (mode === "qualified" && !isPrivateRecipient(inbox)) || from !== expected || !from ||
    !key || !/^[\x21-\x7e]{1,512}$/u.test(key) || !signingKey ||
    (mode === "synthetic" && (!syntheticDigest || !HASH.test(syntheticDigest)))) return undefined;
  const fromDomain = from.slice(from.lastIndexOf("@") + 1);
  const signingDomain = env.PULSE_AGENTMAIL_DKIM_DOMAIN ?? fromDomain;
  // An operator may qualify a parent signer, but never a signer outside the From domain tree.
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/u.test(signingDomain) ||
    (fromDomain !== signingDomain && !fromDomain.endsWith("." + signingDomain))) return undefined;
  return { inbox, from, fromDomain, signingDomain, key, signingKey, mode, syntheticDigest };
}

function withinWindow(timestamp: unknown, now: Date): boolean {
  if (typeof timestamp !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/u.test(timestamp)) return false;
  const age = now.getTime() - Date.parse(timestamp);
  return Number.isFinite(age) && age >= -CLOCK_SKEW_MS && age <= RECOVERY_WINDOW_MS;
}

function quarantineReceipt(id: string, at: string, reason: string): IntakeReceipt {
  return {
    receiptId: id, channel: "email", receivedAt: at, disposition: "quarantined", reasonCodes: [reason],
    bytesReceived: 0, rawSha256: null, reportSha256: null, provider: PROVIDER, deliveryId: id,
    assertedMessageId: null, verifiedSender: null, runId: null, reportType: null, reportedRunStatus: null,
    duplicateOf: null,
  };
}

async function readMarker(bucket: IntakeBucket, path: string) {
  const object = await bucket.get(path);
  if (!object) return null;
  if (object.size > 256) throw Error("AgentMail marker too large");
  const data = await object.json<MessageMarker>();
  if (typeof data?.complete !== "boolean" || typeof data.firstSeen !== "string" || !Number.isFinite(Date.parse(data.firstSeen))) {
    throw Error("AgentMail marker invalid");
  }
  return { data, etag: object.etag };
}

function writeMarker(bucket: IntakeBucket, path: string, data: MessageMarker, etag?: string) {
  return bucket.put(path, JSON.stringify(data), {
    onlyIf: new Headers(etag ? { "If-Match": '"' + etag + '"' } : { "If-None-Match": "*" }),
  });
}

function checkMessage(messageValue: unknown, policy: AgentMailPolicy, messageId: string, now: Date):
  { bytes: Uint8Array; createdAt: string } | { reason: string } {
  const message = asRecord(messageValue);
  if (!message || message.inbox_id !== policy.inbox || message.message_id !== messageId) {
    throw Error("AgentMail lookup identity mismatch");
  }

  if (!withinWindow(message.created_at, now)) return { reason: "agentmail_delivery_outside_window" };
  if (normalizedMailbox(typeof message.from === "string" ? message.from : null) !== policy.from ||
    !Array.isArray(message.to) || message.to.length !== 1 ||
    normalizedMailbox(typeof message.to[0] === "string" ? message.to[0] : null) !== policy.inbox ||
    !Array.isArray(message.labels) || message.labels.length > 64 ||
    message.labels.some(label => typeof label !== "string" || LABEL_DENY.has(label.toLowerCase()))) {
    return { reason: "agentmail_message_identity_denied" };
  }

  // AgentMail obtains these structured verdicts from SES. In-message headers and webhook body
  // fields cannot attest authentication and are deliberately ignored. Restrict to direct mail.
  const auth = asRecord(message.authentication_results);
  if (!auth || auth.arc_sealer != null || auth.dkim !== "pass" || auth.dmarc !== "pass" ||
    typeof auth.dkim_domain !== "string" || auth.dkim_domain.toLowerCase() !== policy.signingDomain ||
    typeof auth.dmarc_domain !== "string" || auth.dmarc_domain.toLowerCase() !== policy.fromDomain) {
    return { reason: "agentmail_sender_authentication_unverified" };
  }

  if (typeof message.size !== "number" || !Number.isSafeInteger(message.size) ||
    message.size < 1 || message.size > MAX_DELIVERY_BYTES) {
    return { reason: "agentmail_message_size_denied" };
  }
  if (typeof message.text !== "string" || !message.text.trim()) {
    return { reason: "agentmail_plain_text_missing" };
  }
  if (/[\uD800-\uDFFF]/u.test(message.text)) return { reason: "agentmail_invalid_plain_text_encoding" };
  if (message.text.length > MAX_REPORT_BYTES) return { reason: "report_too_large" };
  const bytes = encoder.encode(message.text);
  if (bytes.byteLength > MAX_REPORT_BYTES) return { reason: "report_too_large" };
  return { bytes, createdAt: String(message.created_at) };
}

async function processMessage(
  bucket: IntakeBucket, store: ReceiverStore, policy: AgentMailPolicy, id: string, now: Date, fetcher: typeof fetch,
): Promise<MessageResult> {
  const receiptId = "agentmail-" + sha(JSON.stringify([policy.inbox, id]));
  const path = "s0/agentmail/messages/" + receiptId;
  let marker = await readMarker(bucket, path);
  if (marker?.data.complete) return "duplicate";
  if (!await store.tryConsumeRate(now, "email")) return "rate_limited";

  if (!marker) {
    const first = { firstSeen: now.toISOString(), complete: false };
    const created = await writeMarker(bucket, path, first);
    marker = created ? { data: first, etag: created.etag } : await readMarker(bucket, path);
    if (!marker) throw Error("AgentMail marker unavailable");
    if (marker.data.complete) return "duplicate";
  }
  const at = marker.data.firstSeen;
  let resolved: ReturnType<typeof checkMessage>;
  try {
    resolved = checkMessage(await agentMailMessages(fetcher, policy.key, policy.inbox, id), policy, id, now);
  } catch (error) {
    if (!(error instanceof AgentMailTooLarge)) throw error;
    resolved = { reason: "agentmail_api_message_too_large" };
  }

  let receipt = "reason" in resolved ? quarantineReceipt(receiptId, at, resolved.reason) : undefined;
  let report = null;
  if ("bytes" in resolved) {
    const verifiedMail = {
      boundary: PROVIDER, deliveryId: receiptId, authenticatedFrom: policy.from, recipient: policy.inbox,
      dmarc: "pass" as const, alignedDkim: true, gatewayObservedAt: resolved.createdAt,
    };
    const result = ingestResearchDelivery(
      providerPlainTextTransport.receive({ raw: resolved.bytes, verifiedMail }),
      createResearchIntakeState(),
      { emailPolicy: { boundary: PROVIDER, authenticatedFrom: policy.from, recipient: policy.inbox },
        clock: () => new Date(at), receiptId: () => receiptId },
    );
    receipt = result.receipt;
    report = result.state.candidates[0]?.report ?? null;
    if (report && policy.mode === "synthetic" && (!receipt.reportSha256 || !policy.syntheticDigest ||
      !equalSecret(receipt.reportSha256, policy.syntheticDigest))) {
      receipt = quarantineReceipt(receiptId, at, "agentmail_synthetic_report_mismatch");
      report = null;
    }
  }
  if (!receipt) throw Error("AgentMail intake unresolved");
  if (!report) {
    if (!await store.tryConsumeRate(now, "quarantine")) return "rate_limited";
    receipt = { ...receipt, rawSha256: null, assertedMessageId: null, verifiedSender: null };
  }

  await store.saveDelivery(receipt, report);
  if (!await writeMarker(bucket, path, { firstSeen: at, complete: true }, marker.etag)) {
    if (!(await readMarker(bucket, path))?.data.complete) throw Error("AgentMail completion contended");
  }
  return "completed";
}

function reply(status: number): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, noarchive",
      ...(status === 405 ? { Allow: "POST" } : {}), ...(status === 429 ? { "Retry-After": "3600" } : {}) },
  });
}

export async function serveAgentMailWebhook(
  request: Request, env: AgentMailEnvironment, createStore: () => ReceiverStore, now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const policy = getPolicy(env);
  const url = new URL(request.url);
  if (!policy || url.pathname !== agentMailWebhookPath || url.search) return reply(404);
  if (request.method !== "POST") return reply(405);
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get("content-type") ?? "") ||
    !["", "identity"].includes(request.headers.get("content-encoding") ?? "")) return reply(415);

  const envelope = svixEnvelope(request.headers, now);
  if (!envelope) return reply(401);

  let bytes: Uint8Array;
  try {
    bytes = await readBoundedBytes(request, MAX_WEBHOOK_BYTES);
  } catch (error) {
    return reply(error instanceof AgentMailTooLarge ? 413 : 400);
  }
  if (!validSvixSignature(envelope, policy.signingKey, bytes)) return reply(401);

  let event: Record<string, unknown> | undefined;
  try {
    event = asRecord(decodeAgentMailJson(bytes));
  } catch {
    return reply(400);
  }
  const message = asRecord(event?.message);
  if (!event || event.type !== "event" || event.event_type !== "message.received" ||
    typeof event.event_id !== "string" || !/^[A-Za-z0-9_.:-]{1,160}$/u.test(event.event_id) ||
    !message || !isAgentMailMessageId(message.message_id)) return reply(400);
  if (message.inbox_id !== policy.inbox) return reply(403);

  try {
    const result = await processMessage(env.PULSE_INTAKE, createStore(), policy, message.message_id, now, fetcher);
    return reply(result === "rate_limited" ? 429 : 200);
  } catch {
    // An incomplete marker lets Svix retry the same attempt, or a bounded list sweep recover it.
    return reply(503);
  }
}

/** Walk one short mailbox page per tick and bookmark only after every row is terminal. */
export async function reconcileAgentMail(
  env: AgentMailEnvironment, createStore: () => ReceiverStore, now = new Date(), fetcher: typeof fetch = fetch,
): Promise<{ scanned: number; processed: number; deferred: number }> {
  const counters = { scanned: 0, processed: 0, deferred: 0 };
  if (env.PULSE_AGENTMAIL_RECONCILE !== "on") return counters;
  const policy = getPolicy(env);
  if (policy?.mode !== "qualified") return counters;

  const bucket = env.PULSE_INTAKE;
  const checkpointKey = "s0/agentmail/reconcile/" + sha(policy.inbox);
  const checkpoint = await bucket.get(checkpointKey);
  if (checkpoint && checkpoint.size > 16384) throw Error("AgentMail checkpoint invalid");
  const saved = await checkpoint?.json<RecoveryState>();
  const valid = saved && Number.isSafeInteger(saved.anchor) && saved.anchor <= now.getTime() &&
    saved.anchor >= now.getTime() - RECOVERY_WINDOW_MS && Number.isSafeInteger(saved.lowerBound) &&
    saved.lowerBound >= saved.anchor - RECOVERY_WINDOW_MS && saved.lowerBound <= saved.anchor;
  const active = valid && isAgentMailPageToken(saved.token);
  const complete = valid && saved.token === "";
  const anchor = active ? saved.anchor : now.getTime();
  const lowerBound = active ? saved.lowerBound : Math.max(
    anchor - RECOVERY_WINDOW_MS, complete ? saved.anchor - RECOVERY_OVERLAP_MS : 0,
  );
  const query = new URLSearchParams({
    limit: String(RECOVERY_PAGE_SIZE), ascending: "true",
    after: new Date(lowerBound).toISOString(),
    before: new Date(anchor + CLOCK_SKEW_MS).toISOString(),
  });
  if (active) query.set("page_token", saved.token);
  const list = asRecord(await agentMailMessages(fetcher, policy.key, policy.inbox, undefined, query));
  if (!list || !Array.isArray(list.messages) || list.messages.length > RECOVERY_PAGE_SIZE ||
    (list.next_page_token != null && !isAgentMailPageToken(list.next_page_token))) {
    throw Error("AgentMail list response invalid");
  }

  const store = createStore();
  for (const raw of list.messages) {
    counters.scanned++;
    const entry = asRecord(raw);
    if (!entry || entry.inbox_id !== policy.inbox || !isAgentMailMessageId(entry.message_id)) {
      throw Error("AgentMail list identity mismatch");
    }
    // Mailbox listing is a pointer only. The same authoritative Get + validation path is reused.
    try {
      const result = await processMessage(bucket, store, policy, entry.message_id, now, fetcher);
      if (result === "completed") counters.processed++;
      if (result === "rate_limited") counters.deferred++;
    } catch {
      counters.deferred++;
    }
  }

  if (!counters.deferred) {
    // An empty token marks completion. Use CAS so an overlapping sweep cannot discard progress.
    await bucket.put(checkpointKey, JSON.stringify({ anchor, lowerBound, token: list.next_page_token ?? "" }), {
      onlyIf: new Headers(checkpoint ? { "If-Match": '"' + checkpoint.etag + '"' } : { "If-None-Match": "*" }),
    });
  }
  return counters;
}
