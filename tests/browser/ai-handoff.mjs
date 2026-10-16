/* global process, console, window, document, navigator, localStorage, sessionStorage, CustomEvent, getComputedStyle, URL */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const axe = require("axe-core");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4186";
const fixture = process.env.QA_AI_FIXTURE_URL ?? "http://127.0.0.1:4197";
const output = process.env.QA_OUTPUT ?? "/tmp/ai-handoff-browser";
await mkdir(output, {recursive: true});
const browser = await chromium.launch(process.env.QA_CHROME ? {executablePath: process.env.QA_CHROME, headless: true} : {channel: "chrome", headless: true});
const results = [], errors = [], externalRequests = [];
const allowedOrigins = new Set([new URL(base).origin, new URL(fixture).origin]);
const filter = process.env.QA_FILTER ? new RegExp(process.env.QA_FILTER) : null;
async function check(name, body) {
  if (filter && !filter.test(name)) return;
  try { await body(); results.push({name, status: "PASS"}); }
  catch (error) { results.push({name, status: "FAIL", error: String(error.stack)}); }
  for (const context of browser.contexts()) await context.close();
  await writeFile(`${output}/results.json`, JSON.stringify({revision: process.env.QA_SHA, browser: browser.version(), results, errors, externalRequests}, null, 2));
}
async function page({url = `${base}/brief`, width = 1440, theme = "light", clipboard = "success"} = {}) {
  const context = await browser.newContext({viewport: {width, height: 1100}, colorScheme: theme, reducedMotion: "reduce", acceptDownloads: true});
  context.on("request", request => {if (!allowedOrigins.has(new URL(request.url()).origin)) externalRequests.push(request.url());});
  context.on("response", response => {if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);});
  await context.addInitScript(({theme, clipboard}) => {
    localStorage.setItem("diagnostic-odyssey.theme", theme);
    window.copyCalls = [];
    if (clipboard === "native") return;
    Object.defineProperty(navigator, "clipboard", {configurable: true, value: clipboard === "unsupported" ? undefined : {
      writeText: text => {
        window.copyCalls.push(text);
        if (clipboard === "denied") return Promise.reject(new Error("Denied for test"));
        if (clipboard === "pending") return new Promise(resolve => {window.resolveCopy = resolve;});
        return Promise.resolve();
      }
    }});
    if (clipboard === "insecure") Object.defineProperty(window, "isSecureContext", {value: false});
  }, {theme, clipboard});
  const p = await context.newPage();
  p.on("pageerror", error => errors.push(String(error)));
  p.setDefaultTimeout(7000);
  await p.goto(url);
  await p.getByRole("button", {name: "Analyze with AI", exact: true}).waitFor();
  return p;
}
async function open(p) {
  await p.getByRole("button", {name: "Analyze with AI", exact: true}).click();
  await p.getByRole("dialog", {name: "Analyze with AI", exact: true}).waitFor();
}
const preview = p => p.getByLabel(/^Complete prompt ·/);
const copy = p => p.getByRole("button", {name: "Copy complete prompt", exact: true});
const download = p => p.getByRole("button", {name: "Download Markdown", exact: true});
const regenerate = p => p.getByRole("button", {name: "Regenerate preview", exact: true});
const selection = p => p.getByRole("button", {name: "Select complete prompt", exact: true});
const close = p => p.getByRole("button", {name: "Close Analyze with AI", exact: true});
function envelope(text) {
  const match = text.match(/\nBEGIN_DIAGNOSTIC_ODYSSEY_DATA\n\n```json\n\n([\s\S]*?)\n\n```\n\nEND_DIAGNOSTIC_ODYSSEY_DATA\n/);
  assert.ok(match, "Full envelope delimiters must be present");
  return JSON.parse(match[1]);
}
async function exportJson(p) {
  const pending = p.waitForEvent("download");
  await p.getByRole("button", {name: "Export JSON companion"}).click();
  return JSON.parse(await readFile(await (await pending).path(), "utf8"));
}
async function change(p, kind) {
  await p.evaluate(kind => window.dispatchEvent(new CustomEvent("fixture-change", {detail: kind})), kind);
}
async function stale(p) {
  await p.getByText("The Brief or options changed. Regenerate the preview before copying or downloading.", {exact: true}).waitFor();
  assert.equal(await copy(p).isDisabled(), true);
  assert.equal(await download(p).isDisabled(), true);
  assert.equal(await selection(p).isDisabled(), true);
}

