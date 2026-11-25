import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { syntheticResearchReports } from "../../../packages/community-pulse/src/fixtures.ts";
import { inspectResearchReportBytes, type IntakeReceipt } from "../../../packages/community-pulse/src/transport.ts";
import type { HistoryFilters } from "../../../packages/community-pulse/src/history.ts";
import type { ThreadEntryDraft } from "../../../packages/community-pulse/src/threads.ts";
import { createIntakeStore } from "../src/storage.ts";
import { serveResearchHistory } from "../src/historyEndpoint.ts";
import { MemoryR2 } from "../src/offlineBucket.ts";
import { createThreadStore } from "../src/threads.ts";

const token = "private-history-synthetic-bearer-and-cursor-test-only";
const day = 86_400_000;
const now = new Date("2026-11-25T18:00:00Z");
const filters: HistoryFilters = { mode: "substantive", type: null, outcome: null, from: null, to: null };

async function add(bucket: MemoryR2, store: ReturnType<typeof createIntakeStore>, id: number,
  options: { noChange?: boolean; expanded?: boolean; at?: Date } = {}) {
  const base = syntheticResearchReports[options.noChange ? 1 : 0]!;
  const candidate = { ...base, run_id: "fixture-seed-" + id, title: "History fixture " + id,
    schema_version: options.expanded ? "0.2.2" : "0.2.1" };
  const body = new TextEncoder().encode(JSON.stringify(candidate));
  const checked = inspectResearchReportBytes(body);
  assert.ok(checked.ok);
  const report = checked.value;
  bucket.clock = options.at ?? new Date(now.getTime() - (id + 1) * 60_000);
  const receipt: IntakeReceipt = {
    receiptId: "fixture-" + id, channel: "email", receivedAt: bucket.clock.toISOString(), disposition: "accepted",
    reasonCodes: [], bytesReceived: body.byteLength, rawSha256: createHash("sha256").update(body).digest("hex"),
    reportSha256: checked.digest, provider: "fixture-mail", deliveryId: "fixture-mail-" + id, assertedMessageId: null,
    verifiedSender: null, runId: report.run_id, reportType: report.report_type, reportedRunStatus: report.status,
    duplicateOf: null,
  };
  assert.equal((await store.saveDelivery(receipt, report)).disposition, "accepted");
  return report;
}

test("bounded summary pagination excludes new inserts and honors filter and cursor scope", async () => {
  const bucket = new MemoryR2();
  const store = createIntakeStore(bucket);
  for (let id = 0; id < 39; id++) await add(bucket, store, id, { noChange: id % 5 === 0 });
  bucket.readKeys = [];
  const first = await store.readHistory(now, { filters, cursor: null }, token);
  assert.equal(first?.records.length, 25);
  assert.ok(first?.next_cursor);
  assert.ok(first.records.every(row => row.outcome === "completed"));
  assert.equal(bucket.readKeys.length, 0, "summary should only list metadata");
  await add(bucket, store, 50, { at: new Date(now.getTime() + 1000) });
  const later = new Date(now.getTime() + 2000);
  const second = await store.readHistory(later, { filters, cursor: first.next_cursor }, token);
  assert.equal(second?.as_of, first.as_of);
  assert.equal(second?.records.length, 6);
  assert.equal(second.next_cursor, null);
  assert.equal(new Set([...first.records, ...second.records].map(record => record.ref)).size, 31);
  assert.ok(!second.records.some(row => row.title === "History fixture 50"));
  assert.equal((await store.readHistory(later, { filters, cursor: null }, token))?.records[0]?.title, "History fixture 50");
  assert.equal(await store.readHistory(later, { filters: { ...filters, mode: "all" }, cursor: first.next_cursor }, token), null);
  assert.equal(await store.readHistory(later, { filters, cursor: "a" + first.next_cursor }, token), null);
  assert.equal(await store.readHistory(new Date(now.getTime() + day), { filters, cursor: first.next_cursor }, token), null);
  const noChange = await store.readHistory(now, { cursor: null, filters: {
    ...filters, mode: "all", type: "hourly_scout", outcome: "no_change", from: "2026-11-25", to: "2026-11-25",
  } }, token);
  assert.equal(noChange?.records.length, 8);
  assert.equal((await store.readHistory(now, { cursor: null, filters: { ...filters, to: "2026-11-24" } }, token))?.records.length, 0);
});

