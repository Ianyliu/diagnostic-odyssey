import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bindCandidate,
  assertOutput,
  projectEgress,
  fingerprint,
} from "../../packages/planning-guidance/src/index.ts";
import type {
  PlanningGuidanceInputV1,
  VerifiedAuthority,
  ModelCandidateV1,
} from "../../packages/planning-guidance/src/types.ts";

const ALLOWED_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
] as const;

type ModelName = (typeof ALLOWED_MODELS)[number];

const HEX64 = "a".repeat(64);

function getSyntheticFixture(): {
  input: PlanningGuidanceInputV1;
  authority: VerifiedAuthority;
} {
  const authority: VerifiedAuthority = { narrative: null, hints: null };
  const input: PlanningGuidanceInputV1 = {
    schema_version: "pg.v1",
    captured_at: "2026-10-11T12:30:00Z",
    versions: {
      national_release_id: "MEPS2024",
      national_release_sha256: HEX64,
      brief_version: "brief1",
      brief_content_sha256: HEX64,
      scenario_revision: "scenario1",
      scenario_content_sha256: HEX64,
      local_release_id: null,
      local_release_sha256: null,
      request_policy_id: "templates1",
      request_policy_sha256: HEX64,
    },
    context: {
      condition_id: "long_covid",
      cohort_id: "adult",
      population_id: "adults",
      setting_id: "outpatient",
      payer_id: "all_payers",
      geography_id: "national",
      pathway_step_id: "referral",
      mechanism_id: "delay",
    },
    national_estimate_count: 21,
    national_findings: [
      {
        id: "n1",
        source_id: "MEPS",
        estimate_id: "MEPS-EST-1",
        value: 7,
        unit_code: "persons",
        role: "national_reviewed",
        uncertainty_kind: "confidence_interval",
        lower: 5,
        upper: 9,
      },
    ],
    selected_local_context: [],
    scenario_assumptions: [
      {
        id: "a1",
        source_id: "analyst",
        value: 0.2,
        unit_code: "fraction",
        role: "analyst_assumption",
      },
    ],
    deterministic_results: [
      {
        id: "r1",
        source_id: "engine",
        value: 200,
        unit_code: "person_months",
        role: "deterministic_planning_result",
        metric_code: "person_months",
      },
    ],
    warnings: [{ id: "w1", code: "planning_not_effect" }],
    gaps: [{ id: "g1", pathway_step_id: "referral", mechanism_id: "delay" }],
    request_templates: [
      {
        id: "t1",
        gap_id: "g1",
        field_codes: ["referral_date"],
        owner_code: "clinic",
        granularity_code: "aggregate",
        window_code: "monthly",
        privacy_code: "aggregate_only",
      },
    ],
    narrative_admission: {
      release_sha256: null,
      review_sha256: null,
      applicability_sha256: null,
      applicability_policy_version: null,
      applicability_policy_sha256: null,
      references: [],
    },
    hint_admission: {
      release_sha256: null,
      policy_sha256: null,
      hints: [],
    },
  };
  return { input, authority };
}

function redactSecrets(text: string): string {
  let s = text;
  if (process.env.GEMINI_API_KEY) {
    s = s.replaceAll(process.env.GEMINI_API_KEY, "[REDACTED_SECRET]");
  }
  if (process.env.PRIVATE_DEV_AUTH_TOKEN) {
    s = s.replaceAll(process.env.PRIVATE_DEV_AUTH_TOKEN, "[REDACTED_SECRET]");
  }
  return s;
}

function sendJsonResponse(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>
) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const jsonStr = redactSecrets(JSON.stringify(body));
  res.end(jsonStr);
}

