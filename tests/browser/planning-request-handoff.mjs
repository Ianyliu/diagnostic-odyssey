/* global process, console, document, window */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {navigateWorkspace, prepareWorkspace, setAppearance} from "./workspace-helpers.mjs";

const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const axe = require("axe-core");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4198";
const output = process.env.QA_OUTPUT ?? "/tmp/planning-request-handoff";
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: "chrome", headless: true});
const results = [], errors = [];
async function run(name, body) {
  try { results.push({name, status: "PASS", details: await body()}); }
  catch (error) { results.push({name, status: "FAIL", error: String(error.stack ?? error)}); }
  for (const context of browser.contexts()) await context.close();
  await writeFile(`${output}/results.json`, JSON.stringify({browser: browser.version(), results, errors}, null, 2));
}
async function session(width, theme, url = base) {
  const page = await browser.newPage({viewport: {width, height: 1000}, colorScheme: theme, reducedMotion: "reduce"});
  page.setDefaultTimeout(8000);
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto(`${url}/data-requests`);
  await page.locator("main h1").waitFor();
  await setAppearance(page, theme);
  return page;
}
async function exportJson(page, name) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", {name: "Export JSON companion", exact: true}).click();
  await (await pending).saveAs(`${output}/${name}.json`);
  return JSON.parse(await readFile(`${output}/${name}.json`, "utf8"));
}
async function noOverflow(page) {
  const layout = await page.evaluate(() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
    outside: [...document.querySelectorAll(".data-request-sheet *")].filter(element => {
      const box = element.getBoundingClientRect();
      return box.width && (box.left < -1 || box.right > document.documentElement.clientWidth + 1);
    }).map(element => element.className)}));
  assert.ok(layout.scroll <= layout.width + 1, JSON.stringify(layout));
  assert.deepEqual(layout.outside, []);
  return layout;
}
async function focusedControlIsVisible(page) {
  const visible = await page.evaluate(() => {
    const element = document.activeElement;
    const box = element.getBoundingClientRect();
    const topmost = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return element === topmost || element.contains(topmost);
  });
  assert.equal(visible, true, "Focused control must not be covered by fixed navigation");
}

