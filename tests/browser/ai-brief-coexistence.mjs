/* global process, console */
/* PR #111 integration-only browser smoke test across both feature flags.
 * Confirms three independently gated Brief surfaces use the same canonical Brief.
 * It is intentionally not imported by application/runtime code.
 */
import assert from "node:assert/strict";
import {readFile, mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createRequire} from "node:module";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4175";
const demo = process.env.QA_BUILD === "demo";
const insights = process.env.QA_INSIGHTS_BUILD !== "off";
const browser = await chromium.launch(process.env.QA_CHROME
  ? {executablePath: process.env.QA_CHROME, headless: true, args: ["--no-sandbox"]}
  : {channel: "chrome", headless: true});
const errors = [], external = [];
const context = await browser.newContext({acceptDownloads: true, viewport: {width: 1200, height: 950}});
const page = await context.newPage();
page.on("pageerror", error => errors.push(String(error)));
page.on("request", req => {
  if (!req.url().startsWith(base) && !req.url().startsWith("blob:")) external.push(req.url());
});
async function downloadedAfter(action, filename) {
  const downloadPromise = page.waitForEvent("download");
  await action();
  const download = await downloadPromise;
  const dir = await mkdtemp(join(tmpdir(), "do-brief-integration-"));
  const path = join(dir, filename);
  await download.saveAs(path);
  return readFile(path, "utf8");
}
try {
  await page.goto(base + "/brief");
  await page.getByRole("heading", {name: "Long COVID burden and pilot planning brief"}).waitFor();
  const insightsCount = await page.locator("#planning-insights-title").count();
  assert.equal(insightsCount, insights ? 1 : 0, "deterministic insights flag");
  const conceptCount = await page.locator('a[href="/concept/future-ai"]').count();
  assert.equal(conceptCount, demo ? 1 : 0, "concept demo flag");

  await page.getByRole("button", {name: "Analyze with AI"}).click();
  const dialog = page.getByRole("dialog", {name: "Analyze with AI"});
  await dialog.waitFor();
  assert.equal(await dialog.getByRole("combobox", {name: "Analysis goal"}).inputValue(), "comprehensive");
  const textArea = dialog.locator("#ai-handoff-text");
  const completeText = await textArea.inputValue();
  assert.match(completeText, /BEGIN_DIAGNOSTIC_ODYSSEY_DATA/);
  assert.match(completeText, /Gross all-cause burden is not illness-attributable/);
  assert.equal(await dialog.getByRole("button", {name: "Copy complete prompt"}).isEnabled(), true);

  const saved = await downloadedAfter(
    () => dialog.getByRole("button", {name: "Download Markdown"}).click(),
    "full-handoff.md"
  );
  assert.equal(saved, completeText, "exact downloadable full prompt");
  const found = saved.match(/BEGIN_DIAGNOSTIC_ODYSSEY_DATA\n\n\x60\x60\x60json\n\n([\s\S]*?)\n\n\x60\x60\x60\n\nEND_DIAGNOSTIC_ODYSSEY_DATA/);
  assert.ok(found, "canonical envelope is parseable");
  const envelope = JSON.parse(found[1]);
  assert.equal(envelope.data_scope, "current_brief");
  assert.equal(envelope.analysis_goal, "comprehensive");
  assert.equal(envelope.sensitivity_status, "not_in_planning_brief");

  await dialog.getByRole("combobox", {name: "Analysis goal"}).selectOption("evidence_audit");
  assert.equal(await dialog.getByRole("button", {name: "Copy complete prompt"}).isDisabled(), true, "changed goal invalidates snapshot");
  await dialog.getByRole("button", {name: "Regenerate preview"}).click();
  assert.equal(await dialog.getByRole("button", {name: "Copy complete prompt"}).isEnabled(), true);
  await dialog.getByRole("button", {name: "Close Analyze with AI"}).click();

  const jsonString = await downloadedAfter(
    () => page.getByRole("button", {name: "Export JSON companion"}).click(),
    "canonical.json"
  );
  const canonical = JSON.parse(jsonString), fromHandoff = envelope.payload;
  // Composition timestamps legitimately differ between UI events.
  delete canonical.generated_at;
  delete fromHandoff.generated_at;
  assert.deepEqual(fromHandoff, canonical, "AI handoff is the exact reviewed canonical Brief");

  assert.deepEqual(errors, [], "browser has no page errors");
  assert.deepEqual(external, [], "no third-party requests from Brief/handoff");
  console.log(JSON.stringify({result:"PASS", demo, insights, findings:canonical.burden_findings.length,
    requests:canonical.data_requests.length, thirdPartyRequests:external.length}));
} finally {
  await context.close();
  await browser.close();
}
