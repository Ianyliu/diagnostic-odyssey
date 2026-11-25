import { choice, identifier, line, list, nullable, object, unique, url, validateShape, wireVersion } from "./schema.ts";
import type { ValidationResult } from "./schema.ts";

export const reportTypes = ["hourly_scout", "daily_synthesis", "weekly_strategic_review", "on_demand"] as const;
export const reportStatuses = ["completed", "no_change", "partial", "failed"] as const;
export const researchItemKinds = [
  "source_grounded_development", "cross_source_synthesis", "planning_implication", "open_question",
  "verification_needed", "strategic_hypothesis", "source_nomination", "funding_opportunity"
] as const;

export type ReportType = typeof reportTypes[number];
export type ReportStatus = typeof reportStatuses[number];
export type ResearchItemKind = typeof researchItemKinds[number];

export interface ResearchSource {
  url: string;
  publisher: string;
  locator?: string;
}

export interface ResearchItem {
  kind: ResearchItemKind;
  title: string;
  text: string;
  sources: ResearchSource[];
}

export interface ResearchReport {
  schema_version: typeof wireVersion;
  kind: "research_report";
  run_id: string;
  report_type: ReportType;
  status: ReportStatus;
  title: string;
  items: ResearchItem[];
  reason_codes: string[];
}

export type ExpandedResearchReport = Omit<ResearchReport, "schema_version"> & { schema_version: "0.2.2" };
export type ReadableResearchReport = ResearchReport | ExpandedResearchReport;

const itemTextLimit = 700;
const source = object({ url, publisher: line(120), locator: line(200) }, ["locator"]);
const item = object({ kind: choice(researchItemKinds), title: line(120), text: line(itemTextLimit), sources: list(source, 5) });

export const researchReportSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:diagnostic-odyssey:community-pulse:research-report:0.2.1",
  ...object({
    schema_version: choice([wireVersion]), kind: choice(["research_report"]),
    run_id: identifier, report_type: choice(reportTypes), status: choice(reportStatuses),
    title: line(120), items: list(item, 12), reason_codes: unique(identifier, 8)
  })
};

export function validateResearchReport(value: unknown): ValidationResult<ResearchReport> {
  return validateReportSemantics(validateShape<ResearchReport>(researchReportSchema, value));
}

export const expandedReportLimits = {
  hourly_scout: { items: 12, text: 700 },
  daily_synthesis: { items: 20, text: 1500 },
  weekly_strategic_review: { items: 40, text: 2000 },
  on_demand: { items: 40, text: 2000 }
} satisfies Record<ReportType, { items: number; text: number }>;

const expandedSchemas = Object.fromEntries(reportTypes.map(type => {
  const limits = expandedReportLimits[type];
  return [type, object({
    ...researchReportSchema.properties,
    schema_version: choice(["0.2.2"]), report_type: choice([type]),
    items: list(object({ kind: choice(researchItemKinds), title: line(120), text: line(limits.text), sources: list(source, 5) }), limits.items)
  })];
})) as Record<ReportType, ReturnType<typeof object>>;

export function validateExpandedResearchReport(value: unknown): ValidationResult<ExpandedResearchReport> {
  const type = value && typeof value === "object" && "report_type" in value ? value.report_type : undefined;
  const checkedType = reportTypes.find(candidate => candidate === type);
  if (!checkedType) return { ok: false, issues: ["$.report_type: not a permitted value"] };
  return validateReportSemantics(validateShape<ExpandedResearchReport>(expandedSchemas[checkedType], value));
}

/** For readers only. The live email intake calls the immutable v0.2.1 validator directly. */
export function validateReadableResearchReport(value: unknown): ValidationResult<ReadableResearchReport> {
  return value && typeof value === "object" && "schema_version" in value && value.schema_version === "0.2.2"
    ? validateExpandedResearchReport(value) : validateResearchReport(value);
}

function validateReportSemantics<T extends ReadableResearchReport>(result: ValidationResult<T>): ValidationResult<T> {
  if (!result.ok) return result;
  const { status, items, reason_codes: reasonCodes } = result.value;
  const issues: string[] = [];
  if (status === "completed" && items.length === 0) issues.push("$.items: a completed run requires a research item");
  if ((status === "failed" || status === "no_change") && items.length > 0) {
    issues.push("$.items: failed and no-change runs cannot contain research items");
  }
  if ((status === "failed" || status === "partial") && reasonCodes.length === 0) {
    issues.push("$.reason_codes: required for failed and partial runs");
  }
  for (const [index, reportItem] of items.entries()) {
    const path = `$.items[${index}].sources`;
    if ((reportItem.kind === "source_grounded_development" || reportItem.kind === "source_nomination")
      && reportItem.sources.length < 1) issues.push(`${path}: at least one source lead is required`);
    if (reportItem.kind === "cross_source_synthesis" && new Set(reportItem.sources.map(lead => lead.url)).size < 2) {
      issues.push(`${path}: at least two distinct leads are required`);
    }
  }
  return issues.length === 0 ? result : { ok: false, issues };
}

