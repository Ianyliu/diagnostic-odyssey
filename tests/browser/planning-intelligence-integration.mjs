import {prepareWorkspace, navigateWorkspace} from "./workspace-helpers.mjs";
/* global process, URL, console */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";

const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4199";
const output = process.env.QA_OUTPUT ?? "/tmp/planning-intelligence-integration";
const insightsEnabled = process.env.QA_INSIGHTS_MODE !== "off";
const conceptEnabled = process.env.QA_CONCEPT_MODE === "on";
await mkdir(output, {recursive: true});
const browser = await chromium.launch(process.env.QA_CHROME ? {executablePath: process.env.QA_CHROME, headless: true} : {channel: "chrome", headless: true});
const results = [];
const failures = [];
async function check(name, callback) {
  const context = await browser.newContext({acceptDownloads: true, viewport: {width: 1440, height: 1000}, reducedMotion: "reduce"});
  const page = await context.newPage();
  page.on("pageerror", error => failures.push(String(error)));
  context.on("request", request => { if (new URL(request.url()).origin !== new URL(base).origin) failures.push("Unexpected network: "+request.url()); });
  try {
    await page.goto(base + "/brief");
    await page.getByRole("heading", {level: 1, name: /Long COVID burden and pilot planning brief/}).waitFor();
    await callback(page);
    results.push({name, status: "PASS"});
  } catch (error) {
    results.push({name, status: "FAIL", error: String(error.stack ?? error)});
  } finally { await context.close(); }
}
async function canonical(page) {
  await prepareWorkspace(page);
  const promise = page.waitForEvent("download");
  await page.getByRole("button", {name:"Export JSON companion"}).click();
  const file = await promise;
  const content = JSON.parse(await readFile(await file.path(), "utf8"));
  delete content.generated_at;
  return content;
}
await check("all three controls coexist and optional routes remain gated", async page => {
  assert.equal(await page.getByRole("button", {name:"Analyze with AI", exact:true}).count(), 1);
  assert.match(await page.locator("#ai-handoff-launch-note").innerText(), /No live AI model or API calls/);
  assert.equal(await page.locator("#planning-insights-title").count() > 0, insightsEnabled);
  if (insightsEnabled) {
    assert.match(await page.locator("#planning-insights").innerText(), /no live AI inference/);
  }
  assert.equal(await page.getByRole("link", {name:/Explore future AI concept/}).count() > 0, conceptEnabled);
  assert.equal(await page.locator(".brief-concept-note").count() > 0, conceptEnabled);
  if (conceptEnabled) {
    assert.match(await page.locator(".brief-concept-note").innerText(), /No live AI or model API calls/);
  }
  if (insightsEnabled) {
    assert.equal(await page.getByRole("checkbox", {name:/Include insights summary in printed Brief/}).count(), 1);
  } else {
    assert.equal(await page.getByRole("checkbox", {name:/Include insights summary in printed Brief/}).count(), 0);
  }
  await page.screenshot({path:join(output, "brief-combined.png"), fullPage:true});
});
await check("AI handoff, optional print, and navigation do not mutate canonical Brief", async page => {
  const before = await canonical(page);
  await page.getByRole("button", {name:"Analyze with AI", exact:true}).click();
  const dialog = page.getByRole("dialog", {name:"Analyze with AI", exact:true});
  await dialog.waitFor();
  assert.match(await dialog.locator("#ai-handoff-intro").innerText(), /does not invoke an AI provider or consume model API tokens/);
  await dialog.getByRole("button", {name:"Close Analyze with AI"}).click();
  if (insightsEnabled) {
    await page.getByRole("checkbox", {name:/Include insights summary in printed Brief/}).check();
    await page.emulateMedia({media:"print"});
    assert.equal(await page.locator(".insights-print-summary").isVisible(), true);
    assert.equal(await page.getByRole("dialog", {name:"Analyze with AI"}).count(), 0);
    await page.emulateMedia({media:"screen"});
  }
  if (conceptEnabled) {
    await page.getByRole("link", {name:/Explore future AI concept/}).click();
    await page.getByRole("tablist", {name:"Future experience goals"}).waitFor();
    assert.match(await page.locator(".fc-banner").innerText(), /Demo only · No live AI/i);
    for (const name of ["Explore interventions", "Identify data gaps", "Compare strategies", "Explain my Brief"]) {
      await page.getByRole("tab", {name:new RegExp(name)}).click();
      assert.equal(await page.getByRole("tab", {name:new RegExp(name)}).getAttribute("aria-selected"), "true");
    }
    await page.getByRole("link", {name:/Back to current Brief/}).click();
  } else {
    await page.goto(base + "/concept/future-ai");
    await page.waitForURL("**/brief");
    assert.equal(await page.locator(".future-concept").count(), 0);
  }
  const after = await canonical(page);
  assert.deepEqual(after,before);
});
await check("visitor can turn the illustrative concept off and back on without changing canonical Brief", async page => {
  const before = await canonical(page);
  const toggle = page.getByRole("checkbox", {name: "Show future AI concept", exact: true});
  if (!conceptEnabled) {
    assert.equal(await toggle.count(), 0, "build-level off excludes concept visibility controls");
  } else {
    assert.equal(await toggle.isChecked(), true, "concept starts visible when build permits it");
    await toggle.uncheck();
    assert.equal(await page.getByRole("link", {name: /Explore future AI concept/}).count(), 0);
    await toggle.check();
    await page.getByRole("link", {name: /Explore future AI concept/}).click();
    await page.getByRole("tablist", {name: "Future experience goals"}).waitFor();
    await page.getByRole("button", {name: "Hide future AI concept", exact: true}).click();
    await page.waitForURL("**/brief");
    assert.equal(await toggle.isChecked(), false, "hiding from concept returns to the Brief with preference retained");
    assert.equal(await page.getByRole("link", {name: /Explore future AI concept/}).count(), 0);
    await toggle.check();
    assert.equal(await page.getByRole("link", {name: /Explore future AI concept/}).count(), 1);
  }
  assert.deepEqual(await canonical(page), before, "toggling cannot change reviewed evidence or analyst state");
});
async function nav(page, name) { await navigateWorkspace(page, name); }
function envelope(text) {
  const match = text.match(/\nBEGIN_DIAGNOSTIC_ODYSSEY_DATA\n\n```json\n\n([\s\S]*?)\n\n```\n\nEND_DIAGNOSTIC_ODYSSEY_DATA\n/);
  assert.ok(match, "AI handoff envelope delimiters must be present");
  return JSON.parse(match[1]);
}
// Retain the useful fresh-state parity assurance from superseded PR #111, while
// exercising it inside the accepted #110 four-build integration test instead of
// reintroducing its older feature flags, UI, or redundant Git history.
await check("fresh Brief: six complete AI goals match canonical export and downloaded Markdown", async page => {
  const original = await canonical(page);
  await page.getByRole("button", {name: "Analyze with AI", exact: true}).click();
  const dialog = page.getByRole("dialog", {name: "Analyze with AI", exact: true});
  await dialog.waitFor();
  const selectGoal = dialog.getByLabel("Analysis goal");
  const preview = dialog.getByLabel(/^Complete prompt ·/);
  const copy = dialog.getByRole("button", {name: "Copy complete prompt", exact: true});
  const download = dialog.getByRole("button", {name: "Download Markdown", exact: true});
  for (const goal of ["comprehensive", "executive", "evidence_audit", "pilot_planning", "data_gaps", "technical"]) {
    if (await selectGoal.inputValue() !== goal) {
      await selectGoal.selectOption(goal);
      assert.equal(await copy.isDisabled(), true, "goal change must disable stale transfers");
      assert.equal(await download.isDisabled(), true, "goal change must disable stale downloads");
      await dialog.getByRole("button", {name: "Regenerate preview", exact: true}).click();
    }
    assert.equal(await copy.isDisabled(), false, "generated snapshot is transferable");
    const text = await preview.inputValue();
    assert.match(text, /BEGIN_DIAGNOSTIC_ODYSSEY_DATA/, "complete JSON delimiter is present");
    assert.match(text, /Gross all-cause burden is not illness-attributable/, "scientific guardrail survives");
    const handoff = envelope(text);
    assert.equal(handoff.analysis_goal, goal);
    assert.equal(handoff.data_scope, "current_brief");
    assert.equal(handoff.sensitivity_status, "not_in_planning_brief");
    assert.equal(handoff.provenance.national_artifact_version, original.artifact_version);
    assert.equal(handoff.payload.artifact_version, original.artifact_version);
    const payload = {...handoff.payload};
    delete payload.generated_at;
    assert.deepEqual(payload, original, "all selected, eligible Brief fields match the canonical export");
    const pending = page.waitForEvent("download");
    await download.click();
    const fullMarkdown = await readFile(await (await pending).path(), "utf8");
    assert.equal(fullMarkdown, text, "download is byte-for-byte identical without truncation");
  }
  await dialog.getByRole("button", {name: "Close Analyze with AI", exact: true}).click();
  assert.deepEqual(await canonical(page), original, "six goal previews never mutate the Brief");
});