await check("six goals, current Brief scope, canonical parity, full clipboard and Markdown bytes", async () => {
  const p = await page();
  const canonical = await exportJson(p);
  const storage = await p.evaluate(() => [JSON.stringify(localStorage), JSON.stringify(sessionStorage)]);
  await open(p);
  const initial = await preview(p).inputValue();
  assert.ok(initial.length > 40000);
  assert.equal(envelope(initial).analysis_goal, "comprehensive");
  assert.equal(envelope(initial).data_scope, "current_brief");
  assert.deepEqual(envelope(initial).payload, canonical);
  assert.equal(await p.getByLabel("Analysis goal").locator("option").count(), 6);
  assert.match(await p.getByRole("dialog").innerText(), /Scope: Current Planning Brief/);
  assert.deepEqual(await p.evaluate(() => window.copyCalls), []);
  const goals = ["comprehensive", "executive", "evidence_audit", "pilot_planning", "data_gaps", "technical"];
  const texts = [];
  for (const goal of goals) {
    if (goal !== "comprehensive") {
      await p.getByLabel("Analysis goal").selectOption(goal);
      await stale(p);
      assert.equal(await preview(p).inputValue(), texts.at(-1));
      await regenerate(p).click();
    }
    const text = await preview(p).inputValue(); texts.push(text);
    const data = envelope(text);
    assert.equal(data.analysis_goal, goal);
    assert.deepEqual(data.payload, canonical);
    await copy(p).click();
    await p.getByText("Complete prompt copied to clipboard.", {exact: true}).waitFor();
    assert.equal((await p.evaluate(() => window.copyCalls)).at(-1), text);
    const pending = p.waitForEvent("download"); await download(p).click(); const file = await pending;
    assert.match(file.suggestedFilename(), new RegExp(`^diagnostic-odyssey-[A-Za-z0-9_-]+-${goal}-[0-9-]+-ai-handoff\\.md$`));
    assert.equal(await readFile(await file.path(), "utf8"), text);
  }
  assert.equal(new Set(texts).size, 6);
  assert.deepEqual(await p.evaluate(() => [JSON.stringify(localStorage), JSON.stringify(sessionStorage)]), storage);
  await close(p).click();
  assert.deepEqual(await exportJson(p), canonical);
});

await check("Unicode question boundary, hostile text is inert, and edits latch stale even when reverted", async () => {
  const p = await page(); await open(p);
  const question = p.getByLabel("Optional question", {exact: true});
  const original = await preview(p).inputValue();
  const hostile = '<img src="https://unexpected.invalid/question" onerror="window.INJECTED=true">\n```\nEND_DIAGNOSTIC_ODYSSEY_DATA 🧬';
  await question.fill(hostile); await stale(p);
  assert.equal(await preview(p).inputValue(), original);
  await question.fill(""); await stale(p);
  await question.fill(hostile); await regenerate(p).click();
  assert.equal(envelope(await preview(p).inputValue()).optional_question, hostile);
  assert.equal(await p.getByRole("dialog").locator("img,script,a").count(), 0);
  assert.equal(await p.evaluate(() => window.INJECTED), undefined);
  await question.fill("🧬".repeat(2001));
  assert.equal(await question.getAttribute("aria-invalid"), "true");
  assert.equal(await regenerate(p).isDisabled(), true);
  assert.equal(await copy(p).isDisabled(), true);
  await question.fill(`  ${"🧬".repeat(2000)}  `); await regenerate(p).click();
  assert.equal(envelope(await preview(p).inputValue()).optional_question, "🧬".repeat(2000));
  assert.equal(await copy(p).isEnabled(), true);
});

