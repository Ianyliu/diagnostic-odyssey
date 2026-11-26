/**
 * Rendered-parity capture/compare for the Strategy Lab (/pilot).
 *
 *   capture:  QA_BASE_URL=... QA_OUTPUT=dir PLAYWRIGHT_RUNNER=... node tests/browser/pilot-parity.mjs capture
 *   compare:  node tests/browser/pilot-parity.mjs compare <baselineDir> <candidateDir>
 *               [--noise <repeat capture of baseline>]... [--max-noise-fraction 0.15] [--report <file.json>]
 *
 * Capture drives an explicit, scripted interaction plan (stable ids/roles, not DOM position) at
 * every viewport and theme. Every interaction must succeed AND reach its asserted post-state, or
 * the capture fails and writes no summary. For each state it records the exact <main> HTML, the
 * accessibility snapshot and a full-page screenshot; for each viewport/theme it records one
 * focus-order trace (focus traces are not screenshots and are reported separately).
 *
 * Compare fails closed: both summaries must be complete, well-formed and cover exactly the
 * expected viewport x theme x state inventory with no duplicates. HTML, ARIA and focus order are
 * compared exactly, always. Screenshots are compared byte-exactly; a screenshot may be excluded
 * from pixel comparison only when the SAME baseline build rendered that state differently across
 * repeated captures (rasterization noise). Every exclusion is reported, with pixel statistics, and
 * the number of exclusions is bounded. Excluded states are not claimed to be pixel-identical.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import process from "node:process";
import console from "node:console";

export const SCHEMA = "pilot-parity/v2";
const sha = value => createHash("sha256").update(value).digest("hex");
export const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 }
];
export const THEMES = ["light", "dark"];
export const TABS = ["sensitivity", "compare", "quantities", "context"];
export const INPUT_IDS = [
  "pilot-reach", "pilot-capacity", "pilot-alternative_window_months", "pilot-per_participant_cost",
  "pilot-eligible_population", "pilot-baseline_window_months", "pilot-horizon_months", "pilot-fixed_cost"
];
export const INPUT_CASES = [["over-capacity", "1"], ["out-of-range", "101"], ["non-numeric", "abc"], ["large", "1e300"]];
export const STATES = [
  "initial",
  "inspector-open",
  "more-parameters-open",
  ...TABS.map(tab => `tab-${tab}`),
  "tab-keyboard-home",
  "drawer-pathway-boundary",
  "drawer-closed",
  ...INPUT_CASES.map(([name]) => `inputs-${name}`)
];
export const FOCUS_STOPS = 25;
// Intentional, documented exclusions. Nothing else is excluded from capture.
export const EXCLUSIONS = [
  { scope: "screenshot", target: "footer.site-footer (masked black)", reason: "Build-provenance link names the commit being built; it differs between any two revisions by design." },
  { scope: "aria", target: "footer link 'Source <sha10> · committed <date>' and its /url line", reason: "Same build-provenance stamp; stripped by an exact regex, nothing else is filtered." }
];
const HEX64 = /^[0-9a-f]{64}$/;

/** Run one interaction; any thrown error or an unmet post-state fails the capture. */
export async function interact(name, action, verify) {
  try { await action(); } catch (error) { throw new Error(`interaction "${name}" failed: ${error?.message ?? error}`); }
  let reached;
  try { reached = await verify(); } catch (error) { throw new Error(`interaction "${name}" did not reach its expected state: ${error?.message ?? error}`); }
  if (reached !== true) throw new Error(`interaction "${name}" did not reach its expected state`);
}