for (const width of [390, 1440]) for (const theme of ["light", "dark"]) {
  await run(`decision to request to Brief; keyboard/reflow ${width}px ${theme}`, async () => {
    const page = await session(width, theme);
    assert.equal(await page.locator(".data-request-sheet").count(), 0);
    await page.getByRole("link", {name: "Open sensitivity explorer", exact: true}).click();
    await prepareWorkspace(page);
    const assumption = page.getByLabel("Test assumption");
    await assumption.focus();
    await page.keyboard.press("Tab");
    const table = page.getByText("View sensitivity values as a table", {exact: true});
    assert.equal(await table.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Tab");
    const create = page.getByRole("button", {name: "Add to data requests", exact: true});
    assert.equal(await create.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Enter");
    const review = page.getByRole("link", {name: "Review data request", exact: true});
    // The current button remains focusable and inert; the next tab reaches review.
    await page.keyboard.press("Tab");
    assert.equal(await review.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Enter");
    const card = page.locator(".data-request-sheet");
    assert.equal(await card.count(), 1);
    assert.match(await card.innerText(), /Can available capacity support the pilot's intended reach\?/);
    assert.match(await card.innerText(), /assumes capacity of 3,000 participants/);
    assert.match(await card.innerText(), /Availability is unconfirmed/);
    assert.match(await card.innerText(), /minimum necessary aggregate summary/);
    assert.match(await card.innerText(), /If the summary is unavailable or incomplete/);
    assert.match(await card.innerText(), /Including a request in the Brief does not send it/);
    assert.equal(await card.locator(".acquisition-guidance").count(), 0);
    assert.equal(await card.getByRole("button", {name: /Attach reviewed acquisition/}).count(), 0);
    assert.doesNotMatch(await card.innerText(), /FHIR|USCDI|CMS mapping/);
    assert.match(await page.locator(".page-heading").innerText(), /not that its source data is up to date/);
    await page.screenshot({path: `${output}/request-${width}-${theme}.png`, fullPage: true});
    const inputs = card.getByText("Exact applied Pilot assumptions", {exact: true});
    await inputs.focus();
    await focusedControlIsVisible(page);
    await page.keyboard.press("Enter");
    assert.equal(await inputs.evaluate(element => element.parentElement.open), true);
    assert.match(await card.locator(".request-applied-inputs").innerText(), /25% \(0.25\)/);
    assert.equal(await card.locator(".request-applied-inputs dd").count(), 8);
    await page.keyboard.press("Tab");
    const back = card.getByRole("link", {name: "Review assumptions and sensitivity", exact: true});
    assert.equal(await back.evaluate(element => element === document.activeElement), true);
    await focusedControlIsVisible(page);
    await page.keyboard.press("Tab");
    const details = card.getByText("Request details & collection guidance", {exact: true});
    assert.equal(await details.evaluate(element => element.parentElement === document.activeElement || element === document.activeElement), true);
    await focusedControlIsVisible(page);
    await page.keyboard.press("Enter");
    assert.match(await card.innerText(), /available appointment or navigation slots/);
    assert.match(await card.innerText(), /Program\/site level during the 12-month/);
    assert.match(await card.innerText(), /Acquisition guidance awaiting admission/);
    await page.keyboard.press("Tab");
    const privacy = card.getByText("Feasibility and privacy", {exact: true});
    assert.equal(await privacy.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Enter");
    assert.match(await card.innerText(), /Individual identifiers are not required/);
    await page.keyboard.press("Tab");
    assert.equal(await card.getByRole("button", {name: "Remove session request"}).evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Tab");
    const choice = card.getByRole("checkbox");
    assert.equal(await choice.evaluate(element => element === document.activeElement), true);
    await focusedControlIsVisible(page);
    await page.keyboard.press("Space");
    assert.equal(await choice.isChecked(), false);
    await page.keyboard.press("Space");
    assert.equal(await choice.isChecked(), true);
    await page.screenshot({path: `${output}/request-expanded-${width}-${theme}.png`, fullPage: true});
    await card.locator(".request-handoff").screenshot({path: `${output}/decision-detail-${width}-${theme}.png`});
    const layout = await noOverflow(page);
    await page.addScriptTag({content: axe.source});
    const audit = await page.evaluate(async () => window.axe.run(document.querySelector("main"), {runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"]}}));
    await writeFile(`${output}/axe-${width}-${theme}.json`, JSON.stringify(audit, null, 2));
    assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations.map(item => ({id: item.id, targets: item.nodes.map(node => node.target)}))));
    await back.click();
    await prepareWorkspace(page);
    await page.locator("#pilot-capacity").fill("2000");
    await navigateWorkspace(page, "Data requests");
    assert.match(await card.innerText(), /Stale for applied scenario/);
    assert.match(await card.innerText(), /earlier assumptions/);
    assert.match(await card.innerText(), /3,000 participants/);
    assert.equal(await card.locator(".request-applied-inputs").count(), 0);
    assert.equal(await choice.isChecked(), true);
    await page.screenshot({path: `${output}/request-stale-${width}-${theme}.png`, fullPage: true});
    await navigateWorkspace(page, "Planning brief");
    const stale = await exportJson(page, `stale-${width}-${theme}`);
    assert.equal(stale.data_requests.length, 0);
    assert.ok(stale.warnings.some(warning => /stale/.test(warning)));
    await navigateWorkspace(page, "Data requests");
    await choice.uncheck();
    await card.getByRole("button", {name: "Refresh data request", exact: true}).click();
    assert.equal(await choice.isChecked(), false);
    assert.match(await card.innerText(), /2,000 participants/);
    assert.match(await card.innerText(), /Current for applied scenario/);
    await choice.check();
    await navigateWorkspace(page, "Planning brief");
    const current = await exportJson(page, `current-${width}-${theme}`);
    assert.equal(current.data_requests.length, 1);
    assert.equal(current.acquisition_guidance, undefined);
    assert.equal(current.data_requests[0].acquisition_hint, undefined);
    for (const key of ["burden_findings", "local_context", "evidence"]) assert.deepEqual(current[key], stale[key]);
    assert.equal(current.burden_findings.length, 21);
    assert.equal(current.local_context.length, 34);
    // Existing suggestions must remain separate from the single analyst-created request.
    assert.equal(await page.locator(".investigation-card").count(), 3);
    assert.equal(current.data_requests[0].request_id, "session.sensitivity.capacity");
    return {layout, axeViolations: audit.violations.length, axeIncomplete: audit.incomplete.length,
      keyboardOrder: ["assumption", "table", "create", "review", "applied inputs", "return to sensitivity", "request details", "privacy", "remove", "Brief checkbox"],
      staleExcluded: true, refreshPreservesDeselection: true, governedRecordsUnchanged: true, suggestionsNotCreated: true};
  });
}
await run("invalid draft pauses creation and preserves the last applied request", async () => {
  const page = await session(390, "dark");
  await navigateWorkspace(page, "Pilot planner");
  await page.getByRole("button", {name: "Add to data requests", exact: true}).click();
  await page.locator("#pilot-capacity").fill("");
  assert.match(await page.locator(".draft-not-applied").innerText(), /last valid planning assumptions/);
  assert.equal(await page.getByRole("button", {name: "Add to data requests", exact: true}).count(), 0);
  assert.equal(await page.getByText("Sensitivity analysis paused", {exact: true}).count(), 1);
  await navigateWorkspace(page, "Data requests");
  assert.match(await page.locator(".data-request-sheet").innerText(), /Current for applied scenario/);
  await page.getByText("Exact applied Pilot assumptions", {exact: true}).click();
  assert.match(await page.locator(".request-applied-inputs").innerText(), /3,000/);
  return {draftNotApplied: true, appliedRequestUnchanged: true};
});
if (process.env.QA_DEV_BASE_URL) await run("unavailable local context: synthetic loader failure retains national evidence and request loop", async () => {
  const page = await browser.newPage({viewport: {width: 390, height: 1000}});
  let injected = false;
  await page.route(/\/src\/data\/reviewedLocalContext\.ts(?:\?|$)/, async route => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace("return assertReviewedWvLocalContextArtifact(candidate);", 'throw new Error("Synthetic QA unavailable local context");');
    assert.notEqual(body, original, "Loader fixture must actually be installed");
    injected = true;
    await route.fulfill({response, body});
  });
  await page.goto(`${process.env.QA_DEV_BASE_URL}/pilot`);
  await prepareWorkspace(page);
  assert.equal(injected, true);
  await page.getByRole("button", {name: "Add to data requests", exact: true}).click();
  await navigateWorkspace(page, "Data requests");
  assert.match(await page.locator(".data-request-sheet").innerText(), /Availability is unconfirmed/);
  await navigateWorkspace(page, "Planning brief");
  const brief = await exportJson(page, "unavailable-local-context");
  assert.equal(brief.burden_findings.length, 21);
  assert.equal(brief.local_context.length, 0);
  assert.equal(brief.data_requests.length, 1);
  await page.screenshot({path: `${output}/unavailable-context-390.png`, fullPage: true});
  return {fixture: "test-only network interception throws in local-context loader", nationalRecords: 21, localRecords: 0, currentRequests: 1};
});
await browser.close();
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.some(result => result.status !== "PASS") || errors.length ? 1 : 0;
