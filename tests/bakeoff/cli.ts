import {createSyntheticFixture} from "./fixtures.ts";
import {createOllamaAdapter} from "./providers/ollama.ts";
import {createGeminiAdapter} from "./providers/gemini.ts";
import {createMockAdapter} from "./providers/mock.ts";
import {runBakeoffEvaluation} from "./evaluator.ts";
import type {BakeoffConfig, ProviderKind, ProviderAdapter} from "./types.ts";

function parseArgs(): BakeoffConfig & {jsonOutput: boolean} {
  const args = process.argv.slice(2);
  let provider: ProviderKind = "mock";
  let model = "";
  let numRuns = 10;
  let temperature = 0.1;
  let seed = 42;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--provider" && args[i + 1]) {
      const p = args[++i].toLowerCase();
      if (p === "ollama" || p === "gemini" || p === "mock") {
        provider = p;
      }
    } else if (arg === "--model" && args[i + 1]) {
      model = args[++i];
    } else if (arg === "--runs" && args[i + 1]) {
      numRuns = parseInt(args[++i], 10) || 10;
    } else if (arg === "--temperature" && args[i + 1]) {
      temperature = parseFloat(args[++i]) || 0.1;
    } else if (arg === "--seed" && args[i + 1]) {
      seed = parseInt(args[++i], 10) || 42;
    } else if (arg === "--json") {
      jsonOutput = true;
    }
  }

  return {
    provider,
    model,
    numRuns,
    temperature,
    seed,
    jsonOutput,
  };
}

async function main() {
  const opts = parseArgs();
  const fixture = createSyntheticFixture();

  let adapter: ProviderAdapter;
  if (opts.provider === "ollama") {
    adapter = createOllamaAdapter({
      model: opts.model || process.env.OLLAMA_MODEL || "qwen3.5:4b",
    });
  } else if (opts.provider === "gemini") {
    adapter = createGeminiAdapter({
      model: opts.model || process.env.GEMINI_MODEL || "gemini-1.5-flash",
    });
  } else {
    adapter = createMockAdapter({
      model: opts.model || "synthetic-mock-v1",
      behavior: "valid",
    });
  }

  const summary = await runBakeoffEvaluation({
    adapter,
    input: fixture.input,
    authority: fixture.authority,
    config: {
      provider: opts.provider,
      model: adapter.modelName,
      numRuns: opts.numRuns,
      temperature: opts.temperature,
      seed: opts.seed,
    },
  });

  if (opts.jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log("=================================================");
  console.log("  DIAGNOSTIC ODYSSEY - SYNTHETIC PROVIDER BAKEOFF");
  console.log("=================================================");
  console.log(` Provider:             ${summary.provider.toUpperCase()}`);
  console.log(` Model:                ${summary.model}`);
  console.log(` Total Runs:           ${summary.totalRuns}`);
  console.log(
    ` Schema Pass Rate:     ${(summary.schemaPassRate * 100).toFixed(1)}% (${summary.schemaPassCount}/${summary.totalRuns})`
  );
  console.log(
    ` Binding Pass Rate:    ${(summary.bindingPassRate * 100).toFixed(1)}% (${summary.bindingPassCount}/${summary.totalRuns})`
  );
  console.log(` Avg Latency:          ${summary.avgLatencyMs} ms`);
  console.log(` Min / Max Latency:    ${summary.minLatencyMs} / ${summary.maxLatencyMs} ms`);
  console.log(` P95 Latency:          ${summary.p95LatencyMs} ms`);
  console.log(
    ` Tokens (Prompt/Cand): ${summary.totalPromptTokens} / ${summary.totalCandidateTokens}`
  );
  console.log(
    ` Est. Total Cost:      $${summary.totalEstimatedCostUsd.toFixed(6)}`
  );

  if (Object.keys(summary.failureCategories).length > 0) {
    console.log("-------------------------------------------------");
    console.log(" Failure Breakdown:");
    for (const [cat, count] of Object.entries(summary.failureCategories)) {
      console.log(`   - ${cat}: ${count}`);
    }
  }
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Bakeoff execution error:", err);
  process.exit(1);
});
