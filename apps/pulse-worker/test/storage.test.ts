import assert from "node:assert/strict";
import test from "node:test";
import { syntheticResearchReports } from "../../../packages/community-pulse/src/fixtures.ts";
import type { ResearchReport } from "../../../packages/community-pulse/src/research.ts";
import { fixtureMailPolicy, syntheticMail } from "../../../packages/community-pulse/src/transport-fixtures.ts";
import { createResearchIntakeState, ingestResearchDelivery } from "../../../packages/community-pulse/src/transport.ts";
import { createIntakeStore } from "../src/storage.ts";
import { MemoryR2 } from "../src/offlineBucket.ts";

const day = 24 * 60 * 60 * 1000;
const instant = "2026-11-25T13:01:00.000Z";
const now = new Date(instant);
const digestPattern = /^[a-f0-9]{64}$/u;
const hourly = syntheticResearchReports.find(report => report.report_type === "hourly_scout")!;

function delivery(report: ResearchReport, transport: string, receiptId: string, at = now) {
  const input = syntheticMail(JSON.stringify(report), transport);
  if (input.channel === "email" && input.mail) input.mail.gatewayObservedAt = at.toISOString();
  const accepted = ingestResearchDelivery(input, createResearchIntakeState(), {
    clock: () => at, emailPolicy: fixtureMailPolicy, receiptId: () => receiptId
  });
  assert.equal(accepted.receipt.disposition, "accepted");
  const reportBody = accepted.state.candidates[0]?.report;
  assert.ok(reportBody);
  return [accepted.receipt, reportBody] as const;
}

test("run history shows only sanitized content and accepted reports", async () => {
  const bucket = new MemoryR2(now);
  const store = createIntakeStore(bucket);
  for (const [index, report] of syntheticResearchReports.entries()) {
    const result = await store.saveDelivery(...delivery(report, "delivery-" + index, "receipt-" + index));
    assert.equal(result.disposition, "accepted");
  }
  const { inbox, metrics } = await store.readInbox(now);
  assert.equal(inbox.length, 4);
  assert.ok(inbox.every(r => r.report && digestPattern.test(r.receipt.content_sha256 ?? "")));
  assert.equal(metrics.window_hours, 24);
  assert.equal(metrics.last_success_at, instant);
  assert.equal(metrics.runs.hourly_scout.no_change, 1);
  assert.equal(metrics.runs.hourly_scout.missed, null);
  assert.equal(metrics.runs.daily_synthesis.completed, 1);
  assert.equal(metrics.runs.weekly_strategic_review.partial, 1);
  assert.equal(metrics.runs.on_demand.failed, 1);
  assert.equal(metrics.runs.on_demand.last_success_at, null);
  const persisted = JSON.stringify([...bucket.objects]);
  assert.equal(persisted.includes(fixtureMailPolicy.authenticatedFrom), false);
  assert.equal(persisted.includes(fixtureMailPolicy.recipient), false);
  assert.equal(persisted.includes("Message-ID"), false);
});

test("transport replay, changed run IDs and duplicate physical messages retain one run", async () => {
  const bucket = new MemoryR2(now);
  const store = createIntakeStore(bucket);
  const first = delivery(hourly, "same-gateway-id", "original");
  assert.equal((await store.saveDelivery(...first)).disposition, "accepted");
  assert.deepEqual(await store.saveDelivery(...delivery(hourly, "same-gateway-id", "retried")),
    { disposition: "duplicate", reasonCode: "already_received", receiptId: "original" });
  const conflicting = await store.saveDelivery(...delivery({
    ...hourly, run_id: "altered-run-id"
  }, "same-gateway-id", "swapped"));
  assert.equal(conflicting.reasonCode, "delivery_id_conflict");
  const duplicate = await store.saveDelivery(...delivery(hourly, "new-envelope-id", "same-run"));
  assert.equal(duplicate.disposition, "duplicate");
  const changed = await store.saveDelivery(...delivery({
    ...hourly, title: "Different result for existing run"
  }, "changed-email", "different-result"));
  assert.equal(changed.reasonCode, "run_id_conflict");
  const inbox = (await store.readInbox(now)).inbox;
  assert.equal(inbox.filter(row => row.report).length, 1);
  assert.equal(inbox.filter(row => row.receipt.status === "duplicate").length, 1);
  assert.equal(inbox.filter(row => row.receipt.status === "quarantined" && row.report === null).length, 2);
  assert.equal([...bucket.objects.keys()].filter(key => key.startsWith("s0/runs/")).length, 1);
  assert.equal(JSON.stringify([...bucket.objects]).includes("Different result"), false);
});

test("parallel logical run claim preserves one candidate and quarantines a conflicting result", async () => {
  const bucket = new MemoryR2(now);
  const store = createIntakeStore(bucket);
  const result = await Promise.all([store.saveDelivery(...delivery(hourly, "transport-0", "receipt-0")),
    store.saveDelivery(...delivery({ ...hourly, title: "Second contender" }, "transport-1", "receipt-1"))]);
  assert.deepEqual(result.map(row => row.disposition).sort(), ["accepted", "quarantined"]);
  const data = await store.readInbox(now);
  assert.equal(data.inbox.length, 2);
  assert.equal(data.inbox.filter(row => row.report).length, 1);
  assert.equal(data.metrics.runs.hourly_scout.no_change, 1);
});

