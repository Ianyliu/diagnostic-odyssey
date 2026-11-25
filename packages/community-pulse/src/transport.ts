import { createHash, randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";
import { InvalidMime, parseMime } from "./mime.ts";
import { validateResearchReport, type ResearchReport } from "./research.ts";

export const MAX_DELIVERY_BYTES = 256 * 1024;
export const MAX_REPORT_BYTES = 64 * 1024;
const MAX_JSON_DEPTH = 20;
const MAX_RECEIPTS = 256;
const MAX_CANDIDATES = 100;
const MAX_STORED_REPORT_BYTES = 3 * 1024 * 1024;
const MAX_DELIVERY_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const decoder = new TextDecoder("utf-8", { fatal: true });
const safeToken = /^[A-Za-z0-9_.:@+-]{1,160}$/u;
const mailboxPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_{}|~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,63}$/u;

export interface VerifiedMailMetadata {
  /** Supplied by a privileged receiver after authentication, never parsed from candidate headers. */
  boundary: string;
  deliveryId: string;
  authenticatedFrom: string;
  recipient: string;
  dmarc: "pass" | "fail" | "unknown";
  alignedDkim: boolean;
  /** Time observed at the authenticated gateway. The raw message Date header is untrusted. */
  gatewayObservedAt: string;
}

export interface EmailIntakePolicy {
  boundary: string;
  authenticatedFrom: string;
  recipient: string;
}

export type ResearchDelivery = {
  channel: "manual";
  format: "json" | "markdown";
  bytes: Uint8Array;
  /** Local operator supplied by the trusted caller, with no remote authentication implied. */
  operator: string;
} | {
  channel: "email";
  bytes: Uint8Array;
  mail: VerifiedMailMetadata | null;
};

export interface ResearchTransport<Input> {
  receive(input: Input): ResearchDelivery;
}

export interface IntakeReceipt {
  receiptId: string;
  channel: ResearchDelivery["channel"];
  receivedAt: string;
  disposition: "accepted" | "duplicate" | "quarantined";
  reasonCodes: string[];
  bytesReceived: number;
  rawSha256: string | null;
  reportSha256: string | null;
  provider: string | null;
  deliveryId: string | null;
  assertedMessageId: string | null;
  verifiedSender: string | null;
  runId: ResearchReport["run_id"] | null;
  reportType: ResearchReport["report_type"] | null;
  reportedRunStatus: ResearchReport["status"] | null;
  duplicateOf: string | null;
}

export interface ResearchIntakeState {
  version: 1;
  receipts: IntakeReceipt[];
  candidates: { receiptId: string; report: ResearchReport }[];
}

export type IntakeResult = { state: ResearchIntakeState; receipt: IntakeReceipt };

export function createResearchIntakeState(): ResearchIntakeState {
  return { version: 1, receipts: [], candidates: [] };
}

/** Offline fixture adapter. Live receivers must construct metadata from a verified trust boundary. */
export const emailTransport: ResearchTransport<{
  raw: Uint8Array; verifiedMail: VerifiedMailMetadata | null;
}> = {
  receive({ raw, verifiedMail }) {
    return { channel: "email", bytes: raw, mail: verifiedMail };
  }
};

export const manualTransport: ResearchTransport<{
  raw: Uint8Array; format: "json" | "markdown"; operator: string;
}> = {
  receive({ raw, format, operator }) {
    return { channel: "manual", bytes: raw, format, operator };
  }
};

