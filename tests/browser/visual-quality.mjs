import {prepareWorkspace} from "./workspace-helpers.mjs";
/* global process, document, innerWidth, console, getComputedStyle, navigator, location, URL */
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
async function assertNoPageOverflow(page, label) {
  const diagnostic = await page.evaluate(() => {
    const selector = element => element.tagName.toLowerCase() + (element.id ? `#${element.id}` : "") +
      [...element.classList].map(name => `.${name}`).join("");
    const describe = element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return {selector: selector(element), left: rect.left, right: rect.right, width: rect.width,
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
        display: style.display, gridTemplateColumns: style.gridTemplateColumns,
        minWidth: style.minWidth, overflowX: style.overflowX, overflowWrap: style.overflowWrap,
        whiteSpace: style.whiteSpace, fontFamily: style.fontFamily, fontSize: style.fontSize};
    };
    const offenders = [...document.querySelectorAll("body *")].flatMap(element => {
      const box = describe(element);
      if (!box.width || (box.right <= innerWidth && box.left >= 0)) return [];
      // A wide table inside its own scroll region is intentional; distinguish
      // that from content which actually escapes into the document viewport.
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const bounds = parent.getBoundingClientRect();
        if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(parent).overflowX) &&
            bounds.left >= 0 && bounds.right <= innerWidth) return [];
      }
      return [{...box, text: element.textContent.trim().slice(0, 160),
        parent: element.parentElement ? describe(element.parentElement) : null}];
    });
    return {route: location.pathname, viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth,
      userAgent: navigator.userAgent, bodyFont: getComputedStyle(document.body).fontFamily, offenders};
  });
  if (diagnostic.documentWidth > diagnostic.viewportWidth) {
    await writeFile(`${output}/${label}-overflow.json`, JSON.stringify(diagnostic, null, 2));
    await page.screenshot({path: `${output}/${label}-overflow.png`, fullPage: true});
  }
  assert.equal(diagnostic.documentWidth > diagnostic.viewportWidth, false,
    `${diagnostic.route} ${label}: document ${diagnostic.documentWidth}px exceeds viewport ${diagnostic.viewportWidth}px; ` +
    `offenders: ${JSON.stringify(diagnostic.offenders)}; artifacts: ${label}-overflow.{json,png}`);
}
for (const width of [320, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"]) for (const motion of ["reduce", "no-preference"]) {
  const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: motion, colorScheme: theme});
  const label = `${width}-${theme}-${motion}`;
  try {
    await page.goto(base + "/pilot");
    await page.locator(".visual-headline").first().waitFor();
    await prepareWorkspace(page);
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
    await assertNoPageOverflow(page, `pilot-${label}`);
    await page.screenshot({path: `${output}/pilot-${label}.png`, fullPage: true});
    await page.locator("#pilot-fixed_cost").fill(String(Number.MAX_VALUE));
    await page.locator(".pilot-result-ledger").screenshot({path: `${output}/pilot-max-${label}.png`});
    await assertNoPageOverflow(page, `pilot-max-${label}`);
    const maxGeometry = await page.locator(".pilot-result-scientific dd").evaluateAll(elements => elements.map(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      const row = element.parentElement.getBoundingClientRect();
      const fragments = [...range.getClientRects()];
      return {text: element.textContent, rowWidth: row.width, fontSize: getComputedStyle(element).fontSize,
        lines: new Set(fragments.map(r => Math.round(r.top))).size,
        contained: fragments.every(r => r.left >= row.left - 1 && r.right <= row.right + 1)};
    }));
    assert.ok(maxGeometry.some(item => item.text === `$${Number.MAX_VALUE}`), `Missing full finite token: ${label}`);
    assert.ok(maxGeometry.every(item => item.lines === 1 && item.contained), `/pilot max ${label}: ${JSON.stringify(maxGeometry)}`);
    for (const route of ["/", "/burden", "/brief"]) {
      await page.goto(base + route);
      await page.waitForLoadState("networkidle");
      const routeLabel = `${route === "/" ? "overview" : route === "/burden" ? "burden" : "brief"}-${label}`;
      await assertNoPageOverflow(page, routeLabel);
      await page.screenshot({path: `${output}/${routeLabel}.png`, fullPage: true});
      if (route === "/burden") {
        const details = page.locator(".burden-domain-stack > details");
        assert.deepEqual(await details.evaluateAll(items => items.map(item => item.open)), [false, true, false],
          "Only administrative burden is expanded on a fresh visit");
        assert.equal(await page.locator('a[href="/burden/admin"]').count(), 1);
        assert.equal(await page.locator('a[href="/burden/human"]').count(), 1);
        if (width === 390 && motion === "reduce") {
          // The in-page ledger index is intentionally hidden on 390px mobile;
          // verify direct hash navigation opens and focuses the collapsed destination.
          await page.goto(base + "/burden#burden-mental-human");
          await page.waitForFunction(() => document.querySelector("#burden-group-mental-human")?.open === true);
          assert.equal(await details.nth(2).evaluate(item => item.open), true,
            "Mental-health anchor must disclose its destination");
          await page.keyboard.press("Tab");
          assert.equal(await page.locator("body").evaluate(node => node.scrollWidth <= innerWidth + 1),true);
        }
      }
    }
    if (width < 768) {
      const menu = page.getByRole("button", {name: "Menu", exact: true});
      await menu.focus(); await page.keyboard.press("Enter");
      await page.getByRole("navigation", {name: "Primary navigation"}).waitFor();
      await assertNoPageOverflow(page, `navigation-${label}`);
      await page.screenshot({path: `${output}/navigation-${label}.png`});
      await page.keyboard.press("Escape");
      assert.equal(await menu.evaluate(e => document.activeElement === e), true);
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
    }
    results.push({width, theme, motion, status: "PASS", geometry, maxGeometry});
  } catch (error) { results.push({width, theme, motion, route: new URL(page.url()).pathname, status: "FAIL", error: String(error)}); }
  finally { await page.close(); }
}
await browser.close();
await writeFile(`${output}/results.json`, JSON.stringify({revision: process.env.QA_SHA, browser: browser.version(), results}, null, 2));
console.log(JSON.stringify(results));
if (results.some(row => row.status !== "PASS")) process.exitCode = 1;
