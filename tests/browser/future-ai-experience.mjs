/* global process, console, document, window, innerWidth, getComputedStyle, URL */
import assert from "node:assert/strict";
import {mkdir, readFile, writeFile, readdir} from "node:fs/promises";
import {createRequire} from "node:module";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const axe = require("axe-core");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4175";
const output = process.env.QA_OUTPUT ?? "/tmp/future-ai-experience";
const disabled = process.env.QA_BUILD === "off";
const browser = await chromium.launch(process.env.QA_CHROME ? {executablePath: process.env.QA_CHROME, headless: true, args: ["--no-sandbox"]} : {channel: "chrome", headless: true});
await mkdir(output, {recursive: true});
const matrix = [], network = [], pageErrors = [], accessibility = [];
const goals = ["Explain my Brief", "Explore interventions", "Identify data gaps", "Compare strategies"];
async function context(options = {}) {
  const ctx = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: "reduce", ...options});
  ctx.on("request", request => { if (!request.url().startsWith(base) && !request.url().startsWith("blob:")) network.push(request.url()); if (["xhr", "fetch", "websocket", "eventsource"].includes(request.resourceType())) network.push(`${request.resourceType()}:${request.url()}`); });
  ctx.on("page", page => page.on("pageerror", error => pageErrors.push(String(error))));
  return ctx;
}
async function check(name, body) {
  try { matrix.push({name, status: "PASS", details: await body()}); }
  catch (error) { matrix.push({name, status: "FAIL", error: String(error.stack ?? error)}); }
  for (const ctx of browser.contexts()) await ctx.close();
  console.log(matrix.at(-1).status, name);
}
async function ready(page, path = "/concept/future-ai") {
  await page.goto(base + path); await page.locator("main h1").waitFor();
  if (!disabled && path === "/concept/future-ai") await page.locator(".fc-finding").first().waitFor();
}
async function goal(page, name) { await page.getByRole("tab", {name, exact: false}).click(); }
async function nav(page, name) {
  const menu = page.getByRole("navigation", {name: "Primary navigation"});
  if (!await menu.isVisible()) await page.getByRole("button", {name: "Menu", exact: true}).click();
  await menu.getByRole("link", {name, exact: true}).click();
}
async function exportBrief(page, name) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", {name: "Export JSON companion"}).click();
  const download = await pending; const path = `${output}/${name}.json`; await download.saveAs(path);
  const brief = JSON.parse(await readFile(path, "utf8")); delete brief.generated_at; return brief;
}
if (disabled) {
  await check("disabled build redirects the concept route and exposes no entry points", async () => {
    const ctx = await context(); const page = await ctx.newPage(); await ready(page);
    assert.equal(new URL(page.url()).pathname, "/brief");
    await page.screenshot({path: `${output}/default-build-brief.png`, fullPage: true});
    for (const path of ["/brief", "/evidence", "/"]) {
      await ready(page, path);
      assert.equal(await page.locator('a[href="/concept/future-ai"]').count(), 0);
      assert.equal(await page.locator(".future-concept").count(), 0);
    }
    const files = await readdir(`${process.env.QA_DIST}/assets`);
    assert.equal(files.some(file => /FutureAIExperience/.test(file)), false);
    for (const file of files.filter(file => /\.js$/.test(file))) {
      const content = await readFile(`${process.env.QA_DIST}/assets/${file}`, "utf8");
      assert.doesNotMatch(content, /concept-storyboard\.v1|From evidence|research_topic_not_recommendation|Future experience lab/);
    }
    return {fixtureChunks: 0, entryPoints: 0};
  });
} else {
  await check("four substantive layouts across desktop/mobile and light/dark; screenshots and axe", async () => {
    for (const width of [1440, 768, 390]) for (const theme of ["light", "dark"]) {
      const ctx = await context({viewport: {width, height: width === 1440 ? 1000 : 844}, colorScheme: theme});
      const page = await ctx.newPage(); await ready(page);
      for (let i = 0; i < goals.length; i++) {
        await goal(page, goals[i]);
        const panel = page.getByRole("tabpanel");
        assert.equal(await panel.locator("h2").count(), 1);
        assert.equal(await page.getByRole("tab", {selected: true}).count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await page.locator(".fc-banner").isVisible(), true);
        assert.equal(await panel.locator([".fc-finding", ".fc-study", ".fc-map", ".fc-strategy"][i]).count(), [3, 3, 1, 3][i]);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({path: `${output}/goal-${i + 1}-${width}-${theme}.png`, fullPage: true});
        await page.addScriptTag({path: require.resolve("axe-core/axe.min.js")});
        const result = await page.evaluate(() => window.axe.run(document.querySelector(".future-concept"), {runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"]}}));
        accessibility.push({width, theme, goal: goals[i], violations: result.violations, incomplete: result.incomplete});
        assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map(v => ({id: v.id, nodes: v.nodes.map(n => n.target)}))));
      }
      await ctx.close();
    }
    return {screenshots: 24, axeEvaluations: 24};
  });
  await check("visitor-controlled preview visibility is reversible within the app without exporting state", async () => {
    const ctx = await context({acceptDownloads: true}); const page = await ctx.newPage();
    await ready(page, "/brief");
    const toggle = page.getByRole("checkbox", {name: "Show future AI concept", exact: true});
    assert.equal(await toggle.isChecked(), true);
    await toggle.uncheck();
    assert.equal(await page.locator('a[href="/concept/future-ai"]').count(), 0);
    await toggle.check();
    await page.getByRole("link", {name: "Explore future AI concept" }).click();
    await page.getByRole("button", {name: "Hide future AI concept", exact: true}).click();
    await page.waitForURL("**/brief");
    assert.equal(await toggle.isChecked(), false);
    await toggle.check();
    assert.equal(await page.locator('a[href="/concept/future-ai"]').count(), 1);
    return {defaultVisible: true, canHide: true, canRestore: true};
  });
  await check("keyboard goal navigation has one tab stop and meaningful accessible states", async () => {
    const page = await (await context()).newPage(); await ready(page);
    const first = page.getByRole("tab").first(); await first.focus(); await page.keyboard.press("ArrowRight");
    assert.equal(await page.getByRole("tab", {selected: true}).getAttribute("id"), "fc-tab-explore_interventions");
    assert.equal(await page.getByRole("tab", {selected: true}).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press("End"); assert.match(await page.getByRole("tab", {selected: true}).innerText(), /Compare strategies/);
    await page.keyboard.press("Home"); assert.match(await page.getByRole("tab", {selected: true}).innerText(), /Explain my Brief/);
    assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
    await page.keyboard.press("Tab"); assert.equal(await page.getByRole("tabpanel").evaluate(el => el === document.activeElement), true);
    const semantics = await page.getByRole("tabpanel").ariaSnapshot(); assert.match(semantics, /Current reviewed Brief/);
    await page.getByRole("button", {name: /Examine assumptions/}).click(); assert.match(await page.locator("#fc-role-explanation").innerText(), /deterministic planning/);
  });
  await check("research lenses, topic filter, provenance and investigation disclosures stay unverified", async () => {
    const page = await (await context()).newPage(); await ready(page); await goal(page, goals[1]);
    await page.getByRole("button", {name: /Review exact sources/}).click(); assert.match(await page.locator("#fc-pipeline-detail").innerText(), /No publication/);
    await page.getByLabel("Research topic", {exact: true}).selectOption("coordination"); assert.equal(await page.locator(".fc-study").count(), 1);
    await page.getByRole("button", {name: "Transferability", exact: true}).click(); assert.match(await page.locator(".fc-lens-content").innerText(), /Geography & health system/);
    await page.getByRole("button", {name: "Sources & limits"}).click(); assert.match(await page.locator(".fc-lens-content").innerText(), /None admitted/);
    await page.getByText("Questions for an independent reviewer", {exact: true}).click(); assert.match(await page.locator(".fc-study").innerText(), /digital access/);
    assert.match(await page.locator(".fc-study").innerText(), /Illustrative \/ not source-verified/);
    assert.match(await page.locator(".fc-study").innerText(), /Source: not reviewed|None admitted|not independently admitted|not admitted/i);
    assert.ok(await page.locator(".fc-study a[href^=\"https://doi.org/\"]").count() >= 2, "worked sample must have source DOIs");
    assert.equal(await page.locator(".fc-study a[href*=\"?\"]").count(), 0, "no prompt or query data in source links");
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.match(await page.locator(".fc-demo-insight").innerText(), /rehabilitation trial|source-grounded|not directly|coordination/i);
    assert.match(await page.locator(".fc-lens-content").innerText(), /post-hospital|hospital|England and Wales/i);
    await page.screenshot({path: `${output}/research-expanded.png`, fullPage: true});
  });
  await check("all map decisions change information needs; verification nodes update inspector", async () => {
    const page = await (await context()).newPage(); await ready(page); await goal(page, goals[2]);
    for (const [decision, text] of [["Assess implementation feasibility", "Staffed capacity"], ["Assess outreach feasibility", "Operational counts"], ["Understand recognition-to-referral timing", "Timestamped pathway"]]) {
      await page.getByRole("radio", {name: decision}).check(); assert.match(await page.locator(".fc-map-need").innerText(), new RegExp(text));
    }
    assert.match(await page.locator(".fc-demo-analysis").innerText(), /Operational definition to verify/);
    assert.match(await page.locator(".fc-demo-analysis").innerText(), /Example output if data become available/);
    await page.getByRole("button", {name: /Coverage & denominators/}).click(); assert.match(await page.locator("#fc-dependency-inspector").innerText(), /de-duplication/);
    await page.getByRole("button", {name: /Source & stewardship/}).click(); assert.match(await page.locator("#fc-dependency-inspector").innerText(), /privacy review/);
    await page.getByRole("link", {name: "Open real Data Requests"}).click(); assert.equal(new URL(page.url()).pathname, "/data-requests");
    assert.equal(await page.locator(".data-request-sheet").filter({hasText: "SESSION PLANNING REQUEST"}).count(), 0);
  });
  await check("comparison changes selected columns and criteria without scores or effectiveness claims", async () => {
    const page = await (await context()).newPage(); await ready(page); await goal(page, goals[3]);
    await page.getByRole("checkbox", {name: "Remote care coordination", exact: true}).uncheck();
    assert.equal(await page.locator(".fc-strategy").count(), 2); assert.equal(await page.locator("thead th").count(), 3);
    assert.equal(await page.getByRole("checkbox", {name: "Care navigation", exact: true}).isDisabled(), true);
    await page.getByLabel("Comparison lens").selectOption("evidence"); assert.equal(await page.locator("tbody tr").count(), 3);
    assert.match(await page.locator("tbody").innerText(), /No matched comparative estimate/); assert.match(await page.locator("tbody").innerText(), /Not evaluated for local Pilot/);
    assert.match(await page.locator(".fc-demo-analysis").innerText(), /Not a winner/);
    assert.equal(await page.locator(".fc-strategy .fc-demo-insight").count(), 2);
    await page.getByText("Inspect transferability questions", {exact: true}).first().click();
    assert.match(await page.locator(".fc-strategy").first().innerText(), /Geography & health system/);
    await page.getByLabel("Comparison lens").selectOption("implementation"); assert.equal(await page.locator("tbody tr").count(), 3);
    assert.equal(await page.getByRole("rowheader", {name: "Comparative effectiveness"}).count(), 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({path: `${output}/comparison-two-options.png`, fullPage: true});
  });
  await check("nonempty analyst state and canonical export are identical after every concept action", async () => {
    const page = await (await context({acceptDownloads: true})).newPage(); await ready(page, "/local-context");
    await page.getByRole("checkbox").filter({visible: true}).first().check();
    await nav(page, "Pilot planner"); await page.getByLabel("Test assumption").selectOption("capacity");
    await page.getByRole("button", {name: "Add to data requests", exact: true}).click();
    await nav(page, "Data requests"); const request = page.locator(".data-request-sheet").filter({hasText: "SESSION PLANNING REQUEST"});
    await request.getByRole("checkbox").check(); const requestBefore = await request.innerText();
    await nav(page, "Planning brief"); const before = await exportBrief(page, "before-exploration");
    assert.equal(before.local_context.length, 1); assert.equal(before.data_requests.length, 1);
    await page.getByRole("link", {name: "Explore future AI concept"}).click();
    assert.match(await page.locator(".fc-local").innerText(), new RegExp(before.local_context[0].label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await page.locator(".fc-finding summary").first().click(); assert.match(await page.locator(".fc-finding").first().innerText(), /Exact locator/);
    for (const name of goals) await goal(page, name);
    await page.getByRole("link", {name: "Return to assumption-based Pilot"}).click();
    await nav(page, "Data requests"); assert.equal(await request.innerText(), requestBefore);
    await nav(page, "Planning brief"); assert.deepEqual(await exportBrief(page, "after-exploration"), before);
    assert.equal(await page.locator(".brief-concept-entry").isVisible(), true);
    await page.emulateMedia({media: "print"}); assert.equal(await page.locator(".brief-concept-entry a").isVisible(), false);
    await page.pdf({path: `${output}/canonical-brief.pdf`, format: "Letter", printBackground: true});
    return {selectedLocal: 1, selectedRequests: 1, exactCanonicalEquality: true};
  });
  await check("stale selected request warning parity, canonical exclusion and analyst-only dispositions", async () => {
    const page = await (await context({acceptDownloads: true})).newPage(); await ready(page, "/pilot");
    await page.getByLabel("Test assumption").selectOption("capacity");
    await page.getByRole("button", {name: "Add to data requests", exact: true}).click();
    await nav(page, "Data requests");
    const request = page.locator(".data-request-sheet").filter({hasText: "SESSION PLANNING REQUEST"});
    assert.equal(await request.count(), 1);
    await request.getByRole("checkbox").check();
    await nav(page, "Planning brief");
    const current = await exportBrief(page, "current-selected-request"); assert.equal(current.data_requests.length, 1);
    await nav(page, "Pilot planner"); await page.locator("#pilot-capacity").fill("2000");
    await nav(page, "Data requests");
    await request.getByText("Stale for applied scenario", {exact: true}).waitFor();
    const requestBefore = await request.innerText();
    assert.equal(await request.getByRole("checkbox").isChecked(), true);
    await nav(page, "Planning brief");
    const before = await exportBrief(page, "stale-before-exploration");
    assert.equal(before.data_requests.length, 0);
    const staleWarnings = before.warnings.filter(warning => /selected data request is stale/.test(warning));
    assert.equal(staleWarnings.length, 1);
    const realWarnings = await page.locator("#brief-interpretation-boundaries li").allTextContents();
    assert.deepEqual(realWarnings, before.warnings);
    await page.getByRole("link", {name: "Explore future AI concept"}).click();
    await page.locator(".fc-boundaries summary").click();
    assert.deepEqual(await page.locator(".fc-boundaries li").allTextContents(), realWarnings);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({path: `${output}/stale-warning-concept.png`, fullPage: true});
    await goal(page, goals[1]); await page.getByRole("button", {name: "Sources & limits"}).click();
    await goal(page, goals[3]); await page.getByLabel("Comparison lens").selectOption("evidence");
    await goal(page, goals[2]); await page.getByRole("radio", {name: "Assess implementation feasibility"}).check();
    await page.getByRole("link", {name: "Open real Data Requests"}).click();
    assert.equal(await request.innerText(), requestBefore);
    assert.equal(await request.getByRole("checkbox").isChecked(), true);
    assert.equal(await request.getByRole("button", {name: "Refresh data request", exact: true}).count(), 1);
    await nav(page, "Planning brief");
    assert.deepEqual(await exportBrief(page, "stale-after-exploration"), before);
    // An explicit analyst deselection is the only operation that removes this warning.
    await nav(page, "Data requests"); await request.getByRole("checkbox").uncheck();
    const unselectedBefore = await request.innerText();
    await nav(page, "Planning brief");
    const deselected = await exportBrief(page, "stale-explicitly-deselected");
    assert.equal(deselected.warnings.some(warning => /selected data request is stale/.test(warning)), false);
    await page.getByRole("link", {name: "Explore future AI concept"}).click();
    assert.deepEqual(await page.locator(".fc-boundaries li").allTextContents(), deselected.warnings);
    await goal(page, goals[2]); await page.getByRole("link", {name: "Open real Data Requests"}).click();
    assert.equal(await request.innerText(), unselectedBefore);
    assert.equal(await request.getByRole("checkbox").isChecked(), false);
    return {staleWarnings, exactWarningParity: true, staleExcluded: true, requestBodyAndSelectionPreserved: true, explicitDeselectionRespected: true};
  });
  await check("320px reflow, reduced motion, progressive disclosure and concept print exclusion", async () => {
    const page = await (await context({viewport: {width: 320, height: 800}, colorScheme: "dark"})).newPage(); await ready(page);
    for (const name of goals) {
      await goal(page, name);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator(".fc-output-content").evaluate(el => getComputedStyle(el).animationName), "none");
    }
    await page.locator(".fc-activation summary").click(); assert.match(await page.locator(".fc-activation").innerText(), /accountable reviewer/);
    assert.equal(await page.locator(".fc-banner").evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, "Concept label must remain visible below the sticky product header");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({path: `${output}/comparison-320-dark.png`, fullPage: true});
    await page.emulateMedia({media: "print"}); assert.equal(await page.locator(".future-concept").isVisible(), false);
  });
}
await check("no external requests, runtime retrieval, provider traffic or page errors", async () => {
  assert.deepEqual(network, []); assert.deepEqual(pageErrors, []); return {externalOrRuntimeRequests: network.length, pageErrors: pageErrors.length};
});
await writeFile(`${output}/accessibility.json`, JSON.stringify(accessibility, null, 2));
await writeFile(`${output}/results.json`, JSON.stringify({build: disabled ? "off" : "on", browser: browser.version(), axe: axe.version, matrix, network, pageErrors}, null, 2));
await browser.close();
if (matrix.some(row => row.status === "FAIL")) process.exitCode = 1;
