// Negative tests for the rendered-parity harness: incomplete, empty, duplicated or malformed
// captures and failed interactions must never produce a passing comparison.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { EXCLUSIONS, FOCUS_STOPS, SCHEMA, STATES, THEMES, VIEWPORTS, compareCaptures, interact, validateSummary } from "../browser/pilot-parity.mjs";

const harness = join(dirname(fileURLToPath(import.meta.url)), "..", "browser", "pilot-parity.mjs");
const hex = seed => seed.repeat(64).slice(0, 64);

function validSummary(screenshotSeed = "a") {
  const records = VIEWPORTS.flatMap(v => THEMES.flatMap(t => STATES.map(s => ({
    viewport: v.name, theme: t, state: s, htmlSha256: hex("1"), htmlBytes: 100, ariaSha256: hex("2"), screenshotSha256: hex(screenshotSeed), screenshot: `${v.name}-${t}/${s}.png`
  }))));
  const focusTraces = VIEWPORTS.flatMap(v => THEMES.map(t => ({ viewport: v.name, theme: t, sha256: hex("3"), length: FOCUS_STOPS, focused: 20 })));
  return { schema: SCHEMA, status: "PASS", viewports: VIEWPORTS, themes: THEMES, states: STATES, focusStops: FOCUS_STOPS, exclusions: EXCLUSIONS, records, focusTraces };
}
const clone = value => JSON.parse(JSON.stringify(value));
const compare = (baseline, candidate, noise = []) => compareCaptures({ baseline, candidate, noise });

test("identical complete captures pass and report counts separately", () => {
  const report = compare(validSummary(), validSummary());
  assert.equal(report.pass, true, JSON.stringify(report.errors));
  const total = VIEWPORTS.length * THEMES.length * STATES.length;
  assert.equal(report.counts.renderedStates, total);
  assert.equal(report.counts.focusOrderTraces, VIEWPORTS.length * THEMES.length);
  assert.equal(report.counts.screenshotsExactMatch, total);
  assert.equal(report.counts.screenshotsNoiseExcluded, 0);
});

test("missing or empty captures cannot pass", () => {
  assert.equal(compare(null, validSummary()).pass, false);
  assert.equal(compare(validSummary(), null).pass, false);
  const empty = validSummary(); empty.records = []; empty.focusTraces = [];
  const report = compare(empty, empty);
  assert.equal(report.pass, false);
  assert.match(report.errors.join("\n"), /no rendered states/);
});

test("a missing state, a duplicated state or an unexpected state fails", () => {
  const missing = validSummary(); missing.records.pop();
  assert.match(validateSummary(missing).join("\n"), /missing state desktop-1440-dark\/inputs-large/);
  assert.equal(compare(validSummary(), missing).pass, false);
  const duplicated = validSummary(); duplicated.records[1] = clone(duplicated.records[0]);
  assert.match(validateSummary(duplicated).join("\n"), /duplicate state/);
  const extra = validSummary(); extra.records.push({ ...clone(extra.records[0]), state: "toggle-99" });
  assert.match(validateSummary(extra).join("\n"), /unexpected state .*toggle-99/);
});

test("reduced viewport, theme or interaction coverage fails even if self-consistent", () => {
  const fewer = validSummary(); fewer.states = STATES.slice(0, 3);
  fewer.records = fewer.records.filter(record => fewer.states.includes(record.state));
  assert.match(validateSummary(fewer).join("\n"), /interaction-state coverage/);
  const noDark = validSummary(); noDark.themes = ["light"];
  assert.match(validateSummary(noDark).join("\n"), /theme coverage/);
  const noMobile = validSummary(); noMobile.viewports = VIEWPORTS.slice(1);
  assert.match(validateSummary(noMobile).join("\n"), /viewport coverage/);
});

