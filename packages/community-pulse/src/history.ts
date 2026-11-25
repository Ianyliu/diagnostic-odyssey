import { reportStatuses, reportTypes, type ReadableResearchReport, type ReportStatus, type ReportType } from "./research.ts";
import { validDate } from "./schema.ts";

export const historyPageSize = 25;
export const receiptReference = /^\d{13}-[A-Za-z0-9_-]{1,120}$/u;
export const historyCursor = /^[A-Za-z0-9_-]{1,2700}\.[a-f0-9]{64}$/u;
export const historyOutcomes = [...reportStatuses, "duplicate", "quarantined"] as const;
export type HistoryOutcome = typeof historyOutcomes[number];

export interface HistoryFilters {
  mode: "substantive" | "all";
  type: ReportType | null;
  outcome: HistoryOutcome | null;
  from: string | null;
  to: string | null;
}

export interface HistoryQuery { filters: HistoryFilters; cursor: string | null }

export interface ResearchSummary {
  ref: string;
  received_at: string;
  disposition: "accepted" | "duplicate" | "quarantined";
  report_type: ReportType | null;
  outcome: ReportStatus | null;
  title: string | null;
  item_count: number | null;
}

export interface ResearchHistoryPage {
  schema_version: "1";
  records: ResearchSummary[];
  next_cursor: string | null;
  as_of: string;
  latest_ref: string | null;
}

export interface ResearchDetail {
  schema_version: "1";
  ref: string;
  received_at: string;
  digest: string;
  report: ReadableResearchReport;
}

function oneOf<T extends string>(values: readonly T[], candidate: string | null): candidate is T {
  return values.some(value => value === candidate);
}

export function parseHistoryQuery(query: URLSearchParams): HistoryQuery | null {
  const keys = new Set<string>();
  for (const key of query.keys()) {
    if (keys.has(key) || !["mode", "type", "outcome", "from", "to", "cursor"].includes(key)) return null;
    keys.add(key);
  }
  const mode = query.get("mode") ?? "substantive";
  const type = query.get("type");
  const outcome = query.get("outcome");
  const from = query.get("from");
  const to = query.get("to");
  const cursor = query.get("cursor");
  if ((mode !== "substantive" && mode !== "all") ||
      (type !== null && !oneOf(reportTypes, type)) || (outcome !== null && !oneOf(historyOutcomes, outcome)) ||
      (from !== null && !validDate(from)) || (to !== null && !validDate(to)) ||
      (from !== null && to !== null && from > to) || (cursor !== null && !historyCursor.test(cursor))) return null;
  return { filters: { mode, type, outcome, from, to }, cursor };
}
