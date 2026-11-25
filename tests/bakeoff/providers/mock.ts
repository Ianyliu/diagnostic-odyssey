import type {ProviderAdapter, TokenUsage} from "../types.ts";
import {createSyntheticFixture} from "../fixtures.ts";

export type MockBehavior =
  | "valid"
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
  | "provider_unavailable";

export function createMockAdapter(args?: {
  behavior?: MockBehavior;
  model?: string;
  latencyMs?: number;
}): ProviderAdapter {
  const behavior = args?.behavior || "valid";
  const modelName = args?.model || "synthetic-mock-v1";
  const fixedLatency = args?.latencyMs ?? 15;

  return {
    provider: "mock",
    modelName,
    async generateCandidate({egressJson}) {
      if (behavior === "provider_unavailable") {
        throw new Error("Mock provider network error: Connection refused");
      }

      const fixture = createSyntheticFixture();
      let responseObj: any;

      switch (behavior) {
        case "valid":
          responseObj = fixture.expectedCandidate;
          break;

        case "malformed_json":
          return {
            rawResponseText: "{" + JSON.stringify(fixture.expectedCandidate).slice(1, -5) + "... [MALFORMED JSON]",
            latencyMs: fixedLatency,
            tokenUsage: {promptTokens: 100, candidateTokens: 30, totalTokens: 130},
            estimatedCostUsd: 0,
          };

        case "extra_keys":
          responseObj = {
            ...fixture.expectedCandidate,
            disposition: "accepted",
            extra_field: "unauthorized_model_opinion",
          };
          break;

        case "hallucinated_finding_id":
          responseObj = {
            ...fixture.expectedCandidate,
            finding_ids: ["finding_meps_01", "finding_hallucinated_99"],
          };
          break;

        case "hallucinated_template_id":
          responseObj = {
            ...fixture.expectedCandidate,
            requests: [
              ...fixture.expectedCandidate.requests,
              {
                template_id: "template_hallucinated_99",
                gap_id: "gap_referral_delay",
                hint_id: null,
              },
            ],
          };
          break;

        case "hallucinated_hint_id":
          responseObj = {
            ...fixture.expectedCandidate,
            requests: [
              {
                template_id: "template_referral_01",
                gap_id: "gap_referral_delay",
                hint_id: "hint_unreleased_99",
              },
            ],
          };
          break;

        case "hallucinated_reference_id":
          responseObj = {
            ...fixture.expectedCandidate,
            options: [
              {
                reference_id: "ref_hallucinated_99",
                claim_code: "unadmitted_claim",
              },
            ],
          };
          break;

        case "forged_warning":
          responseObj = {
            ...fixture.expectedCandidate,
            warnings: [{id: "warn_suppressed", code: "override"}],
          };
          break;

        case "forged_value":
          responseObj = {
            ...fixture.expectedCandidate,
            numerical_values: [{id: "finding_meps_01", value: 9999}],
          };
          break;

        case "nonexistent_admission":
          responseObj = {
            ...fixture.expectedCandidate,
            options: [
              {
                reference_id: "ref_background_01",
                claim_code: "epidemiology_background",
              },
            ],
          };
          break;

        case "stale_fingerprint":
          responseObj = {
            ...fixture.expectedCandidate,
            snapshot_fingerprint: "pg1:" + "0".repeat(64),
          };
          break;

        default:
          responseObj = fixture.expectedCandidate;
      }

      const rawResponseText = JSON.stringify(responseObj, null, 2);
      const tokenUsage: TokenUsage = {
        promptTokens: egressJson.length / 4,
        candidateTokens: rawResponseText.length / 4,
        totalTokens: (egressJson.length + rawResponseText.length) / 4,
      };

      return {
        rawResponseText,
        latencyMs: fixedLatency,
        tokenUsage,
        estimatedCostUsd: 0,
      };
    },
  };
}