test("health does not fetch report bodies and separates successful checks from substantive deliveries", async () => {
  const bucket = new MemoryR2();
  const store = createIntakeStore(bucket);
  await add(bucket, store, 1, { expanded: true });
  await add(bucket, store, 0, { noChange: true });
  bucket.readKeys = [];
  const health = await store.readHistoryHealth(now);
  assert.equal(health.data.metrics.last_success_at, "2026-11-25T17:59:00.000Z");
  assert.equal(health.data.last_substantive_at, "2026-11-25T17:58:00.000Z");
  assert.equal(health.data.metrics.runs.hourly_scout.no_change, 1);
  assert.deepEqual(bucket.readKeys, ["s0/progress.json"]);
  assert.equal((await store.readHistoryHealth(new Date(now.getTime() + 1000))).etag, health.etag);
});

test("lazy detail reads both declared versions, enforces retention, and refuses corrupted digests", async () => {
  const bucket = new MemoryR2();
  const store = createIntakeStore(bucket);
  const expanded = await add(bucket, store, 0, { expanded: true });
  await add(bucket, store, 1);
  const page = await store.readHistory(now, { filters, cursor: null }, token);
  const [first, second] = page?.records ?? [];
  assert.ok(first && second);
  assert.equal((await store.readReport(now, first.ref))?.report.schema_version, "0.2.2");
  assert.equal((await store.readReport(now, second.ref))?.report.schema_version, "0.2.1");
  assert.equal(await store.readReport(new Date(now.getTime() + 31 * day), first.ref), null);
  const key = "s0/runs/" + createHash("sha256").update(expanded.run_id).digest("hex");
  const target = bucket.objects.get(key)!;
  target.body = target.body.replace("History fixture 0", "Altered fixture 0");
  await assert.rejects(store.readReport(now, first.ref), /failed verification/u);
});

test("history HTTP rejects unauthenticated, disabled, malformed and non-GET requests before R2 access", async () => {
  const url = "https://example.invalid/v1/history";
  const auth = { Authorization: "Bearer " + token };
  function noStorage(): never { assert.fail("Unexpected storage access"); }
  for (const [request, enabled, status] of [
    [new Request(url, { headers: auth }), false, 404],
    [new Request(url), true, 401],
    [new Request(url, { headers: auth, method: "POST" }), true, 405],
    [new Request(url + "?type=on_demand&type=on_demand", { headers: auth }), true, 400],
    [new Request(url + "/report?ref=outside", { headers: auth }), true, 400],
  ] as const) {
    const result = await serveResearchHistory(request, enabled, token, noStorage, now);
    assert.equal(result.status, status);
    assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  }
});

test("reviewer threads persist revisions, reject stale updates and mark expired citations unavailable", async () => {
  const bucket = new MemoryR2();
  const history = createIntakeStore(bucket);
  await add(bucket, history, 0);
  const ref = (await history.readHistory(now, { filters, cursor: null }, token))?.latest_ref;
  assert.ok(ref);
  const detail = await history.readReport(now, ref);
  assert.ok(detail);
  let current = now;
  const store = () => createThreadStore(bucket, ref => history.readReport(current, ref));
  const created = await store().create("Synthetic topic", "A fictional reviewer thread.");
  assert.ok(created);
  const first: ThreadEntryDraft = {
    kind: "membership", title: "Add a candidate", note: "Reviewer selected a fictional item.",
    evidence_status: "unverified", review_status: "pending", due_on: null, supersedes: null,
    citations: [{ ref, digest: detail.digest, item_index: 0 }],
  };
  const invalid = { ...first, citations: [{ ref, digest: "0".repeat(64), item_index: 0 }] };
  await assert.rejects(store().append(created.id, 0, "Fixture reviewer", invalid, now), /citation is unavailable/u);
  const added = await store().append(created.id, 0, "Fixture reviewer", first, now);
  assert.ok(added?.timeline[0]);
  const correction = { ...first, kind: "correction" as const, supersedes: added.timeline[0].id, citations: [] };
  const parallel = await Promise.all([
    store().append(created.id, 1, "Reviewer A", correction, now),
    store().append(created.id, 1, "Reviewer B", correction, now),
  ]);
  assert.equal(parallel.filter(Boolean).length, 1);
  assert.equal((await store().read(created.id))?.timeline[0]?.citations[0]?.availability, "available");
  current = new Date(now.getTime() + 31 * day);
  const expired = await store().read(created.id);
  assert.equal(expired?.timeline.length, 2);
  assert.equal(expired.timeline[1]?.supersedes, expired.timeline[0]?.id);
  assert.equal(expired.timeline[0]?.citations[0]?.availability, "unavailable");
});