async function until(predicate, timeout = 4000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) return false;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function capture() {
  const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
  const { chromium } = require("playwright");
  const base = process.env.QA_BASE_URL;
  const out = process.env.QA_OUTPUT;
  if (!base || !out) throw new Error("QA_BASE_URL and QA_OUTPUT are required");
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(process.env.QA_CHROME ? { executablePath: process.env.QA_CHROME } : { channel: "chrome" });
  const records = [];
  const focusTraces = [];
  try {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: theme, reducedMotion: "reduce" });
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(String(error)));
        const label = `${viewport.name}-${theme}`;
        const dir = join(out, label);
        mkdirSync(dir, { recursive: true });
        const record = async state => {
          if (!STATES.includes(state)) throw new Error(`unexpected state ${state}`);
          await page.waitForTimeout(150);
          const actual = await page.evaluate(() => ({ width: window.innerWidth, scheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" }));
          if (actual.width !== viewport.width || actual.scheme !== theme) throw new Error(`${label}/${state}: rendered at ${JSON.stringify(actual)}`);
          const html = await page.locator("main").first().evaluate(element => element.outerHTML);
          const aria = (await page.locator("body").ariaSnapshot())
            .split("\n")
            .filter((line, index, lines) => !/link "Source [0-9a-f]{10} · committed \d{4}-\d\d-\d\d":/.test(line)
              && !(/\/url: https:\/\/github\.com\/[^/]+\/[^/]+\/commit\/[0-9a-f]{40}/.test(line) && /link "Source /.test(lines[index - 1] ?? "")))
            .join("\n");
          const png = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide", mask: [page.locator("footer.site-footer")], maskColor: "#000000" });
          writeFileSync(join(dir, `${state}.html`), html);
          writeFileSync(join(dir, `${state}.aria.txt`), aria);
          writeFileSync(join(dir, `${state}.png`), png);
          records.push({ viewport: viewport.name, theme, state, htmlSha256: sha(html), htmlBytes: Buffer.byteLength(html), ariaSha256: sha(aria), screenshotSha256: sha(png), screenshot: `${label}/${state}.png` });
        };
        const button = name => page.getByRole("button", { name, exact: true });

        await interact("load /pilot", () => page.goto(`${base}/pilot`, { waitUntil: "networkidle" }),
          () => until(async () => (await page.locator("main h1").first().textContent()) === "Scope a feasible pilot"));
        await record("initial");

        const focus = [];
        await page.evaluate(() => document.activeElement?.blur());
        for (let index = 0; index < FOCUS_STOPS; index += 1) {
          await page.keyboard.press("Tab");
          focus.push(await page.evaluate(() => {
            const element = document.activeElement;
            if (!element || element === document.body) return null;
            return { tag: element.tagName, role: element.getAttribute("role"), id: element.id || null, className: String(element.className), name: element.getAttribute("aria-label") ?? (element.textContent ?? "").trim().slice(0, 60) };
          }));
        }
        if (focus.filter(Boolean).length === 0) throw new Error(`${label}: focus trace reached no focusable element`);
        focusTraces.push({ viewport: viewport.name, theme, sha256: sha(JSON.stringify(focus)), length: focus.length, focused: focus.filter(Boolean).length });
        writeFileSync(join(dir, "focus-order.json"), JSON.stringify(focus, null, 1));
        await page.evaluate(() => document.activeElement?.blur());

        const inspectorToggle = page.locator('.atlas-page-top-actions button[aria-expanded]');
        await interact("open decision inspector", () => button("Show inspector").click(),
          () => until(async () => await inspectorToggle.getAttribute("aria-expanded") === "true" && await page.locator("#pilot-decision-inspector").isVisible()));
        await record("inspector-open");

        const moreToggle = page.locator(".atlas-more-params > button[aria-expanded]");
        await interact("open more parameters", () => page.getByRole("button", { name: /^More parameters/ }).click(),
          () => until(async () => await moreToggle.getAttribute("aria-expanded") === "true" && await page.locator("#pilot-eligible_population").isVisible()));
        await record("more-parameters-open");

        for (const tab of TABS) {
          await interact(`select tab ${tab}`, () => page.locator(`#pilot-tab-${tab}`).click(),
            () => until(async () => await page.locator(`#pilot-tab-${tab}`).getAttribute("aria-selected") === "true" && await page.locator(`#pilot-panel-${tab}`).isVisible()));
          await record(`tab-${tab}`);
        }

        await interact("keyboard Home in tab list", async () => { await page.locator("#pilot-tab-context").focus(); await page.keyboard.press("Home"); },
          () => until(async () => await page.locator("#pilot-tab-sensitivity").getAttribute("aria-selected") === "true"
            && await page.evaluate(() => document.activeElement?.id === "pilot-tab-sensitivity")));
        await record("tab-keyboard-home");

        await interact("open pathway boundary drawer", () => button("Pathway boundary").click(),
          () => until(async () => await page.getByRole("dialog").filter({ hasText: "Modeled pathway boundary" }).isVisible()));
        await record("drawer-pathway-boundary");
        await interact("close drawer with Escape", () => page.keyboard.press("Escape"),
          () => until(async () => await page.getByRole("dialog").filter({ hasText: "Modeled pathway boundary" }).count() === 0
            || !(await page.getByRole("dialog").filter({ hasText: "Modeled pathway boundary" }).isVisible())));
        await record("drawer-closed");

        for (const [name, value] of INPUT_CASES) {
          for (const id of INPUT_IDS) {
            const input = page.locator(`#${id}`);
            await interact(`fill ${id} with ${name}`, async () => { await input.fill(value); await input.blur(); },
              async () => await input.inputValue() === value);
          }
          await record(`inputs-${name}`);
        }
        if (pageErrors.length) throw new Error(`${label}: page errors ${JSON.stringify(pageErrors)}`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const summary = { schema: SCHEMA, status: "PASS", baseUrl: base, viewports: VIEWPORTS, themes: THEMES, states: STATES, focusStops: FOCUS_STOPS, exclusions: EXCLUSIONS, records, focusTraces };
  const problems = validateSummary(summary);
  if (problems.length) throw new Error(`capture is incomplete: ${problems.join("; ")}`);
  writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 1));
  console.log(`captured ${records.length} rendered states and ${focusTraces.length} focus-order traces into ${out}`);
}

/** Returns a list of problems; an empty list means the summary is complete and well formed. */
export function validateSummary(summary, label = "summary") {
  const problems = [];
  const add = message => problems.push(`${label}: ${message}`);
  if (!summary || typeof summary !== "object") return [`${label}: missing or not an object`];
  if (summary.schema !== SCHEMA) add(`schema ${JSON.stringify(summary.schema)} is not ${SCHEMA}`);
  if (summary.status !== "PASS") add(`capture status is ${JSON.stringify(summary.status)}`);
  if (JSON.stringify(summary.viewports) !== JSON.stringify(VIEWPORTS)) add("viewport coverage differs from the expected set");
  if (JSON.stringify(summary.themes) !== JSON.stringify(THEMES)) add("theme coverage differs from the expected set");
  if (JSON.stringify(summary.states) !== JSON.stringify(STATES)) add("interaction-state coverage differs from the expected set");
  if (!Array.isArray(summary.records) || summary.records.length === 0) { add("no rendered states"); return problems; }
  if (!Array.isArray(summary.focusTraces) || summary.focusTraces.length === 0) add("no focus-order traces");
  const expected = new Set(VIEWPORTS.flatMap(v => THEMES.flatMap(t => STATES.map(s => `${v.name}-${t}/${s}`))));
  const seen = new Set();
  for (const record of summary.records) {
    const key = `${record?.viewport}-${record?.theme}/${record?.state}`;
    if (seen.has(key)) add(`duplicate state ${key}`);
    seen.add(key);
    if (!expected.has(key)) add(`unexpected state ${key}`);
    for (const field of ["htmlSha256", "ariaSha256", "screenshotSha256"]) if (!HEX64.test(record?.[field] ?? "")) add(`${key}: malformed ${field}`);
    if (!Number.isInteger(record?.htmlBytes) || record.htmlBytes <= 0) add(`${key}: empty or malformed HTML`);
  }
  for (const key of expected) if (!seen.has(key)) add(`missing state ${key}`);
  const traces = new Set();
  for (const trace of summary.focusTraces ?? []) {
    const key = `${trace?.viewport}-${trace?.theme}`;
    if (traces.has(key)) add(`duplicate focus trace ${key}`);
    traces.add(key);
    if (!HEX64.test(trace?.sha256 ?? "")) add(`${key}: malformed focus trace digest`);
    if (trace?.length !== FOCUS_STOPS) add(`${key}: focus trace has ${trace?.length} stops, expected ${FOCUS_STOPS}`);
    if (!(trace?.focused > 0)) add(`${key}: focus trace reached no element`);
  }
  for (const v of VIEWPORTS) for (const t of THEMES) if (!traces.has(`${v.name}-${t}`)) add(`missing focus trace ${v.name}-${t}`);
  return problems;
}

/** Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced, as Chromium emits) for diff statistics. */
export function decodePng(buffer) {
  let offset = 8, width = 0, height = 0, colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error("unsupported PNG"); }
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i += 1) {
      const value = raw[y * (stride + 1) + 1 + i];
      const a = i >= channels ? pixels[y * stride + i - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const c = i >= channels && y > 0 ? pixels[(y - 1) * stride + i - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      pixels[y * stride + i] = (value + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}

function pixelStats(fileA, fileB) {
  if (!existsSync(fileA) || !existsSync(fileB)) return null;
  const a = decodePng(readFileSync(fileA));
  const b = decodePng(readFileSync(fileB));
  if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) return { sameDimensions: false, a: [a.width, a.height], b: [b.width, b.height] };
  let differing = 0, maxDelta = 0, firstRow = null, lastRow = null;
  for (let p = 0; p < a.width * a.height; p += 1) {
    let delta = 0;
    for (let c = 0; c < a.channels; c += 1) delta = Math.max(delta, Math.abs(a.pixels[p * a.channels + c] - b.pixels[p * a.channels + c]));
    if (delta) { differing += 1; maxDelta = Math.max(maxDelta, delta); const row = Math.floor(p / a.width); firstRow ??= row; lastRow = row; }
  }
  return { sameDimensions: true, differingPixels: differing, totalPixels: a.width * a.height, maxChannelDelta: maxDelta, rows: differing ? [firstRow, lastRow] : null };
}

/**
 * Compare a baseline and a candidate capture. `noise` are repeat captures of the BASELINE build.
 * Returns a report; report.pass is true only when nothing differs beyond bounded, reported noise.
 */
export function compareCaptures({ baseline, candidate, noise = [], baselineDir = null, candidateDir = null, noiseDirs = [], maxNoiseFraction = 0.15 }) {
  const errors = [
    ...validateSummary(baseline, "baseline"),
    ...validateSummary(candidate, "candidate"),
    ...noise.flatMap((summary, index) => validateSummary(summary, `noise[${index}]`))
  ];
  const report = { pass: false, errors, exclusions: EXCLUSIONS, counts: {}, domAriaDifferences: [], focusDifferences: [], screenshotDifferences: [], noiseExcludedScreenshots: [], harnessNondeterminism: [] };
  if (errors.length) return report;
  const byKey = summary => new Map(summary.records.map(record => [`${record.viewport}-${record.theme}/${record.state}`, record]));
  const tracesByKey = summary => new Map(summary.focusTraces.map(trace => [`${trace.viewport}-${trace.theme}`, trace]));
  const a = byKey(baseline), b = byKey(candidate), repeats = noise.map(byKey);
  const ta = tracesByKey(baseline), tb = tracesByKey(candidate), trepeats = noise.map(tracesByKey);
  let exact = 0;
  for (const [key, recordA] of a) {
    const recordB = b.get(key);
    // Noise captures of the same build must agree exactly on DOM/ARIA, or the harness is nondeterministic.
    repeats.forEach((repeat, index) => {
      const r = repeat.get(key);
      if (r.htmlSha256 !== recordA.htmlSha256 || r.ariaSha256 !== recordA.ariaSha256) report.harnessNondeterminism.push(`${key}: noise[${index}] DOM/ARIA differs from baseline`);
    });
    if (recordA.htmlSha256 !== recordB.htmlSha256 || recordA.htmlBytes !== recordB.htmlBytes || recordA.ariaSha256 !== recordB.ariaSha256) {
      report.domAriaDifferences.push({ key, html: recordA.htmlSha256 === recordB.htmlSha256 ? "same" : "differs", aria: recordA.ariaSha256 === recordB.ariaSha256 ? "same" : "differs" });
    }
    if (recordA.screenshotSha256 === recordB.screenshotSha256) { exact += 1; continue; }
    const unstable = repeats.map((repeat, index) => ({ index, record: repeat.get(key) })).filter(({ record }) => record.screenshotSha256 !== recordA.screenshotSha256);
    if (unstable.length) {
      report.noiseExcludedScreenshots.push({
        key,
        justification: `baseline build rendered this state differently in ${unstable.length} of ${repeats.length} repeat capture(s)`,
        candidateVsBaseline: baselineDir && candidateDir ? pixelStats(join(baselineDir, recordA.screenshot), join(candidateDir, recordB.screenshot)) : null,
        baselineVsRepeat: baselineDir && noiseDirs[unstable[0].index] ? pixelStats(join(baselineDir, recordA.screenshot), join(noiseDirs[unstable[0].index], unstable[0].record.screenshot)) : null
      });
    } else {
      report.screenshotDifferences.push({ key, stats: baselineDir && candidateDir ? pixelStats(join(baselineDir, recordA.screenshot), join(candidateDir, recordB.screenshot)) : null });
    }
  }
  for (const [key, traceA] of ta) {
    if (traceA.sha256 !== tb.get(key).sha256) report.focusDifferences.push(key);
    trepeats.forEach((repeat, index) => { if (repeat.get(key).sha256 !== traceA.sha256) report.harnessNondeterminism.push(`${key}: noise[${index}] focus order differs`); });
  }
  const total = a.size;
  const bound = Math.floor(total * maxNoiseFraction);
  if (report.noiseExcludedScreenshots.length > bound) report.errors.push(`noise exclusions (${report.noiseExcludedScreenshots.length}) exceed the bound of ${bound} (${maxNoiseFraction} of ${total})`);
  if (report.harnessNondeterminism.length) report.errors.push("repeat captures of the baseline disagree on DOM, ARIA or focus order; the harness is not deterministic");
  report.counts = {
    renderedStates: total,
    renderedStatesDomAriaIdentical: total - report.domAriaDifferences.length,
    focusOrderTraces: ta.size,
    focusOrderTracesIdentical: ta.size - report.focusDifferences.length,
    screenshotsCompared: total,
    screenshotsExactMatch: exact,
    screenshotsNoiseExcluded: report.noiseExcludedScreenshots.length,
    screenshotsDiffering: report.screenshotDifferences.length,
    noiseCaptures: noise.length,
    noiseExclusionBound: bound
  };
  report.pass = report.errors.length === 0 && report.domAriaDifferences.length === 0 && report.focusDifferences.length === 0 && report.screenshotDifferences.length === 0;
  return report;
}

function loadSummary(dir) {
  const file = join(dir, "summary.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

function compareCli(args) {
  const positional = [], noiseDirs = [];
  let reportFile = null, maxNoiseFraction = 0.15;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--noise") noiseDirs.push(args[++index]);
    else if (args[index] === "--report") reportFile = args[++index];
    else if (args[index] === "--max-noise-fraction") maxNoiseFraction = Number(args[++index]);
    else positional.push(args[index]);
  }
  if (positional.length !== 2 || !(maxNoiseFraction >= 0 && maxNoiseFraction < 1)) {
    console.error("usage: pilot-parity.mjs compare <baselineDir> <candidateDir> [--noise <dir>]... [--max-noise-fraction f] [--report file]");
    return 2;
  }
  const [baselineDir, candidateDir] = positional;
  const report = compareCaptures({
    baseline: loadSummary(baselineDir), candidate: loadSummary(candidateDir), noise: noiseDirs.map(loadSummary),
    baselineDir, candidateDir, noiseDirs, maxNoiseFraction
  });
  if (reportFile) writeFileSync(reportFile, JSON.stringify(report, null, 1));
  const c = report.counts;
  console.log(report.errors.length ? `INVALID: ${report.errors.join("; ")}` :
    `${c.renderedStates} rendered states: ${c.renderedStatesDomAriaIdentical} with identical <main> HTML and ARIA; ` +
    `${c.focusOrderTraces} focus-order traces: ${c.focusOrderTracesIdentical} identical; ` +
    `${c.screenshotsCompared} screenshots: ${c.screenshotsExactMatch} byte-identical, ${c.screenshotsNoiseExcluded} excluded as baseline rasterization noise (bound ${c.noiseExclusionBound}, NOT claimed pixel-identical), ${c.screenshotsDiffering} differing`);
  for (const item of report.noiseExcludedScreenshots) console.log(`  EXCLUDED ${item.key}: ${item.justification}; candidate vs baseline ${JSON.stringify(item.candidateVsBaseline)}; baseline vs repeat ${JSON.stringify(item.baselineVsRepeat)}`);
  for (const item of report.domAriaDifferences) console.log(`  DOM/ARIA DIFF ${JSON.stringify(item)}`);
  for (const key of report.focusDifferences) console.log(`  FOCUS DIFF ${key}`);
  for (const item of report.screenshotDifferences) console.log(`  SCREENSHOT DIFF ${JSON.stringify(item)}`);
  console.log(report.pass ? "PASS" : "FAIL");
  return report.pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "capture") {
    try { await capture(); }
    catch (error) {
      if (process.env.QA_OUTPUT) { mkdirSync(process.env.QA_OUTPUT, { recursive: true }); writeFileSync(join(process.env.QA_OUTPUT, "capture-failure.json"), JSON.stringify({ error: String(error?.stack ?? error) }, null, 1)); }
      console.error(`CAPTURE FAILED: ${error?.message ?? error}`);
      process.exitCode = 1;
    }
  } else if (mode === "compare") process.exitCode = compareCli(args);
  else { console.error("usage: pilot-parity.mjs capture | compare <baselineDir> <candidateDir> [options]"); process.exitCode = 2; }
}
