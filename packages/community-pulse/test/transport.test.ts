import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { syntheticResearchReports } from "../src/fixtures.ts";
import { buildSyntheticInbox, fixtureMailPolicy, syntheticMail } from "../src/transport-fixtures.ts";
import {
  createResearchIntakeState, MAX_DELIVERY_BYTES, ingestResearchDelivery, manualTransport, type ResearchDelivery
} from "../src/transport.ts";

const now = () => new Date("2026-11-25T13:01:00Z");
const options = { clock: now, emailPolicy: fixtureMailPolicy };
const scout = syntheticResearchReports[1]!;
const input = JSON.stringify(scout);

test("synthetic email adapter records every run outcome and isolates duplicates and quarantine", () => {
  const state = buildSyntheticInbox();
  assert.deepEqual(state.receipts.map(r => r.disposition),
    ["accepted", "accepted", "accepted", "accepted", "duplicate", "quarantined"]);
  assert.deepEqual(state.receipts.slice(0, 4).map(r => r.reportedRunStatus), ["completed", "no_change", "partial", "failed"]);
  assert.equal(state.candidates.length, 4);
  assert.ok(state.receipts.every(r => r.receivedAt.endsWith("Z")));
});

test("MIME JSON, labeled plain text, and Markdown structured data need no inference", () => {
  const encoded = readFileSync(new URL("./fixtures/hourly-no-change.eml", import.meta.url));
  const verified = syntheticMail("", "ascii-fixture") as Extract<ResearchDelivery, { channel: "email" }>;
  const fromMime = ingestResearchDelivery({ ...verified, bytes: encoded }, createResearchIntakeState(), options);
  assert.equal(fromMime.receipt.disposition, "accepted");
  assert.equal(fromMime.receipt.reportedRunStatus, "no_change");
  assert.equal(fromMime.receipt.rawSha256, createHash("sha256").update(encoded).digest("hex"));
  const md = readFileSync(new URL("./fixtures/hourly-no-change.md", import.meta.url));
  const manual = manualTransport.receive({ raw: md, format: "markdown", operator: "local-test" });
  const duplicate = ingestResearchDelivery(manual, fromMime.state, options);
  assert.equal(duplicate.receipt.disposition, "duplicate");
  assert.equal(duplicate.state.candidates.length, 1);
});

test("sender text and forged authentication headers cannot authorize ingestion", () => {
  const logged = syntheticMail(input, "forged", { authenticated: false });
  const forged = new TextEncoder().encode("Authentication-Results: fake; dmarc=pass; dkim=pass\r\n" +
    new TextDecoder().decode(logged.bytes));
  const result = ingestResearchDelivery({ ...logged, bytes: forged }, createResearchIntakeState(), options);
  assert.deepEqual(result.receipt.reasonCodes, ["unauthenticated_mail"]);
  assert.equal(result.state.candidates.length, 0);
});

test("rejects unaligned DKIM, an unapproved identity, and negative clock skew beyond tolerance", () => {
  const message = syntheticMail(input, "mail") as Extract<ResearchDelivery, { channel: "email" }>;
  assert.ok(message.mail);
  for (const mail of [
    { ...message.mail, alignedDkim: false },
    { ...message.mail, dmarc: "fail" as const },
    { ...message.mail, recipient: "different@example.invalid" },
    { ...message.mail, gatewayObservedAt: "2026-11-26T13:00:00Z" }
  ]) assert.equal(ingestResearchDelivery({ ...message, mail }, createResearchIntakeState(), options).receipt.disposition, "quarantined");
  const mismatch = syntheticMail(input, "mail", { rawFrom: "other@example.invalid" });
  assert.deepEqual(ingestResearchDelivery(mismatch, createResearchIntakeState(), options).receipt.reasonCodes,
    ["message_sender_mismatch"]);
});

test("rejects reused delivery IDs, changed run payloads, and oversized content", () => {
  const id = "replay";
  const original = syntheticMail(input, id);
  const first = ingestResearchDelivery(original, createResearchIntakeState(), options);
  const retry = ingestResearchDelivery(original, first.state, options);
  assert.equal(retry.state, first.state);
  assert.equal(retry.receipt.disposition, "duplicate");
  const changed = JSON.stringify({ ...scout, title: "Different content" });
  const deliveryConflict = ingestResearchDelivery(syntheticMail(changed, id), first.state, options);
  assert.deepEqual(deliveryConflict.receipt.reasonCodes, ["delivery_id_conflict"]);
  const runConflict = ingestResearchDelivery(syntheticMail(changed, "new"), first.state, options);
  assert.deepEqual(runConflict.receipt.reasonCodes, ["run_id_conflict"]);
  const oversize = ingestResearchDelivery({ ...original, bytes: new Uint8Array(MAX_DELIVERY_BYTES + 1) },
    first.state, options);
  assert.deepEqual(oversize.receipt.reasonCodes, ["oversized_delivery"]);
  assert.equal(oversize.receipt.rawSha256, null);
});

test("duplicate JSON property names, HTML-only messages, and invalid reports are quarantined", () => {
  for (const delivery of [
    syntheticMail(input.replace('"status":', '"status":"no_change","status":'), "duplicate"),
    syntheticMail("<p>data</p>", "html", { contentType: "text/html" }),
    syntheticMail(JSON.stringify({ ...scout, publish_now: true }), "schema"),
    syntheticMail("<svg/>", "attachment", { contentType: "image/svg+xml" })
  ]) {
    const result = ingestResearchDelivery(delivery, createResearchIntakeState(), options);
    assert.equal(result.receipt.disposition, "quarantined");
    assert.deepEqual(result.state.candidates, []);
  }
});