await check("stale data request forces a current AI handoff snapshot; exploration preserves canonical state", async page => {
  await nav(page, "Local context");
  await page.locator('input[id^="select-local-context-"]').first().check();
  await nav(page, "Pilot planner");
  await page.locator("#pilot-capacity").fill("5000");
  await page.getByLabel("Test assumption").selectOption("capacity");
  await page.getByRole("button", {name: "Add to data requests", exact: true}).click();
  await nav(page, "Data requests");
  const sheet = page.locator(".data-request-sheet").filter({hasText: "SESSION PLANNING REQUEST"});
  await sheet.getByRole("checkbox").check();
  await nav(page, "Planning brief");
  assert.equal((await canonical(page)).data_requests.length, 1);
  await nav(page, "Pilot planner");
  await page.locator("#pilot-capacity").fill("2000");
  await nav(page, "Data requests");
  await sheet.getByText("Stale for applied scenario", {exact: true}).waitFor();
  await nav(page, "Planning brief");
  const stale = await canonical(page);
  assert.equal(stale.data_requests.length, 0);
  assert.equal(stale.warnings.filter(warning => /selected data request is stale/.test(warning)).length, 1);
  await page.getByRole("button", {name: "Analyze with AI", exact: true}).click();
  const dialog = page.getByRole("dialog", {name: "Analyze with AI", exact: true});
  await dialog.waitFor();
  const preview = dialog.getByLabel(/^Complete prompt ·/);
  const handoffPayload = envelope(await preview.inputValue()).payload;
  delete handoffPayload.generated_at;
  assert.deepEqual(handoffPayload, stale);
  const copy = dialog.getByRole("button", {name: "Copy complete prompt", exact: true});
  const download = dialog.getByRole("button", {name: "Download Markdown", exact: true});
  assert.equal(await copy.isDisabled(), false);
  await dialog.getByLabel("Analysis goal").selectOption("executive");
  await dialog.getByText("The Brief or options changed. Regenerate the preview before copying or downloading.", {exact: true}).waitFor();
  assert.equal(await copy.isDisabled(), true);
  assert.equal(await download.isDisabled(), true);
  await dialog.getByRole("button", {name: "Regenerate preview", exact: true}).click();
  assert.equal(await copy.isDisabled(), false);
  const pending = page.waitForEvent("download");
  await download.click();
  assert.equal(await readFile(await (await pending).path(), "utf8"), await preview.inputValue());
  await dialog.getByRole("button", {name: "Close Analyze with AI", exact: true}).click();
  if (conceptEnabled) {
    await page.getByRole("link", {name: /Explore future AI concept/}).click();
    await page.getByRole("tablist", {name: "Future experience goals"}).waitFor();
    await page.getByRole("tab", {name: /Compare strategies/}).click();
    await page.getByRole("link", {name: /Back to current Brief/}).click();
  }
  assert.deepEqual(await canonical(page), stale);
});
await browser.close();
await writeFile(join(output,"summary.json"),JSON.stringify({passed: results.every(x=>x.status==="PASS") && failures.length===0, build:{insightsEnabled,conceptEnabled},results,failures},null,2)+"\n");
console.log(JSON.stringify({results,failures},null,2));
if(results.some(x=>x.status!=="PASS")||failures.length)process.exitCode=1;
