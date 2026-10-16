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
const browser = await chromium.launch({channel: "chrome", headless: true});
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
  const promise = page.waitForEvent("download");
  await page.getByRole("button", {name:"Export JSON companion"}).click();
  const file = await promise;
  const content = JSON.parse(await readFile(await file.path(), "utf8"));
  delete content.generated_at;
  return content;
}
await check("all three controls coexist and optional routes remain gated", async page => {
  assert.equal(await page.getByRole("button", {name:"Analyze with AI", exact:true}).count(), 1);
  assert.equal(await page.locator("#planning-insights-title").count() > 0, insightsEnabled);
  assert.equal(await page.getByRole("link", {name:/Explore future AI concept/}).count() > 0, conceptEnabled);
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
await browser.close();
await writeFile(join(output,"summary.json"),JSON.stringify({passed: results.every(x=>x.status==="PASS") && failures.length===0, build:{insightsEnabled,conceptEnabled},results,failures},null,2)+"\n");
console.log(JSON.stringify({results,failures},null,2));
if(results.some(x=>x.status!=="PASS")||failures.length)process.exitCode=1;
