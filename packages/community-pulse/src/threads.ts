import { choice, count, instant, line, list, nullable, object, uuid, validateShape, date } from "./schema.ts";
import { receiptReference } from "./history.ts";

export const threadEntryKinds = ["membership", "evidence", "question", "milestone", "correction"] as const;
export const threadEvidenceStates = ["unverified", "corroborated", "unresolved", "corrected"] as const;
export const threadReviewStates = ["pending", "under_review", "independently_reviewed"] as const;

export interface ThreadCitation {
  ref: string;
  digest: string;
  item_index: number;
}

export interface ThreadEntryDraft {
  kind: typeof threadEntryKinds[number];
  title: string;
  note: string;
  evidence_status: typeof threadEvidenceStates[number];
  review_status: typeof threadReviewStates[number];
  citations: ThreadCitation[];
  due_on: string | null;
  supersedes: string | null;
}

export interface ThreadEntry extends ThreadEntryDraft {
  id: string;
  revision: number;
  at: string;
  reviewer: string;
}

export interface ResearchThread {
  schema_version: "1";
  id: string;
  topic: string;
  description: string;
  timeline: ThreadEntry[];
}

export type ThreadProjection = Omit<ResearchThread, "timeline"> & {
  timeline: (Omit<ThreadEntry, "citations"> & {
    citations: (ThreadCitation & { availability: "available" | "unavailable" })[];
  })[];
};

const citation = object({
  ref: { type: "string", minLength: 15, maxLength: 134, pattern: receiptReference.source },
  digest: { type: "string", minLength: 64, maxLength: 64, pattern: "^[a-f0-9]{64}$" },
  item_index: count(0, 39),
});
const entry = object({
  id: uuid, revision: count(1, 12), at: instant, reviewer: line(80),
  kind: choice(threadEntryKinds), title: line(120), note: line(700),
  evidence_status: choice(threadEvidenceStates), review_status: choice(threadReviewStates),
  citations: list(citation, 2), due_on: nullable(date), supersedes: nullable(uuid),
});
const threadSchema = object({
  schema_version: choice(["1"]), id: uuid, topic: line(120), description: line(320),
  timeline: list(entry, 12),
});

export function validateResearchThread(value: unknown) {
  const result = validateShape<ResearchThread>(threadSchema, value);
  if (!result.ok) return result;
  const seen = new Set<string>();
  const refs = new Set<string>();
  for (const [index, row] of result.value.timeline.entries()) {
    const prior = result.value.timeline[index - 1];
    if (seen.has(row.id) || row.revision !== index + 1 || (prior && Date.parse(prior.at) > Date.parse(row.at)) ||
      (row.kind === "membership" && row.citations.length < 1) ||
      (row.kind === "correction" && row.supersedes === null) ||
      (row.kind !== "milestone" && row.due_on !== null) ||
      (row.supersedes !== null && !seen.has(row.supersedes))) {
      return { ok: false as const, issues: ["$.timeline[" + index + "]: invalid revision or reference"] };
    }
    seen.add(row.id);
    for (const lead of row.citations) refs.add(lead.ref);
  }
  return refs.size > 12 ? { ok: false as const, issues: ["$.timeline: too many distinct reports"] } : result;
}
