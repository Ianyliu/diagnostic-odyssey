import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeResearchReport, resolveCounty, sourceOriginGroups, validateEventSnapshot, validateResearchReport,
  validateSnapshotTransition, validateExtractionResult, checkExtractionAnchors, convertLegacyResearchProposals
} from "../src/index.ts";
import { emptySyntheticSnapshot, syntheticResearchReports, syntheticSnapshot } from "../src/fixtures.ts";
import type { ExtractionResult } from "../src/extraction.ts";

test("approved and intentionally empty fixtures pass validation", () => {
  assert.equal(validateEventSnapshot(syntheticSnapshot).ok, true);
  assert.equal(validateEventSnapshot(emptySyntheticSnapshot).ok, true);
  assert.equal(syntheticSnapshot.records.length, 7);
  assert.equal(syntheticSnapshot.records.find(x => x.revision === 2)?.status, "stayed");
  assert.ok(syntheticSnapshot.records.some(row => row.status === "proposed"));
  assert.ok(syntheticSnapshot.records.some(row => row.status === "effective"));
  assert.ok(syntheticSnapshot.records.some(row => row.status === "rescinded"));
  assert.ok(syntheticSnapshot.coverage.some(row => row.status === "partial"));
});

test("requires an explicit state and resolves cross-border service separately", () => {
  assert.equal(resolveCounty("Ohio County", "54"), "54069");
  assert.equal(resolveCounty("Wayne County", "54"), "54099");
  assert.equal(resolveCounty("Wayne County", "39"), undefined);
  assert.equal(resolveCounty("Boyd County", "21"), "21019");
  assert.ok(syntheticSnapshot.records.some(row => row.geographic_relations.some(geo => geo.fips_codes.includes("21019")) &&
    row.geographic_relations.some(geo => geo.fips_codes.includes("54099") && geo.relation === "serves")));
});

test("reprints share an origin and do not count as independent evidence", () => {
  const groups = sourceOriginGroups(syntheticSnapshot.evidence);
  const group = groups.get("ridgeview regional diagnostic center");
  assert.equal(group?.length, 2);
  assert.ok(group?.some(row => row.republished_from));
});

test("rejects malformed, unrelated and withdrawn snapshot content", () => {
  for (const mutate of [
    (s: typeof syntheticSnapshot) => { s.records[0]!.dates[0]!.value = "2026-02-30"; },
    (s: typeof syntheticSnapshot) => { s.records[0]!.geographic_relations[0]!.fips_codes = ["99"]; },
    (s: typeof syntheticSnapshot) => { s.records[0]!.claims[0]!.evidence_ids = ["missing"]; },
    (s: typeof syntheticSnapshot) => { s.records[0]!.status_as_of = "2026-12-01"; },
    (s: typeof syntheticSnapshot) => { s.coverage[0]!.checked = 99; },
    (s: typeof syntheticSnapshot) => { s.records.push(s.records[0]!); },
    (s: typeof syntheticSnapshot) => { s.records[2]!.revision = 1; },
    (s: typeof syntheticSnapshot) => { Object.assign(s.records[0]!, { scenario_parameter: 2 }); }
  ]) {
    const snapshot = structuredClone(syntheticSnapshot);
    mutate(snapshot);
    assert.equal(validateEventSnapshot(snapshot).ok, false);
  }
});

test("activation preserves historical tombstones and requires a new revision for edited content", () => {
  const revised = structuredClone(syntheticSnapshot);
  revised.snapshot_id = "00000000-0000-4000-8000-000000000150";
  revised.previous_snapshot_id = syntheticSnapshot.snapshot_id;
  revised.created_at = "2026-11-26T13:00:00Z";
  assert.equal(validateSnapshotTransition(syntheticSnapshot, revised).ok, true);
  revised.records[0]!.title = "Changed without a revision";
  assert.equal(validateSnapshotTransition(syntheticSnapshot, revised).ok, false);
  revised.records[0]!.title = syntheticSnapshot.records[0]!.title;
  revised.tombstones.pop();
  assert.equal(validateSnapshotTransition(syntheticSnapshot, revised).ok, false);
});

test("research outcome semantics preserve no-change and all four task types", () => {
  assert.deepEqual(syntheticResearchReports.map(row => row.status), ["completed", "no_change", "partial", "failed"]);
  assert.equal(new Set(syntheticResearchReports.map(row => row.report_type)).size, 4);
  const report = structuredClone(syntheticResearchReports[0]!);
  assert.equal(validateResearchReport({ ...report, approved: true }).ok, false);
  assert.equal(validateResearchReport({ ...report, status: "no_change" }).ok, false);
  assert.equal(validateResearchReport({ ...report, status: "partial", reason_codes: [] }).ok, false);
  assert.equal(validateResearchReport({ ...report, items: [{ ...report.items[0]!, sources: [] }] }).ok, false);
  report.title = "  E\u0301tude  ";
  assert.equal(normalizeResearchReport(report).title, "Étude");
});

test("legacy leads import as internal research with caller-provided run identity", () => {
  const result = convertLegacyResearchProposals({
    schema_version: "0.2.0", kind: "research_proposals", status: "no_proposals", proposals: [], reason_codes: []
  }, { run_id: "legacy-1", report_type: "on_demand", title: "Old scout" });
  assert.equal(result.ok && result.value.status, "no_change");
});

const anchor = { segment_id: "s1", quote: "The clinic proposes a revised schedule." };
const extraction: ExtractionResult = {
  schema_version: "0.2.1", kind: "extraction_result", status: "ok", reason_codes: [], security_flags: [],
  records: [{ title: "Proposed schedule", change_type: "capacity_change", domains: ["diagnostic_access"],
    status_suggestion: "proposed", claims: [{ text: anchor.quote, assertion_type: "documented_action", attributed_to: null,
      anchors: [anchor] }], date_mentions: [], place_mentions: [] }]
};

test("extraction detects missing and ambiguous anchors without making approval claims", () => {
  assert.equal(validateExtractionResult(extraction).ok, true);
  assert.deepEqual(checkExtractionAnchors(extraction, { s1: anchor.quote }), []);
  assert.equal(checkExtractionAnchors(extraction, { s1: "Unrelated text" }).length, 1);
  assert.equal(checkExtractionAnchors(extraction, { s1: anchor.quote + anchor.quote }).length, 1);
  assert.equal(validateExtractionResult({ ...extraction, reviewed: true }).ok, false);
});