class RejectedInput extends Error {}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizedMailbox(value: string | null): string | null {
  if (!value || value.length > 400 || [...value].some(character => character.charCodeAt(0) < 32)) return null;
  const simple = value.trim();
  const displayName = /^(?:[^<>,"]{1,128}|"[^"\\]{1,128}")\s*<([^<>,]+)>$/u.exec(simple);
  const mailbox = displayName?.[1] ?? simple;
  if (!mailboxPattern.test(mailbox)) return null;
  const domain = mailbox.lastIndexOf("@") + 1;
  return mailbox.slice(0, domain) + mailbox.slice(domain).toLowerCase();
}

function checkTrustedMail(
  metadata: VerifiedMailMetadata | null,
  policy: EmailIntakePolicy | undefined,
  receivedAt: string
): { boundary: string; deliveryId: string; sender: string } {
  if (!metadata || !policy ||
    !safeToken.test(policy.boundary) || !safeToken.test(metadata.deliveryId) ||
    metadata.boundary !== policy.boundary || metadata.dmarc !== "pass" ||
    metadata.alignedDkim !== true) {
    throw new RejectedInput("unauthenticated_mail");
  }
  const sender = normalizedMailbox(metadata.authenticatedFrom);
  const recipient = normalizedMailbox(metadata.recipient);
  if (!sender || !recipient ||
    sender !== normalizedMailbox(policy.authenticatedFrom) ||
    recipient !== normalizedMailbox(policy.recipient)) {
    throw new RejectedInput("mail_identity_denied");
  }
  const delta = Date.parse(receivedAt) - Date.parse(metadata.gatewayObservedAt);
  if (!Number.isFinite(delta) || delta > MAX_DELIVERY_AGE_MS || delta < -MAX_CLOCK_SKEW_MS) {
    throw new RejectedInput("mail_outside_delivery_window");
  }
  return { boundary: policy.boundary, deliveryId: metadata.deliveryId, sender };
}

function parseJson(text: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new RejectedInput("invalid_json");
  }
  // Parsing validates token syntax. A bounded token pass then detects duplicate object keys that
  // JSON.parse would otherwise silently collapse, including equivalent escaped key names.
  const tokens = /"(?:[^"\\]|\\[\s\S])*"|[[\]{},:]/gu;
  const stack: (Set<string> | null)[] = [];
  for (const match of text.matchAll(tokens)) {
    const token = match[0];
    if (token === "{" || token === "[") {
      stack.push(token === "{" ? new Set() : null);
      if (stack.length > MAX_JSON_DEPTH) throw new RejectedInput("json_depth_limit");
    } else if (token === "}" || token === "]") {
      stack.pop();
    } else if (token.startsWith('"')) {
      let next = (match.index ?? 0) + token.length;
      while (/\s/u.test(text[next] ?? "")) next += 1;
      if (text[next] !== ":") continue;
      const key = JSON.parse(token) as string;
      const keys = stack.at(-1);
      if (!keys || keys.has(key) || ["__proto__", "prototype", "constructor"].includes(key)) {
        throw new RejectedInput("invalid_json_key");
      }
      keys.add(key);
    }
  }
  return value;
}

function field(line: string, expected: string): string {
  const prefix = expected + ": ";
  if (!line.startsWith(prefix)) throw new RejectedInput("invalid_plain_report");
  return line.slice(prefix.length).trim();
}

function parsePlainReport(text: string): unknown {
  const [header, ...sections] = text.split("\n--\n");
  const lines = header?.split("\n") ?? [];
  if (lines.length < 5 || lines[0] !== "Community Pulse Research Report v0.2.1") {
    throw new RejectedInput("unstructured_report");
  }
  const reasonCodes = lines.slice(5).map(line => field(line, "Reason-Code"));
  const items = sections.map(section => {
    const itemLines = section.split("\n");
    const textAt = itemLines.indexOf("Text:");
    if (textAt < 2) throw new RejectedInput("invalid_plain_report");
    const sources = itemLines.slice(2, textAt).map(line => {
      const parts = field(line, "Source").split(" | ");
      if (parts.length !== 2 && parts.length !== 3) throw new RejectedInput("invalid_plain_report");
      const [url, publisher, locator] = parts;
      return locator === undefined ? { url, publisher } : { url, publisher, locator };
    });
    return {
      kind: field(itemLines[0]!, "Item-Type"),
      title: field(itemLines[1]!, "Title"),
      sources,
      text: itemLines.slice(textAt + 1).join("\n").trim()
    };
  });
  return {
    schema_version: "0.2.1",
    kind: "research_report",
    run_id: field(lines[1]!, "Run-ID"),
    report_type: field(lines[2]!, "Report-Type"),
    status: field(lines[3]!, "Status"),
    title: field(lines[4]!, "Title"),
    reason_codes: reasonCodes,
    items
  };
}

function parseBody(text: string, mode: "json" | "text"): ResearchReport {
  const normalized = text.replaceAll("\r\n", "\n").trim();
  const fenced = mode === "text" ? /^\x60{3}json[ \t]*\n([\s\S]*?)\n\x60{3}$/u.exec(normalized) : null;
  const parsed = mode === "json" || normalized.startsWith("{") || fenced
    ? parseJson(fenced?.[1] ?? normalized)
    : parsePlainReport(normalized);
  const validated = validateResearchReport(parsed);
  if (!validated.ok) throw new RejectedInput("invalid_report_schema");
  return validated.value;
}

