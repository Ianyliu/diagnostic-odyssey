import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import { allowLocalCommunityPulseFixtures, isProtectedFixturePreview, showCommunityPulseFixtures }
  from "../src/server/community-pulse/environment.ts";
import { readCommunityPulse } from "../src/server/community-pulse/runtime.ts";
import { fixtureDataSource } from "../src/server/community-pulse/fixtureDataSource.ts";
import { parseCommunityPulseResponse } from "../src/data/communityPulseResponse.ts";

const flags = { VITE_COMMUNITY_PULSE_ENABLED: "on", COMMUNITY_PULSE_MODE: "fixture" };
const preview = { ...flags, VERCEL: "1", VERCEL_ENV: "preview" };
const request = (query = "", method = "GET") => new Request("https://preview.example.invalid/api/community-pulse" + query, { method });

test("fixture flags default off and an attempted production override still fails closed", () => {
  assert.equal(showCommunityPulseFixtures({}), false);
  assert.equal(allowLocalCommunityPulseFixtures(flags), true);
  assert.equal(isProtectedFixturePreview(preview), true);
  for (const env of [
    { ...preview, VERCEL_ENV: "production" },
    { ...preview, VERCEL_TARGET_ENV: "production" },
    { ...flags, VERCEL_ENV: "preview" },
    { ...preview, COMMUNITY_PULSE_MODE: "off" }
  ]) {
    assert.equal(isProtectedFixturePreview(env), false);
    assert.equal(showCommunityPulseFixtures(env), false);
    assert.equal(allowLocalCommunityPulseFixtures(env), false);
  }
});

test("disabled and invalid requests do not touch the data source", async () => {
  let calls = 0;
  const dataSource = { async read() { calls++; return fixtureDataSource.read(); } };
  assert.equal((await readCommunityPulse(request(), false, dataSource)).status, 404);
  assert.equal((await readCommunityPulse(request("", "POST"), true, dataSource)).status, 405);
  assert.equal((await readCommunityPulse(request("?url=https://example.invalid"), true, dataSource)).status, 400);
  assert.equal(calls, 0);
});

test("each request reads a new projection without rebuilding and only sends approved and safe inbox fields", async () => {
  const initial = await fixtureDataSource.read();
  let projection = { ...initial, inbox: [] as typeof initial.inbox };
  const dataSource = { async read() { return projection; } };
  const first = await readCommunityPulse(request(), true, dataSource);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  assert.equal(first.headers.get("x-robots-tag"), "noindex, noarchive");
  assert.equal(parseCommunityPulseResponse(await first.json())?.inbox.length, 0);
  projection = initial;
  const next = parseCommunityPulseResponse(await (await readCommunityPulse(request(), true, dataSource)).json());
  assert.equal(next?.inbox.length, 6);
  assert.equal(next?.inbox.filter(row => row.receipt.status !== "accepted").every(row => row.report === null), true);
  assert.ok(next?.inbox.some(row => row.candidate_claims?.some(claim => claim.verification === "unsupported")));
  assert.equal(next?.snapshot.records.some(row => row.title.includes("Conflicting deadline")), false);
});

test("source failure is a safe JSON 503", async () => {
  const failure = await readCommunityPulse(request(), true, { async read() { throw Error("private store path"); } });
  assert.equal(failure.status, 503);
  assert.deepEqual(await failure.json(), { error: "intelligence_unavailable" });
});

test("the committed Vercel module matches the source and runs without TypeScript dependencies", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  execFileSync(process.execPath, ["scripts/community-pulse/build-endpoint.mjs", "--check"], { cwd: root });
  const requestScript = [
    'import endpoint from "./apps/web/api/community-pulse.js";',
    'const response = await endpoint.fetch(new Request("https://preview.example.invalid/api/community-pulse"));',
    'const body = await response.json();',
    'process.stdout.write(JSON.stringify({status: response.status, count: body.inbox?.length}));'
  ].join("");
  const invoke = (environment: "preview" | "production") => JSON.parse(execFileSync(process.execPath,
    ["--input-type=module", "-e", requestScript],
    { cwd: root, encoding: "utf8", env: { VERCEL: "1", VERCEL_ENV: environment, COMMUNITY_PULSE_MODE: "fixture" } }
  )) as { status: number; count?: number };
  assert.deepEqual(invoke("preview"), { status: 200, count: 6 });
  assert.deepEqual(invoke("production"), { status: 404 });
});