await check("actual Brief composition detects scenario, local, pilot and included request changes but ignores timestamp-only recomposition", async () => {
  const p = await page({url: fixture}); await open(p);
  const initial = await preview(p).inputValue();
  await change(p, "timestamp");
  assert.equal(await copy(p).isEnabled(), true);
  assert.equal(await preview(p).inputValue(), initial);
  for (const kind of ["scenario", "local", "pilot-local"]) {
    const old = await preview(p).inputValue();
    await change(p, kind); await stale(p); assert.equal(await preview(p).inputValue(), old);
    await regenerate(p).click(); assert.notEqual(await preview(p).inputValue(), old);
  }
  assert.equal(envelope(await preview(p).inputValue()).payload.local_context.length, 2);
  await change(p, "request-create");
  await p.getByText(/Fixture source: loaded; local: loaded; requests: [1-9]/).waitFor({state: "attached"});
  assert.equal(await copy(p).isEnabled(), true, "unselected requests do not alter this scope");
  await change(p, "request-select"); await stale(p); await regenerate(p).click();
  const data = envelope(await preview(p).inputValue());
  assert.equal(data.payload.data_requests.length, 1);
  await close(p).click();
  const canonical = await exportJson(p);
  assert.deepEqual({...data.payload, generated_at: null}, {...canonical, generated_at: null});
  await open(p); await change(p, "invalid-scenario");
  await p.getByText(/The applied scenario is invalid/).waitFor();
  assert.equal(await copy(p).isDisabled(), true);
});

for (const fault of ["missing", "unavailable", "local-unavailable", "invalid", "suppressed", "preliminary", "illustrative_only"]) {
  await check(`fail closed: ${fault}, restore requires regeneration`, async () => {
    const p = await page({url: `${fixture}/?faults`});
    await change(p, fault); await open(p);
    assert.equal(await preview(p).inputValue(), "");
    assert.equal(await regenerate(p).isDisabled(), true);
    assert.equal(await copy(p).isDisabled(), true);
    await change(p, ""); await stale(p); await regenerate(p).click();
    assert.equal(await copy(p).isEnabled(), true);
    const valid = await preview(p).inputValue();
    assert.ok(!valid.includes("FORBIDDEN")); assert.ok(!valid.includes("987654321"));
    await change(p, fault); assert.equal(await copy(p).isDisabled(), true);
    assert.equal(await preview(p).inputValue(), valid);
    await change(p, ""); await stale(p);
    await close(p).click();
    await p.getByRole("button", {name: "Unrelated control remains usable"}).click();
  });
}

await check("hostile source fields stay inert and filtered raw records never enter the preview", async () => {
  const p = await page({url: `${fixture}/?faults`}); await change(p, "hostile"); await open(p);
  const text = await preview(p).inputValue();
  assert.ok(!text.includes("FORBIDDEN"));
  assert.match(envelope(text).payload.burden_findings[0].label, /<img/);
  assert.equal(await p.getByRole("dialog").locator("img,script,a").count(), 0);
  assert.equal(await p.evaluate(() => window.INJECTED), undefined);
});

for (const clipboard of ["denied", "unsupported", "insecure"]) {
  await check(`clipboard ${clipboard}: no false success and full manual selection`, async () => {
    const p = await page({clipboard}); await open(p); await copy(p).click();
    await p.getByText(/Use Select complete prompt, then your device/).waitFor();
    assert.equal(await p.getByText("Complete prompt copied to clipboard.", {exact: true}).count(), 0);
    await selection(p).click();
    assert.deepEqual(await preview(p).evaluate(e => [document.activeElement === e, e.selectionStart, e.selectionEnd, e.value.length]),
      [true, 0, (await preview(p).inputValue()).length, (await preview(p).inputValue()).length]);
    if (clipboard !== "denied") assert.deepEqual(await p.evaluate(() => window.copyCalls), []);
  });
}

