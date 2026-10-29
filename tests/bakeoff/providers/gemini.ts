import type {ProviderAdapter, TokenUsage} from "../types.ts";

export function createGeminiAdapter(args?: {
  apiKey?: string;
  model?: string;
}): ProviderAdapter {
  const apiKey = args?.apiKey || process.env.GEMINI_API_KEY;
  const modelName = args?.model || process.env.GEMINI_MODEL || "gemini-1.5-flash";

  return {
    provider: "gemini",
    modelName,
    async generateCandidate({
      egressJson,
      temperature,
      seed,
      timeoutMs = 15000,
    }) {
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY environment variable is not set. " +
            "Gemini evaluation is strictly manual and opt-in."
        );
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const systemPrompt =
        "You are a strictly bounded candidate generator for Diagnostic Odyssey planning guidance. " +
        "You accept a JSON ModelEgressV1 snapshot and select ONLY existing finding_ids, option reference_ids (matching claim_code), " +
        "and request template_ids (matching gap_id and hint_id if released) from the provided input egress. " +
        "You MUST respond ONLY with a single JSON object conforming strictly to the ModelCandidateV1 schema: " +
        '{"schema_version":"pg.v1","snapshot_fingerprint":"<exact_fingerprint>","finding_ids":["<id>"],"options":[{"reference_id":"<id>","claim_code":"<code>"}],"requests":[{"template_id":"<id>","gap_id":"<id>","hint_id":null}]}. ' +
        "Do NOT include explanations, markdown formatting, text notes, warnings, values, or extra fields.";

      const body: Record<string, any> = {
        systemInstruction: {
          parts: [{text: systemPrompt}],
        },
        contents: [
          {
            role: "user",
            parts: [{text: egressJson}],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature,
        },
      };

      if (typeof seed === "number") {
        body.generationConfig.seed = seed;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const startMs = Date.now();

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const latencyMs = Date.now() - startMs;
        clearTimeout(timer);

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            `Gemini API error (${response.status} ${response.statusText}): ${text}`
          );
        }

        const data = (await response.json()) as {
          candidates?: {
            content?: {
              parts?: {text?: string}[];
            };
          }[];
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        };

        const rawResponseText =
          data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        const promptTokens = data.usageMetadata?.promptTokenCount || 0;
        const candidateTokens = data.usageMetadata?.candidatesTokenCount || 0;
        const totalTokens =
          data.usageMetadata?.totalTokenCount || promptTokens + candidateTokens;

        const tokenUsage: TokenUsage = {
          promptTokens,
          candidateTokens,
          totalTokens,
        };

        // Estimated cost based on Gemini Flash rates ($0.075/1M in, $0.30/1M out)
        const promptCost = (promptTokens / 1_000_000) * 0.075;
        const candidateCost = (candidateTokens / 1_000_000) * 0.30;
        const estimatedCostUsd = Number((promptCost + candidateCost).toFixed(6));

        return {
          rawResponseText,
          latencyMs,
          tokenUsage,
          estimatedCostUsd,
        };
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
          throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
        }
        throw new Error(`Gemini API call failed: ${err.message || String(err)}`);
      }
    },
  };
}
