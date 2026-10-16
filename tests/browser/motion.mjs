/* global process, console, document, window, PerformanceObserver */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, writeFile} from "node:fs/promises";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4175";
const output = process.env.QA_OUTPUT ?? "/tmp/motion-quality";
await mkdir(output, {recursive: true});
const browser = await chromium.launch(process.env.QA_CHROME ? {executablePath: process.env.QA_CHROME} : {channel: "chrome"});
const results = [];
for (const mode of ["normal", "keyboard", "reduced", "deep-link"]) {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: mode === "reduced" ? "reduce" : "no-preference"});
  try {
    let openingLayoutShift = 0;
    await page.addInitScript(() => {
      window.auditShifts = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.auditShifts.push(entry.value);
      }).observe({type: "layout-shift", buffered: true});
    });
    await page.goto(base + (mode === "deep-link" ? "/?review=1" : "/"));
    await page.locator(".overview-proof").waitFor();
    if (mode === "normal" || mode === "keyboard") {
      assert.equal(await page.locator(".overview-page.is-opening").count(), 1);
      const animated = await page.evaluate(() => document.getAnimations().map(animation => ({
        name: animation.animationName, frames: animation.effect.getKeyframes()
      })));
      assert.ok(animated.some(animation => animation.name === "workspace-reveal"));
      assert.ok(animated.some(animation => animation.name === "workspace-unfold"));
      await page.screenshot({path: `${output}/${mode}-opening.png`, animations: "allow"});
      if (mode === "keyboard") {
        await page.keyboard.press("Tab");
        assert.equal(await page.locator(".overview-page.is-opening").count(), 0);
        assert.equal(await page.locator(".skip-link").evaluate(e => e === document.activeElement), true);
      } else {
        await page.locator(".overview-page.is-opening").waitFor({state: "detached"});
      }
      openingLayoutShift = await page.evaluate(() => window.auditShifts.reduce((sum, value) => sum + value, 0));
      assert.ok(openingLayoutShift < .01, `opening moved the layout: ${openingLayoutShift}`);
      await page.reload();
      await page.locator(".overview-proof").waitFor();
      assert.equal(await page.locator(".overview-page.is-opening").count(), 0, "opening runs once per session");
    } else {
      assert.equal(await page.locator(".overview-page.is-opening").count(), 0);
      assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.animationName?.startsWith("workspace-")).length), 0);
    }
    const layoutShift = await page.evaluate(() => window.auditShifts.reduce((sum, value) => sum + value, 0));
    assert.ok(layoutShift < .01, `unexpected layout movement: ${layoutShift}`);
    results.push({mode, status: "PASS", openingLayoutShift, layoutShift});
  } catch (error) { results.push({mode, status: "FAIL", error: String(error.stack)}); }
  finally { await page.close(); }
}
await browser.close();
await writeFile(`${output}/results.json`, JSON.stringify({results}, null, 2));
console.log(JSON.stringify(results));
if (results.some(row => row.status !== "PASS")) process.exitCode = 1;
