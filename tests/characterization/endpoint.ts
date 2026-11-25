/**
 * Deterministic characterization of the Preview-only /api/ai-guidance endpoint.
 *
 * Drives `handleReviewedGuidance` directly (the same function the Vercel entry point calls)
 * with an injected state store and a recording provider mock. Nothing touches the network.
 * Covers access boundaries (feature gates, bearer auth, origin), request validation (size,
 * shape, consent, selection), challenge signing/replay/expiry, rate limiting, state-store
 * failures, provider failure modes, exactly what is sent to the provider, and exactly what is
 * returned. Time is stubbed; the only normalized fields are the known nondeterministic ones
 * (random challenge nonce, measured latency, generated-at timestamp, random generation id).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { handleReviewedGuidance } from "../../apps/web/api/ai-guidance.ts";
import { canonicalJson } from "./capture.ts";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../../", import.meta.url));
const national = JSON.parse(readFileSync(`${root}artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json`, "utf8"));
const local = JSON.parse(readFileSync(`${root}artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json`, "utf8"));

const URL_BASE = "https://protected.example.vercel.app";
const URL_FULL = `${URL_BASE}/api/ai-guidance`;
const TOKEN = "operator-credential-that-is-long-enough-20261021";
const SECRET = "dedicated-hmac-challenge-secret-distinct-20261123";
const API_KEY = "SENTINEL_GEMINI_API_KEY_NEVER_LEAK";
const NOW = Date.parse("2026-11-25T12:00:30.000Z");
const BRIEF_AT = "2026-11-25T12:00:00.000Z";

type Env = Record<string, string | undefined>;
const baseEnv = (): Env => ({
  VERCEL_ENV: "preview", AI_PREVIEW_ENABLED: "on", AI_GUIDANCE_ENABLED: "on", AI_PREVIEW_TOKEN: TOKEN,
  AI_CHALLENGE_SECRET: SECRET, GEMINI_API_KEY: API_KEY, GEMINI_MODEL: "gemini-3.5-flash-lite"
});
const selection = () => ({
  schema_version: "do.gemini-reviewed.v1", national_artifact_version: national.manifest.artifact_version,
  local_artifact_version: local.manifest.artifact_version,
  finding_ids: ["meps24-gross-all-cause-spending-total", "meps24-k6-score-mean"],
  local_ids: [local.indicators[3].indicator_id, "wv.acs.poverty_pct"], brief_generated_at: BRIEF_AT
});

function memoryStore() {
  const consumed = new Set<string>(); const counts = new Map<string, number>();
  return {
    calls: { consume: 0, increment: 0 },
    async consumeChallenge(key: string) { this.calls.consume += 1; if (consumed.has(key)) return "replay" as const; consumed.add(key); return "consumed" as const; },
    async incrementRateLimit(key: string, _window: number, limit: number) { this.calls.increment += 1; const n = (counts.get(key) ?? 0) + 1; counts.set(key, n); return n <= limit; }
  };
}

interface ProviderLog { calls: number; last: unknown }
function recordingProvider(responder: (egress: Record<string, unknown>) => Response | Promise<Response>) {
  const log: ProviderLog = { calls: 0, last: null };
  const provider = (async (url: RequestInfo | URL, init?: RequestInit) => {
    log.calls += 1;
    const headers = new Headers(init?.headers);
    const wire = JSON.parse(String(init?.body));
    const egress = JSON.parse(wire.contents[0].parts[0].text);
    log.last = {
      url: String(url).replace(API_KEY, "<KEY>"), method: init?.method, headerNames: [...headers.keys()].sort(),
      keyInHeader: headers.get("x-goog-api-key") === API_KEY, keyElsewhere: String(url).includes(API_KEY) || String(init?.body).includes(API_KEY),
      hasSignal: init?.signal instanceof AbortSignal, systemInstruction: wire.systemInstruction, generationConfig: wire.generationConfig,
      role: wire.contents[0].role, egress
    };
    return responder(egress);
  }) as typeof fetch;
  return { provider, log };
}
const goodCandidate = (egress: Record<string, unknown>) => ({
  schema_version: "pg.v1", snapshot_fingerprint: egress.snapshot_fingerprint, finding_ids: [(egress.finding_ids as string[])[0]], options: [],
  requests: [{ template_id: "draft_referral_timing", gap_id: "referral_measurement_gap", hint_id: null }]
});
const providerJson = (egress: Record<string, unknown>, candidate: unknown = goodCandidate(egress), extra: Record<string, unknown> = { usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 30 } }) =>
  Response.json({ candidates: [{ content: { parts: [{ text: typeof candidate === "string" ? candidate : JSON.stringify(candidate) }] } }], ...extra });

function post(body: unknown, init: { auth?: string | null | undefined; origin?: string | null | undefined; method?: string; headers?: Record<string, string>; raw?: BodyInit | null } = {}): Request {
  const headers = new Headers({ "Content-Type": "application/json", ...(init.headers ?? {}) });
  const auth = init.auth === undefined ? `Bearer ${TOKEN}` : init.auth;
  if (auth !== null) headers.set("Authorization", auth);
  const origin = init.origin === undefined ? URL_BASE : init.origin;
  if (origin !== null) headers.set("Origin", origin);
  const method = init.method ?? "POST";
  const bodyless = method === "GET" || method === "HEAD";
  return new Request(URL_FULL, { method, headers, ...(bodyless ? {} : { body: init.raw !== undefined ? init.raw : JSON.stringify(body) }) });
}
const frame = (action: string, sel: unknown = selection(), challenge: unknown = null, consent: unknown = true) => ({ action, selection: sel, consent, challenge });

function normalizeBody(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeBody);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "challenge" && typeof v === "string") out[k] = /^\d{13}\.[0-9a-f]{32}\.[0-9a-f]{64}$/.test(v) ? "<challenge:well-formed>" : "<challenge:malformed>";
      else if (k === "latency_ms") out[k] = typeof v === "number" ? "<ms>" : v;
      else if (k === "at" && typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) out[k] = "<iso>";
      else if (k === "proposal_id" && typeof v === "string" && /^pgp1:[0-9a-f]{64}$/.test(v)) out[k] = "<proposal-id:derived-from-random-generation-id>";
      else if (k === "id" && typeof v === "string" && /^reviewed_[0-9a-f]{16}$/.test(v)) out[k] = "<generation-id>";
      else out[k] = normalizeBody(v);
    }
    return out;
  }
  return value;
}
async function observe(response: Response) {
  const text = await response.text();
  let body: unknown = text;
  try { body = normalizeBody(JSON.parse(text)); } catch { /* keep text */ }
  return { status: response.status, headers: [...response.headers.entries()].sort(([a], [b]) => a.localeCompare(b)), body, leaksKey: text.includes(API_KEY) || text.includes(TOKEN) || text.includes(SECRET) };
}

