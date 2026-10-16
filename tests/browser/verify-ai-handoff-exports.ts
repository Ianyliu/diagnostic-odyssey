/** Exercise the read-only handoff against actual browser-downloaded Briefs. No output is transmitted. */
import assert from "node:assert/strict";
import {readFile, readdir, writeFile} from "node:fs/promises";
import {join} from "node:path";
import type {PlanningBrief} from "@diagnostic-odyssey/brief-core";
import {createAiHandoffText} from "../../apps/web/src/data/aiHandoff.ts";
import {AI_GOALS} from "../../apps/web/src/data/aiHandoffTemplates.ts";

const directory = process.argv[2];
assert.ok(directory, "Pass a browser output directory containing downloaded Brief JSON.");
const results: {file: string; goals: number; stale: boolean}[] = [];
for (const file of (await readdir(directory)).filter(name => name.endsWith(".json"))) {
  const raw: unknown = JSON.parse(await readFile(join(directory, file), "utf8"));
  if (!raw || typeof raw !== "object" || !("title" in raw) || raw.title !== "Diagnostic Odyssey planning brief") continue;
  const brief = raw as PlanningBrief;
  const before = JSON.stringify(brief);
  for (const goal of AI_GOALS) {
    const text = createAiHandoffText(brief, {goal});
    assert.deepEqual(text.envelope.payload, brief, `${file}: ${goal} canonical parity`);
    assert.deepEqual(text.envelope.payload.warnings, brief.warnings);
    assert.equal(text.envelope.generated_at, brief.generated_at);
    assert.equal(Object.isFrozen(text.envelope.payload), true);
    assert.equal(JSON.stringify(brief), before, "Handoff must not mutate the browser export.");
  }
  results.push({file, goals: AI_GOALS.length, stale: brief.warnings.some(warning => /stale/.test(warning))});
}
assert.ok(results.length > 0, "No actual Planning Brief exports were verified.");
assert.ok(results.some(result => result.stale), "Exercise a real stale-request Brief, not just the default state.");
await writeFile(join(directory, "ai-handoff-export-verification.json"), JSON.stringify({status: "PASS", results}, null, 2));
console.log(`PASS: ${results.length} real browser Brief exports × ${AI_GOALS.length} handoff goals; warnings and canonical payloads unchanged.`);
