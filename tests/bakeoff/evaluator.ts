import type {
  PlanningGuidanceInputV1,
  VerifiedAuthority,
  ModelCandidateV1,
  PlanningGuidanceOutputV1,
} from "../../packages/planning-guidance/src/types.ts";
import {
  projectEgress,
  assertCandidate,
  bindCandidate,
  assertOutput,
  fingerprint,
} from "../../packages/planning-guidance/src/index.ts";
import type {
  ProviderAdapter,
  BakeoffConfig,
  RunResult,
  BakeoffSummary,
} from "./types.ts";

export function categorizeFailure(
  errText: string,
  candidate?: unknown,
  input?: PlanningGuidanceInputV1
): RunResult["failureCategory"] {
  const msg = errText.toLowerCase();

  if (msg.includes("syntaxerror") || msg.includes("json") || msg.includes("malformed")) {
    return "malformed_json";
  }
  if (msg.includes("warning")) {
    return "forged_warning";
  }
  if (
    msg.includes("numerical") ||
    msg.includes("value") ||
    msg.includes("drift")
  ) {
    return "forged_value";
  }
  if (msg.includes("extra") || msg.includes("unknown key")) {
    return "extra_keys";
  }
  if (msg.includes("unknown or fabricated finding")) {
    return "hallucinated_finding_id";
  }
  if (msg.includes("unknown template/gap relationship") || msg.includes("template")) {
    return "hallucinated_template_id";
  }
  if (msg.includes("unknown/unreleased hint")) {
    return "hallucinated_hint_id";
  }
  if (
    msg.includes("unadmitted") ||
    msg.includes("context-ineligible") ||
    msg.includes("unreleased reference")
  ) {
    // Disambiguate between completely hallucinated reference ID and existing background-only reference
    if (
      candidate &&
      typeof candidate === "object" &&
      Array.isArray((candidate as any).options) &&
      input?.narrative_admission?.references
    ) {
      const optionRefs = (candidate as any).options.map((o: any) => o?.reference_id);
      const admittedRefs = new Set(
        input.narrative_admission.references.map((r) => r.id)
      );
      const hasBackgroundOnly = optionRefs.some((refId: string) =>
        admittedRefs.has(refId)
      );
      if (hasBackgroundOnly) {
        return "nonexistent_admission";
      }
    }
    return "hallucinated_reference_id";
  }
  if (msg.includes("background-only") || msg.includes("nonexistent")) {
    return "nonexistent_admission";
  }
  if (msg.includes("stale snapshot") || msg.includes("stale")) {
    return "stale_fingerprint";
  }
  if (
    msg.includes("unavailable") ||
    msg.includes("connection refused") ||
    msg.includes("timed out") ||
    msg.includes("api error") ||
    msg.includes("gemini_api_key") ||
    msg.includes("not set") ||
    msg.includes("failed")
  ) {
    return "provider_unavailable";
  }
  if (msg.includes("invalid contract") || msg.includes("candidate")) {
    return "invalid_schema";
  }
  return "other";
}

export async function runBakeoffEvaluation(args: {
  adapter: ProviderAdapter;
  input: PlanningGuidanceInputV1;
  authority: VerifiedAuthority;
  config: BakeoffConfig;
}): Promise<BakeoffSummary> {
  const {adapter, input, authority, config} = args;
  const egress = projectEgress(input, authority);
  const egressJson = JSON.stringify(egress);
  const expectedFingerprint = fingerprint(input, authority);

  const numRuns = config.numRuns ?? 10;
  const runs: RunResult[] = [];
  const failureCategories: Record<string, number> = {};

  for (let i = 0; i < numRuns; i++) {
    const timestamp = new Date().toISOString();
    const generationId = `gen_bakeoff_${i + 1}`;
    const generatedAt = new Date().toISOString();

    let latencyMs = 0;
    let tokenUsage = undefined;
    let estimatedCostUsd = 0;
    let schemaValid = false;
    let bindingValid = false;
    let candidate: ModelCandidateV1 | null = null;
    let rawParsedCandidate: unknown = null;
    let output: PlanningGuidanceOutputV1 | null = null;
    let rejectionReason: string | null = null;
    let failureCategory: RunResult["failureCategory"] = null;

    try {
      const response = await adapter.generateCandidate({
        egressJson,
        temperature: config.temperature,
        seed: config.seed,
        timeoutMs: config.timeoutMs,
      });

      latencyMs = response.latencyMs;
      tokenUsage = response.tokenUsage;
      estimatedCostUsd = response.estimatedCostUsd ?? 0;

      // Step 1: JSON Parsing
      let parsed: unknown;
      try {
        parsed = JSON.parse(response.rawResponseText);
        rawParsedCandidate = parsed;
      } catch (jsonErr: any) {
        throw new Error(`Malformed JSON response: ${jsonErr.message}`);
      }

      // Step 2: Schema Validation (assertCandidate)
      try {
        assertCandidate(parsed);
        schemaValid = true;
        candidate = parsed as ModelCandidateV1;
      } catch (schemaErr: any) {
        throw new Error(`Candidate schema invalid: ${schemaErr.message}`);
      }

      // Step 3: Candidate Binding & Contract Output Assertion
      try {
        const boundOutput = bindCandidate(
          input,
          authority,
          candidate,
          generationId,
          generatedAt,
          expectedFingerprint
        );
        assertOutput(boundOutput, input, authority);
        bindingValid = true;
        output = boundOutput;
      } catch (bindingErr: any) {
        throw new Error(`Candidate binding failed: ${bindingErr.message}`);
      }
    } catch (err: any) {
      rejectionReason = err.message || String(err);
      failureCategory = categorizeFailure(rejectionReason!, rawParsedCandidate, input);
      failureCategories[failureCategory] =
        (failureCategories[failureCategory] || 0) + 1;
    }

    runs.push({
      runIndex: i + 1,
      timestamp,
      provider: adapter.provider,
      model: adapter.modelName,
      latencyMs,
      tokenUsage,
      estimatedCostUsd,
      schemaValid,
      bindingValid,
      candidate,
      output,
      rejectionReason,
      failureCategory,
    });
  }

  // Summary aggregation
  const schemaPassCount = runs.filter((r) => r.schemaValid).length;
  const bindingPassCount = runs.filter((r) => r.bindingValid).length;
  const latencies = runs.map((r) => r.latencyMs).sort((a, b) => a - b);
  const totalPromptTokens = runs.reduce(
    (acc, r) => acc + (r.tokenUsage?.promptTokens || 0),
    0
  );
  const totalCandidateTokens = runs.reduce(
    (acc, r) => acc + (r.tokenUsage?.candidateTokens || 0),
    0
  );
  const totalEstimatedCostUsd = runs.reduce(
    (acc, r) => acc + (r.estimatedCostUsd || 0),
    0
  );

  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
  const minLatencyMs = latencies[0] || 0;
  const maxLatencyMs = latencies[latencies.length - 1] || 0;
  const p95Index = Math.min(
    Math.floor(latencies.length * 0.95),
    latencies.length - 1
  );
  const p95LatencyMs = latencies[p95Index] || 0;

  return {
    provider: adapter.provider,
    model: adapter.modelName,
    totalRuns: numRuns,
    schemaPassCount,
    schemaPassRate: numRuns > 0 ? schemaPassCount / numRuns : 0,
    bindingPassCount,
    bindingPassRate: numRuns > 0 ? bindingPassCount / numRuns : 0,
    avgLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    p95LatencyMs,
    totalPromptTokens,
    totalCandidateTokens,
    totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6)),
    failureCategories,
    runs,
  };
}
