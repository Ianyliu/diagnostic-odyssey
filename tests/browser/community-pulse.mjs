/* global document, window */
import console from "node:console";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";

const require = createRequire(process.env.PLAYWRIGHT_RUNNER);
const { chromium } = require("playwright");
const axePath = require.resolve("axe-core");
const base = process.env.QA_BASE_URL;
const off = process.env.QA_DISABLED_URL;
const output = process.env.QA_OUTPUT;
assert.ok(base && off && output);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1, hasTouch: true });
  await mobile.goto(base + "/local-context");
  await mobile.getByRole("link", { name: /Policy & Access Change Ledger/i }).first().click();
  await mobile.getByRole("heading", { name: "Policy & Access Change Ledger" }).waitFor();
  await mobile.getByRole("heading", { name: /Ridgeview announces/i }).waitFor();
  await mobile.getByLabel("Geographic view").selectOption("54099");
  await mobile.getByRole("heading", { name: "Documented service to selected county" }).waitFor();
  const detail = mobile.locator("article").filter({ hasText: "Ridgeview announces" }).locator("summary").first();
  await detail.focus();
  await mobile.keyboard.press("Enter");
  assert.equal(await detail.evaluate(el => el.parentElement.open), true);
  await mobile.getByRole("link", { name: /Ridgeview Regional Diagnostic Center/i }).waitFor();
  await mobile.getByLabel("Date focus").selectOption("upcoming");
  await mobile.getByRole("heading", { name: /Ridgeview announces/i }).waitFor();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await mobile.addScriptTag({ path: axePath });
  const ledgerAxe = await mobile.evaluate(async () => (await window.axe.run(".pulse-page")).violations.map(x => x.id));
  assert.deepEqual(ledgerAxe, []);
  await mobile.screenshot({ path: join(output, "community-pulse-ledger-mobile.png"), fullPage: true });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const endpoint = await desktop.request.get(base + "/api/community-pulse");
  assert.equal(endpoint.status(), 200);
  assert.match(endpoint.headers()["cache-control"], /no-store/);
  const data = await endpoint.json();
  const later = data.inbox.find(item => item.report?.report_type === "daily_synthesis");
  assert.ok(later);
  let calls = 0;
  await desktop.route("**/api/community-pulse", async route => {
    calls++;
    await route.fulfill({ json: calls === 1 ? { ...data, inbox: data.inbox.filter(item => item !== later) } : data });
  });
  await desktop.clock.install();
  await desktop.goto(base + "/local-context/policy-access/intelligence");
  await desktop.getByRole("heading", { name: "Quarantined submission" }).waitFor();
  assert.equal(await desktop.getByRole("heading", { name: later.report.title }).count(), 0);
  await desktop.clock.fastForward(31_000);
  await desktop.getByRole("heading", { name: later.report.title }).waitFor();
  const report = desktop.locator("article").filter({ hasText: later.report.title });
  await report.getByText("Raw research report", { exact: true }).click();
  await report.getByRole("heading", { name: "Cross-source synthesis" }).waitFor();
  assert.equal(await report.locator("a").count(), 0);
  await report.getByText("Validated candidate claims", { exact: true }).click();
  await report.getByText("Unsupported", { exact: true }).waitFor();
  const rejected = desktop.locator("article").filter({ hasText: "Quarantined submission" });
  assert.equal(await rejected.getByText("Raw research report", { exact: true }).count(), 0);
  await desktop.addScriptTag({ path: axePath });
  const briefAxe = await desktop.evaluate(async () => (await window.axe.run(".pulse-page")).violations.map(x => x.id));
  assert.deepEqual(briefAxe, []);
  await desktop.screenshot({ path: join(output, "community-pulse-intelligence-desktop.png"), fullPage: true });

  const disabled = await browser.newPage();
  let unexpected = 0;
  disabled.on("request", req => { if (req.url().endsWith("/api/community-pulse")) unexpected++; });
  await disabled.goto(off + "/local-context");
  await disabled.getByRole("main").waitFor();
  assert.equal(await disabled.getByRole("link", { name: /Policy & Access Change Ledger/i }).count(), 0);
  assert.equal(unexpected, 0);
  assert.equal((await disabled.request.get(off + "/api/community-pulse")).status(), 404);
  console.log("PASS: mobile filters and keyboard evidence, automatic inbox refresh, quarantine isolation, scoped axe, and feature disabled");
} finally {
  await browser.close();
}
