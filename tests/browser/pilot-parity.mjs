/**
 * Rendered-parity capture/compare for the Strategy Lab (/pilot).
 *
 *   capture:  QA_BASE_URL=... QA_OUTPUT=dir PLAYWRIGHT_RUNNER=... node tests/browser/pilot-parity.mjs capture
 *   compare:  node tests/browser/pilot-parity.mjs compare <dirA> <dirB> [<second capture of A for noise>]
 *
 * For each viewport/theme/state it records the exact <main> HTML, the accessibility
 * snapshot, a focus-order trace and a screenshot digest, with reduced motion and
 * disabled animations so output is deterministic. Compare exits nonzero on any
 * difference; it is intended to prove that a structural refactor of the page did
 * not change rendered DOM, class names, ARIA, focus order or pixels.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import console from "node:console";

const sha = value => createHash("sha256").update(value).digest("hex");
const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 }
];
const THEMES = ["light", "dark"];

async function capture() {
  const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
  const { chromium } = require("playwright");
  const base = process.env.QA_BASE_URL;
  const out = process.env.QA_OUTPUT;
  if (!base || !out) throw new Error("QA_BASE_URL and QA_OUTPUT are required");
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(process.env.QA_CHROME ? { executablePath: process.env.QA_CHROME } : { channel: "chrome" });
  const summary = {};
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: theme, reducedMotion: "reduce" });
      const page = await context.newPage();
      const label = `${viewport.name}-${theme}`;
      const record = async (state) => {
        await page.waitForTimeout(150);
        const html = await page.locator("main").first().evaluate(element => element.outerHTML);
        // The footer's build-provenance link names the commit being built, so it differs by design
        // between two revisions. Strip exactly that stamp (and its URL line) from the ARIA tree.
        const aria = (await page.locator("body").ariaSnapshot())
          .split("\n")
          .filter((line, index, lines) => !/link "Source [0-9a-f]{10} · committed \d{4}-\d\d-\d\d":/.test(line)
            && !(/\/url: https:\/\/github\.com\/[^/]+\/[^/]+\/commit\/[0-9a-f]{40}/.test(line) && /link "Source /.test(lines[index - 1] ?? "")))
          .join("\n");
        const png = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide", mask: [page.locator("footer.site-footer")], maskColor: "#000000" });
        const key = `${label}/${state}`;
        const dir = join(out, label);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${state}.html`), html);
        writeFileSync(join(dir, `${state}.aria.txt`), aria);
        writeFileSync(join(dir, `${state}.png`), png);
        summary[key] = { htmlSha256: sha(html), htmlBytes: html.length, ariaSha256: sha(aria), screenshotSha256: sha(png) };
      };
      await page.goto(`${base}/pilot`, { waitUntil: "networkidle" });
      await page.locator("main h1").first().waitFor();
      await record("initial");

      // Focus order: first 25 tab stops.
      const focus = [];
      await page.evaluate(() => document.activeElement?.blur());
      for (let index = 0; index < 25; index += 1) {
        await page.keyboard.press("Tab");
        focus.push(await page.evaluate(() => {
          const element = document.activeElement;
          if (!element || element === document.body) return null;
          return { tag: element.tagName, role: element.getAttribute("role"), id: element.id || null, className: String(element.className), name: element.getAttribute("aria-label") ?? (element.textContent ?? "").trim().slice(0, 60) };
        }));
      }
      summary[`${label}/focus-order`] = { sha256: sha(JSON.stringify(focus)), length: focus.length };
      writeFileSync(join(out, label, "focus-order.json"), JSON.stringify(focus, null, 1));

      // Every disclosure/tab control, toggled in DOM order, one at a time.
      const toggles = await page.locator("main [aria-expanded], main [role=tab]").count();
      for (let index = 0; index < toggles; index += 1) {
        const control = page.locator("main [aria-expanded], main [role=tab]").nth(index);
        if (!await control.isVisible()) continue;
        await control.click().catch(() => {});
        await record(`toggle-${String(index).padStart(2, "0")}`);
      }

      // Numeric inputs: valid, over-capacity, out-of-range, and non-numeric drafts.
      const inputs = page.locator("main input[type=text], main input[type=number], main input:not([type])");
      const inputCount = await inputs.count();
      for (const [name, value] of [["over-capacity", "1"], ["out-of-range", "101"], ["non-numeric", "abc"], ["large", "1e300"]]) {
        for (let index = 0; index < inputCount; index += 1) {
          const input = inputs.nth(index);
          if (!await input.isVisible()) continue;
          await input.fill(value);
          await input.blur();
        }
        await record(`inputs-${name}`);
      }
      await context.close();
    }
  }
  await browser.close();
  writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 1));
  console.log(`captured ${Object.keys(summary).length} states into ${out}`);
}

function compare(dirA, dirB, noiseDir) {
  const load = dir => JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
  const a = load(dirA);
  const b = load(dirB);
  // Optional second capture of the SAME build as dirA: screenshots that differ between those two
  // runs are rasterization noise, so only their pixels are excluded. HTML, ARIA and focus order
  // are always compared exactly.
  const noise = noiseDir ? load(noiseDir) : null;
  const noisy = new Set(noise ? Object.keys(a).filter(key => a[key].screenshotSha256 !== noise[key]?.screenshotSha256) : []);
  const strip = (entry, key) => {
    if (!entry || !noisy.has(key)) return entry;
    const rest = { ...entry };
    delete rest.screenshotSha256;
    return rest;
  };
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const different = keys.filter(key => JSON.stringify(strip(a[key], key)) !== JSON.stringify(strip(b[key], key)));
  console.log(`${keys.length} states compared (exact HTML, ARIA, focus order; ${keys.length - noisy.size} screenshots compared pixel-exact, ${noisy.size} excluded as baseline rasterization noise); ${different.length} differ`);
  for (const key of different.slice(0, 30)) console.log(`  DIFF ${key}\n    A ${JSON.stringify(a[key])}\n    B ${JSON.stringify(b[key])}`);
  if (readdirSync(dirA).length === 0) throw new Error("empty baseline");
  process.exit(different.length ? 1 : 0);
}

const [mode, ...args] = process.argv.slice(2);
if (mode === "capture") await capture();
else if (mode === "compare" && (args.length === 2 || args.length === 3)) compare(args[0], args[1], args[2]);
else { console.error("usage: pilot-parity.mjs capture | compare <dirA> <dirB> [<noiseDir>]"); process.exit(2); }
