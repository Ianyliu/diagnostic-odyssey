import assert from "node:assert/strict";
import test from "node:test";
import { readHistoryEndpoint } from "../src/server/community-pulse/historyEndpoint.ts";
import { parseResearchDetail, parseResearchHealth, parseResearchHistory, parseThreadProjection } from "../src/data/communityPulseHistory.ts";

const preview = {
  VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feat/community-pulse-fixture-phase-f", COMMUNITY_PULSE_MODE: "fixture",
};
const staged = { ...preview, PULSE_STAGING_INBOX_ENABLED: "on",
  PULSE_STAGING_WORKER_URL: "https://community-pulse-staging.example.workers.dev",
  PULSE_STAGING_WORKER_TOKEN: "private-history-integration-testing-token-only",
};
const base = "https://preview.example.invalid/api/community-pulse-history";
const request = (query: string, options?: RequestInit) => new Request(base + "?" + query, options);

test("protected demo reads bounded summaries, both report versions, and retention-aware thread citations", async () => {
  const first = await readHistoryEndpoint(request("view=history"), preview);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  const raw = await first.json();
  const page = parseResearchHistory(raw);
  assert.equal(page?.records.length, 25);
  assert.ok(page?.next_cursor);
  assert.ok(page.records.every(row => row.outcome !== "no_change"));
  assert.ok(raw.records.every((row: Record<string, unknown>) => !Object.hasOwn(row, "report")));
  assert.equal((await readHistoryEndpoint(request("view=history&mode=all&cursor=" + page.next_cursor), preview)).status, 410);
  const next = parseResearchHistory(await (await readHistoryEndpoint(request("view=history&cursor=" + page.next_cursor), preview)).json());
  assert.equal(next?.records.length, 6);
  assert.equal(next.as_of, page.as_of);
  const detail = parseResearchDetail(await (await readHistoryEndpoint(request("view=report&ref=" + page.records[0]?.ref), preview)).json());
  assert.equal(detail?.report.schema_version, "0.2.2");
  assert.ok((detail?.report.items.length ?? 0) > 12);
  const oldDetail = parseResearchDetail(await (await readHistoryEndpoint(request("view=report&ref=" + page.records[1]?.ref), preview)).json());
  assert.equal(oldDetail?.report.schema_version, "0.2.1");

  const health = await readHistoryEndpoint(request("view=health"), preview);
  const content = parseResearchHealth(await health.json());
  const tag = health.headers.get("etag");
  assert.ok(tag && content);
  assert.notEqual(content.metrics.last_success_at, content.last_substantive_at);
  const unchanged = await readHistoryEndpoint(request("view=health", { headers: { "If-None-Match": tag } }), preview);
  assert.equal(unchanged.status, 304);

  const thread = parseThreadProjection(await (await readHistoryEndpoint(request("view=thread"), preview)).json());
  assert.equal(thread?.timeline.length, 5);
  assert.equal(thread.timeline[3]?.supersedes, thread.timeline[0]?.id);
  assert.equal(thread.timeline[0]?.citations[0]?.availability, "available");
  assert.equal(thread.timeline[4]?.citations[0]?.availability, "unavailable");
});

test("history, report and thread access fail closed outside the exact protected preview", async () => {
  const noFetch = async () => { assert.fail("No request to Worker expected"); };
  for (const env of [{}, { ...preview, VERCEL_ENV: "production" }, { ...preview, VERCEL_GIT_COMMIT_REF: "unapproved" }]) {
    for (const view of ["history", "report", "thread"]) {
      assert.equal((await readHistoryEndpoint(request("view=" + view), env, noFetch)).status, 404);
    }
  }
  assert.equal((await readHistoryEndpoint(request("view=thread"), staged, noFetch)).status, 404);
  assert.equal((await readHistoryEndpoint(request("view=thread", { method: "POST" }), preview, noFetch)).status, 405);
  assert.equal((await readHistoryEndpoint(request("view=history", { headers: { "Sec-Fetch-Site": "cross-site" } }), staged, noFetch)).status, 403);
  assert.equal((await readHistoryEndpoint(request("view=history&url=http://localhost"), staged, noFetch)).status, 400);
  assert.equal((await readHistoryEndpoint(request("view=history"), { ...staged, PULSE_STAGING_WORKER_URL: "https://localhost" }, noFetch)).status, 503);
});

test("staging proxy checks report digests and forwards only fixed paths with a server credential", async () => {
  const list = parseResearchHistory(await (await readHistoryEndpoint(request("view=history"), preview)).json());
  const reference = list?.records[0]?.ref;
  assert.ok(reference);
  const response = await readHistoryEndpoint(request("view=report&ref=" + reference), preview);
  const detail = parseResearchDetail(await response.json());
  assert.ok(detail);
  const good = await readHistoryEndpoint(request("view=report&ref=" + reference), staged, async (url, options) => {
    assert.equal(String(url), "https://community-pulse-staging.example.workers.dev/v1/history/report?ref=" + reference);
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer " + staged.PULSE_STAGING_WORKER_TOKEN);
    assert.equal(options?.redirect, "error");
    return Response.json(detail);
  });
  assert.equal(good.status, 200);
  const tampered = await readHistoryEndpoint(request("view=report&ref=" + reference), staged,
    async () => Response.json({ ...detail, report: { ...detail.report, title: "Tampered" } }));
  assert.equal(tampered.status, 503);
});
