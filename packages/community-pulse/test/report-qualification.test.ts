import assert from "node:assert/strict";
import test from "node:test";
import { validateResearchReport, type ResearchReport } from "../src/research.ts";
import { syntheticMail, fixtureMailPolicy } from "../src/transport-fixtures.ts";
import { createResearchIntakeState, ingestResearchDelivery, manualTransport, MAX_REPORT_BYTES } from "../src/transport.ts";

const clock = () => new Date("2026-11-25T13:01:00Z");
const utf8 = new TextEncoder();

function report(texts: string[]): ResearchReport {
  return {
    schema_version: "0.2.1", kind: "research_report", run_id: "synthetic-qualification",
    report_type: "on_demand", status: "completed", title: "Synthetic boundary check", reason_codes: [],
    items: texts.map((text, index) => ({
      kind: "open_question", title: "Synthetic item " + (index + 1), text, sources: []
    }))
  };
}

test("v0.2.1 accepts twelve 700-code-unit items and rejects a thirteenth", () => {
  const texts = Array<string>(12).fill("x".repeat(700));
  assert.equal(validateResearchReport(report(texts)).ok, true);
  assert.deepEqual(validateResearchReport(report([...texts, "One extra item"])),
    { ok: false, issues: ["$.items: expected an array within length limits"] });
});

test("v0.2.1 counts UTF-16 code units and checks text even when the item count is valid", () => {
  const boundary = "🙂".repeat(350);
  assert.equal(validateResearchReport(report([boundary])).ok, true);
  assert.deepEqual(validateResearchReport(report([boundary + "x"])),
    { ok: false, issues: ["$.items[0].text: expected bounded text in the specified format"] });
});

test("email intake quarantines a completed 30-item report with eleven overlong texts below the byte cap", () => {
  const fixture = report(["x".repeat(1022), ...Array<string>(10).fill("x".repeat(701)), ...Array<string>(19).fill("x".repeat(700))]);
  const body = JSON.stringify(fixture);
  assert.ok(utf8.encode(body).byteLength < MAX_REPORT_BYTES);
  const { receipt, state } = ingestResearchDelivery(
    syntheticMail(body, "multi-limit-qualification"), createResearchIntakeState(), { clock, emailPolicy: fixtureMailPolicy }
  );
  assert.equal(receipt.disposition, "quarantined");
  assert.deepEqual(receipt.reasonCodes, ["invalid_report_schema"]);
  assert.deepEqual(state.candidates, []);
});

test("the independent byte limit rejects an otherwise valid report one byte over 64 KiB", () => {
  const json = JSON.stringify(report(["Does this synthetic question pass?"]));
  const exactLimit = json.padEnd(MAX_REPORT_BYTES, " ");
  for (const [body, accepted] of [[exactLimit, true], [exactLimit + " ", false]] as const) {
    const delivery = manualTransport.receive({ raw: utf8.encode(body), format: "json", operator: "local-test" });
    const { receipt } = ingestResearchDelivery(delivery, createResearchIntakeState(), { clock });
    assert.equal(receipt.disposition, accepted ? "accepted" : "quarantined");
    assert.deepEqual(receipt.reasonCodes, accepted ? [] : ["oversized_report"]);
  }
});
