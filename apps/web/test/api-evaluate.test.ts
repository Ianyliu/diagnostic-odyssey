import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/ai/evaluate.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { EventEmitter } from "node:events";

class MockRequest extends EventEmitter {
  method: string;
  headers: Record<string, string>;
  body: unknown;

  constructor(
    method = "POST",
    headers: Record<string, string> = {},
    body: unknown = {}
  ) {
    super();
    this.method = method;
    this.headers = headers;
    this.body = body;
  }
}

class MockResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = "";

  setHeader(key: string, value: string) {
    this.headers[key.toLowerCase()] = value;
  }

  end(chunk?: string) {
    if (chunk) this.body += chunk;
  }
}

async function invokeHandler(
  req: MockRequest,
  res: MockResponse
): Promise<{ statusCode: number; headers: Record<string, string>; json: any }> {
  await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
  let json = {};
  try {
    json = JSON.parse(res.body);
  } catch {
    // empty
  }
  return { statusCode: res.statusCode, headers: res.headers, json };
}

test("rejects when VERCEL_ENV is not 'preview'", async () => {
  const origEnv = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    const req = new MockRequest("POST");
    const res = new MockResponse();
    const { statusCode, json } = await invokeHandler(req, res);
    assert.equal(statusCode, 403);
    assert.equal(json.code, "ENVIRONMENT_NOT_PERMITTED");
  } finally {
    process.env.VERCEL_ENV = origEnv;
  }
});

test("rejects when AI_PROVIDER_ENABLED is not 'on'", async () => {
  const origEnv = process.env.VERCEL_ENV;
  const origFlag = process.env.AI_PROVIDER_ENABLED;
  try {
    process.env.VERCEL_ENV = "preview";
    process.env.AI_PROVIDER_ENABLED = "off";
    const req = new MockRequest("POST");
    const res = new MockResponse();
    const { statusCode, json } = await invokeHandler(req, res);
    assert.equal(statusCode, 403);
    assert.equal(json.code, "PROVIDER_DISABLED");
  } finally {
    process.env.VERCEL_ENV = origEnv;
    process.env.AI_PROVIDER_ENABLED = origFlag;
  }
});

test("rejects non-POST HTTP methods", async () => {
  const origEnv = process.env.VERCEL_ENV;
  const origFlag = process.env.AI_PROVIDER_ENABLED;
  try {
    process.env.VERCEL_ENV = "preview";
    process.env.AI_PROVIDER_ENABLED = "on";
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      const req = new MockRequest(method);
      const res = new MockResponse();
      const { statusCode, headers, json } = await invokeHandler(req, res);
      assert.equal(statusCode, 405);
      assert.equal(headers["allow"], "POST");
      assert.equal(json.code, "METHOD_NOT_ALLOWED");
    }
  } finally {
    process.env.VERCEL_ENV = origEnv;
    process.env.AI_PROVIDER_ENABLED = origFlag;
  }
});

test("rejects when dev auth token is missing or invalid", async () => {
  const origEnv = process.env.VERCEL_ENV;
  const origFlag = process.env.AI_PROVIDER_ENABLED;
  const origDevToken = process.env.PRIVATE_DEV_AUTH_TOKEN;
  try {
    process.env.VERCEL_ENV = "preview";
    process.env.AI_PROVIDER_ENABLED = "on";
    process.env.PRIVATE_DEV_AUTH_TOKEN = "secret_dev_token_123";

    // Missing token
    const req1 = new MockRequest("POST");
    const res1 = new MockResponse();
    const result1 = await invokeHandler(req1, res1);
    assert.equal(result1.statusCode, 401);
    assert.equal(result1.json.code, "UNAUTHORIZED");

    // Invalid token
    const req2 = new MockRequest("POST", { authorization: "Bearer wrong_token" });
    const res2 = new MockResponse();
    const result2 = await invokeHandler(req2, res2);
    assert.equal(result2.statusCode, 401);
    assert.equal(result2.json.code, "UNAUTHORIZED");
  } finally {
    process.env.VERCEL_ENV = origEnv;
    process.env.AI_PROVIDER_ENABLED = origFlag;
    process.env.PRIVATE_DEV_AUTH_TOKEN = origDevToken;
  }
});

test("rejects obsolete or forbidden model selection", async () => {
  const origEnv = process.env.VERCEL_ENV;
  const origFlag = process.env.AI_PROVIDER_ENABLED;
  const origDevToken = process.env.PRIVATE_DEV_AUTH_TOKEN;
  const origApiKey = process.env.GEMINI_API_KEY;
  try {
    process.env.VERCEL_ENV = "preview";
    process.env.AI_PROVIDER_ENABLED = "on";
    process.env.PRIVATE_DEV_AUTH_TOKEN = "secret_dev_token_123";
    process.env.GEMINI_API_KEY = "mock_gemini_key";

    const req = new MockRequest(
      "POST",
      { authorization: "Bearer secret_dev_token_123" },
      { model: "gemini-1.5-flash" } // Obsolete forbidden model
    );
    const res = new MockResponse();
    const { statusCode, json } = await invokeHandler(req, res);
    assert.equal(statusCode, 400);
    assert.equal(json.code, "INVALID_MODEL");
  } finally {
    process.env.VERCEL_ENV = origEnv;
    process.env.AI_PROVIDER_ENABLED = origFlag;
    process.env.PRIVATE_DEV_AUTH_TOKEN = origDevToken;
    process.env.GEMINI_API_KEY = origApiKey;
  }
});

