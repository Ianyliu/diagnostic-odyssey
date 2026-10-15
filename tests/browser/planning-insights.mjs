/* global process, console, document, window */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { URL } from "node:url";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const { chromium } = require("playwright");
const axe = require("axe-core");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4188";
const output = process.env.QA_OUTPUT ?? "/tmp/diagnostic-insights-browser";
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: "chrome", headless: true});
const results = [];
const errors = [];
const externalRequests = [];
async function run(name, body) {
  try { results.push({name, status: "PASS", details: await body()}); }
  catch (error) { results.push({name, status: "FAIL", error: String(error.stack ?? error)}); }
  for (const context of browser.contexts()) await context.close();
  await writeFile(`${output}/results.json`, JSON.stringify({results, errors, externalRequests}, null, 2));
}
async function session(width = 1440, theme = "light", reducedMotion = "reduce") {
  const context = await browser.newContext({viewport: {width, height: 1000}, colorScheme: theme, reducedMotion});
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  page.on("request", request => {
    if (new URL(request.url()).origin !== new URL(base).origin) externalRequests.push(request.url());
  });
  await page.goto(`${base}/brief`);
  await page.locator("#planning-insights-title").waitFor();
  return {context, page};
}
async function navigate(page, name) {
  const nav = page.getByRole("navigation", {name: "Primary navigation"});
  if (!await nav.isVisible()) await page.getByRole("button", {name: "Menu", exact: true}).click();
  await nav.getByRole("link", {name, exact: true}).click();
}
async function exportJson(page, name) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", {name: "Export JSON companion"}).click();
  const download = await pending;
  await download.saveAs(`${output}/${name}.json`);
  return JSON.parse(await readFile(`${output}/${name}.json`, "utf8"));
}
for (const width of [1440, 768, 390, 360]) for (const theme of ["light", "dark"]) {
  await run(`layout, contrast, provenance and keyboard ${width} ${theme}`, async () => {
    const {page} = await session(width, theme);
    const preview = page.locator("#planning-insights");
    assert.match(await preview.innerText(), /Deterministic planning preview — no live AI inference/);
    assert.equal(await preview.locator(".insight-finding").count(), 3);
    assert.equal(await preview.locator(".investigation-card").count(), 3);
    assert.match(await preview.innerText(), /Available, not selected/);
    await preview.screenshot({path: `${output}/insights-${width}-${theme}.png`});
    await page.screenshot({path: `${output}/brief-${width}-${theme}.png`, fullPage: true});
    const summary = preview.locator(".insight-finding summary").first();
    await summary.focus();
    await page.keyboard.press("Enter");
    assert.equal(await summary.evaluate(element => element.parentElement.open), true);
    assert.match(await preview.innerText(), /HC-256|MEPS/);
    await page.addScriptTag({content: axe.source});
    const report = await page.evaluate(async () => window.axe.run(document.querySelector("#planning-insights"), {runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"]}}));
    await writeFile(`${output}/axe-${width}-${theme}.json`, JSON.stringify(report, null, 2));
    assert.equal(report.violations.length, 0, JSON.stringify(report.violations.map(item => ({id: item.id, nodes: item.nodes.map(node => node.target)}))));
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll("#planning-insights *")].filter(element => {
        const box = element.getBoundingClientRect();
        return box.width && (box.right > document.documentElement.clientWidth + 1 || box.left < -1);
      }).map(element => element.className)
    }));
    assert.ok(layout.scroll <= layout.width + 1, JSON.stringify(layout));
    assert.deepEqual(layout.overflow, []);
    const hide = page.getByRole("button", {name: "Hide insights", exact: true});
    await hide.focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator("#planning-insights-content").isVisible(), false);
    await page.getByRole("button", {name: "Show insights", exact: true}).click();
    assert.equal(await page.locator("#planning-insights-content").isVisible(), true);
    return {axeViolations: report.violations.length, axeIncomplete: report.incomplete.length, layout};
  });
}
await run("current state, local selection, requests and canonical JSON isolation", async () => {
  const {page} = await session();
  const before = await exportJson(page, "before-inspection");
  for (const disclosure of await page.locator("#planning-insights summary").all()) await disclosure.click();
  const after = await exportJson(page, "after-inspection");
  delete before.generated_at; delete after.generated_at;
  assert.deepEqual(after, before);
  assert.equal(after.data_requests.length, 0);
  await navigate(page, "Pilot planner");
  await page.locator("#pilot-capacity").fill("2000");
  await navigate(page, "Planning brief");
  assert.match(await page.locator(".insight-next").innerText(), /Check the modeled capacity constraint/);
  assert.match(await page.locator(".insight-results").innerText(), /2,000/);
  await navigate(page, "Pilot planner");
  await page.locator("#pilot-capacity").fill("5000");
  await navigate(page, "Planning brief");
  assert.match(await page.locator(".insight-next").innerText(), /Choose an assumption to verify/);
  assert.match(await page.locator(".insight-next").innerText(), /does not establish which investigation should come first/);
  await navigate(page, "Local context");
  await page.locator('input[id^="select-local-context-"]').first().check();
  await navigate(page, "Planning brief");
  assert.match(await page.locator(".insight-local").innerText(), /1 selected indicator/);
  await navigate(page, "Pilot planner");
  await page.getByLabel("Test assumption").selectOption("capacity");
  await page.getByRole("button", {name: "Add to data requests", exact: true}).click();
  await navigate(page, "Planning brief");
  const prompt = page.locator(".investigation-card").filter({hasText: "Verify available capacity"});
  assert.match(await prompt.innerText(), /Request exists/);
  await prompt.getByRole("link", {name: /Review existing request/}).click();
  const request = page.locator(".data-request-sheet");
  assert.equal(await request.getByRole("checkbox").isChecked(), false);
  await request.getByRole("checkbox").check();
  await navigate(page, "Pilot planner");
  await page.locator("#pilot-capacity").fill("1000");
  await navigate(page, "Planning brief");
  assert.match(await page.locator(".investigation-card").filter({hasText: "Verify available capacity"}).innerText(), /Stale request/);
  const stale = await exportJson(page, "stale-inspected");
  assert.equal(stale.data_requests.length, 0);
  assert.equal(stale.local_context.length, 1);
  assert.equal(stale.burden_findings.length, 21);
  return {canonicalUnchanged: true, explicitSelection: true, staleExcluded: true};
});
for (const width of [1440, 820, 390, 360]) await run(`huge finite scenario presentation stays readable at ${width}px`, async () => {
  const {page} = await session(width, "dark");
  await navigate(page, "Pilot planner");
  await page.locator("#pilot-fixed_cost").fill(String(Number.MAX_VALUE));
  await navigate(page, "Planning brief");
  await page.screenshot({path: `${output}/insights-extreme-${width}-dark.png`, fullPage: true});
  const value = page.locator(".insight-results dd").last();
  assert.match(await value.innerText(), /1\.7976931348623157e\+308/);
  const box = await value.boundingBox();
  assert.ok(box.x + box.width <= width, JSON.stringify(box));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
});
await run("optional actual PDF summary preserves JSON and excludes unaccepted suggestions", async () => {
  const {page} = await session();
  const choice = page.getByRole("checkbox", {name: /Include insights summary in printed Brief/});
  assert.equal(await choice.isChecked(), false);
  const before = await exportJson(page, "print-before");
  await page.emulateMedia({media: "print"});
  assert.equal(await page.locator(".insights-print-summary").count(), 0);
  assert.equal(await page.locator("#planning-insights").isVisible(), false);
  await page.pdf({path: `${output}/summary-off.pdf`, format: "Letter", printBackground: true});
  await page.emulateMedia({media: "screen"});
  await choice.check();
  const after = await exportJson(page, "print-after");
  delete before.generated_at; delete after.generated_at;
  assert.deepEqual(after, before);
  await page.emulateMedia({media: "print"});
  const summary = page.locator(".insights-print-summary");
  assert.equal(await summary.isVisible(), true);
  assert.equal(await summary.locator(".investigation-card, .intervention-gap").count(), 0);
  assert.doesNotMatch(await summary.innerText(), /Verify pathway timing|Verify available capacity|Possible source owner/);
  await page.pdf({path: `${output}/summary-on.pdf`, format: "Letter", printBackground: true});
  await page.emulateMedia({media: "screen"});
  await page.getByRole("button", {name: "Hide insights", exact: true}).click();
  await page.emulateMedia({media: "print"});
  assert.equal(await summary.isVisible(), true, "Explicit print choice survives hiding the screen preview");
  await page.emulateMedia({media: "screen"});
  await navigate(page, "Local context");
  await page.locator("main details").evaluateAll(elements => elements.forEach(element => {element.open = true;}));
  for (const checkbox of await page.locator('input[id^="select-local-context-"]').all()) await checkbox.check();
  await navigate(page, "Planning brief");
  await page.getByRole("checkbox", {name: /Include insights summary in printed Brief/}).check();
  await page.emulateMedia({media: "print"});
  await page.pdf({path: `${output}/summary-all-context.pdf`, format: "Letter", printBackground: true});
  return {defaultOff: true, jsonUnchanged: true, suggestionsExcluded: true};
});
await browser.close();
console.log(JSON.stringify(results.map(({name, status, error}) => ({name, status, error})), null, 2));
if (results.some(row => row.status === "FAIL") || errors.length || externalRequests.length) process.exitCode = 1;
