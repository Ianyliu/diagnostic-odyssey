import assert from "node:assert/strict";
import test from "node:test";
import { AI_RESEARCH_MODULES, AI_RESEARCH_TEMPLATE_VERSION, enrichAiHandoff } from "../src/data/aiHandoffResearch.ts";
import { AI_PROVIDER_CHOICES, AI_PUBLIC_RESEARCH_LINKS, availableAiProviders } from "../src/data/aiHandoffProviders.ts";
import { copyAndOpenAiProvider } from "../src/data/aiHandoffTransfer.ts";
import type { AiHandoffTextV1 } from "../src/data/aiHandoff.ts";

const input = {
  markdown: "# Existing handoff\nBEGIN_DIAGNOSTIC_ODYSSEY_DATA\ncanonical JSON\nEND_DIAGNOSTIC_ODYSSEY_DATA\n",
  plainTextLength: 92,
  envelope: {payload: {burden_findings: [{estimate_id: "ID1", value: 1}]}}
} as unknown as AiHandoffTextV1;

test("optional modules extend rather than mutate full canonical handoff", () => {
  const original = input.markdown;
  const result = enrichAiHandoff(input, ["visuals", "literature", "interventions"]);
  assert.equal(input.markdown, original);
  assert.ok(result.markdown.startsWith(original.trimEnd()));
  assert.ok(result.markdown.includes(AI_RESEARCH_TEMPLATE_VERSION));
  assert.ok(result.markdown.indexOf("END_DIAGNOSTIC_ODYSSEY_DATA") < result.markdown.indexOf("## Additional research"));
  assert.ok(result.markdown.indexOf("## Retrieved literature") < result.markdown.indexOf("## Investigational interventions"));
  assert.ok(result.markdown.indexOf("## Investigational interventions") < result.markdown.indexOf("## Visualizations"));
  assert.ok(result.markdown.includes("No sources retrieved"));
  assert.ok(result.markdown.includes("95% confidence intervals"));
  assert.ok(result.markdown.includes("not ROI"));
  assert.equal(result.envelope, input.envelope);
  assert.equal(result.plainTextLength, Array.from(result.markdown).length);
  assert.ok(Object.isFrozen(result));
  assert.equal(enrichAiHandoff(input, []), input);
});

test("module validation fails closed", () => {
  assert.deepEqual(AI_RESEARCH_MODULES, ["literature", "interventions", "visuals"]);
  assert.throws(() => enrichAiHandoff(input, ["literature", "literature"]), /duplicate/);
  assert.throws(() => enrichAiHandoff(input, ["unreviewed"] as never), /Unsupported/);
});

test("provider home links exclude any private content, and build-time allowlist is restrictive", () => {
  for (const provider of AI_PROVIDER_CHOICES) {
    const url = new URL(provider.home);
    assert.equal(url.protocol, "https:");
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
  }
  assert.deepEqual(availableAiProviders(""), []);
  assert.deepEqual(availableAiProviders("claude,chatgpt,unknown").map(p => p.id), ["chatgpt", "claude"]);
  assert.deepEqual(availableAiProviders(undefined), AI_PROVIDER_CHOICES);
  for (const link of AI_PUBLIC_RESEARCH_LINKS) {
    const url = new URL(link.url);
    assert.equal(url.protocol, "https:");
    assert.match(url.hostname, /^(pubmed\.ncbi\.nlm\.nih\.gov|clinicaltrials\.gov)$/);
    assert.ok(url.searchParams.get("term"));
    assert.ok(!link.url.includes("private"));
  }
});

test("clipboard and provider launch start synchronously in one click", async () => {
  const events: string[] = [];
  let finish!: () => void;
  const action = copyAndOpenAiProvider(
    "private Brief content", AI_PROVIDER_CHOICES[0]!, {writeText: value => {
      events.push("write:" + value);
      return new Promise<void>(resolve => {finish = resolve;});
    }}, true, (url, target, features) => {
      events.push("open:" + url + ":" + target + ":" + features);
      return null; // noopener may return null on successful open.
    }
  );
  assert.deepEqual(events, ["write:private Brief content", "open:https://chatgpt.com/:_blank:noopener,noreferrer"]);
  assert.equal(action.launch, "attempted");
  finish();
  assert.equal(await action.copy, "copied");
});

test("window launch and clipboard denial are reported without auto-submission", async () => {
  const action = copyAndOpenAiProvider("private", AI_PROVIDER_CHOICES[1]!,
    {writeText: async () => {throw new Error("denied");}}, true, () => {throw new Error("blocked");});
  assert.equal(action.launch, "failed");
  assert.equal(await action.copy, "denied");
});
