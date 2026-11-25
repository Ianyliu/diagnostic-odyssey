import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildApiSnapshot, renderApiSnapshot } from "./api-snapshot.ts";
import { buildCharacterization, renderCharacterization } from "./capture.ts";

const golden = (name: string): string => readFileSync(fileURLToPath(new URL(`./golden/${name}`, import.meta.url)), "utf8");

function describeCaseDrift(expectedText: string, actualText: string): string {
  const expected = JSON.parse(expectedText).cases as Record<string, unknown>;
  const actual = JSON.parse(actualText).cases as Record<string, unknown>;
  const ids = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  const drift = ids.filter(id => JSON.stringify(expected[id]) !== JSON.stringify(actual[id]));
  const shown = drift.slice(0, 15).map(id =>
    `  ${id}\n    baseline: ${JSON.stringify(expected[id])?.slice(0, 220)}\n    current:  ${JSON.stringify(actual[id])?.slice(0, 220)}`);
  return `${drift.length} of ${ids.length} characterized cases differ:\n${shown.join("\n")}${drift.length > shown.length ? `\n  ... and ${drift.length - shown.length} more` : ""}`;
}

test("scientific and contract behavior is exactly equivalent to the pre-refactor baseline", () => {
  const expected = golden("characterization.json");
  const actual = renderCharacterization(buildCharacterization());
  if (actual !== expected) assert.fail(describeCaseDrift(expected, actual));
});

test("type-level public API of every workspace package is unchanged", () => {
  const expected = golden("package-api.json");
  const actual = renderApiSnapshot(buildApiSnapshot());
  if (actual === expected) return;
  const before = JSON.parse(expected) as Record<string, Record<string, unknown>>;
  const after = JSON.parse(actual) as Record<string, Record<string, unknown>>;
  const lines: string[] = [];
  for (const pkg of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const names = new Set([...Object.keys(before[pkg] ?? {}), ...Object.keys(after[pkg] ?? {})]);
    for (const name of [...names].sort()) {
      if (JSON.stringify(before[pkg]?.[name]) !== JSON.stringify(after[pkg]?.[name])) {
        lines.push(`  ${pkg}.${name}\n    baseline: ${JSON.stringify(before[pkg]?.[name])?.slice(0, 260)}\n    current:  ${JSON.stringify(after[pkg]?.[name])?.slice(0, 260)}`);
      }
    }
  }
  assert.fail(`public API drift in ${lines.length} export(s):\n${lines.slice(0, 15).join("\n")}`);
});
