import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidArtifactBundle,
  canExportEstimate,
  linkedConditionCandidateIds,
  type ArtifactBundle
} from "@diagnostic-odyssey/contracts";
import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import {
  loadReviewedLinkedConditionSecondaryEvidence
} from "../src/data/reviewedLinkedConditionArtifact.ts";
import {
  formatLinkedConditionSecondaryEvidence
} from "../src/data/linkedConditionPresentation.ts";

const readSource = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const nationalArtifactPath = fileURLToPath(new URL(
  "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json",
  import.meta.url
));
const linkedRoot = new URL(
  "../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/",
  import.meta.url
);
const linkedChecksumPath = fileURLToPath(new URL("SHA256SUMS", linkedRoot));

const rawNational: unknown = JSON.parse(readFileSync(nationalArtifactPath, "utf8"));
assertValidArtifactBundle(rawNational);
const national: ArtifactBundle = rawNational;
const nationalEstimates = national.burden_domains.flatMap(domain => domain.measures);

test("Candidate A presentation uses the exact reviewed copy and intended rounding", () => {
  const evidence = loadReviewedLinkedConditionSecondaryEvidence();
  const display = formatLinkedConditionSecondaryEvidence(evidence);

  assert.equal(evidence.sectionHeading, "Documented U09-linked service-use footprint");
  assert.equal(
    evidence.measureLabel,
    "Share with at least one 2024 encounter linked in MEPS to an exact U09 condition record"
  );
  assert.equal(
    evidence.alwaysVisibleExplanation,
    "This is not the share diagnosed or recognized with Long COVID and does not measure Long-COVID-attributable healthcare use."
  );
  assert.equal(display.estimate, "4.8%");
  assert.equal(display.interval, "95% CI 2.5%–7.0%");
  assert.equal(display.weightedDenominator, "6,831,165.107549");
  assert.deepEqual(evidence.technicalLimitations, [
    "Exact U09 is not equivalent to the governed operational-current Long COVID definition.",
    "Absence of U09 does not mean absence of Long COVID.",
    "Absence of a qualifying linked encounter does not mean absence of healthcare.",
    "Calendar-year 2024 encounters may occur before or after the Round 3/1 current-status anchor.",
    "Condition-event linkage does not establish causation.",
    "116 of 259 qualifying U09-linked events also carry at least one non-U09 condition link."
  ]);
});

