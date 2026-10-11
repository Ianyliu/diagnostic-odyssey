import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import {basename, dirname, join, resolve} from "node:path";
import process from "node:process";

const [beforePath, afterPath, reportPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !reportPath) throw new Error("Usage: node compare-governed-regression.mjs BEFORE.json AFTER.json REPORT.json");
const outputPath = resolve(reportPath);
assert.ok(!existsSync(outputPath) || !lstatSync(outputPath).isSymbolicLink(), "Report output must not be a symlink");
const resolvedOutput = join(realpathSync(dirname(outputPath)), basename(outputPath));
assert.ok(!resolvedOutput.split(/[\\/]/).some((part, index, parts) => part === "artifacts" && parts[index + 1] === "reviewed"), "Refusing to write a reviewed artifact");
const before = JSON.parse(readFileSync(beforePath, "utf8"));
const after = JSON.parse(readFileSync(afterPath, "utf8"));
const sha256 = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sections = ["invariants", "scenarios", "briefs", "checksums"].map(section => ({
  section, before_sha256: sha256(before[section]), after_sha256: sha256(after[section]),
  unchanged: JSON.stringify(before[section]) === JSON.stringify(after[section])
}));
const report = {
  unchanged: sections.every(section => section.unchanged), sections,
  invariants: after.invariants,
  scenarios: after.scenarios.map(scenario => ({id: scenario.id, result: scenario.result,
    sensitivity_points: Object.fromEntries(Object.entries(scenario.sensitivities).map(([field, points]) => [field, points.length]))})),
  briefs: after.briefs.map(brief => ({id: brief.id, sha256: brief.sha256,
    exported_estimates: JSON.parse(brief.json).burden_findings.length,
    selected_local_records: JSON.parse(brief.json).local_context.length,
    selected_current_data_requests: JSON.parse(brief.json).data_requests.length}))
};
writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
assert.equal(report.unchanged, true, "Governed regression changed; inspect report before merging or deploying");
assert.deepEqual(after, before, "Unexpected snapshot schema or metadata changed");
