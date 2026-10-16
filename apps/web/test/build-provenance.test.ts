import assert from "node:assert/strict";
import test from "node:test";
import { displayBuildProvenance } from "../src/data/buildProvenance.ts";

const revision = "1c885c604dd6cc71fd64de044d0e9c6b320c8f0c";

test("source provenance links to the exact verified commit without inventing build time", () => {
  const value = displayBuildProvenance({sourceSha:revision,sourceCommitDate:"2026-10-16",buildDate:null});
  assert.equal(value.label, "Source 1c885c604d · committed 2026-10-16");
  assert.equal(value.url, `https://github.com/Ianyliu/diagnostic-odyssey/commit/${revision}`);
  assert.doesNotMatch(value.label, /built/i);
});

test("explicitly supplied build date is shown distinctly from source commit date", () => {
  const value = displayBuildProvenance({sourceSha:revision,sourceCommitDate:"2026-10-15",buildDate:"2026-10-16"});
  assert.equal(value.label, "Source 1c885c604d · committed 2026-10-15 · built 2026-10-16");
});

test("incomplete or untrusted build identities fail closed without a clickable link", () => {
  for (const sha of [null, "12345678", revision + "/evil", "x".repeat(40), "<script/>"]) {
    const value = displayBuildProvenance({sourceSha:sha,sourceCommitDate:"2026-10-16",buildDate:"2026-10-16"});
    assert.deepEqual(value, {label:"Source revision unavailable",url:null});
  }
});

test("invalid dates do not become provenance claims", () => {
  const value = displayBuildProvenance({sourceSha:revision,sourceCommitDate:"yesterday",buildDate:"some day"});
  assert.equal(value.label, "Source 1c885c604d");
  assert.ok(value.url?.endsWith(revision));
});