export async function buildEndpointCharacterization(): Promise<{ schema: 1; caseCount: number; cases: Record<string, unknown> }> {
  const cases: Record<string, unknown> = {};
  const realNow = Date.now;
  let clock = NOW;
  Date.now = () => clock;
  const record = async (id: string, fn: () => Promise<unknown>): Promise<void> => {
    if (id in cases) throw new Error(`duplicate endpoint case ${id}`);
    clock = NOW;
    let outcome: unknown;
    try { outcome = { ok: await fn() }; } catch (error) { const e = error as Error; outcome = { threw: { name: e.name, message: e.message } }; }
    const text = canonicalJson(outcome);
    cases[id] = text.length > 1500 ? { sha256: createHash("sha256").update(text).digest("hex").slice(0, 16), bytes: text.length } : JSON.parse(text);
  };
  const run = async (request: Request, env: Env = baseEnv(), providerFn: typeof fetch = recordingProvider(egress => providerJson(egress)).provider, store: ReturnType<typeof memoryStore> | undefined = memoryStore()) =>
    observe(await handleReviewedGuidance(request, env as never, providerFn, store));
  const flow = async (actionFrame: (challenge: string) => unknown, env: Env = baseEnv(), tweak?: (c: string) => string) => {
    const store = memoryStore();
    const prep = await handleReviewedGuidance(post(frame("prepare")), env as never, recordingProvider(e => providerJson(e)).provider, store);
    const { challenge } = (await prep.json()) as { challenge: string };
    return { challenge, store, send: (c = tweak ? tweak(challenge) : challenge, provider = recordingProvider(e => providerJson(e))) => handleReviewedGuidance(post(actionFrame(c)), env as never, provider.provider, store).then(observe).then(obs => ({ obs, provider: provider.log })) };
  };

  try {
    // 1. Feature gates, method, authentication, origin -------------------------------------------------
    const gateEnvs: [string, Env][] = [
      ["production", { ...baseEnv(), VERCEL_ENV: "production" }], ["development", { ...baseEnv(), VERCEL_ENV: "development" }],
      ["no-vercel-env", { ...baseEnv(), VERCEL_ENV: undefined }], ["preview-off", { ...baseEnv(), AI_PREVIEW_ENABLED: "off" }],
      ["preview-unset", { ...baseEnv(), AI_PREVIEW_ENABLED: undefined }], ["guidance-off", { ...baseEnv(), AI_GUIDANCE_ENABLED: "off" }],
      ["guidance-ON-case", { ...baseEnv(), AI_GUIDANCE_ENABLED: "ON" }], ["empty-env", {}]
    ];
    for (const [name, env] of gateEnvs) await record(`gate/${name}`, () => run(post(frame("prepare")), env));
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
      for (const origin of [null, URL_BASE, "https://attacker.invalid", "null"]) {
        for (const auth of [undefined, null, "Bearer wrong"] as const) {
          await record(`method/${method}/origin-${origin ?? "none"}/auth-${auth === undefined ? "valid" : auth ?? "none"}`, () => run(post(frame("prepare"), { method, origin, auth })));
        }
      }
    }
    const authVariants: [string, string | null][] = [
      ["none", null], ["empty", ""], ["bearer-empty", "Bearer "], ["lowercase-scheme", `bearer ${TOKEN}`], ["basic", `Basic ${TOKEN}`], ["wrong-token", "Bearer nope"],
      ["token-prefix", `Bearer ${TOKEN.slice(0, 40)}`], ["token-plus-suffix", `Bearer ${TOKEN}x`], ["oversized-header", `Bearer ${"a".repeat(2050)}`],
      ["extra-space", `Bearer  ${TOKEN}`], ["trailing-space", `Bearer ${TOKEN} `]
    ];
    for (const [name, auth] of authVariants) await record(`auth/${name}`, () => run(post(frame("prepare"), { auth })));
    for (const [name, token] of [["short", "x".repeat(31)], ["undefined", undefined], ["empty", ""], ["exactly-32", "t".repeat(32)]] as const) {
      await record(`auth/server-token-${name}`, () => run(post(frame("prepare"), { auth: `Bearer ${token ?? ""}` }), { ...baseEnv(), AI_PREVIEW_TOKEN: token }));
    }
    for (const origin of [null, "https://protected.example.vercel.app/", "http://protected.example.vercel.app", "https://protected.example.vercel.app:443", "https://PROTECTED.example.vercel.app"]) {
      await record(`origin/post/${origin ?? "none"}`, () => run(post(frame("prepare"), { origin })));
    }

    // 2. Server configuration -----------------------------------------------------------------------
    const configEnvs: [string, Env][] = [
      ["no-challenge-secret", { ...baseEnv(), AI_CHALLENGE_SECRET: undefined }], ["short-secret", { ...baseEnv(), AI_CHALLENGE_SECRET: "s".repeat(31) }],
      ["secret-equals-token", { ...baseEnv(), AI_CHALLENGE_SECRET: TOKEN.padEnd(40, "x").slice(0, 40), AI_PREVIEW_TOKEN: TOKEN.padEnd(40, "x").slice(0, 40) }],
      ["secret-equals-apikey", { ...baseEnv(), AI_CHALLENGE_SECRET: API_KEY.padEnd(40, "k"), GEMINI_API_KEY: API_KEY.padEnd(40, "k") }],
      ["no-api-key", { ...baseEnv(), GEMINI_API_KEY: undefined }], ["empty-api-key", { ...baseEnv(), GEMINI_API_KEY: "" }],
      ["unlisted-model", { ...baseEnv(), GEMINI_MODEL: "gemini-unlisted" }], ["second-model", { ...baseEnv(), GEMINI_MODEL: "gemini-2.5-flash-lite" }],
      ["default-model", { ...baseEnv(), GEMINI_MODEL: undefined }], ["empty-model", { ...baseEnv(), GEMINI_MODEL: "" }],
      ["vercel-no-store", { ...baseEnv(), VERCEL: "1" }], ["kv-url-only", { ...baseEnv(), KV_REST_API_URL: "https://kv.invalid" }],
      ["kv-token-only", { ...baseEnv(), KV_REST_API_TOKEN: "kv-token-16-chars" }], ["kv-http", { ...baseEnv(), KV_REST_API_URL: "http://kv.invalid", KV_REST_API_TOKEN: "kv-token-16-chars" }],
      ["kv-short-token", { ...baseEnv(), KV_REST_API_URL: "https://kv.invalid", KV_REST_API_TOKEN: "short" }],
      ["kv-upstash-mismatch", { ...baseEnv(), KV_REST_API_URL: "https://kv.invalid", KV_REST_API_TOKEN: "kv-token-16-chars", UPSTASH_REDIS_REST_URL: "https://other.invalid", UPSTASH_REDIS_REST_TOKEN: "kv-token-16-chars" }],
      ["kv-garbage-url", { ...baseEnv(), KV_REST_API_URL: "not a url", KV_REST_API_TOKEN: "kv-token-16-chars" }]
    ];
    for (const [name, env] of configEnvs) {
      await record(`config/${name}`, async () => {
        const tracker = recordingProvider(e => providerJson(e));
        const obs = await observe(await handleReviewedGuidance(post(frame("prepare")), env as never, tracker.provider, name.startsWith("kv-") || name === "vercel-no-store" ? undefined : memoryStore()));
        return { obs, providerCalls: tracker.log.calls };
      });
    }
    await record("config/default-memory-store-prepare", async () => observe(await handleReviewedGuidance(post(frame("prepare")), { ...baseEnv(), AI_PREVIEW_TOKEN: "default-memory-store-token-unique-0001-xxxxxxxx" } as never, recordingProvider(e => providerJson(e)).provider)).then(o => ({ status: o.status, error: (o.body as { error?: string }).error })));

    // 3. Request body validation -----------------------------------------------------------------------
    const rawBodies: [string, BodyInit | null, Record<string, string>?][] = [
      ["empty", ""], ["null-body", null], ["invalid-json", "{"], ["json-null", "null"], ["json-array", "[]"], ["json-string", "\"x\""], ["json-number", "1"],
      ["oversized-5000", JSON.stringify({ ...frame("prepare"), pad: "x".repeat(5000) })], ["exactly-over-limit", " ".repeat(4097) + JSON.stringify(frame("prepare"))],
      ["lying-content-length", JSON.stringify(frame("prepare")), { "content-length": "99999" }],
      ["invalid-utf8", new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])], ["bom", "\ufeff" + JSON.stringify(frame("prepare"))],
      ["duplicate-keys", `{"action":"prepare","action":"analyze","selection":${JSON.stringify(selection())},"consent":true,"challenge":null}`],
      ["extra-key", JSON.stringify({ ...frame("prepare"), extra: 1 })], ["missing-selection", JSON.stringify({ action: "prepare", consent: true, challenge: null })],
      ["missing-challenge", JSON.stringify({ action: "prepare", selection: selection(), consent: true })], ["missing-action", JSON.stringify({ selection: selection(), consent: true, challenge: null })]
    ];
    for (const [name, raw, headers] of rawBodies) await record(`body/${name}`, () => run(post(null, { raw: raw as BodyInit, ...(headers ? { headers } : {}) })));
    for (const action of ["prepare", "analyze", "Prepare", "ANALYZE", "", "delete", 1, null, undefined]) await record(`action/${String(action)}`, () => run(post(frame(action as string))));
    for (const consent of [true, false, "true", 1, null, undefined, [] ]) await record(`consent/${JSON.stringify(consent) ?? "undefined"}`, () => run(post(frame("prepare", selection(), null, consent))));
    for (const challenge of ["x", "", 0, {}, [], false]) await record(`prepare-with-challenge/${JSON.stringify(challenge)}`, () => run(post(frame("prepare", selection(), challenge))));

    // 4. Selection validation: mutation sweep -----------------------------------------------------------
    const sel = selection() as Record<string, unknown>;
    const selMutations: [string, unknown][] = [["delete", Symbol.for("delete")], ["null", null], ["empty", ""], ["text", "x"], ["number", 5], ["negative", -1], ["true", true], ["array", []], ["object", {}], ["injection", "<script>alert(1)</script>"], ["traversal", "../../etc/passwd"], ["long", "a".repeat(200)]];
    const apply = (path: (string | number)[], value: unknown) => {
      const copy = structuredClone(sel) as Record<string | number, unknown>; let cur = copy;
      for (const k of path.slice(0, -1)) cur = cur[k] as Record<string | number, unknown>;
      const last = path[path.length - 1] as string | number;
      if (value === Symbol.for("delete")) { if (Array.isArray(cur)) cur.splice(Number(last), 1); else delete cur[last]; } else cur[last] = value;
      return copy;
    };
    const paths: (string | number)[][] = Object.keys(sel).flatMap(k => Array.isArray(sel[k]) ? [[k], ...(sel[k] as unknown[]).map((_, i) => [k, i])] : [[k]]);
    for (const path of paths) for (const [name, value] of selMutations) {
      await record(`selection/${path.join(".")}/${name}`, () => run(post(frame("prepare", apply(path, value)))).then(o => ({ status: o.status, body: o.body })));
    }
    const allFindings = national.burden_domains.flatMap((d: { measures: { estimate_id: string }[] }) => d.measures.map(m => m.estimate_id)) as string[];
    const allLocal = local.indicators.map((r: { indicator_id: string }) => r.indicator_id) as string[];
    const selVariants: [string, unknown][] = [
      ["all-findings", { ...sel, finding_ids: allFindings }], ["all-locals", { ...sel, local_ids: allLocal }], ["no-findings", { ...sel, finding_ids: [] }],
      ["no-locals-null-release", { ...sel, local_ids: [], local_artifact_version: null }], ["locals-without-release", { ...sel, local_artifact_version: null }],
      ["duplicate-finding", { ...sel, finding_ids: [allFindings[0], allFindings[0]] }], ["duplicate-local", { ...sel, local_ids: [allLocal[0], allLocal[0]] }],
      ["unknown-finding", { ...sel, finding_ids: ["not-a-finding"] }], ["unknown-local", { ...sel, local_ids: ["not.a.local"] }], ["too-many-findings", { ...sel, finding_ids: Array.from({ length: 22 }, (_, i) => `f${i}`) }],
      ["old-national-release", { ...sel, national_artifact_version: "meps-2024-long-covid-candidate-20260923T020607Z" }],
      ["brief-future-121s", { ...sel, brief_generated_at: new Date(NOW + 121000).toISOString() }], ["brief-future-119s", { ...sel, brief_generated_at: new Date(NOW + 119000).toISOString() }],
      ["brief-age-24h", { ...sel, brief_generated_at: new Date(NOW - 86400000).toISOString() }], ["brief-age-24h-1s", { ...sel, brief_generated_at: new Date(NOW - 86401000).toISOString() }],
      ["brief-no-ms", { ...sel, brief_generated_at: "2026-11-25T12:00:00Z" }], ["brief-offset", { ...sel, brief_generated_at: "2026-11-25T12:00:00+00:00" }],
      ["extra-selection-key", { ...sel, scenario: { capacity: 1 } }], ["numeric-values-smuggled", { ...sel, finding_ids: ["meps24-gross-all-cause-spending-total"], value: 123 }]
    ];
    for (const [name, value] of selVariants) await record(`selection-variant/${name}`, () => run(post(frame("prepare", value))).then(o => ({ status: o.status, body: o.body })));

    // 5. Happy path, challenge lifecycle, replay and expiry ------------------------------------------------
    await record("flow/prepare-response", () => run(post(frame("prepare"))));
    await record("flow/analyze-success", async () => (await flow(c => frame("analyze", selection(), c))).send().then(r => r));
    await record("flow/analyze-success-no-locals", async () => {
      const noLocal = { ...selection(), local_ids: [], local_artifact_version: null };
      return (await flow(c => frame("analyze", noLocal, c))).send();
    });
    await record("flow/replay-same-challenge", async () => { const f = await flow(c => frame("analyze", selection(), c)); const first = await f.send(); const second = await f.send(); return { first: first.obs.status, second: second.obs, providerCalls: [first.provider.calls, second.provider.calls] }; });
    await record("flow/stale-selection-after-prepare", async () => (await flow(c => frame("analyze", { ...selection(), finding_ids: ["meps24-k6-score-mean"] }, c))).send());
    await record("flow/reordered-selection-same-challenge", async () => (await flow(c => frame("analyze", { ...selection(), finding_ids: [...selection().finding_ids].reverse() }, c))).send());
    for (const [name, tweak] of [
      ["garbage", () => "garbage"], ["empty", () => ""], ["two-segments", (c: string) => c.split(".").slice(0, 2).join(".")], ["four-segments", (c: string) => c + ".00"],
      ["uppercase-mac", (c: string) => c.slice(0, c.lastIndexOf(".") + 1) + c.slice(c.lastIndexOf(".") + 1).toUpperCase()], ["flipped-mac", (c: string) => c.slice(0, -1) + (c.endsWith("0") ? "1" : "0")],
      ["short-time", (c: string) => c.slice(1)], ["future-time", (c: string) => String(NOW + 60000) + c.slice(c.indexOf("."))], ["swapped-nonce", (c: string) => { const p = c.split("."); return `${p[0]}.${"0".repeat(32)}.${p[2]}`; }]
    ] as [string, (c: string) => string][]) {
      await record(`flow/challenge-${name}`, async () => (await flow(c => frame("analyze", selection(), c), baseEnv(), tweak)).send());
    }
    for (const value of [null, 0, 12345, {}, [], true]) {
      await record(`flow/challenge-type-${JSON.stringify(value)}`, async () => (await flow(() => frame("analyze", selection(), value))).send(value as never));
    }
    await record("flow/challenge-from-other-secret", async () => {
      const other = await handleReviewedGuidance(post(frame("prepare")), { ...baseEnv(), AI_CHALLENGE_SECRET: "another-dedicated-hmac-challenge-secret-xxxxx" } as never, recordingProvider(e => providerJson(e)).provider, memoryStore());
      const { challenge } = (await other.json()) as { challenge: string };
      return (await flow(() => frame("analyze", selection(), challenge))).send(challenge);
    });
    for (const [name, advance] of [["89s", 89000], ["90s", 90000], ["91s", 91000], ["5min", 300000], ["back-4s", -4000], ["back-6s", -6000]] as [string, number][]) {
      await record(`flow/clock-${name}`, async () => {
        const f = await flow(c => frame("analyze", selection(), c));
        clock = NOW + advance;
        return f.send();
      });
    }
    await record("flow/analyze-with-prepare-challenge-field-null", () => run(post(frame("analyze", selection(), null))));

    // 6. Rate limiting and state-store failures --------------------------------------------------------------
    await record("store/rate-limit-sequence", async () => {
      const store = memoryStore(); const statuses: number[] = [];
      for (let i = 0; i < 14; i += 1) statuses.push((await observe(await handleReviewedGuidance(post(frame("prepare")), baseEnv() as never, undefined as never, store))).status);
      return { statuses, calls: store.calls };
    });
    await record("store/rate-limit-key-per-token", async () => {
      const store = memoryStore(); const statuses: number[] = [];
      for (let i = 0; i < 13; i += 1) statuses.push((await observe(await handleReviewedGuidance(post(frame("prepare")), baseEnv() as never, undefined as never, store))).status);
      const other = { ...baseEnv(), AI_PREVIEW_TOKEN: "second-operator-credential-long-enough-20261123" };
      const second = await observe(await handleReviewedGuidance(post(frame("prepare"), { auth: `Bearer ${other.AI_PREVIEW_TOKEN}` }), other as never, undefined as never, store));
      return { last: statuses[12], secondTokenStatus: second.status };
    });
    const failing = (over: Partial<ReturnType<typeof memoryStore>> & Record<string, unknown>) => ({ ...memoryStore(), ...over });
    await record("store/increment-throws", () => run(post(frame("prepare")), baseEnv(), undefined, failing({ incrementRateLimit: async () => { throw new Error("boom"); } }) as never));
    await record("store/consume-throws", async () => { const f = await flow(c => frame("analyze", selection(), c)); return observe(await handleReviewedGuidance(post(frame("analyze", selection(), f.challenge)), baseEnv() as never, recordingProvider(e => providerJson(e)).provider, failing({ consumeChallenge: async () => { throw new Error("boom"); } }) as never)); });
    await record("store/consume-returns-replay", async () => { const f = await flow(c => frame("analyze", selection(), c)); return observe(await handleReviewedGuidance(post(frame("analyze", selection(), f.challenge)), baseEnv() as never, recordingProvider(e => providerJson(e)).provider, failing({ consumeChallenge: async () => "replay" }) as never)); });
    await record("store/consume-never-called-on-prepare", async () => { const store = memoryStore(); await handleReviewedGuidance(post(frame("prepare")), baseEnv() as never, undefined as never, store); return store.calls; });

    // 7. Provider interaction and failure modes ----------------------------------------------------------------
    const analyze = async (responder: (egress: Record<string, unknown>) => Response | Promise<Response>, env: Env = baseEnv()) => {
      const f = await flow(c => frame("analyze", selection(), c), env); const tracker = recordingProvider(responder);
      return f.send(undefined, tracker);
    };
    await record("provider/egress-and-request-shape", async () => { const r = await analyze(e => providerJson(e)); return { provider: r.provider, status: r.obs.status }; });
    await record("provider/success-body", async () => (await analyze(e => providerJson(e))).obs);
    await record("provider/second-model", async () => { const r = await analyze(e => providerJson(e), { ...baseEnv(), GEMINI_MODEL: "gemini-2.5-flash-lite" }); return { url: (r.provider.last as { url: string }).url, status: r.obs.status }; });
    await record("provider/default-model-url", async () => { const r = await analyze(e => providerJson(e), { ...baseEnv(), GEMINI_MODEL: undefined }); return { url: (r.provider.last as { url: string }).url, status: r.obs.status }; });
    const bad = (name: string, responder: (egress: Record<string, unknown>) => Response | Promise<Response>) => record(`provider/${name}`, async () => (await analyze(responder)).obs);
    await bad("http-500", () => new Response("upstream", { status: 500 }));
    await bad("http-429", () => new Response("rate", { status: 429 }));
    await bad("fetch-throws", () => { throw new Error("network down"); });
    await bad("rejects-async", async () => { throw new Error("aborted"); });
    await bad("oversized-32769", () => new Response("x".repeat(32769)));
    await bad("exactly-32768-invalid-json", () => new Response(" ".repeat(32768)));
    await bad("invalid-utf8", () => new Response(new Uint8Array([0xff, 0xfe])));
    await bad("not-json", () => new Response("not json"));
    await bad("json-array", () => Response.json([]));
    await bad("json-null", () => Response.json(null));
    await bad("no-candidates", () => Response.json({}));
    await bad("candidates-not-array", () => Response.json({ candidates: {} }));
    await bad("empty-candidates", () => Response.json({ candidates: [] }));
    await bad("no-parts", () => Response.json({ candidates: [{ content: {} }] }));
    await bad("text-not-string", () => Response.json({ candidates: [{ content: { parts: [{ text: 5 }] } }] }));
    await bad("text-too-long", e => providerJson(e, "x".repeat(8193)));
    await bad("text-not-json", e => providerJson(e, "not json"));
    await bad("candidate-null", e => providerJson(e, "null"));
    await bad("candidate-array", e => providerJson(e, "[]"));
    await bad("wrong-fingerprint", e => providerJson(e, { ...goodCandidate(e), snapshot_fingerprint: "pg1:" + "0".repeat(64) }));
    await bad("unknown-finding", e => providerJson(e, { ...goodCandidate(e), finding_ids: ["fabricated"] }));
    await bad("options-nonempty", e => providerJson(e, { ...goodCandidate(e), options: [{ reference_id: "x", claim_code: "y" }] }));
    await bad("extra-key", e => providerJson(e, { ...goodCandidate(e), numeric_value: 12 }));
    await bad("missing-key", e => providerJson(e, { schema_version: "pg.v1" }));
    await bad("bad-request-template", e => providerJson(e, { ...goodCandidate(e), requests: [{ template_id: "nope", gap_id: "nope", hint_id: null }] }));
    await bad("request-hint-nonnull", e => providerJson(e, { ...goodCandidate(e), requests: [{ template_id: "draft_referral_timing", gap_id: "referral_measurement_gap", hint_id: "h" }] }));
    await bad("no-findings-no-requests", e => providerJson(e, { ...goodCandidate(e), finding_ids: [], requests: [] }));
    for (const [name, usage] of [["null", null], ["array", []], ["string", "x"], ["negative", { promptTokenCount: -1 }], ["fraction", { promptTokenCount: 1.5 }], ["text", { candidatesTokenCount: "3" }], ["empty", {}], ["unsafe-int", { promptTokenCount: 2 ** 53 }], ["valid", { promptTokenCount: 1, candidatesTokenCount: 2 }]] as [string, unknown][]) {
      await record(`provider/usage-${name}`, async () => { const r = await analyze(e => providerJson(e, undefined, { usageMetadata: usage })); return { status: r.obs.status, usage: (r.obs.body as { usage?: unknown }).usage, error: (r.obs.body as { error?: string }).error }; });
    }
    await record("provider/no-usage-field", async () => { const r = await analyze(e => providerJson(e, undefined, {})); return { status: r.obs.status, usage: (r.obs.body as { usage?: unknown }).usage }; });
    await record("provider/never-called-on-failed-prepare-paths", async () => {
      const tracker = recordingProvider(e => providerJson(e));
      await handleReviewedGuidance(post(frame("prepare")), baseEnv() as never, tracker.provider, memoryStore());
      await handleReviewedGuidance(post(frame("analyze", selection(), "bad")), baseEnv() as never, tracker.provider, memoryStore());
      await handleReviewedGuidance(post(frame("prepare"), { auth: "Bearer no" }), baseEnv() as never, tracker.provider, memoryStore());
      return tracker.log.calls;
    });
    await record("provider/key-never-in-any-response", async () => {
      const results = [await analyze(e => providerJson(e)), await analyze(() => new Response(`${API_KEY} ${TOKEN}`, { status: 500 })), await analyze(() => { throw new Error(API_KEY); })];
      return results.map(r => r.obs.leaksKey);
    });
    await record("provider/untrusted-text-not-reflected", async () => (await analyze(e => providerJson(e, { ...goodCandidate(e), finding_ids: ["<img src=x onerror=alert(1)>"] }))).obs);
  } finally {
    Date.now = realNow;
  }
  return { schema: 1, caseCount: Object.keys(cases).length, cases };
}

export function renderEndpointCharacterization(value: { schema: 1; caseCount: number; cases: Record<string, unknown> }): string {
  const lines = Object.keys(value.cases).sort().map(id => `    ${JSON.stringify(id)}: ${canonicalJson(value.cases[id])}`);
  return `{\n  "schema": ${value.schema},\n  "caseCount": ${value.caseCount},\n  "cases": {\n${lines.join(",\n")}\n  }\n}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2];
  if (!out) { console.error("usage: endpoint.ts <output-file>"); process.exit(2); }
  const { writeFileSync } = await import("node:fs");
  const data = await buildEndpointCharacterization();
  writeFileSync(out, renderEndpointCharacterization(data));
  const suspects = Object.entries(data.cases).filter(([, v]) => JSON.stringify(v).includes("\"name\":\"TypeError\""));
  console.log(`wrote ${data.caseCount} endpoint cases to ${out}; TypeError-suspects: ${suspects.length}`);
  for (const [id, v] of suspects.slice(0, 15)) console.log("  suspect:", id, JSON.stringify(v).slice(0, 220));
}
