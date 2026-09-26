import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidArtifactBundle,
  type ArtifactBundle,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import { buildPlanningBrief } from "@diagnostic-odyssey/brief-core";
import {
  groupBriefBurdenFindings,
  OTHER_REVIEWED_FINDINGS_GROUP_ID
} from "../src/data/briefBurdenPresentation.ts";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const reviewedArtifactPath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json",
    import.meta.url
  )
);
const rawReviewed: unknown = JSON.parse(readFileSync(reviewedArtifactPath, "utf8"));
assertValidArtifactBundle(rawReviewed);
const reviewedBundle: ArtifactBundle = rawReviewed;
const reviewedEstimates = reviewedBundle.burden_domains.flatMap(
  domain => domain.measures
);
const reviewedBrief = buildPlanningBrief({
  context: reviewedBundle.context,
  estimates: reviewedEstimates,
  localContext: [],
  scenario: null,
  evidence: reviewedBundle.evidence,
  dataRequests: [],
  generatedAt: "2026-09-25T00:00:00Z"
});

test("reviewed Burden runtime remains 21 estimates in 13 / 4 / 4 full domain groups", () => {
  assert.equal(reviewedEstimates.length, 21);
  assert.deepEqual(
    reviewedBundle.burden_domains.map(domain => [
      domain.domain_id,
      domain.measures.length
    ]),
    [
      ["economic-healthcare", 13],
      ["healthcare-work-admin", 4],
      ["mental-human", 4]
    ]
  );

  const groups = groupBriefBurdenFindings(
    reviewedBundle.burden_domains,
    reviewedBrief.burden_findings
  );
  assert.deepEqual(
    groups.map(group => [group.group_id, group.findings.length]),
    [
      ["economic-healthcare", 13],
      ["healthcare-work-admin", 4],
      ["mental-human", 4]
    ]
  );

  const groupedIds = groups.flatMap(group =>
    group.findings.map(finding => finding.estimate_id)
  );
  assert.equal(groupedIds.length, 21);
  assert.equal(new Set(groupedIds).size, 21);
  assert.deepEqual(
    new Set(groupedIds),
    new Set(reviewedBrief.burden_findings.map(finding => finding.estimate_id))
  );
});

test("brief grouping preserves unmatched gated findings in an explicit fallback", () => {
  const seed = reviewedBrief.burden_findings[0];
  assert.ok(seed);
  const unmatched: Estimate = {
    ...seed,
    estimate_id: "synthetic-unmatched-reviewed-finding",
    measure_id: "synthetic-unmatched-reviewed-finding",
    label: "Synthetic unmatched reviewed finding"
  };

  const groups = groupBriefBurdenFindings(
    reviewedBundle.burden_domains,
    [...reviewedBrief.burden_findings, unmatched]
  );
  const fallback = groups.find(
    group => group.group_id === OTHER_REVIEWED_FINDINGS_GROUP_ID
  );

  assert.ok(fallback);
  assert.equal(fallback.label, "Other reviewed findings");
  assert.deepEqual(
    fallback.findings.map(finding => finding.estimate_id),
    [unmatched.estimate_id]
  );

  const groupedIds = groups.flatMap(group =>
    group.findings.map(finding => finding.estimate_id)
  );
  assert.equal(groupedIds.length, 22);
  assert.equal(new Set(groupedIds).size, 22);
});

test("Burden and Domain pages share plain-language measure presentation", () => {
  const burden = readSource("../src/pages/BurdenPage.tsx");
  const domain = readSource("../src/pages/DomainPage.tsx");
  const measures = readSource("../src/components/BurdenMeasureList.tsx");

  assert.match(burden, /className="burden-domain-stack"/);
  assert.match(burden, /formatDataStateLabel\(domain\.availability_state\)/);
  assert.match(burden, /<BurdenMeasureList estimates=\{domain\.measures\} \/>/);
  assert.doesNotMatch(burden, /Reviewed analytical estimate/);
  assert.doesNotMatch(burden, />\{domain\.availability_state\}</);

  assert.match(domain, /formatDataStateLabel\(domain\.availability_state\)/);
  assert.match(domain, /<BurdenMeasureList estimates=\{domain\.measures\} \/>/);
  assert.doesNotMatch(domain, /State: \{domain\.availability_state\}/);
  assert.match(domain, /Not yet represented by a standalone reviewed domain/);

  assert.match(measures, /formatEstimateValue\(estimate\)/);
  assert.match(measures, /formatEstimateInterval\(estimate\)/);
  assert.match(measures, /<details className="burden-measure-details technical-disclosure">/);
  assert.match(measures, /Interpretation and technical details/);
  assert.match(measures, /estimate\.allowed_interpretation/);
  assert.match(measures, /estimate\.universe/);
  assert.match(measures, /estimate\.denominator/);
  assert.match(measures, /estimate\.system_boundary/);
  assert.match(measures, /estimate\.source_ref/);
  assert.match(measures, /formatReleaseStatusLabel\(estimate\.release_status\)/);
  assert.match(measures, /estimate\.component_of_measure_id/);
  assert.match(measures, /do not add this value to the parent total/);
});

test("Planning Brief uses semantic grouped tables and promotes every warning", () => {
  const brief = readSource("../src/pages/BriefPage.tsx");

  assert.match(brief, /groupBriefBurdenFindings\(/);
  assert.match(brief, /<table className="brief-burden-table">/);
  assert.match(brief, /<thead>/);
  assert.match(brief, /<tbody>/);
  assert.match(brief, /<th scope="col">Measure<\/th>/);
  assert.match(brief, /<th scope="col">Estimate<\/th>/);
  assert.match(brief, /<th scope="col">Confidence interval<\/th>/);
  assert.match(brief, /tabIndex=\{0\}/);
  assert.match(brief, /brief\.warnings\.map\(warning =>/);
  assert.doesNotMatch(brief, /<h2>Warnings<\/h2>/);

  const boundariesIndex = brief.indexOf("<h2>Interpretation boundaries</h2>");
  const burdenIndex = brief.indexOf("<h2>Reviewed national burden findings</h2>");
  assert.ok(boundariesIndex >= 0);
  assert.ok(burdenIndex >= 0);
  assert.ok(boundariesIndex < burdenIndex);

  assert.match(brief, /formatDataStateLabel\(record\.state\)/);
  assert.doesNotMatch(brief, /Partial data state/);
  assert.doesNotMatch(brief, />Loaded</);
  assert.doesNotMatch(brief, /Data state:<\/strong> \{record\.state\}/);
});

test("new grouped Brief presentation remains print-safe without hiding critical boundaries", () => {
  const styles = readSource("../src/styles.css");

  assert.match(styles, /\.brief-burden-table-wrap\{[^}]*overflow-x:auto/);
  assert.match(styles, /\.brief-burden-table\{[^}]*border-collapse:collapse/);
  assert.match(styles, /@media print/);
  assert.match(styles, /\.brief-burden-table-wrap\{overflow:visible/);
  assert.match(styles, /thead\{display:table-header-group\}/);
  assert.match(styles, /\.brief-burden-table tr\{break-inside:avoid/);
  assert.doesNotMatch(styles, /\.interpretation-boundaries\s*\{[^}]*display:none/i);
  assert.doesNotMatch(styles, /\.brief-burden-table\s*\{[^}]*display:none/i);
  assert.match(styles, /\.brief-export-actions/);
  assert.match(styles, /\.print-provenance/);
});
