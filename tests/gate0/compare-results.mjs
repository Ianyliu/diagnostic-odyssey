/* global process, console */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [beforePath, afterPath, outputPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  throw new Error(
    "Usage: node compare-results.mjs BEFORE/qa-results.json AFTER/qa-results.json [comparison.json]",
  );
}
const [before, after] = await Promise.all(
  [beforePath, afterPath].map(async (path) =>
    JSON.parse(await readFile(path, "utf8")),
  ),
);
const keys = [
  "defaultBrief",
  "selectedBrief",
  "staleBrief",
  "refreshedBrief",
  "capacitySensitivity",
  "reachSensitivity",
  "windowSensitivity",
];
function normalize(value) {
  if (value && !Array.isArray(value) && typeof value === "object") {
    // Only the Brief's execution timestamp varies. Reviewed metadata stays compared.
    const copy = { ...value };
    if (Array.isArray(copy.burden_findings)) delete copy.generated_at;
    return Object.fromEntries(
      Object.entries(copy)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return Array.isArray(value) ? value.map(normalize) : value;
}
function checksum(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
const results = keys.map((key) => {
  assert.ok(
    Object.hasOwn(before.snapshots, key),
    `Baseline snapshot missing: ${key}`,
  );
  assert.ok(
    Object.hasOwn(after.snapshots, key),
    `Repaired snapshot missing: ${key}`,
  );
  const beforeValue = normalize(before.snapshots[key]);
  const afterValue = normalize(after.snapshots[key]);
  let status = "PASS";
  let error;
  try {
    assert.deepEqual(afterValue, beforeValue);
  } catch (cause) {
    status = "FAIL";
    error = String(cause);
  }
  return {
    key,
    status,
    beforeSha256: checksum(beforeValue),
    afterSha256: checksum(afterValue),
    ...(error ? { error } : {}),
  };
});
const report = {
  before: beforePath,
  after: afterPath,
  ignored: "Planning Brief top-level generated_at only",
  results,
};
const serialized = JSON.stringify(report, null, 2);
if (outputPath) await writeFile(outputPath, serialized + "\n");
console.log(serialized);
process.exitCode = results.some((result) => result.status === "FAIL") ? 1 : 0;
