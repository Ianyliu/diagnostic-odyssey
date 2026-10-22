/* global process, document, window, Event, requestAnimationFrame, console */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, writeFile} from "node:fs/promises";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4186";
const output = process.env.QA_OUTPUT ?? "/tmp/guided-workspace";
await mkdir(output, {recursive: true});
const browser = await chromium.launch(process.env.QA_CHROME ? {executablePath: process.env.QA_CHROME} : {channel: "chrome"});
const results = [], errors = [];
async function check(name, body) {
  try { results.push({name, status: "PASS", details: await body()}); }
  catch (error) { results.push({name, status: "FAIL", error: String(error.stack)}); }
  for (const context of browser.contexts()) await context.close();
  await writeFile(`${output}/results.json`, JSON.stringify({results, errors}, null, 2));
}
async function pageAt(path, width = 390, theme = "light") {
  const page = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme, reducedMotion: "reduce"});
  page.setDefaultTimeout(6000);
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto(base + path); await page.locator("main h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function overflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `overflow at ${page.url()}`);
}
await check("reviewed OpenGraph preview is a served, valid 1200x630 PNG", async () => {
  const page = await pageAt("/");
  const imageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
  assert.equal(imageUrl, "https://diagnostic-odyssey-psi.vercel.app/og-image.png");
  const ogAlt = await page.locator('meta[property="og:image:alt"]').getAttribute("content");
  const twitterAlt = await page.locator('meta[name="twitter:image:alt"]').getAttribute("content");
  assert.equal(ogAlt, twitterAlt);
  assert.match(ogAlt, /reviewed national burden.*local implementation.*transparent pilot plans/i);
  assert.doesNotMatch(ogAlt, /confidence intervals?|\\bCI\\b/i);
  const response = await page.request.get(base + "/og-image.png");
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"] ?? "", /image\/png/);
  const bytes = await response.body();
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), 1200);
  assert.equal(bytes.readUInt32BE(20), 630);
  await writeFile(`${output}/reviewed-og-image.png`, bytes);
  return {width: 1200, height: 630, bytes: bytes.length};
});
await check("Burden charts expose numeric confidence bounds and distinguish descriptive IQR",async()=>{
 const page=await pageAt("/burden",390);
 const tracks=page.locator('.burden-domain-stack .metric-visual-track[role="img"]');
 const labels=await tracks.evaluateAll(nodes=>nodes.map(n=>n.getAttribute("aria-label")??""));
 assert.ok(labels.some(label=>/95% CI.*to/.test(label)), "numeric sampling CI is accessible");
 assert.ok(labels.some(label=>/Interquartile range.*not a confidence interval/i.test(label)), "IQR is distinguished from sampling CI");
 const normal=page.locator('.burden-domain-stack .metric-visual-interval').first();
 assert.ok(await normal.count()>0);
 const style=await normal.getAttribute("style");
 assert.match(style,/left: [0-9.]+%; width: [0-9.]+%/);
 await overflow(page);
 return {charts:labels.length,firstInterval:style};
});
for (const width of [320, 360, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"]) {
  await check(`default guided layouts ${width} ${theme}`, async () => {
    const page = await pageAt("/", width, theme);
    const layouts = [];
    for (const route of ["/", "/burden", "/local-context", "/pilot", "/data-requests", "/brief"]) {
      await page.goto(base + route); await page.locator("main h1").waitFor();
      await overflow(page);
      const navigation = page.getByRole("navigation", {name: "Primary navigation"});
      assert.equal(await navigation.getByRole("link").count(), 4);
      assert.equal(await navigation.getByRole("link", {name: "Reviewed evidence", exact: true}).getAttribute("href"), "/burden");
      const rect = await navigation.boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1);
      const targets = await navigation.locator("a").evaluateAll(links => links.map(link => ({w: link.getBoundingClientRect().width, h: link.getBoundingClientRect().height})));
      assert.ok(targets.every(target => target.w >= 44 && target.h >= 44));
      if (width < 1024) assert.ok(rect.y + rect.height <= 901);
      if (route === "/pilot") {
        assert.equal(await page.locator(".pilot-headlines > div").count(), 4);
        assert.equal(await page.locator("#pilot-input-group-1").evaluate(e => e.open), false);
        assert.match(await page.locator("#pilot-input-group-1 > summary").innerText(), /Program capacity: 3,000/);
        assert.ok(await page.getByRole("link", {name: "Explore sensitivity →", exact: true}).isVisible());
        assert.equal(await page.locator(".decision-visual").count(), 3);
        assert.ok((await page.locator(".pilot-summary").boundingBox()).y < (await page.locator(".pilot-input-column").boundingBox()).y || width > 1100);
      }
      if (route === "/brief") {
        assert.equal(await page.locator("#brief-full-report").evaluate(e => e.open), false);
        assert.ok(await page.getByRole("button", {name: "Analyze with AI", exact: true}).isVisible());
        assert.ok(await page.getByRole("link", {name: "Open AI workspace →", exact: true}).isVisible());
        assert.equal(await page.locator(".insight-finding").count(), 3);
      }
      layouts.push({route, navigation: rect, height: await page.evaluate(() => document.documentElement.scrollHeight)});
    }
    return layouts;
  });
}
await check("bulk local selections default to all, respect individual overrides and remain separate from Pilot", async () => {
  const page = await pageAt("/local-context");
  const inputs = page.locator('input[id^="select-local-context-"]');
  assert.equal(await inputs.count(), 34);
  assert.equal(await inputs.evaluateAll(elements => elements.filter(input => input.checked).length), 34);
  assert.match(await page.locator("#local-selection-summary").innerText(), /34 indicators selected/);
  assert.match(await page.locator("#local-selection-summary").innerText(), /start selected by default/);
  await page.getByRole("button", {name: "Select none", exact: true}).first().click();
  assert.equal(await inputs.evaluateAll(elements => elements.filter(input => input.checked).length), 0);
  const category = page.locator("#local-primary-care-category");
  await category.getByRole("button", {name: "Select all", exact: true}).click();
  const selectedInCategory = await category.locator('input[type="checkbox"]:checked').count();
  assert.ok(selectedInCategory >= 2, "category bulk action selects eligible records");
  await category.getByRole("button", {name: "Select none", exact: true}).click();
  assert.equal(await category.locator('input[type="checkbox"]:checked').count(), 0);
  await page.getByRole("button", {name: "Select all", exact: true}).first().click();
  assert.equal(await inputs.evaluateAll(elements => elements.filter(input => input.checked).length), 34);
  assert.match(await page.getByRole("status").first().innerText(), /No Pilot context selected/);
});
await check("multiple data requests default selected and support reversible bulk choices", async () => {
  const page = await pageAt("/pilot");
  const sensitivity = page.locator("#sensitivity");
  await page.getByLabel("Test assumption").selectOption("capacity");
  await sensitivity.getByRole("button", {name: "Add to data requests", exact: true}).click();
  await page.getByLabel("Test assumption").selectOption("reach");
  await sensitivity.getByRole("button", {name: "Add to data requests", exact: true}).click();
  await sensitivity.getByRole("link", {name: "Review data request", exact: true}).click();
  const checks = page.locator(".data-request-sheet input[type='checkbox']");
  assert.equal(await checks.count(), 2);
  assert.equal(await checks.evaluateAll(elements => elements.filter(input => input.checked).length), 2);
  await page.getByRole("button", {name: "Select none", exact: true}).click();
  assert.equal(await checks.evaluateAll(elements => elements.filter(input => input.checked).length), 0);
  await page.getByRole("button", {name: "Select all", exact: true}).click();
  assert.equal(await checks.evaluateAll(elements => elements.filter(input => input.checked).length), 2);
  await checks.first().uncheck();
  assert.equal(await checks.evaluateAll(elements => elements.filter(input => input.checked).length), 1);
});
await check("visible selections, collapsed category state and unchanged Pilot inputs", async () => {
  const page = await pageAt("/local-context");
  const category = page.locator("#local-primary-care-category");
  const row = category.locator(".ledger-indicator-row").first();
  assert.equal(await row.getByRole("checkbox").isChecked(), true, "reviewed indicator starts checked");
  await page.getByRole("button", {name: "Select none", exact: true}).first().click();
  await row.getByRole("checkbox").check();
  await row.getByRole("button", {name: /Use .* in Pilot planning/}).click();
  await category.locator(":scope > summary").click();
  assert.match(await category.locator(":scope > summary").innerText(), /1 selected for Brief.*Pilot:/);
  await page.getByRole("navigation", {name: "Primary navigation"}).getByRole("link", {name: "Pilot planner", exact: true}).click();
  await page.locator("#pilot-input-group-1 > summary").click();
  assert.equal(await page.locator("#pilot-capacity").inputValue(), "3000");
  assert.match(await page.locator("#pilot-context").innerText(), /does not alter reach, capacity, timing, cost/);
  await page.locator("#pilot-capacity").fill("2345");
  await page.locator("#pilot-capacity").fill("2e");
  assert.match(await page.locator(".pilot-summary").innerText(), /Draft not applied/);
  assert.ok(await page.getByRole("button", {name: "Review planning brief", exact: true}).isDisabled());
  await page.locator("#pilot-input-group-1 > summary").click();
  assert.ok(await page.locator("#pilot-capacity").isVisible(), "errors remain revealed");
  await page.locator("#pilot-capacity").fill("2000");
  await page.getByRole("link", {name: "Explore sensitivity →", exact: true}).click();
  assert.equal(await page.locator(":focus").getAttribute("id"), "sensitivity-title");
  await page.locator("#sensitivity").getByRole("button", {name: "Add to data requests", exact: true}).click();
  await page.getByRole("link", {name: "Review unresolved data needs", exact: true}).click();
  assert.ok(await page.getByRole("checkbox", {name: /Include in Planning Brief/}).isVisible());
});
await check("collapsed report links, print completeness, exact restoration and AI dialog", async () => {
  const page = await pageAt("/brief");
  // Compact 7–8-page contract uses an explicit none-selected Local Context state.
  // The all-reviewed default is checked in a separate native PDF below.
  await page.getByRole("navigation", {name: "Primary navigation"}).getByRole("link", {name: "Local context", exact: true}).click();
  await page.getByRole("button", {name: "Select none", exact: true}).first().click();
  await page.getByRole("navigation", {name: "Primary navigation"}).getByRole("link", {name: "Planning brief", exact: true}).click();
  await page.locator(".insight-finding summary").first().click();
  const before = await page.locator("main details").evaluateAll(elements => elements.map(e => e.open));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => { window.print = () => window.dispatchEvent(new Event("beforeprint")); });
  await page.getByRole("button", {name: "Print / save PDF", exact: true}).evaluate(button => button.click());
  await page.emulateMedia({media: "print"});
  assert.equal(await page.locator(".brief-print-footer").isVisible(), false, "Footer is rendered in the real PDF page margin, not a fixed-position overlay");
  await page.pdf({path: `${output}/collapsed-report.pdf`, format: "A4", printBackground: true});
  await page.emulateMedia({media: "screen"});
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  assert.deepEqual(await page.locator("main details").evaluateAll(elements => elements.map(e => e.open)), before);
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);
  assert.equal(await page.locator(".insights-print-summary").count(), 0, "Insights remains print opt-in");
  await page.getByRole("button", {name: "Analyze with AI", exact: true}).click();
  assert.ok(await page.getByRole("dialog").isVisible());
  await page.getByRole("navigation", {name: "Primary navigation"}).waitFor({state: "hidden"});
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(":focus").innerText(), "Analyze with AI");
  await page.goto(base + "/brief#brief-national-burden");
  await page.waitForFunction(() => document.activeElement?.textContent === "Reviewed national burden findings");
  assert.equal(await page.locator("#brief-full-report").evaluate(e => e.open), true);
  await page.goto(base + "/pilot#pilot-trace");
  await page.waitForFunction(() => document.activeElement?.textContent === "Decision trace");
  assert.equal(await page.locator("#pilot-decision-details").evaluate(e => e.open), true);
});
await check("all-reviewed default prints a concise PDF with 34 canonical selections", async () => {
  const page = await pageAt("/local-context");
  const inputs = page.locator('input[id^="select-local-context-"]');
  assert.equal(await inputs.count(), 34);
  assert.equal(await inputs.evaluateAll(elements => elements.filter(input => input.checked).length), 34);
  await page.getByRole("navigation", {name: "Primary navigation"}).getByRole("link", {name: "Planning brief", exact: true}).click();
  const before = await page.locator("main details").evaluateAll(elements => elements.map(e => e.open));
  await page.evaluate(() => { window.print = () => window.dispatchEvent(new Event("beforeprint")); });
  await page.getByRole("button", {name: "Print / save PDF", exact: true}).evaluate(button => button.click());
  await page.emulateMedia({media: "print"});
  assert.equal(await page.locator(".brief-print-footer").isVisible(), false, "Footer is rendered in the real PDF page margin, not a fixed-position overlay");
  await page.pdf({path: `${output}/all-context-report.pdf`, format: "A4", printBackground: true});
  await page.emulateMedia({media: "screen"});
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  assert.deepEqual(await page.locator("main details").evaluateAll(elements => elements.map(e => e.open)), before);
  assert.equal(await page.locator(".insights-print-summary").count(), 0);
});
for (const width of [390, 1440]) await check(`cross-route history reveals fragments and preserves ordinary scroll ${width}`, async () => {
  const page = await pageAt("/brief", width);
  const navigate = async name => {
    await page.getByRole("navigation", {name: "Primary navigation"}).getByRole("link", {name, exact: true}).click();
    await page.locator("main h1").waitFor();
  };
  const settleScroll = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const expectBurdenFocus = () => page.waitForFunction(() => document.activeElement?.textContent === "Reviewed national burden findings", null, {timeout: 6000});
  await page.getByRole("link", {name: "Inspect all 21 findings →", exact: true}).click();
  await expectBurdenFocus();
  await settleScroll();
  const fragmentScroll = await page.evaluate(() => window.scrollY);
  await navigate("Pilot planner");
  await navigate("Planning brief");
  await page.locator("#brief-full-report > summary").click();
  assert.equal(await page.locator("#brief-full-report").evaluate(e => e.open), false);
  await navigate("Pilot planner");
  await page.goBack();
  await page.waitForURL(base + "/brief");
  await page.goBack();
  await page.waitForURL(base + "/pilot");
  await page.goBack();
  await page.waitForURL(base + "/brief#brief-national-burden");
  await expectBurdenFocus();
  assert.equal(await page.locator("#brief-full-report").evaluate(e => e.open), true);
  assert.ok(await page.locator("#brief-national-burden h2").isVisible());
  await page.waitForFunction(y => Math.abs(window.scrollY - y) <= 1, fragmentScroll);

  // Forward to an ordinary entry, then verify its saved position on return.
  await page.goForward();
  await page.waitForURL(base + "/pilot");
  await settleScroll();
  await page.evaluate(() => window.scrollTo(0, 300));
  await settleScroll();
  const ordinaryScroll = await page.evaluate(() => window.scrollY);
  await page.goForward();
  await page.waitForURL(base + "/brief");
  await page.goBack();
  await page.waitForURL(base + "/pilot");
  await page.waitForFunction(y => Math.abs(window.scrollY - y) <= 1, ordinaryScroll);

  // A real cross-route link must also regain fragment focus on Forward.
  await page.goto(base + "/");
  await page.getByRole("link", {name: "See planning insights", exact: true}).click();
  await page.waitForFunction(() => document.activeElement?.id === "planning-insights-title");
  await settleScroll();
  const insightsScroll = await page.evaluate(() => window.scrollY);
  await page.goBack();
  await page.waitForURL(base + "/");
  await page.goForward();
  await page.waitForURL(base + "/brief#planning-insights");
  await page.waitForFunction(() => document.activeElement?.id === "planning-insights-title");
  await page.waitForFunction(y => Math.abs(window.scrollY - y) <= 1, insightsScroll);
});
await check("text enlargement and keyboard-height simulation keep controls reachable", async () => {
  const page = await pageAt("/pilot", 390);
  await page.addStyleTag({content: "html {font-size: 200% !important;}"});
  await overflow(page);
  await page.locator("#pilot-input-group-1 > summary").click();
  await page.locator("#pilot-capacity").focus();
  await page.setViewportSize({width: 390, height: 480});
  await page.locator("#pilot-capacity").scrollIntoViewIfNeeded();
  const box = await page.locator("#pilot-capacity").boundingBox();
  const nav = await page.getByRole("navigation", {name: "Primary navigation"}).boundingBox();
  assert.ok(box.y >= 0 && box.y + box.height <= nav.y, "focused input clears bottom navigation");
  await overflow(page);
});
await check("200% text enlargement across all widths and themes", async () => {
  for (const width of [320, 360, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"]) {
    const page = await pageAt("/pilot", width, theme);
    await page.addStyleTag({content: "html {font-size: 200% !important;}"});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await overflow(page);
    await page.close();
  }
});
await check("extreme headline values retain every digit at 320px", async () => {
  for (const theme of ["light", "dark"]) {
    const page = await pageAt("/pilot", 320, theme);
    for (const id of [1, 2]) await page.locator(`#pilot-input-group-${id} > summary`).click();
    for (const [field, value] of Object.entries({fixed_cost: "0", per_participant_cost: "0", baseline_window_months: "0", alternative_window_months: "0", horizon_months: "0", reach: "100", capacity: String(Number.MAX_VALUE), eligible_population: String(Number.MAX_VALUE)})) {
      await page.locator(`#pilot-${field}`).fill(value);
    }
    const headline = page.locator(".pilot-headlines .scientific-value");
    await headline.scrollIntoViewIfNeeded();
    await overflow(page);
    assert.equal(await headline.innerText(), Number.MAX_VALUE.toExponential());
    assert.ok(await headline.evaluate(el => {const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1;}));
  }
});
await browser.close();
console.log(JSON.stringify({results, errors}));
if (errors.length || results.some(row => row.status !== "PASS")) process.exitCode = 1;