test("medical route composes Candidate A only as separate secondary evidence", () => {
  const app = readSource("../src/App.tsx");
  const medical = readSource("../src/pages/MedicalBurdenPage.tsx");
  const domain = readSource("../src/pages/DomainPage.tsx");
  const component = readSource("../src/components/LinkedConditionServiceUseFootprint.tsx");
  const styles = readSource("../src/styles.css");

  assert.match(app, /path="burden\/medical" element=\{<MedicalBurdenPage \/>\}/);
  assert.match(medical, /tryLoadReviewedLinkedConditionSecondaryEvidence\(\)/);
  assert.match(medical, /secondaryContent=\{secondaryContent\}/);
  assert.match(domain, /secondaryContent\?: ReactNode/);
  assert.match(domain, /\{secondaryContent\}/);
  assert.match(domain, /<BurdenMeasureList estimates=\{domain\.measures\} \/>/);

  assert.match(component, /Secondary \/ documentation-linked evidence/);
  assert.match(component, /Reviewed descriptive evidence/);
  assert.match(component, /\{evidence\.sectionHeading\}/);
  assert.match(component, /\{evidence\.measureLabel\}/);
  assert.match(component, /\{evidence\.alwaysVisibleExplanation\}/);
  assert.match(component, /Survey-weighted estimate/);
  assert.match(component, /Technical interpretation and provenance/);
  assert.match(component, /evidence\.technicalLimitations\.map/);
  assert.match(component, /aria-labelledby="linked-condition-secondary-heading"/);
  assert.match(component, /<details className="technical-disclosure/);
  assert.match(component, /<summary>/);
  assert.match(
    component,
    /Reviewed documentation-linked service-use evidence is unavailable\./
  );
  assert.doesNotMatch(component, /tooltip|onMouseEnter|onMouseOver/i);

  assert.match(styles, /\.linked-condition-secondary-evidence\{/);
  assert.match(styles, /@media\(max-width:640px\).*linked-condition-secondary-measure/s);
});

test("active runtime view model contains no non-A candidate or generic Estimate semantics", () => {
  const evidence = loadReviewedLinkedConditionSecondaryEvidence();
  const serialized = JSON.stringify(evidence);

  assert.ok(serialized.includes("u09_linked_service_use_person_share"));
  for (const id of linkedConditionCandidateIds.slice(1)) {
    assert.equal(serialized.includes(id), false, id);
  }
  for (const forbiddenValue of [
    "0.1973708941306436",
    "0.1562085830927701",
    "0.03350284715268952",
    "0.007659463885183907"
  ]) {
    assert.equal(serialized.includes(forbiddenValue), false, forbiddenValue);
  }
  for (const estimateField of [
    "estimate_id",
    "measure_id",
    "release_status",
    "display_status",
    "source_ref"
  ]) {
    assert.equal(estimateField in (evidence as unknown as Record<string, unknown>), false);
  }
});

test("ordinary national ArtifactBundle and export semantics remain exactly separate", () => {
  assert.equal(nationalEstimates.length, 21);
  assert.deepEqual(
    national.burden_domains.map(domain => [domain.domain_id, domain.measures.length]),
    [
      ["economic-healthcare", 13],
      ["healthcare-work-admin", 4],
      ["mental-human", 4]
    ]
  );
  assert.ok(nationalEstimates.every(canExportEstimate));

  const ordinarySerialized = JSON.stringify(national);
  for (const id of linkedConditionCandidateIds) {
    assert.equal(ordinarySerialized.includes(id), false, id);
  }

  const contracts = readSource("../../../packages/contracts/src/index.ts");
  assert.doesNotMatch(contracts, /reviewed_linked_condition_secondary_evidence/);
  assert.doesNotMatch(contracts, /u09_linked_service_use_person_share.*canExportEstimate/s);
});

test("Planning Brief remains 21 ordinary findings and excludes Candidate A", () => {
  const brief = buildPlanningBrief({
    context: national.context,
    estimates: nationalEstimates,
    localContext: [],
    scenario: null,
    evidence: national.evidence,
    dataRequests: national.data_requests,
    generatedAt: "2026-09-30T00:00:00Z"
  });
  assert.equal(brief.burden_findings.length, 21);

  const json = serializeBriefJson(brief);
  assert.equal(json.includes("u09_linked_service_use_person_share"), false);
  assert.equal(json.includes("Documented U09-linked service-use footprint"), false);
  assert.equal(
    json.includes("Share with at least one 2024 encounter linked in MEPS to an exact U09 condition record"),
    false
  );

  const briefPage = readSource("../src/pages/BriefPage.tsx");
  assert.doesNotMatch(briefPage, /reviewedLinkedConditionArtifact|LinkedConditionServiceUseFootprint/);
});

test("Overview, DecisionStateRail, Pilot, Evidence, and ArtifactProvider remain unaware of Candidate A", () => {
  const paths = [
    "../src/pages/OverviewPage.tsx",
    "../src/components/DecisionStateRail.tsx",
    "../src/pages/PilotPage.tsx",
    "../src/pages/EvidencePage.tsx",
    "../src/data/ArtifactContext.tsx"
  ];
  for (const path of paths) {
    const source = readSource(path);
    assert.doesNotMatch(source, /reviewedLinkedConditionArtifact/);
    assert.doesNotMatch(source, /u09_linked_service_use_person_share/);
    assert.doesNotMatch(source, /LinkedConditionServiceUseFootprint/);
  }

  const rail = readSource("../src/components/DecisionStateRail.tsx");
  assert.match(rail, /bundle\.burden_domains/);
  assert.match(rail, /\.filter\(canExportEstimate\)\.length/);
  assert.equal(nationalEstimates.filter(canExportEstimate).length, 21);
});

test("specialized loader never uses historical candidate-manifest filenames as reviewed package index", () => {
  const loader = readSource("../src/data/reviewedLinkedConditionArtifact.ts");

  assert.match(loader, /linked-condition-candidate-estimates\.json/);
  assert.match(loader, /reviewed-diagnostics\.json/);
  assert.match(loader, /source-metadata\.json/);
  assert.match(loader, /github-actions-run-manifest\.json/);
  assert.match(loader, /review-manifest\.json/);
  assert.match(loader, /product-policy\.json/);
  assert.doesNotMatch(loader, /candidate-manifest\.json/);
  assert.doesNotMatch(loader, /hc256-source-metadata\.json/);
  assert.doesNotMatch(loader, /linked-condition-source-metadata\.json/);
  assert.match(loader, /assertValidReviewedLinkedConditionPackage\(input\)/);
});

test("immutable reviewed linked-condition package remains byte-valid and runtime-inactive", () => {
  const checksumManifest = readFileSync(linkedChecksumPath, "utf8");
  for (const line of checksumManifest.trim().split("\n")) {
    const [expectedHash, fileName] = line.split(/\s{2}/);
    assert.ok(expectedHash);
    assert.ok(fileName);
    const actualHash = createHash("sha256")
      .update(readFileSync(resolve(dirname(linkedChecksumPath), fileName)))
      .digest("hex");
    assert.equal(actualHash, expectedHash, fileName);
  }

  const reviewManifest = JSON.parse(
    readFileSync(fileURLToPath(new URL("review-manifest.json", linkedRoot)), "utf8")
  ) as Record<string, unknown>;
  const productPolicy = JSON.parse(
    readFileSync(fileURLToPath(new URL("product-policy.json", linkedRoot)), "utf8")
  ) as Record<string, unknown>;

  assert.equal(reviewManifest.runtime_selected, false);
  assert.equal(productPolicy.runtime_selected, false);
});
