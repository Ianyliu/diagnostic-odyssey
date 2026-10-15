import assert from "node:assert/strict";
import test from "node:test";
import { copyAiHandoffText, aiHandoffFilename } from "../src/data/aiHandoffTransfer.ts";
import type { AiHandoffTextV1 } from "../src/data/aiHandoff.ts";

test("clipboard preserves the full text and only succeeds after the browser promise resolves", async () => {
  const text = `# Full prompt\n${"🧬 <source>\n".repeat(20000)}`;
  let release!: () => void;
  let received = "";
  let settled = false;
  const result = copyAiHandoffText(text, {writeText: value => {
    received = value;
    return new Promise<void>(resolve => { release = resolve; });
  }}, true).then(value => { settled = true; return value; });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(received, text);
  release();
  assert.equal(await result, "copied");
});

test("clipboard denied, missing and insecure contexts preserve a manual fallback without retrying", async () => {
  let writes = 0;
  const denied = {writeText: async () => { writes++; throw new Error("not allowed"); }};
  assert.equal(await copyAiHandoffText("full prompt", denied, false), "insecure");
  assert.equal(writes, 0);
  assert.equal(await copyAiHandoffText("full prompt", undefined, true), "unsupported");
  assert.equal(await copyAiHandoffText("full prompt", denied, true), "denied");
  assert.equal(writes, 1);
});

test("download names use bounded safe provenance and goal tokens, never optional question content", () => {
  const snapshot = {envelope: {provenance: {national_artifact_version: `../<script>\n${"x".repeat(300)}`},
    analysis_goal: "technical", generated_at: "2026-10-15T12:00:00Z", optional_question: "PRIVATE"}} as AiHandoffTextV1;
  const name = aiHandoffFilename(snapshot);
  assert.match(name, /^diagnostic-odyssey-[A-Za-z0-9_-]+-technical-2026-10-15-ai-handoff\.md$/);
  assert.ok(name.length < 180);
  assert.ok(!name.includes("PRIVATE"));
});
