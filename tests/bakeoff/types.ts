import type {ModelCandidateV1, PlanningGuidanceOutputV1} from "../../packages/planning-guidance/src/types.ts";

export type ProviderKind = "ollama" | "gemini" | "mock";

export type BakeoffConfig = {
  provider: ProviderKind;
  model: string;
  numRuns: number;
  temperature: number;
  seed?: number;
  timeoutMs?: number;
  ollamaHost?: string;
  geminiApiKey?: string;
  systemPromptOverride?: string;
};

export type TokenUsage = {
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
};

export type RunResult = {
  runIndex: number;
  timestamp: string;
  provider: ProviderKind;
  model: string;
  latencyMs: number;
  tokenUsage?: TokenUsage;
  estimatedCostUsd?: number;
  schemaValid: boolean;
  bindingValid: boolean;
  candidate: ModelCandidateV1 | null;
  output: PlanningGuidanceOutputV1 | null;
  rejectionReason: string | null;
  failureCategory:
    | null
    | "malformed_json"
    | "extra_keys"
    | "hallucinated_finding_id"
    | "hallucinated_template_id"
    | "hallucinated_hint_id"
    | "hallucinated_reference_id"
    | "forged_warning"
    | "forged_value"
    | "nonexistent_admission"
    | "stale_fingerprint"
    | "provider_unavailable"
    | "invalid_schema"
    | "other";
};

export type BakeoffSummary = {
  provider: ProviderKind;
  model: string;
  totalRuns: number;
  schemaPassCount: number;
  schemaPassRate: number;
  bindingPassCount: number;
  bindingPassRate: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  totalPromptTokens: number;
  totalCandidateTokens: number;
  totalEstimatedCostUsd: number;
  failureCategories: Record<string, number>;
  runs: RunResult[];
};

export type ProviderAdapter = {
  provider: ProviderKind;
  modelName: string;
  generateCandidate(args: {
    egressJson: string;
    temperature: number;
    seed?: number;
    timeoutMs?: number;
  }): Promise<{
    rawResponseText: string;
    latencyMs: number;
    tokenUsage?: TokenUsage;
    estimatedCostUsd?: number;
  }>;
};