test("ready receipts follow durable candidate bytes and an interrupted final write is recoverable", async () => {
  const bucket = new MemoryR2(now);
  const store = createIntakeStore(bucket);
  bucket.interrupt = (key, options) => key.startsWith("s0/journal/") && options.onlyIf.has("if-match");
  await assert.rejects(store.saveDelivery(...delivery(hourly, "recovery", "first")), /interruption/);
  assert.equal((await store.readInbox(now)).inbox.length, 0);
  assert.equal([...bucket.objects.keys()].filter(key => key.startsWith("s0/runs/")).length, 1);
  bucket.interrupt = null;
  assert.equal(await store.recoverPending(now), 1);
  assert.deepEqual((await store.readInbox(now)).inbox.map(row => row.receipt.ingestion_id), ["first"]);
  assert.equal((await store.saveDelivery(...delivery(hourly, "recovery", "second"))).disposition, "duplicate");
});

test("interruption before candidate write requires redelivery and retains original observed time", async () => {
  const bucket = new MemoryR2(now);
  const store = createIntakeStore(bucket);
  bucket.interrupt = key => key.startsWith("s0/runs/");
  await assert.rejects(store.saveDelivery(...delivery(hourly, "before-bytes", "initial")), /interruption/);
  assert.equal(await store.recoverPending(now), 0);
  assert.equal((await store.readInbox(now)).inbox.length, 0);
  bucket.interrupt = null;
  const later = new Date(now.getTime() + 1000);
  assert.equal((await store.saveDelivery(...delivery(hourly, "before-bytes", "retry", later))).disposition, "accepted");
  const stored = (await store.readInbox(later)).inbox[0]!;
  assert.equal(stored.receipt.ingestion_id, "initial");
  assert.equal(stored.receipt.received_at, instant);
});

test("reconciliation repairs interrupted summary writes before history leaves the inbox window", async () => {
  const bucket = new MemoryR2(now);
  const store = createIntakeStore(bucket);
  bucket.interrupt = key => key === "s0/progress.json";
  await assert.rejects(store.saveDelivery(...delivery(hourly, "summary-failure", "ready")), /interruption/);
  assert.equal((await store.readInbox(now)).inbox.length, 1);
  bucket.interrupt = null;
  await store.recoverPending(now);
  const older = await store.readInbox(new Date(now.getTime() + 2 * day));
  assert.equal(older.inbox.length, 0);
  assert.equal(older.metrics.last_success_at, instant);
});

test("separate durable hourly caps hold under concurrent writes and survive another handler instance", async () => {
  const bucket = new MemoryR2(now);
  const options = { emailPerHour: 3, quarantinePerHour: 2 };
  const store = createIntakeStore(bucket, options);
  const out = await Promise.all(Array.from({ length: 15 }, () => store.tryConsumeRate(now, "email")));
  assert.equal(out.filter(Boolean).length, 3);
  const other = createIntakeStore(bucket, options);
  assert.equal(await other.tryConsumeRate(now, "email"), false);
  assert.equal(await other.tryConsumeRate(now, "quarantine"), true);
  assert.equal(await other.tryConsumeRate(now, "quarantine"), true);
  assert.equal(await other.tryConsumeRate(now, "quarantine"), false);
  assert.equal(await other.tryConsumeRate(new Date(now.getTime() + 3600000), "email"), true);
});

test("quarantine stores no content or supplied sender and pages inbox with conditional reads", async () => {
  const bucket = new MemoryR2(now);
  const store = createIntakeStore(bucket, { hourlyExpectedSince: "2026-11-25T12:30:00Z" });
  await store.saveDelivery(...delivery(hourly, "first", "success"));
  const [parsed] = delivery(hourly, "rejected", "rejected");
  await store.saveDelivery({ ...parsed, disposition: "quarantined", reasonCodes: ["sender_not_allowed"] }, null);
  bucket.pageLimit = 1;
  const result = await store.readInboxIfChanged(now);
  assert.equal(result.data?.inbox.length, 2);
  assert.equal(result.data?.inbox.find(item => item.receipt.status === "quarantined")?.report, null);
  assert.equal(result.data?.metrics.runs.hourly_scout.missed, false);
  bucket.readKeys = [];
  const unchanged = await store.readInboxIfChanged(new Date(now.getTime() + 1000), result.etag);
  assert.equal(unchanged.data, null);
  assert.deepEqual(bucket.readKeys, ["s0/progress.json"]);
  const missed = await store.readInboxIfChanged(new Date(now.getTime() + 91 * 60000), result.etag);
  assert.equal(missed.data?.metrics.runs.hourly_scout.missed, true);
  assert.notEqual(missed.etag, result.etag);
});

test("staging retention purges expired private state and removes expired success metadata", async () => {
  const bucket = new MemoryR2(now);
  const store = createIntakeStore(bucket, { retentionDays: 7 });
  await store.saveDelivery(...delivery(hourly, "expiry", "initial"));
  await store.tryConsumeRate(now, "email");
  const after = new Date(now.getTime() + 8 * day);
  bucket.clock = after;
  assert.equal((await store.readInbox(after)).metrics.last_success_at, null);
  assert.deepEqual(await store.purgeExpired(after), { deleted: 4, cursor: null });
  assert.deepEqual([...bucket.objects.keys()], ["s0/progress.json"]);
  assert.equal(bucket.objects.get("s0/progress.json")?.body, "{}");
});