async function parseBody(
  req: IncomingMessage & { body?: unknown }
): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object" && !Array.isArray(req.body)) {
      return req.body as Record<string, unknown>;
    }
    if (typeof req.body === "string") {
      try {
        const parsed = JSON.parse(req.body);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }
  }

  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk: Buffer | string) => {
      data += chunk.toString();
      if (data.length > 65536) {
        req.destroy();
        resolve({});
      }
    });
    req.on("end", () => {
      if (!data.trim()) return resolve({});
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          resolve(parsed as Record<string, unknown>);
        } else {
          resolve({});
        }
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  // STRICT gate 1: Preview environment check
  if (process.env.VERCEL_ENV !== "preview") {
    return sendJsonResponse(res, 403, {
      error: "Access denied: Preview environment required",
      code: "ENVIRONMENT_NOT_PERMITTED",
    });
  }

  // STRICT gate 2: Provider explicit enablement check
  if (process.env.AI_PROVIDER_ENABLED !== "on") {
    return sendJsonResponse(res, 403, {
      error: "Access denied: AI provider is disabled",
      code: "PROVIDER_DISABLED",
    });
  }

  // STRICT gate 3: HTTP POST only
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJsonResponse(res, 405, {
      error: "Method not allowed: POST required",
      code: "METHOD_NOT_ALLOWED",
    });
  }

  // STRICT gate 4: Private development authorization check
  const expectedDevToken = process.env.PRIVATE_DEV_AUTH_TOKEN;
  if (!expectedDevToken) {
    return sendJsonResponse(res, 403, {
      error: "Access denied: Development authorization not configured",
      code: "AUTH_NOT_CONFIGURED",
    });
  }

  const authHeader =
    (req.headers["x-dev-authorization"] as string | undefined) ||
    (req.headers["authorization"] as string | undefined);

  const providedToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader?.trim();

  if (!providedToken || providedToken !== expectedDevToken) {
    return sendJsonResponse(res, 401, {
      error: "Unauthorized: Invalid or missing dev authorization token",
      code: "UNAUTHORIZED",
    });
  }

  // Gate 5: Secret Gemini API key check
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return sendJsonResponse(res, 500, {
      error: "Server error: Gemini API key not configured",
      code: "API_KEY_MISSING",
    });
  }

  // Parse request body
  const body = await parseBody(req);

  // Model selection check (disallow obsolete gemini-1.5-flash or unapproved models)
  const requestedModel =
    typeof body.model === "string" ? body.model : "gemini-2.0-flash";

  if (!ALLOWED_MODELS.includes(requestedModel as ModelName)) {
    return sendJsonResponse(res, 400, {
      error: `Invalid model selection. Allowed models: ${ALLOWED_MODELS.join(
        ", "
      )}`,
      code: "INVALID_MODEL",
    });
  }

  const model: ModelName = requestedModel as ModelName;

  // Enforce server-defined synthetic fixture ONLY.
  // Reject any caller-provided authority, prompt overrides, or health data.
  const { input, authority } = getSyntheticFixture();
  const egress = projectEgress(input, authority);
  const expectedFp = fingerprint(input, authority);

  const systemInstruction = `You are a diagnostic planning guidance AI assistant.
Evaluate the provided egress payload and return a candidate selection strictly formatted as a JSON object matching schema 'pg.v1'.
Do NOT include any commentary, explanations, or markdown formatting outside the JSON output.

Required JSON structure:
{
  "schema_version": "pg.v1",
  "snapshot_fingerprint": "${expectedFp}",
  "finding_ids": ["n1"],
  "options": [],
  "requests": [{"template_id": "t1", "gap_id": "g1", "hint_id": null}]
}`;

  const promptText = `${systemInstruction}\n\nEgress Payload:\n${JSON.stringify(
    egress
  )}`;

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 512,
          temperature: 0.1,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return sendJsonResponse(res, 502, {
        error: "Provider request failed",
        code: "PROVIDER_ERROR",
        status: response.status,
      });
    }

    const resData = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const candidateText =
      resData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return sendJsonResponse(res, 502, {
        error: "Provider returned empty output",
        code: "EMPTY_PROVIDER_RESPONSE",
      });
    }

    let parsedCandidate: ModelCandidateV1;
    try {
      parsedCandidate = JSON.parse(candidateText) as ModelCandidateV1;
    } catch {
      return sendJsonResponse(res, 422, {
        error: "Provider output is not valid JSON",
        code: "INVALID_CANDIDATE_JSON",
      });
    }

    const generationId = `gen_eval_${Math.random()
      .toString(36)
      .substring(2, 10)}`;
    const generatedAt = new Date().toISOString();

    let boundOutput;
    try {
      boundOutput = bindCandidate(
        input,
        authority,
        parsedCandidate,
        generationId,
        generatedAt,
        expectedFp
      );
      assertOutput(boundOutput, input, authority);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return sendJsonResponse(res, 422, {
        error: `Candidate binding/assertion failed: ${redactSecrets(errMsg)}`,
        code: "CONTRACT_BINDING_FAILED",
      });
    }

    const latencyMs = Date.now() - startTime;

    return sendJsonResponse(res, 200, {
      status: "ok",
      model,
      fingerprint: expectedFp,
      output: boundOutput,
      metadata: {
        latency_ms: latencyMs,
        prompt_tokens: resData.usageMetadata?.promptTokenCount ?? null,
        completion_tokens:
          resData.usageMetadata?.candidatesTokenCount ?? null,
        total_tokens: resData.usageMetadata?.totalTokenCount ?? null,
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const errMsg = err instanceof Error ? err.message : String(err);
    const isTimeout =
      err instanceof Error && err.name === "AbortError";

    return sendJsonResponse(res, 504, {
      error: isTimeout
        ? "Provider request timed out after 10 seconds"
        : `Provider request failed: ${redactSecrets(errMsg)}`,
      code: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
    });
  }
}
