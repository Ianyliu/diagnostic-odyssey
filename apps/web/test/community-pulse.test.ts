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
