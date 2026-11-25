import { receiptReference, historyCursor, historyPageSize, type ResearchHistoryPage, type ResearchDetail, type ResearchSummary }
  from "../../../../packages/community-pulse/src/history.ts";
import { reportStatuses, reportTypes, validateReadableResearchReport } from "../../../../packages/community-pulse/src/research.ts";
import { validInstant } from "../../../../packages/community-pulse/src/schema.ts";
import { validateResearchThread, type ThreadProjection } from "../../../../packages/community-pulse/src/threads.ts";
import { parseStagingMetrics, type StagingInboxMetrics } from "./communityPulseResponse.ts";

export interface ResearchHealth {
  schema_version: "1";
  metrics: StagingInboxMetrics;
  latest_ref: string | null;
  latest_at: string | null;
  latest_substantive_ref: string | null;
  last_substantive_at: string | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
function reference(value: unknown): value is string {
  return typeof value === "string" && receiptReference.test(value);
}
function nullableReference(value: unknown): value is string | null {
  return value === null || reference(value);
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && validInstant(value);
}

export function parseResearchHealth(value: unknown): ResearchHealth | null {
  if (!record(value) || value.schema_version !== "1" || !nullableReference(value.latest_ref) ||
      !nullableReference(value.latest_substantive_ref) || !(value.latest_at === null || timestamp(value.latest_at)) ||
      !(value.last_substantive_at === null || timestamp(value.last_substantive_at))) return null;
  const metrics = parseStagingMetrics(value.metrics);
  return metrics ? {
    schema_version: "1", metrics, latest_ref: value.latest_ref, latest_at: value.latest_at,
    latest_substantive_ref: value.latest_substantive_ref, last_substantive_at: value.last_substantive_at,
  } : null;
}

function parseSummary(value: unknown): ResearchSummary | null {
  if (!record(value) || !reference(value.ref) || !timestamp(value.received_at) ||
    (value.disposition !== "accepted" && value.disposition !== "duplicate" && value.disposition !== "quarantined")) return null;
  const type = reportTypes.find(candidate => value.report_type === candidate) ?? null;
  const outcome = reportStatuses.find(candidate => value.outcome === candidate) ?? null;
  if (value.disposition === "accepted" ? !type || !outcome : value.report_type !== null || value.outcome !== null) return null;
  if (!(value.title === null || (typeof value.title === "string" && value.title.length > 0 && value.title.length <= 120 &&
    !/[\p{Cc}\p{Cf}]/u.test(value.title)))) return null;
  if (!(value.item_count === null || (typeof value.item_count === "number" && Number.isInteger(value.item_count) &&
    value.item_count >= 0 && value.item_count <= 40))) return null;
  if (value.disposition !== "accepted" && (value.title !== null || value.item_count !== null)) return null;
  return { ref: value.ref, received_at: value.received_at, disposition: value.disposition,
    report_type: type, outcome, title: value.title, item_count: value.item_count };
}

export function parseResearchHistory(value: unknown): ResearchHistoryPage | null {
  if (!record(value) || value.schema_version !== "1" || !timestamp(value.as_of) || !nullableReference(value.latest_ref) ||
    !(value.next_cursor === null || (typeof value.next_cursor === "string" && historyCursor.test(value.next_cursor))) ||
    !Array.isArray(value.records) || value.records.length > historyPageSize) return null;
  const records: ResearchSummary[] = [];
  for (const row of value.records) {
    const item = parseSummary(row);
    if (!item || records.some(existing => existing.ref === item.ref)) return null;
    records.push(item);
  }
  if (value.latest_ref !== (records[0]?.ref ?? null)) return null;
  return { schema_version: "1", records, as_of: value.as_of, next_cursor: value.next_cursor, latest_ref: value.latest_ref };
}

export function parseResearchDetail(value: unknown): ResearchDetail | null {
  if (!record(value) || value.schema_version !== "1" || !reference(value.ref) || !timestamp(value.received_at) ||
    typeof value.digest !== "string" || !/^[a-f0-9]{64}$/u.test(value.digest)) return null;
  const report = validateReadableResearchReport(value.report);
  return report.ok ? { schema_version: "1", ref: value.ref, received_at: value.received_at,
    digest: value.digest, report: report.value } : null;
}

export function parseThreadProjection(value: unknown): ThreadProjection | null {
  if (!record(value) || !Array.isArray(value.timeline) || value.timeline.length > 12) return null;
  const availability: ("available" | "unavailable")[][] = [];
  const timeline: unknown[] = [];
  for (const row of value.timeline) {
    if (!record(row) || !Array.isArray(row.citations) || row.citations.length > 2) return null;
    const states: ("available" | "unavailable")[] = [];
    const citations: unknown[] = [];
    for (const cite of row.citations) {
      if (!record(cite) || (cite.availability !== "available" && cite.availability !== "unavailable")) return null;
      const { availability: state, ...reference } = cite;
      states.push(state);
      citations.push(reference);
    }
    availability.push(states);
    timeline.push({ ...row, citations });
  }
  const checked = validateResearchThread({ ...value, timeline });
  return checked.ok ? { ...checked.value, timeline: checked.value.timeline.map((row, index) => ({
    ...row, citations: row.citations.map((cite, citeIndex) => ({
      ...cite, availability: availability[index]?.[citeIndex] ?? "unavailable",
    })),
  })) } : null;
}
