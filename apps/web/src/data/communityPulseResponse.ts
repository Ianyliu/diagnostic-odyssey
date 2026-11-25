import {
  validateEventSnapshot,
  validateResearchReport,
  type EventSnapshot,
  type ResearchReport,
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
    !displayText(r.received_at, 30) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(r.received_at) ||
    !Number.isFinite(Date.parse(r.received_at)) ||
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

export function parseCommunityPulseResponse(value: unknown): CommunityPulseResponse | null {
  if (!isRecord(value) || value.schema_version !== "0.2.1" ||
    !Array.isArray(value.inbox) || value.inbox.length > 80) return null;
  const snapshot = validateEventSnapshot(value.snapshot);
  if (!snapshot.ok) return null;
  const inbox: InboxEntry[] = [];
  const ids = new Set<string>();
  for (const item of value.inbox) {
    const entry = parseEntry(item);
    if (!entry || ids.has(entry.receipt.ingestion_id)) return null;
    ids.add(entry.receipt.ingestion_id);
    inbox.push(entry);
  }
  return {schema_version: "0.2.1", snapshot: snapshot.value, inbox};
}
