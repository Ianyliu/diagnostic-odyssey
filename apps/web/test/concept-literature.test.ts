import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {
  DEMO_LITERATURE_REVIEW_DATE, DEMO_LITERATURE_NOTICE, demoPublications,
  demoTopicExamples, demoDecisionEvidence, getDemoPublication, isSafeDemoLiteratureLink
} from "../src/concept/demoLiterature.ts";

test("worked literature references are real, independently traceable sample metadata only", () => {
  assert.equal(DEMO_LITERATURE_REVIEW_DATE, "2026-10-15");
  assert.match(DEMO_LITERATURE_NOTICE, /NOT independently admitted/);
  assert.equal(demoPublications.length, 4);
  assert.equal(new Set(demoPublications.map(source => source.id)).size, 4);
  for (const source of demoPublications) {
    assert.match(source.doi, /^10\.\d{4,9}\/[\w.\-/]+$/);
    assert.equal(source.url, `https://doi.org/${source.doi}`);
    assert.equal(isSafeDemoLiteratureLink(source.url), true);
    assert.ok(source.design.length > 20);
    assert.ok(source.interpretation.length > 40);
    assert.match(source.limitations, /not |no |cannot |limit|without|non-/i);
    assert.equal(getDemoPublication(source.id), source);
  }
  for (const url of ["http://doi.org/10.1/example", "https://evil.example/?prompt=secret",
    "https://doi.org/10.1/example?prompt=secret", "javascript:alert(1)", "https://doi.org/10.1/example#leak"]) {
    assert.equal(isSafeDemoLiteratureLink(url), false);
  }
  const regain = getDemoPublication("mcgregor-2024");
  assert.match(regain.setting, /three months after discharge from hospital/);
  assert.match(regain.finding, /0\.03 \(95% CI 0\.01 to 0\.05\)/);
  assert.match(regain.interpretation, /does not test remote referral navigation or diagnostic delay/);
  assert.equal("correctionUrl" in regain && isSafeDemoLiteratureLink(regain.correctionUrl), true);
});

test("default concept study cards map every original research topic to specific sources without admitting effects", () => {
  for (const id of ["navigation", "education", "coordination"] as const) {
    const example = demoTopicExamples[id];
    assert.ok(example.sourceIds.length >= 2);
    for (const sourceId of example.sourceIds) assert.ok(getDemoPublication(sourceId));
    assert.match(example.appraisal, /Do not|not evidence|not infer|Do not transfer/i);
    assert.ok(example.candidateFields.length >= 4);
  }
  assert.match(demoTopicExamples.coordination.directness, /not an RCT of referral coordination/);
  assert.equal(demoPublications.filter(source => source.type === "randomized_trial").length, 1);
  for (const decision of ["referral", "capacity", "reach"] as const) {
    assert.ok(getDemoPublication(demoDecisionEvidence[decision].sourceId));
    assert.ok(demoDecisionEvidence[decision].candidateDefinition);
    assert.ok(demoDecisionEvidence[decision].sampleOutput);
  }
});

test("no static demo publication is wired into authoritative analytical or export source modules", () => {
  for (const path of [
    "../src/pages/BriefPage.tsx",
    "../src/data/planningInsights.ts",
    "../src/data/aiHandoff.ts",
    "../src/concept/conceptBrief.ts",
    "../../../packages/brief-core/src/index.ts"
  ]) {
    let content: string;
    try { content = readFileSync(new URL(path, import.meta.url), "utf8"); }
    catch { continue; }
    assert.doesNotMatch(content, /demoLiterature|DemoLiterature|demoTopicExamples|demoPublications/, path);
  }
  for (const file of ["demoLiterature.ts", "DemoLiteratureComponents.tsx"]) {
    const source = readFileSync(new URL(`../src/concept/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|setScenario\s*\(|upsertAnalystDataRequest\s*\()/);
  }
});