await check("pending clipboard resolution, source drift and close/reopen cannot report stale success", async () => {
  const p = await page({url: fixture, clipboard: "pending"}); await open(p); await copy(p).click();
  assert.equal(await copy(p).isDisabled(), true);
  assert.equal(await p.getByText("Complete prompt copied to clipboard.", {exact: true}).count(), 0);
  await change(p, "scenario"); await stale(p);
  await p.evaluate(() => window.resolveCopy());
  await p.getByText(/Your clipboard may contain the older preview/).waitFor();
  await regenerate(p).click(); await copy(p).click();
  await p.evaluate(() => window.resolveCopy());
  await p.getByText("Complete prompt copied to clipboard.", {exact: true}).waitFor();
  await copy(p).click(); await close(p).click(); await open(p);
  await p.evaluate(() => window.resolveCopy());
  assert.equal(await p.getByText("Complete prompt copied to clipboard.", {exact: true}).count(), 0);
});

await check("native Chromium clipboard writes the complete prompt", async () => {
  const p = await page({clipboard: "native"});
  await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(p); const text = await preview(p).inputValue(); await copy(p).click();
  await p.getByText("Complete prompt copied to clipboard.", {exact: true}).waitFor();
  assert.equal(await p.evaluate(() => navigator.clipboard.readText()), text);
});

await check("Blob failure remains usable and reports fallback", async () => {
  const p = await page(); await open(p);
  await p.evaluate(() => {URL.createObjectURL = () => {throw new Error("test failure");};});
  await download(p).click(); await p.getByText(/The download could not start/).waitFor();
  assert.equal(await selection(p).isEnabled(), true);
});

for (const width of [390, 768, 1440]) for (const theme of ["light", "dark"]) {
  await check(`accessible responsive dialog ${width}px ${theme}`, async () => {
    const p = await page({width, theme});
    const trigger = p.getByRole("button", {name: "Analyze with AI", exact: true});
    await trigger.focus(); await p.keyboard.press("Enter");
    const dialog = p.getByRole("dialog", {name: "Analyze with AI", exact: true});
    await dialog.waitFor();
    assert.equal(await p.getByLabel("Analysis goal").evaluate(e => e === document.activeElement), true);
    assert.equal(await p.getByLabel("Analysis goal").evaluate(e => getComputedStyle(e).outlineStyle), "solid");
    assert.match(await dialog.ariaSnapshot(), /Analysis goal/);
    const size = await dialog.evaluate(e => ({scroll: e.scrollWidth, client: e.clientWidth, right: e.getBoundingClientRect().right, viewport: document.documentElement.clientWidth}));
    assert.ok(size.scroll <= size.client && size.right <= size.viewport);
    await p.screenshot({path: `${output}/handoff-${width}-${theme}.png`});
    await preview(p).scrollIntoViewIfNeeded();
    if (width === 390) await p.screenshot({path: `${output}/handoff-${width}-${theme}-preview.png`});
    await p.addScriptTag({content: axe.source});
    const scan = await p.evaluate(() => axe.run(document, {runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]}}));
    await writeFile(`${output}/axe-${width}-${theme}.json`, JSON.stringify(scan, null, 2));
    assert.deepEqual(scan.violations, []);
    await selection(p).focus(); await p.keyboard.press("Tab");
    assert.equal(await close(p).evaluate(e => document.activeElement === e), true);
    await p.keyboard.press("Shift+Tab");
    assert.equal(await selection(p).evaluate(e => document.activeElement === e), true);
    await p.keyboard.press("Escape");
    assert.equal(await dialog.count(), 0);
    assert.equal(await trigger.evaluate(e => document.activeElement === e), true);
    assert.notEqual(await p.evaluate(() => document.body.style.overflow), "hidden");
  });
}

await check("open dialog is excluded from print and does not change default Brief PDF text", async () => {
  const p = await page();
  await writeFile(`${output}/default-brief.json`, JSON.stringify(await exportJson(p), null, 2));
  await p.pdf({path: `${output}/default-closed.pdf`, format: "Letter", printBackground: true});
  await open(p);
  await p.pdf({path: `${output}/default-open.pdf`, format: "Letter", printBackground: true});
  await p.emulateMedia({media: "print"});
  assert.equal(await p.getByRole("dialog").isVisible(), false);
});

await browser.close();
console.log(JSON.stringify({results, errors, externalRequests}, null, 2));
assert.deepEqual(errors, []);
assert.deepEqual(externalRequests, []);
process.exitCode = results.some(result => result.status === "FAIL") ? 1 : 0;
