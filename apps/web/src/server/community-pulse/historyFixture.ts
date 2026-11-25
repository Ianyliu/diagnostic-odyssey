import { createHash } from "node:crypto";
import { syntheticResearchReports } from "../../../../../packages/community-pulse/src/fixtures.ts";
import { inspectResearchReportBytes, type IntakeReceipt } from "../../../../../packages/community-pulse/src/transport.ts";
import type { ThreadEntryDraft } from "../../../../../packages/community-pulse/src/threads.ts";
import { MemoryR2 } from "../../../../pulse-worker/src/offlineBucket.ts";
import { createIntakeStore } from "../../../../pulse-worker/src/storage.ts";
import { serveResearchHistory } from "../../../../pulse-worker/src/historyEndpoint.ts";
import { createThreadStore } from "../../../../pulse-worker/src/threads.ts";

const clock = new Date("2026-11-25T18:00:00.000Z");
const fixtureToken = "synthetic-history-cursor-reproducible-key-fixtures-only";
const threadId = "bb237c83-8359-4ec2-a09d-db3b036d75a9";

async function seed() {
  const bucket = new MemoryR2();
  bucket.trackReads = false;
  const store = createIntakeStore(bucket);
  const fixture = syntheticResearchReports[0];
  const noChange = syntheticResearchReports[1];
  if (!fixture || !noChange) throw Error("Missing research history fixtures");

  // A complete synthetic archive exercises the second page and retains operational receipts.
  for (let index = 0; index < 42; index++) {
    const operational = index % 4 === 0;
    const archived = operational ? noChange : fixture;
    const title = operational ? "Synthetic scheduled check" :
      ["Clinic evening access", "Coverage verification", "Cross-county referrals"][index % 3] + " — fixture " + String(index + 1).padStart(2, "0");
    const expanded = index === 1;
    const candidate = {
      ...archived, title, run_id: "research-history-fixture-" + index,
      schema_version: expanded ? "0.2.2" : archived.schema_version,
      report_type: expanded ? "weekly_strategic_review" : archived.report_type,
      items: expanded ? [...archived.items, ...Array.from({ length: 13 }, (_, offset) => ({
        kind: "open_question", title: "Synthetic research question " + (offset + 1),
        text: "What documented conditions would establish the milestone in this fictional case?", sources: [],
      }))] : archived.items,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(candidate));
    const parsed = inspectResearchReportBytes(bytes);
    if (!parsed.ok) throw Error("Bad history fixture");
    const report = parsed.value;
    const receivedAt = new Date(clock.getTime() - (index + 1) * 3_600_000);
    bucket.clock = receivedAt;
    const receipt: IntakeReceipt = {
      receiptId: "fixture-history-" + index, channel: "email", receivedAt: receivedAt.toISOString(),
      disposition: "accepted", reasonCodes: [], bytesReceived: bytes.byteLength,
      rawSha256: createHash("sha256").update(bytes).digest("hex"), reportSha256: parsed.digest,
      provider: "synthetic-history", deliveryId: "synthetic-history-" + index, assertedMessageId: null,
      verifiedSender: null, runId: report.run_id, reportType: report.report_type, reportedRunStatus: report.status,
      duplicateOf: null,
    };
    const saved = await store.saveDelivery(receipt, report);
    if (saved.disposition !== "accepted") throw Error("Synthetic history report was not stored");
  }

  const history = await store.readHistory(clock, { cursor: null, filters: { mode: "substantive",
    type: null, outcome: null, from: null, to: null } }, fixtureToken);
  const reference = history?.records[0]?.ref;
  const detail = reference ? await store.readReport(clock, reference) : null;
  if (!detail) throw Error("History fixture unavailable");
  let revisionId = 0;
  const threads = createThreadStore(bucket, async ref => store.readReport(clock, ref),
    () => `eee61c21-2a98-423e-b881-${String(++revisionId).padStart(12, "0")}`);
  await threads.create("Evening diagnostic access", "Fictional review of service hours, cross-county referrals, and policy milestones.", threadId);
  const base = { evidence_status: "unresolved", review_status: "under_review", citations: [], due_on: null, supersedes: null } as const;
  const draft = (change: Partial<ThreadEntryDraft> & Pick<ThreadEntryDraft, "kind" | "title" | "note">): ThreadEntryDraft =>
    ({ ...base, citations: [], ...change });
  const member = await threads.append(threadId, 0, "Fixture reviewer", draft({
    kind: "membership", title: "Link a research item", note: "Reviewer added this synthetic lead for investigation.",
    evidence_status: "unverified", review_status: "pending",
    citations: [{ ref: detail.ref, digest: detail.digest, item_index: 0 }],
  }), clock);
  if (!member?.timeline[0]) throw Error("Fixture membership failed");
  await threads.append(threadId, 1, "Fixture reviewer", draft({
    kind: "question", title: "Who qualifies for an evening referral?",
    note: "The fictional notice does not specify eligibility for out-of-county patients.",
  }), clock);
  await threads.append(threadId, 2, "Fixture reviewer", draft({
    kind: "milestone", title: "Policy clarification due",
    note: "Check for an approved schedule before interpreting the change as effective.", due_on: "2026-12-10",
  }), clock);
  await threads.append(threadId, 3, "Fixture reviewer", draft({
    kind: "correction", title: "Replace the initial interpretation",
    note: "The synthetic notice describes a proposal. The effective date remains unconfirmed.",
    evidence_status: "corrected", supersedes: member.timeline[0].id,
  }), clock);
  const laterReference = history?.records[2]?.ref;
  const archived = laterReference ? await store.readReport(clock, laterReference) : null;
  if (!archived) throw Error("Archived fixture missing");
  await threads.append(threadId, 4, "Fixture reviewer", draft({
    kind: "evidence", title: "Record the original coverage citation",
    note: "The fixture source is now unavailable. The reviewer note remains in the thread.",
    evidence_status: "unverified",
    citations: [{ ref: archived.ref, digest: archived.digest, item_index: 0 }],
  }), clock);
  const archivedKey = "s0/runs/" + createHash("sha256").update(archived.report.run_id).digest("hex");
  await bucket.delete([archivedKey]);
  return { store, threads };
}

// A fixed synthetic clock and identifiers keep cursors and citations stable across preview instances.
let demo: ReturnType<typeof seed> | undefined;
function fixtureStore() {
  demo ??= seed().catch(error => { demo = undefined; throw error; });
  return demo;
}

export async function readFixtureHistory(request: Request, upstream: URL) {
  const { store } = await fixtureStore();
  const headers = new Headers(request.headers);
  headers.set("Authorization", "Bearer " + fixtureToken);
  return serveResearchHistory(new Request(upstream, { headers }), true, fixtureToken, () => store, clock);
}

export async function readFixtureThread() {
  const { threads } = await fixtureStore();
  return threads.read(threadId);
}
