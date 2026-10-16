/* global process, document, innerWidth, console */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, writeFile} from "node:fs/promises";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4175";
const output = process.env.QA_OUTPUT ?? "/tmp/visual-quality";
await mkdir(output, {recursive: true});
const browser = await chromium.launch(process.env.QA_CHROME ? {executablePath: process.env.QA_CHROME} : {channel: "chrome"});
const results = [];
for (const width of [320, 390, 768, 1440]) for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: "reduce", colorScheme: theme});
  try {
    await page.goto(base + "/pilot");
    await page.locator(".visual-headline").first().waitFor();
    const geometry = await page.locator(".visual-headline").evaluateAll(elements => elements.map(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      const rect = element.getBoundingClientRect();
      const fragments = [...range.getClientRects()];
      return {text: element.textContent, lines: new Set(fragments.map(r => Math.round(r.top))).size,
        contained: fragments.every(r => r.left >= rect.left - 1 && r.right <= rect.right + 1 && r.right <= innerWidth)};
    }));
    assert.ok(geometry.every(item => item.lines === 1 && item.contained), JSON.stringify(geometry));
    assert.ok(geometry.some(item => item.text === "$1,200,000"));
    assert.ok(geometry.some(item => item.text === "6 mo"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({path: `${output}/pilot-${width}-${theme}.png`, fullPage: true});
    for (const route of ["/", "/brief"]) {
      await page.goto(base + route);
      await page.waitForLoadState("networkidle");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, route);
      await page.screenshot({path: `${output}/${route === "/" ? "overview" : "brief"}-${width}-${theme}.png`, fullPage: true});
    }
    if (width < 768) {
      const menu = page.getByRole("button", {name: "Menu", exact: true});
      await menu.focus(); await page.keyboard.press("Enter");
      await page.getByRole("navigation", {name: "Primary navigation"}).waitFor();
      await page.screenshot({path: `${output}/navigation-${width}-${theme}.png`});
      await page.keyboard.press("Escape");
      assert.equal(await menu.evaluate(e => document.activeElement === e), true);
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
    }
    results.push({width, theme, status: "PASS", geometry});
  } catch (error) { results.push({width, theme, status: "FAIL", error: String(error)}); }
  finally { await page.close(); }
}
await browser.close();
await writeFile(`${output}/results.json`, JSON.stringify({results}, null, 2));
console.log(JSON.stringify(results));
if (results.some(row => row.status !== "PASS")) process.exitCode = 1;
