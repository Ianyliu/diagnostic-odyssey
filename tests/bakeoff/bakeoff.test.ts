import {test} from "node:test";
import assert from "node:assert/strict";
import {createSyntheticFixture} from "./fixtures.ts";
import {createMockAdapter, type MockBehavior} from "./providers/mock.ts";
import {createOllamaAdapter} from "./providers/ollama.ts";
import {createGeminiAdapter} from "./providers/gemini.ts";
import {runBakeoffEvaluation} from "./evaluator.ts";

test("bakeoff mock provider valid evaluation achieves 100% pass rate", async () => {
  const fixture = createSyntheticFixture();
  const adapter = createMockAdapter({behavior: "valid"});

  const summary = await runBakeoffEvaluation({
    adapter,
    input: fixture.input,
    authority: fixture.authority,
    config: {
      provider: "mock",
      model: "mock-valid",
      numRuns: 10,
      temperature: 0.1,
    },
  });

  assert.equal(summary.totalRuns, 10);
  assert.equal(summary.schemaPassCount, 10);
  assert.equal(summary.schemaPassRate, 1.0);
  assert.equal(summary.bindingPassCount, 10);
  assert.equal(summary.bindingPassRate, 1.0);
  assert.equal(Object.keys(summary.failureCategories).length, 0);

  for (const run of summary.runs) {
    assert.equal(run.schemaValid, true);
    assert.equal(run.bindingValid, true);
    assert.equal(run.rejectionReason, null);
    assert.equal(
      run.candidate?.snapshot_fingerprint,
      fixture.snapshotFingerprint
    );
  }
});

test("bakeoff evaluator catches and categorizes all failure cases in failure matrix", async () => {
  const fixture = createSyntheticFixture();

  const cases: {behavior: MockBehavior; expectedCategory: string}[] = [
    {behavior: "malformed_json", expectedCategory: "malformed_json"},
    {behavior: "extra_keys", expectedCategory: "extra_keys"},
    {
      behavior: "hallucinated_finding_id",
      expectedCategory: "hallucinated_finding_id",
    },
    {
      behavior: "hallucinated_template_id",
      expectedCategory: "hallucinated_template_id",
    },
    {behavior: "hallucinated_hint_id", expectedCategory: "hallucinated_hint_id"},
    {
      behavior: "hallucinated_reference_id",
      expectedCategory: "hallucinated_reference_id",
    },
    {behavior: "forged_warning", expectedCategory: "forged_warning"},
    {behavior: "forged_value", expectedCategory: "forged_value"},
    {
      behavior: "nonexistent_admission",
      expectedCategory: "nonexistent_admission",
    },
    {behavior: "stale_fingerprint", expectedCategory: "stale_fingerprint"},
    {
      behavior: "provider_unavailable",
      expectedCategory: "provider_unavailable",
    },
  ];

  for (const c of cases) {
    const adapter = createMockAdapter({behavior: c.behavior});
    const summary = await runBakeoffEvaluation({
      adapter,
      input: fixture.input,
      authority: fixture.authority,
      config: {
        provider: "mock",
        model: `mock-${c.behavior}`,
        numRuns: 1,
        temperature: 0.1,
      },
    });

    assert.equal(summary.bindingPassCount, 0, `Behavior ${c.behavior} should fail binding`);
    assert.equal(summary.runs[0].bindingValid, false);
    assert.ok(summary.runs[0].rejectionReason, `Behavior ${c.behavior} should set rejectionReason`);
    assert.equal(
      summary.runs[0].failureCategory,
      c.expectedCategory,
      `Behavior ${c.behavior} expected ${c.expectedCategory} but got ${summary.runs[0].failureCategory}`
    );
  }
});

test("bakeoff evaluator ensures candidate ID-only log output and redacts sensitive prompt strings", async () => {
  const fixture = createSyntheticFixture();
  const adapter = createMockAdapter({behavior: "valid"});

  const summary = await runBakeoffEvaluation({
    adapter,
    input: fixture.input,
    authority: fixture.authority,
    config: {
      provider: "mock",
      model: "mock-valid",
      numRuns: 1,
      temperature: 0.1,
    },
  });

  const runJson = JSON.stringify(summary.runs[0]);
  assert.ok(runJson.includes("candidate"));
  assert.equal("rawResponseText" in summary.runs[0], false);
  assert.equal("promptText" in summary.runs[0], false);
  assert.ok(summary.runs[0].candidate);
  assert.deepEqual(Object.keys(summary.runs[0].candidate!).sort(), [
    "finding_ids",
    "options",
    "requests",
    "schema_version",
    "snapshot_fingerprint",
  ]);
});

test("Ollama adapter fails gracefully when server is offline or unreachable", async () => {
  const fixture = createSyntheticFixture();
  const adapter = createOllamaAdapter({host: "http://127.0.0.1:59999"}); // closed port

  const summary = await runBakeoffEvaluation({
    adapter,
    input: fixture.input,
    authority: fixture.authority,
    config: {
      provider: "ollama",
      model: "qwen3.5:4b",
      numRuns: 1,
      temperature: 0.1,
      timeoutMs: 1000,
    },
  });

  assert.equal(summary.bindingPassCount, 0);
  assert.equal(summary.runs[0].failureCategory, "provider_unavailable");
  assert.ok(summary.runs[0].rejectionReason?.includes("Ollama server unavailable"));
});

test("Gemini adapter fails gracefully when GEMINI_API_KEY is not set", async () => {
  const fixture = createSyntheticFixture();
  const adapter = createGeminiAdapter({apiKey: ""});

  const summary = await runBakeoffEvaluation({
    adapter,
    input: fixture.input,
    authority: fixture.authority,
    config: {
      provider: "gemini",
      model: "gemini-1.5-flash",
      numRuns: 1,
      temperature: 0.1,
    },
  });

  assert.equal(summary.bindingPassCount, 0);
  assert.equal(summary.runs[0].failureCategory, "provider_unavailable");
  assert.ok(summary.runs[0].rejectionReason?.includes("GEMINI_API_KEY environment variable is not set"));
});