test("redacts secret API key and dev token from error outputs and logs", async () => {
  const origEnv = process.env.VERCEL_ENV;
  const origFlag = process.env.AI_PROVIDER_ENABLED;
  const origDevToken = process.env.PRIVATE_DEV_AUTH_TOKEN;
  const origApiKey = process.env.GEMINI_API_KEY;
  const origFetch = global.fetch;

  const secretKey = "SUPER_SECRET_GEMINI_API_KEY_999";
  const devToken = "SUPER_SECRET_DEV_AUTH_TOKEN_888";

  try {
    process.env.VERCEL_ENV = "preview";
    process.env.AI_PROVIDER_ENABLED = "on";
    process.env.PRIVATE_DEV_AUTH_TOKEN = devToken;
    process.env.GEMINI_API_KEY = secretKey;

    // Mock fetch to simulate an error containing secrets
    global.fetch = async () => {
      throw new Error(`Fetch failed for key ${secretKey} token ${devToken}`);
    };

    const req = new MockRequest(
      "POST",
      { authorization: `Bearer ${devToken}` },
      { model: "gemini-2.0-flash" }
    );
    const res = new MockResponse();
    const { resBody } = await (async () => {
      await invokeHandler(req, res);
      return { resBody: res.body };
    })();

    assert.equal(resBody.includes(secretKey), false, "Secret Gemini key leaked!");
    assert.equal(resBody.includes(devToken), false, "Secret Dev Token leaked!");
    assert.equal(resBody.includes("[REDACTED_SECRET]"), true, "Redaction sentinel present");
  } finally {
    process.env.VERCEL_ENV = origEnv;
    process.env.AI_PROVIDER_ENABLED = origFlag;
    process.env.PRIVATE_DEV_AUTH_TOKEN = origDevToken;
    process.env.GEMINI_API_KEY = origApiKey;
    global.fetch = origFetch;
  }
});

test("successfully evaluates synthetic fixture and binds candidate output when Gemini returns valid JSON", async () => {
  const origEnv = process.env.VERCEL_ENV;
  const origFlag = process.env.AI_PROVIDER_ENABLED;
  const origDevToken = process.env.PRIVATE_DEV_AUTH_TOKEN;
  const origApiKey = process.env.GEMINI_API_KEY;
  const origFetch = global.fetch;

  try {
    process.env.VERCEL_ENV = "preview";
    process.env.AI_PROVIDER_ENABLED = "on";
    process.env.PRIVATE_DEV_AUTH_TOKEN = "valid_token";
    process.env.GEMINI_API_KEY = "valid_key";

    global.fetch = async (url, options) => {
      const authHeader = (options?.headers as Record<string, string>)?.["x-goog-api-key"];
      assert.equal(authHeader, "valid_key");
      assert.equal(
        (url as string).includes("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"),
        true
      );

      // Return a valid candidate text matching synthetic fixture
      const candidateObj = {
        schema_version: "pg.v1",
        snapshot_fingerprint: "pg1:61fcad8177dc4eebbe2fba04ed7dc092f8d4e464352f6cb5256efdab67103eea",
        finding_ids: ["n1"],
        options: [],
        requests: [{ template_id: "t1", gap_id: "g1", hint_id: null }],
      };

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(candidateObj) }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 120,
            candidatesTokenCount: 45,
            totalTokenCount: 165,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const req = new MockRequest(
      "POST",
      { authorization: "Bearer valid_token" },
      { model: "gemini-2.0-flash" }
    );
    const res = new MockResponse();
    const { statusCode, json } = await invokeHandler(req, res);

    assert.equal(statusCode, 200);
    assert.equal(json.status, "ok");
    assert.equal(json.model, "gemini-2.0-flash");
    assert.equal(
      json.fingerprint,
      "pg1:61fcad8177dc4eebbe2fba04ed7dc092f8d4e464352f6cb5256efdab67103eea"
    );
    assert.equal(json.output.schema_version, "pg.v1");
    assert.equal(json.output.generation.state, "available");
    assert.equal(json.output.supported_findings[0].id, "n1");
    assert.equal(json.metadata.total_tokens, 165);
  } finally {
    process.env.VERCEL_ENV = origEnv;
    process.env.AI_PROVIDER_ENABLED = origFlag;
    process.env.PRIVATE_DEV_AUTH_TOKEN = origDevToken;
    process.env.GEMINI_API_KEY = origApiKey;
    global.fetch = origFetch;
  }
});
