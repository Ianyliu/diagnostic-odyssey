import type {ProviderAdapter, TokenUsage} from "../types.ts";

export function createOllamaAdapter(args?: {
  host?: string;
  model?: string;
}): ProviderAdapter {
  const host = (args?.host || process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/+$/, "");
  const modelName = args?.model || process.env.OLLAMA_MODEL || "qwen3.5:4b";

  return {
    provider: "ollama",
    modelName,
    async generateCandidate({
      egressJson,
      temperature,
      seed,
      timeoutMs = 15000,
    }) {
      const url = `${host}/api/chat`;

      const systemPrompt =
        "You are a strictly bounded candidate generator for Diagnostic Odyssey planning guidance. " +
        "You accept a JSON ModelEgressV1 snapshot and select ONLY existing finding_ids, option reference_ids (matching claim_code), " +
        "and request template_ids (matching gap_id and hint_id if released) from the provided input egress. " +
        "You MUST respond ONLY with a single JSON object conforming strictly to the ModelCandidateV1 schema: " +
        '{"schema_version":"pg.v1","snapshot_fingerprint":"<exact_fingerprint>","finding_ids":["<id>"],"options":[{"reference_id":"<id>","claim_code":"<code>"}],"requests":[{"template_id":"<id>","gap_id":"<id>","hint_id":null}]}. ' +
        "Do NOT include explanations, markdown formatting, text notes, warnings, values, or extra fields.";

      const body = {
        model: modelName,
        messages: [
          {role: "system", content: systemPrompt},
          {role: "user", content: egressJson},
        ],
        stream: false,
        format: "json",
        options: {
          temperature,
          seed,
        },
      };

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
            `Ollama API error (${response.status} ${response.statusText}): ${text}`
          );
        }

        const data = (await response.json()) as {
          message?: {content?: string};
          prompt_eval_count?: number;
          eval_count?: number;
        };

        const rawResponseText = data.message?.content || "";
        const tokenUsage: TokenUsage = {
          promptTokens: data.prompt_eval_count || 0,
          candidateTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        };

        return {
          rawResponseText,
          latencyMs,
          tokenUsage,
          estimatedCostUsd: 0.0,
        };
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
          throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
        }
        throw new Error(
          `Ollama server unavailable on ${host}: ${err.message || String(err)}`
        );
      }
    },
  };
}
