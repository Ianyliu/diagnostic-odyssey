/* global process, document */
import {createRequire} from "node:module";
import {mkdir, writeFile} from "node:fs/promises";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const [base, output] = process.argv.slice(2);
if (!base || !output) throw new Error("Pass a preview URL and screenshot output directory.");
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: "chrome"});
const inventory = [];
for (const width of [390, 1440]) for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme, reducedMotion: "reduce"});
  async function capture(slug, route) {
    await page.evaluate(() => document.fonts.ready);
    const file = `${slug}-${width}-${theme}.png`;
    const viewport = `${slug}-${width}-${theme}-viewport.png`;
    await page.screenshot({path: `${output}/${file}`, fullPage: true});
    await page.screenshot({path: `${output}/${viewport}`});
    inventory.push({file, viewport, route, width, theme, height: await page.evaluate(() => document.documentElement.scrollHeight)});
  }
  for (const [slug, route] of [["overview", "/"], ["evidence", "/burden"], ["context", "/local-context"], ["pilot", "/pilot"], ["requests", "/data-requests"], ["brief", "/brief"]]) {
    await page.goto(base + route);
    await page.locator("h1").waitFor();
    await page.waitForLoadState("networkidle");
    await capture(slug, route);
  }
  await page.goto(base + "/pilot");
  await page.locator("#sensitivity").getByRole("button", {name: "Add to data requests", exact: true}).click();
  // This capture script supports the baseline and revised navigation structures.
  await page.locator('a[href="/data-requests"]').first().evaluate(link => link.click());
  await page.locator(".data-request-sheet").getByRole("checkbox").check();
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await capture("requests-selected", "/data-requests");
  await page.close();
}
await browser.close();
await writeFile(`${output}/inventory.json`, JSON.stringify(inventory, null, 2) + "\n");
