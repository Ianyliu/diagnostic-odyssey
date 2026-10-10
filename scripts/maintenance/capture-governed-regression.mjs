// Run with Node 22 and --experimental-strip-types; imports the chosen checkout.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve, join, relative } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] ?? process.cwd());
const output = process.argv[3];
if (!output) throw new Error("Usage: node --experimental-strip-types capture-governed-regression.mjs CHECKOUT OUTPUT.json");
const outputPath = resolve(output);
assert.ok(!existsSync(outputPath) || !lstatSync(outputPath).isSymbolicLink(), "Output must not be a symlink");
const resolvedOutput = join(realpathSync(dirname(outputPath)), basename(outputPath));
assert.ok(!resolvedOutput.split(/[\\/]/).some((part, index, parts) => part === "artifacts" && parts[index + 1] === "reviewed"), "Refusing to write a reviewed artifact");
const load = path => import(pathToFileURL(join(root, path)).href);
const json = path => JSON.parse(readFileSync(join(root, path), "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const { calculateScenario, oneWaySensitivity } = await load("packages/scenario-engine/src/index.ts");
const { buildPlanningBrief, serializeBriefJson } = await load("packages/brief-core/src/index.ts");
const { createPlanningScenarioDefaults } = await load("apps/web/src/data/planningScenarioDefaults.ts");
const { buildSensitivityValues } = await load("apps/web/src/data/decisionVisuals.ts");
const { createSensitivityDataRequest, isDataRequestCurrentForScenario } = await load("apps/web/src/data/dataRequestTemplates.ts");
const { createLocalContextSelectionForArtifact, updateLocalContextSelection, resolveSelectedLocalContext, deriveBriefContextWithSelectedLocalContext } = await load("apps/web/src/data/localContextSelection.ts");
const { withStaleSelectedDataRequestWarning } = await load("apps/web/src/data/briefDataRequestWarnings.ts");

const bundle = json("artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json");
const local = json("artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json");
const estimates = bundle.burden_domains.flatMap(domain => domain.measures);
assert.equal(estimates.length, 21);
assert.equal(local.indicators.length, 34);
const base = createPlanningScenarioDefaults();
const cases = [
  ["defaults", base],
  ["capacity-constrained", {...base, capacity: 2000}],
  ["horizon-capped", {...base, horizon_months: 4, alternative_window_months: 3}],
  ["precise-reach", {...base, reach: 0.251234567}],
  ["zero-reach", {...base, reach: 0}],
  ["zero-capacity", {...base, capacity: 0}],
  ["zero-resources", {...base, fixed_cost: 0, per_participant_cost: 0}],
  ["near-zero-reach", {...base, eligible_population: 1e9, reach: 4e-7}],
  ["near-one-reach", {...base, reach: 0.9999996}],
  ["rounding-boundary", {...base, eligible_population: 3, reach: 0.5, capacity: 1.5}],
  ["all-zero", {...base, eligible_population: 0, reach: 0, capacity: 0, baseline_window_months: 0, alternative_window_months: 0, horizon_months: 0, fixed_cost: 0, per_participant_cost: 0}]
];
const scenarios = cases.map(([id, input]) => ({
  id, input, result: calculateScenario(input),
  sensitivities: Object.fromEntries(["reach", "capacity", "alternative_window_months"].map(field => [
    field, oneWaySensitivity(input, field, buildSensitivityValues(input, field))
  ]))
}));

let selection = createLocalContextSelectionForArtifact(local);
for (const id of ["wv.hrsa.primary-care.designated-distinct-count", "wv.acs.uninsured_pct"]) {
  selection = updateLocalContextSelection(selection, local, id, true);
}
const selected = resolveSelectedLocalContext(selection, "loaded", local);
assert.equal(selected.length, 2);
const requestScenario = {...base, capacity: 42};
const selectedRequest = createSensitivityDataRequest(requestScenario, "capacity");
const briefs = [
  {id: "unselected-context-and-requests", input: base, records: [], requests: [], staleCount: 0},
  {id: "explicit-context-and-current-request", input: requestScenario, records: selected, requests: [selectedRequest], staleCount: 0},
  {id: "explicit-context-and-stale-request", input: {...requestScenario, capacity: 43}, records: selected, requests: [selectedRequest], staleCount: 1}
].map(({id, input, records, requests, staleCount}) => {
  const currentRequests = requests.filter(request => isDataRequestCurrentForScenario(request, input));
  const brief = withStaleSelectedDataRequestWarning(buildPlanningBrief({
    context: deriveBriefContextWithSelectedLocalContext(bundle.context, "loaded", local, records),
    estimates, localContext: records, scenario: {input, result: calculateScenario(input)},
    evidence: bundle.evidence, dataRequests: currentRequests, generatedAt: "2026-10-08T00:00:00.000Z"
  }), staleCount);
  const serialized = serializeBriefJson(brief);
  const parsed = JSON.parse(serialized);
  assert.deepEqual(parsed.scenario.input, input);
  assert.deepEqual(parsed.scenario.result, calculateScenario(input));
  assert.deepEqual(parsed.burden_findings, estimates);
  assert.deepEqual(parsed.local_context, records);
  assert.equal(parsed.data_requests.length, requests.length - staleCount);
  for (const value of Object.values(parsed.scenario.result)) {
    if (typeof value === "number") assert.ok(Number.isFinite(value));
    assert.notEqual(value, null);
  }
  // Inclusion of context must not change national findings or scenario arithmetic.
  return {id, json: serialized, sha256: hash(serialized)};
});

const checksums = {};
const manifests = [];
function scan(directory) {
  for (const entry of readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const path = join(directory, entry.name);
    assert.equal(entry.isSymbolicLink(), false, "Reviewed artifacts must not be symlinks");
    if (entry.isDirectory()) scan(path);
    else {
      assert.ok(entry.isFile());
      checksums[relative(root, path).split("\\").join("/")] = hash(readFileSync(path));
      if (entry.name === "SHA256SUMS") manifests.push(path);
    }
  }
}
scan(join(root, "artifacts/reviewed"));
let verifiedManifestEntries = 0;
for (const manifest of manifests) {
  for (const line of readFileSync(manifest, "utf8").trim().split("\n")) {
    const match = /^([0-9a-f]{64}) {2}([^/\\]+)$/.exec(line);
    assert.ok(match, "Malformed reviewed manifest");
    assert.equal(hash(readFileSync(join(manifest, "..", match[2]))), match[1]);
    verifiedManifestEntries++;
  }
}
const snapshot = {
  schema_version: 1,
  invariants: {national_estimates: estimates.length, local_indicators: local.indicators.length, reviewed_files: Object.keys(checksums).length, verified_manifest_entries: verifiedManifestEntries},
  scenarios, briefs, checksums
};
writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + "\n");
