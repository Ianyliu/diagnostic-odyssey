import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { displayBuildProvenance } from "../src/data/buildProvenance.ts";

test("positive footer description retains explicit source/build identity", () => {
  const shell = readFileSync(fileURLToPath(new URL("../src/components/AppShell.tsx", import.meta.url)), "utf8");
  assert.match(shell, /Reviewed public evidence with traceable sources/);
  assert.match(shell, /local context and analyst assumptions remain distinct/);
  assert.match(shell, /aria-label="Application source revision"/);
  assert.match(shell, /buildIdentity\.url/);
  assert.match(shell, /buildIdentity\.label/);
  const sha = "1c885c604dd6cc71fd64de044d0e9c6b320c8f0c";
  const value = displayBuildProvenance({sourceSha:sha,sourceCommitDate:"2026-10-19",buildDate:"2026-10-19"});
  assert.match(value.label, /Source 1c885c604d · committed 2026-10-19 · built 2026-10-19/);
  assert.equal(value.url, `https://github.com/Ianyliu/diagnostic-odyssey/commit/${sha}`);
});