test("malformed digests, empty HTML and broken focus traces fail", () => {
  const bad = validSummary();
  bad.records[0].htmlSha256 = "not-a-digest";
  bad.records[1].htmlBytes = 0;
  bad.focusTraces[0].length = 3;
  bad.focusTraces[1].focused = 0;
  bad.focusTraces.pop();
  const problems = validateSummary(bad).join("\n");
  for (const pattern of [/malformed htmlSha256/, /empty or malformed HTML/, /focus trace has 3 stops/, /reached no element/, /missing focus trace/]) assert.match(problems, pattern);
});

test("a capture whose status is not PASS (failed interaction) cannot be compared", () => {
  const failed = validSummary(); failed.status = "FAIL";
  assert.equal(compare(failed, validSummary()).pass, false);
});

test("DOM, ARIA and focus-order differences always fail, even with noise captures", () => {
  const candidate = validSummary(); candidate.records[5].htmlSha256 = hex("9");
  assert.equal(compare(validSummary(), candidate, [validSummary()]).domAriaDifferences.length, 1);
  assert.equal(compare(validSummary(), candidate, [validSummary()]).pass, false);
  const focus = validSummary(); focus.focusTraces[0].sha256 = hex("8");
  assert.deepEqual(compare(validSummary(), focus).focusDifferences, ["mobile-390-light"]);
});

test("a screenshot difference fails unless the baseline itself was unstable for that state", () => {
  const candidate = validSummary(); candidate.records[4].screenshotSha256 = hex("b");
  const strict = compare(validSummary(), candidate);
  assert.equal(strict.pass, false);
  assert.equal(strict.counts.screenshotsDiffering, 1);
  const noisy = validSummary(); noisy.records[4].screenshotSha256 = hex("c");
  const tolerated = compare(validSummary(), candidate, [noisy]);
  assert.equal(tolerated.pass, true);
  assert.equal(tolerated.counts.screenshotsNoiseExcluded, 1, "the exclusion is reported, not hidden");
  assert.equal(tolerated.counts.screenshotsExactMatch, tolerated.counts.screenshotsCompared - 1);
  // Noise in a different state does not excuse this one.
  const elsewhere = validSummary(); elsewhere.records[7].screenshotSha256 = hex("c");
  assert.equal(compare(validSummary(), candidate, [elsewhere]).pass, false);
});

test("noise exclusions are bounded", () => {
  const candidate = validSummary("b");
  const noisy = validSummary("c");
  const report = compare(validSummary(), candidate, [noisy]);
  assert.equal(report.pass, false);
  assert.match(report.errors.join("\n"), /exceed the bound/);
});

test("noise captures that disagree on DOM or focus order invalidate the comparison", () => {
  const noisy = validSummary(); noisy.records[2].ariaSha256 = hex("7");
  const report = compare(validSummary(), validSummary(), [noisy]);
  assert.equal(report.pass, false);
  assert.match(report.errors.join("\n"), /not deterministic/);
});

test("interactions fail on a thrown action or an unreached post-state", async () => {
  await assert.rejects(interact("click", async () => { throw new Error("element detached"); }, async () => true), /interaction "click" failed: element detached/);
  await assert.rejects(interact("toggle", async () => {}, async () => false), /did not reach its expected state/);
  await assert.rejects(interact("toggle", async () => {}, async () => { throw new Error("timeout"); }), /did not reach its expected state: timeout/);
  await interact("ok", async () => {}, async () => true);
});

test("CLI exits nonzero for an empty directory and zero for complete identical captures", () => {
  const root = mkdtempSync(join(tmpdir(), "pilot-parity-"));
  try {
    for (const name of ["a", "b", "empty"]) mkdirSync(join(root, name));
    writeFileSync(join(root, "a", "summary.json"), JSON.stringify(validSummary()));
    writeFileSync(join(root, "b", "summary.json"), JSON.stringify(validSummary()));
    const run = (...args) => { try { execFileSync(process.execPath, [harness, "compare", ...args], { stdio: "pipe" }); return 0; } catch (error) { return error.status; } };
    assert.equal(run(join(root, "a"), join(root, "b")), 0);
    assert.equal(run(join(root, "empty"), join(root, "b")), 1);
    assert.equal(run(join(root, "a"), join(root, "empty")), 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
