import assert from "node:assert/strict";
import test from "node:test";
import {
  expandedReportLimits, validateExpandedResearchReport, validateReadableResearchReport, validateResearchReport,
  type ExpandedResearchReport, type ReportType,
} from "../src/research.ts";
import { createResearchIntakeState, ingestResearchDelivery, inspectResearchReportBytes, MAX_REPORT_BYTES } from "../src/transport.ts";
import { fixtureMailPolicy, syntheticMail } from "../src/transport-fixtures.ts";

const clock = () => new Date("2026-11-25T18:00:00.000Z");
const utf8 = new TextEncoder();

function report(report_type: ReportType, count: number, text: string): ExpandedResearchReport {
  return {
    schema_version: "0.2.2", kind: "research_report", report_type, run_id: "expanded-qualification",
    status: "completed", title: "Synthetic expanded report", reason_codes: [],
    items: Array.from({ length: count }, (_, index) => ({ kind: "cross_source_synthesis",
      title: "Synthetic item " + index, text, sources: Array.from({ length: 5 }, (_, source) => ({
        url: "https://example.org/synthetic/" + index + "/" + source, publisher: "Example authority",
      })),
    })),
  };
}

test("expanded report limits dispatch by type and count UTF-16 code units", () => {
  for (const [type, limits] of Object.entries(expandedReportLimits)) {
    const reportType = type as ReportType;
    const text = "🔬".repeat(limits.text / 2);
    const fixture = report(reportType, limits.items, text);
    assert.equal(validateExpandedResearchReport(fixture).ok, true);
    assert.equal(validateExpandedResearchReport(report(reportType, limits.items + 1, text)).ok, false);
    assert.equal(validateExpandedResearchReport(report(reportType, 1, text + "x")).ok, false);
  }
});

test("version dispatch preserves all v0.2.1 limits and strict expanded source constraints", () => {
  const older = { ...report("on_demand", 12, "a".repeat(700)), schema_version: "0.2.1" };
  const newer = report("on_demand", 30, "a".repeat(1022));
  assert.equal(validateReadableResearchReport(older).ok, true);
  assert.equal(validateResearchReport(newer).ok, false);
  assert.equal(validateReadableResearchReport({ ...newer, schema_version: "0.2.1" }).ok, false);
  assert.equal(validateReadableResearchReport(newer).ok, true);
  assert.equal(validateReadableResearchReport({ ...newer, schema_version: "0.2.3" }).ok, false);
  assert.equal(validateReadableResearchReport({ ...newer, approved: true }).ok, false);
  assert.equal(validateExpandedResearchReport({ ...newer, items: [{ ...newer.items[0],
    sources: [...newer.items[0]!.sources, newer.items[0]!.sources[0]] }] }).ok, false);
});

test("source-heavy multibyte JSON retains the independent exact 64 KiB limit", () => {
  const expanded = report("weekly_strategic_review", 40, "診".repeat(320));
  const json = JSON.stringify(expanded);
  const size = utf8.encode(json).length;
  assert.ok(size < MAX_REPORT_BYTES);
  const nearCap = json + " ".repeat(MAX_REPORT_BYTES - size);
  const accepted = inspectResearchReportBytes(utf8.encode(nearCap));
  assert.equal(accepted.ok, true);
  assert.deepEqual(inspectResearchReportBytes(utf8.encode(nearCap + " ")), { ok: false, reason: "oversized_report" });
  assert.deepEqual(inspectResearchReportBytes(utf8.encode(json.replace('"kind":', '"kind":"research_report","kind":'))),
    { ok: false, reason: "invalid_json_key" });
});

test("expanded reports never reach candidates through the current authenticated email writer", () => {
  const message = syntheticMail(JSON.stringify(report("on_demand", 1, "A synthetic comparison")), "expanded-fixture");
  const result = ingestResearchDelivery(message, createResearchIntakeState(), { clock, emailPolicy: fixtureMailPolicy });
  assert.equal(result.receipt.disposition, "quarantined");
  assert.deepEqual(result.receipt.reasonCodes, ["invalid_report_schema"]);
  assert.deepEqual(result.state.candidates, []);
});
