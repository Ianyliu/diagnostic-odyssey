/* Workstream H: combined-state and physical print matrix, no deployed URL access. */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {prepareWorkspace, navigateWorkspace} from "./workspace-helpers.mjs";

const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4199";
const root = process.env.QA_OUTPUT ?? "/tmp/workstream-h";
const mode = process.env.QA_H_MODE ?? "default";
const insights = process.env.QA_INSIGHTS_MODE === "on";
const concept = process.env.QA_CONCEPT_MODE === "on";
const cases = ["default", "none", "custom", "pilot-only", "pilot-overlap"];
const headlines = [
  "meps24-current-long-covid-population",
  "meps24-gross-all-cause-spending-total",
  "meps24-healthcare-paperwork-time-mean",
  "meps24-k6-serious-distress"
];
const report = {mode, insights, concept, tests: [], printCombinations: [], pdfs: [], errors: []};
await mkdir(root, {recursive: true});
const browser = await chromium.launch({channel: "chrome", headless: true});

async function jsonBytes(page) {
  await prepareWorkspace(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", {name: "Export JSON companion"}).click();
  const download = await pending;
  return readFile(await download.path(), "utf8");
}
async function nav(page, label) {
  await navigateWorkspace(page, label);
}
async function setup(name) {
  const context = await browser.newContext({acceptDownloads: true, viewport: {width: 1440, height: 1000}, reducedMotion: "reduce"});
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(String(error)));
  await page.goto(base + "/brief");
  await prepareWorkspace(page);
  if (name !== "default") {
    await nav(page, "Local context");
    await page.getByRole("button", {name: "Select none", exact: true}).first().click();
    if (name === "custom") {
      const group = page.getByRole("group", {name: "ACS access context selection controls"});
      if (await group.count()) await group.getByRole("button", {name: "Select all"}).click();
      else for (const id of ["wv.acs.no_vehicle_pct", "wv.acs.uninsured_pct", "wv.acs.broadband_pct", "wv.acs.poverty_pct"]) {
        await page.locator("#select-local-context-" + id.replace(/[^a-zA-Z0-9_-]/g, "-")).check();
      }
    }
    if (name === "pilot-only" || name === "pilot-overlap") {
      await page.getByRole("button", {name: /Use .* in Pilot planning/}).first().click();
    }
    await nav(page, "Planning brief");
    if (name === "pilot-overlap") {
      const pilot = JSON.parse(await jsonBytes(page)).local_context;
      assert.equal(pilot.length, 1);
      await nav(page, "Local context");
      await page.locator("#select-local-context-" + pilot[0].indicator_id.replace(/[^a-zA-Z0-9_-]/g, "-")).check();
      await nav(page, "Planning brief");
    }
  }
  return {page, context};
}
function verifyCanonical(brief, name) {
  assert.equal(brief.burden_findings.length, 21, "Only 21 released ordinary findings");
  assert.equal(new Set(brief.burden_findings.map(x => x.estimate_id)).size, 21);
  assert.ok(brief.burden_findings.every(x => !/u09/i.test(x.estimate_id)), "No U09 promotion");
  const expected = {default: 34, none: 0, custom: 4, "pilot-only": 1, "pilot-overlap": 1};
  assert.equal(brief.local_context.length, expected[name], name);
  assert.equal(new Set(brief.local_context.map(x => x.indicator_id)).size, expected[name]);
  const fields = ["indicator_id", "label", "geography_name", "geography_type", "state",
    "value", "unit", "universe", "source_ref", "source_locator", "source_agency",
    "source_release_vintage", "limitations", "allowed_interpretation", "prohibited_interpretation",
    "release_status"];
  for (const entry of brief.local_context) {
    for (const field of fields) assert.ok(Object.hasOwn(entry, field), name + " lacks " + field);
    assert.ok(entry.source_ref && entry.source_locator && Array.isArray(entry.limitations));
  }
  if (name === "default") assert.equal(brief.local_context.length, 34);
}
async function physicalPdf(page, name, printLocal, printInsights, size, canonical) {
  const file = name + "-" + (printLocal ? "detailed" : "concise") + "-" +
    (printInsights ? "insights" : "plain") + "-" + size + ".pdf";
  await page.emulateMedia({media: "print"});
  assert.equal(await page.locator(".brief-executive-summary").isVisible(), true);
  assert.equal(await page.locator(".brief-executive-finding").count(), 4);
  assert.equal(await page.locator(".brief-local-context-list").isVisible(), printLocal && canonical.local_context.length > 0);
  assert.equal(await page.locator(".insights-print-summary").count() > 0, insights && printInsights);
  await page.pdf({path: root + "/" + file, format: size, printBackground: true});
  await page.emulateMedia({media: "screen"});
  report.pdfs.push({file, name, detailed: printLocal, insights: insights && printInsights, requestedInsights: printInsights, size,
    selected: canonical.local_context.length});
  await writeFile(root + "/" + file + ".json", JSON.stringify(canonical, null, 2) + "\n");
}
try {
  for (const name of cases) {
    const {page, context} = await setup(name);
    try {
      const before = await jsonBytes(page);
      const canonical = JSON.parse(before);
      verifyCanonical(canonical, name);
      assert.equal(await page.locator(".brief-executive-finding").count(), 4);
      const text = await page.locator(".brief-executive-summary").innerText();
      for (const id of headlines) assert.ok(text.includes(id), "Absent headline " + id);
      assert.match(text, /not attributable to Long COVID|not attributable to Long COVID or diagnostic delay/i);
      assert.match(text, /ES[A-Z]Q|PSAQ/);
      assert.equal(await page.locator("#planning-insights-title").count() > 0, insights);
      assert.equal(await page.locator(".brief-concept-note").count() > 0, concept);
      const localControl = page.getByRole("checkbox", {name: /Include detailed local-context records in print/});
      const insightControl = page.getByRole("checkbox", {name: /Include optional Planning Insights detail in printed Brief/});
      assert.equal(await localControl.count(), 1);
      assert.equal(await insightControl.count(), insights ? 1 : 0);
      for (const printLocal of [false, true]) for (const printInsights of [false, true]) {
        if (printLocal) await localControl.check(); else await localControl.uncheck();
        if (insights) { if (printInsights) await insightControl.check(); else await insightControl.uncheck(); }
        const after = await jsonBytes(page);
        assert.equal(after, before, "Print options changed canonical bytes or generated_at");
        const row = {selection: name, local: printLocal, planning: printInsights, effectivePlanning: insights && printInsights,
          status: insights || !printInsights ? "PASS" : "NOT_APPLICABLE_DISABLED"};
        report.printCombinations.push(row);
        if (name === "default" || (mode === "default" && !printInsights && ((name === "none" && !printLocal) || (name !== "none" && printLocal)))) {
          await physicalPdf(page, name, printLocal, printInsights, "Letter", canonical);
        }
        if (mode === "default" && name === "default" && !printInsights) {
          await physicalPdf(page, name, printLocal, printInsights, "A4", canonical);
        }
      }
      report.tests.push({name, status: "PASS", selected: canonical.local_context.length, completeLocalRecords: true, printCanonicalByteIdentical: true});
    } finally {
      await context.close();
    }
  }
  if (mode === "default") {
    const {page, context} = await setup("default");
    try {
      await nav(page, "Pilot planner");
      await page.getByLabel("Test assumption").selectOption("capacity");
      await page.getByRole("button", {name: "Add to data requests", exact: true}).click();
      await page.getByLabel("Test assumption").selectOption("reach");
      await page.getByRole("button", {name: "Add to data requests", exact: true}).click();
      await page.locator("#sensitivity").getByRole("link", {name: "Review data request", exact: true}).click();
      const selected = page.locator(".data-request-sheet input[type='checkbox']");
      assert.equal(await selected.count(), 2);
      assert.equal(await selected.evaluateAll(nodes => nodes.filter(n => n.checked).length), 2);
      await nav(page, "Planning brief");
      assert.equal(JSON.parse(await jsonBytes(page)).data_requests.length, 2);
      await nav(page, "Data requests");
      await page.locator(".data-request-sheet input[type='checkbox']").last().uncheck();
      await nav(page, "Planning brief");
      assert.equal(JSON.parse(await jsonBytes(page)).data_requests.length, 1);
      await nav(page, "Pilot planner");
      await page.locator("#pilot-capacity").fill("2000");
      await nav(page, "Planning brief");
      const stale = JSON.parse(await jsonBytes(page));
      assert.ok(stale.data_requests.length < 2, "Stale request must be excluded");
      const localControl = page.getByRole("checkbox", {name: /Include detailed local-context records in print/});
      await localControl.check();
      await physicalPdf(page, "stale-request", true, false, "Letter", stale);
      report.tests.push({name: "data-request-selected-deselected-stale", status: "PASS", remaining: stale.data_requests.length});
    } finally { await context.close(); }
    {
    const {page, context} = await setup("default");
    try {
      await nav(page, "Pilot planner");
      await page.locator("#pilot-fixed_cost").fill(String(Number.MAX_VALUE));
      await nav(page, "Planning brief");
      const extreme = JSON.parse(await jsonBytes(page));
      await page.getByRole("checkbox", {name: /Include detailed local-context records in print/}).check();
      await physicalPdf(page, "extreme", true, false, "Letter", extreme);
      report.tests.push({name: "extreme-finite-scenario", status: "PASS"});
    } finally { await context.close(); }
    }
  }
} catch (error) {
  report.tests.push({name: "integration-matrix", status: "FAIL", error: String(error.stack ?? error)});
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(root + "/matrix-results.json", JSON.stringify(report, null, 2) + "\n");
}
if (report.errors.length) process.exitCode = 1;
console.log(JSON.stringify({mode, cases: report.tests, lightweight: report.printCombinations.length,
  renderedPdfs: report.pdfs.length, errors: report.errors}, null, 2));