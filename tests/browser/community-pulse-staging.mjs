/* global document, window */
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import process from "node:process";
import { fixtureDataSource } from "../../apps/web/src/server/community-pulse/fixtureDataSource.ts";

const require = createRequire(process.env.PLAYWRIGHT_RUNNER);
const { chromium } = require("playwright");
const base = process.env.QA_STAGING_URL;
assert.ok(base);

const fixture = await fixtureDataSource.read();
const reports = fixture.inbox.filter(entry => entry.report).map(({receipt, report}) => ({receipt, report}));
const latest = reports[0];
assert.ok(latest);

const emptyRun = {
  completed: 0, no_change: 0, partial: 0, failed: 0,
  last_delivery_at: null, last_success_at: null, missed: null,
};
const asOf = "2026-11-25T08:01:00Z";
const health = {
  as_of: asOf,
  window_hours: 24,
  last_success_at: null,
  runs: {
    hourly_scout: { ...emptyRun, missed: true },
    daily_synthesis: emptyRun,
    weekly_strategic_review: emptyRun,
    on_demand: emptyRun,
  },
};
const initial = { schema_version: "0.2.1", inbox: [], metrics: health };
const updated = {
  ...initial,
  inbox: [latest],
  metrics: {
    ...health,
    last_success_at: latest.receipt.received_at,
    runs: {
      ...health.runs,
      hourly_scout: {
        ...emptyRun,
        completed: 1,
        missed: false,
        last_delivery_at: latest.receipt.received_at,
        last_success_at: latest.receipt.received_at,
      },
    },
  },
};

const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const requests = [];
  let fixtureReads = 0;
  await page.route("**/api/community-pulse", async route => {
    fixtureReads++;
    await route.fulfill({json: fixture});
  });
  await page.route("**/api/community-pulse-staging", async route => {
    requests.push(route.request().headers()["if-none-match"]);
    switch (requests.length) {
      case 1: await route.fulfill({json: initial, headers: {ETag: "\"one\""} }); break;
      case 2: await route.fulfill({status: 304, headers: {ETag: "\"one\""} }); break;
      case 3: await route.fulfill({json: updated, headers: {ETag: "\"two\""} }); break;
      default: await route.fulfill({status: 401, json: {error: "not_authorized"}});
    }
  });
  await page.clock.install();
  await page.goto(base + "/local-context/policy-access/intelligence?inspect=receipts");
  await page.getByText("Private staging inbox", {exact: true}).waitFor();
  await page.getByText("Last successful update", {exact: true}).waitFor();
  await page.getByText("Missed run", {exact: true}).waitFor();
  assert.equal(fixtureReads, 0);

  const notModified = page.waitForResponse(response => response.status() === 304);
  await page.clock.fastForward(61_000);
  await notModified;
  assert.deepEqual(requests, [undefined, "\"one\""]);
  await page.clock.fastForward(61_000);
  assert.equal(requests.length, 2);
  await page.clock.fastForward(61_000);
  await page.getByRole("heading", {name: latest.report.title}).waitFor();
  assert.equal(requests[2], "\"one\"");
  await page.getByText("On cadence", {exact: true}).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.addScriptTag({ path: require.resolve("axe-core") });
  const violations = await page.evaluate(async () => (await window.axe.run(".pulse-page")).violations.map(result => result.id));
  assert.deepEqual(violations, []);
  const refresh = page.getByRole("button", {name: "Refresh inbox"});
  await refresh.focus();
  assert.equal(await refresh.evaluate(element => element === document.activeElement), true);
  const output = process.env.QA_OUTPUT;
  if (output) {
    await mkdir(output, {recursive: true});
    await page.screenshot({path: join(output, "staging-intelligence-mobile.png"), fullPage: true});
  }

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {configurable: true, value: "hidden"});
    document.dispatchEvent(new window.Event("visibilitychange"));
  });
  await page.getByText("Loading staging inbox…", {exact: true}).waitFor();
  await page.clock.fastForward(360_000);
  assert.equal(requests.length, 3);
  assert.equal(await page.getByRole("heading", {name: latest.report.title}).count(), 0);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {configurable: true, value: "visible"});
    document.dispatchEvent(new window.Event("visibilitychange"));
  });
  await page.getByText("Staging inbox is unavailable.", {exact: true}).waitFor();
  assert.equal(requests[3], undefined);
  assert.equal(fixtureReads, 0);
  console.log("PASS: private staging feed, ETag revalidation, idle backoff, hidden-tab suspension, missed run, mobile axe, keyboard focus, and no fixture fallback");
} finally {
  await browser.close();
}