const canonicalText = (value: string): string => value.normalize("NFC").trim();

/** Normalizes presentation text without changing source URLs, lead order, or the original receipt bytes. */
export function normalizeResearchReport(report: ResearchReport): ResearchReport {
  return {
    schema_version: report.schema_version, kind: report.kind, run_id: report.run_id,
    report_type: report.report_type, status: report.status, title: canonicalText(report.title),
    items: report.items.map(entry => ({
      kind: entry.kind, title: canonicalText(entry.title), text: canonicalText(entry.text),
      sources: entry.sources.map(lead => ({
        url: lead.url, publisher: canonicalText(lead.publisher),
        ...(lead.locator === undefined ? {} : { locator: canonicalText(lead.locator) })
      }))
    })),
    reason_codes: [...report.reason_codes].sort()
  };
}

const legacyProposalTypes = [
  "source_nomination", "possible_change", "cross_source_relationship", "research_question", "strategic_hypothesis"
] as const;
const legacyStatuses = ["ok", "no_proposals", "partial", "error"] as const;
type LegacyProposalType = typeof legacyProposalTypes[number];
type LegacyStatus = typeof legacyStatuses[number];
interface LegacyResearch {
  title: string;
  summary: string;
  wv_relevance: string | null;
  verification_question: string;
  limitations: string[];
  proposal_type: LegacyProposalType;
  leads: { url: string; publisher: string | null; locator: string | null }[];
}
const legacySchema = object({
  schema_version: choice(["0.2.0"]), kind: choice(["research_proposals"]), status: choice(legacyStatuses),
  proposals: list(object({
    proposal_type: choice(legacyProposalTypes), title: line(120), summary: line(itemTextLimit), wv_relevance: nullable(line(400)),
    verification_question: line(400), limitations: list(line(240), 4),
    leads: list(object({ url, publisher: nullable(line(120)), locator: nullable(line(200)) }), 5)
  }), 8),
  reason_codes: unique(identifier, 8)
});
const legacyItemKind: Record<LegacyProposalType, ResearchItemKind> = {
  source_nomination: "source_nomination", possible_change: "verification_needed",
  cross_source_relationship: "strategic_hypothesis", research_question: "open_question", strategic_hypothesis: "strategic_hypothesis"
};
const legacyStatus: Record<LegacyStatus, ReportStatus> = {
  ok: "completed", no_proposals: "no_change", partial: "partial", error: "failed"
};

/** Explicit bridge for the original research-only envelope. Run metadata comes from its trusted caller. */
export function convertLegacyResearchProposals(value: unknown, run: {
  run_id: string; report_type: ReportType; title: string;
}): ValidationResult<ResearchReport> {
  const legacy = validateShape<{ status: LegacyStatus; proposals: LegacyResearch[]; reason_codes: string[] }>(legacySchema, value);
  if (!legacy.ok) return legacy;
  return validateResearchReport({
    ...run, schema_version: wireVersion, kind: "research_report", status: legacyStatus[legacy.value.status],
    items: legacy.value.proposals.flatMap(convertLegacyProposal),
    reason_codes: legacy.value.reason_codes
  });
}

function convertLegacyProposal(proposal: LegacyResearch, index: number): ResearchItem[] {
  const first: ResearchItem = {
    kind: legacyItemKind[proposal.proposal_type], title: proposal.title, text: proposal.summary,
    sources: proposal.leads.map(lead => ({
      url: lead.url, publisher: lead.publisher ?? "Publisher unverified",
      ...(lead.locator === null ? {} : { locator: lead.locator })
    }))
  };
  const items = [first];
  let current = first;
  const sections = [
    ...(proposal.wv_relevance === null ? [] : ["WV: " + proposal.wv_relevance]),
    "Check: " + proposal.verification_question,
    ...proposal.limitations.map(limit => "Limit: " + limit)
  ];
  for (const section of sections) {
    if (current.text.length + section.length + 1 <= itemTextLimit) {
      current.text += " " + section;
    } else {
      current = {
        kind: "verification_needed", title: "Verification notes for legacy proposal " + (index + 1),
        text: section, sources: []
      };
      items.push(current);
    }
  }
  return items;
}