function extractReport(delivery: ResearchDelivery, receipt: IntakeReceipt): ResearchReport {
  if (delivery.channel === "manual") {
    if (delivery.bytes.byteLength > MAX_REPORT_BYTES) throw new RejectedInput("oversized_report");
    let text: string;
    try {
      text = decoder.decode(delivery.bytes);
    } catch {
      throw new RejectedInput("invalid_utf8");
    }
    return parseBody(text, delivery.format === "json" ? "json" : "text");
  }

  let message;
  try {
    message = parseMime(delivery.bytes, MAX_REPORT_BYTES);
  } catch (error) {
    if (error instanceof InvalidMime) throw new RejectedInput(error.message);
    throw error;
  }
  receipt.assertedMessageId = message.assertedMessageId;
  if (normalizedMailbox(message.from) !== receipt.verifiedSender) {
    throw new RejectedInput("message_sender_mismatch");
  }
  const reports = message.bodies.filter(body => body.mediaType === "application/json" ||
    /^(?:\{|\x60{3}|Community Pulse Research Report v0\.2\.1)/u.test(body.text.trim()));
  if (reports.length !== 1) {
    throw new RejectedInput(reports.length ? "ambiguous_report_parts" : "unstructured_report");
  }
  const report = reports[0]!;
  return parseBody(report.text, report.mediaType === "application/json" ? "json" : "text");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return "{" + keys.map(key => JSON.stringify(key) + ":" + canonicalJson(object[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function duplicate(receipt: IntakeReceipt, previous: IntakeReceipt): void {
  receipt.disposition = "duplicate";
  receipt.reasonCodes = ["already_received"];
  receipt.duplicateOf = previous.duplicateOf ?? previous.receiptId;
  receipt.reportSha256 = previous.reportSha256;
  receipt.runId = previous.runId;
  receipt.reportType = previous.reportType;
  receipt.reportedRunStatus = previous.reportedRunStatus;
}

/** Process one inert delivery. Callers serialize persisted state updates outside this pure store. */
export function ingestResearchDelivery(
  delivery: ResearchDelivery,
  state: ResearchIntakeState,
  options: { emailPolicy?: EmailIntakePolicy; clock?: () => Date; receiptId?: () => string } = {}
): IntakeResult {
  const receivedAt = (options.clock ?? (() => new Date()))().toISOString();
  const receipt: IntakeReceipt = {
    receiptId: (options.receiptId ?? randomUUID)(),
    channel: delivery.channel,
    receivedAt,
    disposition: "quarantined",
    reasonCodes: [],
    bytesReceived: delivery.bytes.byteLength,
    rawSha256: null,
    reportSha256: null,
    provider: null,
    deliveryId: null,
    verifiedSender: null,
    assertedMessageId: null,
    runId: null,
    reportType: null,
    reportedRunStatus: null,
    duplicateOf: null
  };
  let report: ResearchReport | undefined;
  try {
    if (delivery.bytes.byteLength > MAX_DELIVERY_BYTES) throw new RejectedInput("oversized_delivery");
    receipt.rawSha256 = sha256(delivery.bytes);
    if (!delivery.bytes.byteLength) throw new RejectedInput("empty_delivery");

    if (delivery.channel === "email") {
      const verified = checkTrustedMail(delivery.mail, options.emailPolicy, receivedAt);
      receipt.provider = verified.boundary;
      receipt.deliveryId = verified.deliveryId;
      receipt.verifiedSender = verified.sender;
    } else {
      if (!safeToken.test(delivery.operator)) throw new RejectedInput("invalid_operator");
      receipt.provider = delivery.operator;
    }

    const previousDelivery = receipt.deliveryId && state.receipts.find(previous =>
      previous.channel === receipt.channel &&
      previous.provider === receipt.provider &&
      previous.deliveryId === receipt.deliveryId
    );
    if (previousDelivery) {
      if (previousDelivery.rawSha256 !== receipt.rawSha256) throw new RejectedInput("delivery_id_conflict");
      return {
        state,
        receipt: previousDelivery.disposition === "accepted"
          ? { ...previousDelivery, disposition: "duplicate", reasonCodes: ["already_received"], duplicateOf: previousDelivery.receiptId }
          : previousDelivery
      };
    }

    report = extractReport(delivery, receipt);
    receipt.reportSha256 = sha256(canonicalJson(report));
    receipt.runId = report.run_id;
    receipt.reportType = report.report_type;
    receipt.reportedRunStatus = report.status;

    const previousContent = state.receipts.find(previous =>
      previous.disposition === "accepted" && previous.reportSha256 === receipt.reportSha256
    );
    if (previousContent) {
      duplicate(receipt, previousContent);
    } else if (state.receipts.some(previous => previous.disposition === "accepted" && previous.runId === report?.run_id)) {
      throw new RejectedInput("run_id_conflict");
    } else {
      const candidateBytes = new TextEncoder().encode(JSON.stringify([...state.candidates, { receiptId: receipt.receiptId, report }]));
      if (state.candidates.length >= MAX_CANDIDATES || candidateBytes.byteLength > MAX_STORED_REPORT_BYTES) {
        throw new RejectedInput("local_candidate_store_limit");
      }
      receipt.disposition = "accepted";
    }
  } catch (error) {
    if (!(error instanceof RejectedInput)) throw error;
    receipt.reasonCodes = [error.message];
    receipt.disposition = "quarantined";
  }

  if (state.receipts.length >= MAX_RECEIPTS) {
    return {
      state,
      receipt: { ...receipt, disposition: "quarantined", reasonCodes: ["local_receipt_store_limit"], duplicateOf: null }
    };
  }
  return {
    receipt,
    state: {
      version: state.version,
      receipts: [...state.receipts, receipt],
      candidates: receipt.disposition === "accepted" && report
        ? [...state.candidates, { receiptId: receipt.receiptId, report }]
        : state.candidates
    }
  };
}
