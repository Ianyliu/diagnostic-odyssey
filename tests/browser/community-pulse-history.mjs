/* global document, window */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import console from "node:console";

const require = createRequire(process.env.PLAYWRIGHT_RUNNER);
const { chromium } = require("playwright");
const base = process.env.QA_BASE_URL;
assert.ok(base);
const appPath = "/local-context/policy-access/intelligence";
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.clock.install();
  let reportReads = 0;
  let newDelivery = false;
  page.on("request", request => {
    if (new URL(request.url()).searchParams.get("view") === "report") reportReads++;
  });
  await page.route("**/api/community-pulse-history?view=health", async route => {
    if (!newDelivery) return route.continue();
    const response = await page.request.get(base + "/api/community-pulse-history?view=health");
    const content = await response.json();
    await route.fulfill({ json: { ...content, last_substantive_at: "2026-11-25T18:10:00.000Z" }, headers: { ETag: '"fixture-update"' } });
  });

  await page.goto(base + appPath);
  await page.getByRole("button", { name: "Research history" }).click();
  await page.getByText("Last substantive report").waitFor();
  await page.getByText("Last successful check").waitFor();
  const cards = page.locator(".pulse-history-records article");
  await cards.nth(24).waitFor();
  assert.equal(await cards.count(), 25);
  assert.ok(!(await cards.allTextContents()).some(text => text.includes("No substantive change")));
  assert.equal(reportReads, 0);
  const firstTitle = await cards.first().getByRole("heading").textContent();
  const disclosure = cards.first().getByRole("button", { name: /open report/iu });
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await cards.first().getByText("Synthetic research question 13").waitFor();
  assert.equal(reportReads, 1);
  await cards.first().getByText("Report provenance").click();
  await cards.first().getByText("0.2.2", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.addScriptTag({ path: require.resolve("axe-core") });
  assert.deepEqual(await page.evaluate(async () => (await window.axe.run(".pulse-page")).violations.map(v => v.id)), []);

  const output = process.env.QA_OUTPUT;
  if (output) {
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, "research-history-mobile.png") });
  }
  await page.getByRole("button", { name: "Older receipts" }).click();
  await cards.first().getByRole("heading").filter({ hasNotText: firstTitle }).waitFor();
  assert.equal(await cards.count(), 6);
  newDelivery = true;
  await page.clock.fastForward(61_000);
  await page.getByText("New deliveries available.").waitFor();
  assert.equal(await cards.count(), 6, "background health must keep the history page in place");
  await page.getByRole("button", { name: "Newer receipts" }).click();
  await cards.first().getByRole("heading", { name: firstTitle, exact: true }).waitFor();
  await page.getByLabel("Show", { exact: true }).selectOption("all");
  await page.getByLabel("Outcome", { exact: true }).selectOption("no_change");
  await page.getByLabel("Report type", { exact: true }).selectOption("hourly_scout");
  await page.getByLabel("From (UTC)").fill("2026-11-25");
  await page.getByLabel("Through (UTC)").fill("2026-11-25");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("heading", { name: "Synthetic scheduled check" }).first().waitFor();
  assert.ok((await cards.allTextContents()).every(text => text.includes("No substantive change")));

  await page.getByRole("button", { name: "Intelligence threads" }).click();
  await page.getByRole("heading", { name: "Evening diagnostic access" }).waitFor();
  await page.getByText("Cited report item is unavailable.").waitFor();
  await page.getByText("Superseded", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Open cited item 1" }).click();
  await page.getByText("Report provenance").waitFor();
  assert.equal(reportReads, 2);
  assert.deepEqual(await page.evaluate(async () => (await window.axe.run(".pulse-page")).violations.map(v => v.id)), []);
  if (output) await page.screenshot({ path: join(output, "intelligence-thread-mobile.png"), fullPage: true });

  if (process.env.QA_DISABLED_URL) {
    const disabled = await page.request.get(process.env.QA_DISABLED_URL + "/api/community-pulse-history?view=history");
    assert.equal(disabled.status(), 404);
  }
  console.log("PASS: compact and stable history, filtering, lazy mixed-version detail, new deliveries, thread corrections, unavailable citations, mobile axe and keyboard");
} finally {
  await browser.close();
}
