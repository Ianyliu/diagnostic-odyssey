import assert from "node:assert/strict";
import test from "node:test";
import { reportTypes } from "../../../packages/community-pulse/src/index.ts";
import { fixtureDataSource } from "../src/server/community-pulse/fixtureDataSource.ts";
import { readStagingInbox } from "../src/server/community-pulse/stagingEndpoint.ts";
import { isProtectedStagingPreview, showCommunityPulseStaging } from "../src/server/community-pulse/environment.ts";
import { parseStagingInboxResponse } from "../src/data/communityPulseResponse.ts";

const settings = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feat/community-pulse-fixture-phase-f",
  COMMUNITY_PULSE_MODE: "fixture",
  VITE_COMMUNITY_PULSE_ENABLED: "on",
  PULSE_STAGING_INBOX_ENABLED: "on",
  PULSE_STAGING_WORKER_URL: "https://community-pulse-staging.test-client.workers.dev",
  PULSE_STAGING_WORKER_TOKEN: "0123456789abcdef0123456789abcdef",
};
const request = (headers?: Record<string, string>, suffix = "", method = "GET") =>
  new Request("https://preview.example.invalid/api/community-pulse-staging" + suffix, headers ? {method, headers} : {method});

const fixture = await fixtureDataSource.read();
const inbox = fixture.inbox.map(({receipt, report}) => ({receipt, report}));
const runs = Object.fromEntries(reportTypes.map(reportType => [reportType, {
  completed: 1, no_change: 2, partial: 3, failed: 0,
  last_success_at: null, last_delivery_at: null, missed: reportType === "hourly_scout" ? true : null,
}]));
const projection = {
  schema_version: "0.2.1",
  inbox,
  metrics: {as_of: "2026-11-25T08:01:00Z", window_hours: 24, last_success_at: null, runs},
};

test("staging needs explicit flags, the exact preview branch, and a non-production deployment", async () => {
  assert.equal(isProtectedStagingPreview(settings), true);
  assert.equal(showCommunityPulseStaging(settings), true);
  for (const environment of [
    {...settings, VERCEL_ENV: "production"},
    {...settings, VERCEL_TARGET_ENV: "production"},
    {...settings, VERCEL_GIT_COMMIT_REF: "main"},
    {...settings, COMMUNITY_PULSE_MODE: "production"},
    {...settings, PULSE_STAGING_INBOX_ENABLED: "off"},
    {...settings, VERCEL: "0"},
    {},
  ]) {
    assert.equal(isProtectedStagingPreview(environment), false);
    assert.equal(showCommunityPulseStaging(environment), false);
    assert.equal((await readStagingInbox(request(), environment, async () => {
      assert.fail("Disabled staging must not make a network request");
    })).status, 404);
  }
});

test("staging proxies a fixed Worker path with a server credential and returns only validated fields", async () => {
  const result = await readStagingInbox(request({
    Authorization: "Bearer browser-input",
    Cookie: "do-not-forward",
    "If-None-Match": "\"inbox-new\"",
    "Sec-Fetch-Site": "same-origin",
  }), settings, async (target, initial) => {
    const headers = new Headers(initial?.headers);
    assert.equal(String(target), "https://community-pulse-staging.test-client.workers.dev/v1/inbox");
    assert.equal(headers.get("Authorization"), "Bearer " + settings.PULSE_STAGING_WORKER_TOKEN);
    assert.equal(headers.get("Cookie"), null);
    assert.equal(headers.get("If-None-Match"), "\"inbox-new\"");
    assert.equal(initial?.method, "GET");
    assert.equal(initial?.redirect, "error");
    assert.equal(initial?.cache, "no-store");
    return Response.json({...projection, private_credential: "never returned"}, {
      headers: {ETag: "\"inbox-content\"", "Set-Cookie": "remote=never; Secure"},
    });
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  assert.equal(result.headers.get("ETag"), "\"inbox-content\"");
  assert.equal(result.headers.get("Set-Cookie"), null);
  assert.deepEqual(await result.json(), projection);
});

test("rejects cross-origin, unsupported method, queries, and Worker URL changes before any upstream call", async () => {
  const never = async (): Promise<Response> => { assert.fail("No upstream request expected"); };
  assert.equal((await readStagingInbox(request({"Sec-Fetch-Site": "cross-site"}), settings, never)).status, 403);
  assert.equal((await readStagingInbox(request(undefined, "", "POST"), settings, never)).status, 405);
  assert.equal((await readStagingInbox(request(undefined, "?next=https://attacker.example"), settings, never)).status, 400);
  for (const url of [
    "http://community-pulse-staging.test-client.workers.dev/",
    "https://community-pulse-staging.test-client.workers.dev/v1/inbox",
    "https://community-pulse-staging.test-client.workers.dev:443/",
    "https://community-pulse-staging.test-client.workers.dev@attacker.test/",
    "https://community-pulse-staging.test-client.workers.dev.attacker.test/",
  ]) {
    assert.equal((await readStagingInbox(request(), {...settings, PULSE_STAGING_WORKER_URL: url}, never)).status, 503);
  }
});

test("a conditional response needs the corresponding safe validator and still uses no-store", async () => {
  const upstream = async () => new Response(null, {status: 304, headers: {ETag: "\"inbox-tag\""}});
  const hit = await readStagingInbox(request({"If-None-Match": "\"inbox-tag\""}), settings, upstream);
  assert.equal(hit.status, 304);
  assert.equal(hit.headers.get("Cache-Control"), "private, no-store");
  assert.equal(await hit.text(), "");
  assert.equal((await readStagingInbox(request(), settings, upstream)).status, 503);
  assert.equal((await readStagingInbox(request({"If-None-Match": "*"}), settings, upstream)).status, 503);
  assert.equal((await readStagingInbox(request({"If-None-Match": "\"unrelated-tag\""}), settings, upstream)).status, 503);
});

test("refuses malformed, oversized, redirected, or unauthorized upstream data", async () => {
  for (const response of [
    Response.redirect("https://attacker.example/"),
    new Response("an upstream authorization detail", {status: 401}),
    new Response("oops", {headers: {ETag: "\"bad\"","Content-Type": "application/json"}}),
    Response.json({...projection, snapshot: fixture.snapshot}, {headers: {ETag: "\"bad\""}}),
    Response.json(projection, {headers: {ETag: "\"oversized\"", "Content-Length": "2000000"}}),
  ]) {
    const result = await readStagingInbox(request(), settings, async () => response);
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), {error: "intelligence_unavailable"});
    assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  }
});

test("staging shape rejects approved artifacts, invented claims, and invalid operational counters", () => {
  assert.deepEqual(parseStagingInboxResponse(projection), projection);
  assert.equal(parseStagingInboxResponse({...projection, snapshot: fixture.snapshot}), null);
  assert.equal(parseStagingInboxResponse({...projection, inbox: fixture.inbox}), null);
  assert.equal(parseStagingInboxResponse({...projection, metrics: {...projection.metrics, runs: {}}}), null);
  assert.equal(parseStagingInboxResponse({...projection, metrics: {...projection.metrics, window_hours: -1}}), null);
});
