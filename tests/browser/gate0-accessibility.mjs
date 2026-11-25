/* global process, console, document, window, localStorage, getComputedStyle, requestAnimationFrame, Buffer */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

// Use the existing isolated Playwright/axe runner; no production dependency.
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const { chromium } = require("playwright");
const axe = require("axe-core");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4186";
const output = process.env.QA_OUTPUT ?? "/tmp/gate0-accessibility";
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.QA_CHROME ? {executablePath: process.env.QA_CHROME, headless: true} : {channel: "chrome", headless: true});
const results = [];
const errors = [];

// Decode only Chromium's noninterlaced 8-bit RGB/RGBA screenshots. Retain both
// PNGs so independent review can inspect the gradient beneath the actual text.
function pngPixels(buffer) {
  assert.equal(buffer.subarray(1, 4).toString(), "PNG");
  let width, height, channels;
  const chunks = [];
  for (let offset = 8; offset < buffer.length;) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + size);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8); assert.ok([2, 6].includes(data[9]));
      assert.equal(data[12], 0); channels = data[9] === 2 ? 3 : 4;
    }
    if (type === "IDAT") chunks.push(data);
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  assert.equal(raw.length, height * (stride + 1));
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y ? pixels[(y - 1) * stride + x] : 0;
      const corner = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const p = left + up - corner;
      const distances = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)];
      const paeth = distances[0] <= distances[1] && distances[0] <= distances[2] ? left : distances[1] <= distances[2] ? up : corner;
      const prediction = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
      pixels[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
  }
  return { width, height, channels, pixels };
}
function luminance(rgb) {
  return rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(original, background, foreground) {
  const a = pngPixels(original), b = pngPixels(background);
  assert.equal(a.width, b.width); assert.equal(a.height, b.height);
  let minimum = Infinity, textPixels = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    const text = [...a.pixels.subarray(i * a.channels, i * a.channels + 3)];
    const under = [...b.pixels.subarray(i * b.channels, i * b.channels + 3)];
    if (text.reduce((sum, value, index) => sum + (value - under[index]) ** 2, 0) < 300) continue;
    const [low, high] = [luminance(foreground), luminance(under)].sort((x, y) => x - y);
    minimum = Math.min(minimum, (high + 0.05) / (low + 0.05)); textPixels++;
  }
  assert.ok(textPixels > 0, "Raster must contain caption text");
  return { minimum, textPixels };
}
async function check(name, body) {
  const result = { name, status: "PASS", measurements: {} };
  try { await body(result.measurements); }
  catch (error) { result.status = "FAIL"; result.error = String(error.stack); }
  results.push(result);
  for (const context of browser.contexts()) await context.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ revision: process.env.QA_SHA, browser: browser.version(), results, errors }, null, 2));
}
async function page(width, theme, motion, explicit = true) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: motion });
  if (explicit) await context.addInitScript(value => localStorage.setItem("diagnostic-odyssey.theme", value), theme);
  const p = await context.newPage();
  p.on("pageerror", error => errors.push(String(error)));
  p.setDefaultTimeout(6000);
  return p;
}
for (const mode of ["light", "dark", "system-light", "system-dark"]) for (const motion of ["reduce", "no-preference"]) {
  await check(`C-01 390px ${mode} ${motion}`, async measurements => {
    const p = await page(390, mode.endsWith("dark") ? "dark" : "light", motion, !mode.startsWith("system"));
    await p.goto(`${base}/local-context`); await p.locator("main h1").waitFor();
    await p.getByRole("button", { name: /Primary care shortage designations/ }).click();
    const triggers = p.locator(".atlas-detail-trigger:visible");
    const count = await triggers.count(); assert.ok(count > 0);
    const firstTrigger = triggers.first();
    await p.keyboard.press("Tab"); await firstTrigger.focus();
    assert.equal(await firstTrigger.evaluate(e => e.matches(":focus-visible")), true);
    measurements.focus = await firstTrigger.evaluate(e => ({ outline: getComputedStyle(e).outlineStyle, width: getComputedStyle(e).outlineWidth }));
    assert.notEqual(measurements.focus.outline, "none"); assert.ok(parseFloat(measurements.focus.width) >= 2);
    const drawer = p.locator("dialog.atlas-drawer");
    await p.keyboard.press("Enter"); await drawer.waitFor({ state: "visible" });
    const drawerContent = await drawer.locator(".atlas-drawer-list dd").allTextContents();
    assert.ok(drawerContent.length > 0);
    await p.keyboard.press("Escape"); await drawer.waitFor({ state: "hidden" });
    await p.keyboard.press("Space"); await drawer.waitFor({ state: "visible" });
    assert.deepEqual(await drawer.locator(".atlas-drawer-list dd").allTextContents(), drawerContent, "Provenance disclosure content must be unchanged");
    measurements.content = drawerContent;
    await p.keyboard.press("Escape"); await drawer.waitFor({ state: "hidden" });
    measurements.viewport = await p.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    await p.screenshot({ path: `${output}/reflow-${mode}-${motion}.png`, fullPage: true });
    await p.addScriptTag({ content: axe.source });
    const scan = await p.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
    await writeFile(`${output}/axe-${mode}-${motion}.json`, JSON.stringify(scan, null, 2));
    assert.deepEqual(scan.violations, []);
    assert.ok(measurements.viewport.scrollWidth <= measurements.viewport.clientWidth, "Expanded source details must not overflow the document");
    const menu = p.getByRole("button", { name: "Menu", exact: true }); await menu.focus(); await p.keyboard.press("Enter");
    const overview = p.getByRole("navigation", { name: "Supporting navigation" }).getByRole("link", { name: "Overview", exact: true });
    await overview.focus(); await p.keyboard.press("Enter"); await p.waitForURL(`${base}/`);
    await p.waitForFunction(() => document.activeElement === document.querySelector("main h1"));
  });
}
for (const width of [1440, 768, 390]) for (const theme of ["light", "dark"]) {
  await check(`C-02 ${width}px ${theme}`, async measurements => {
    const p = await page(width, theme, "reduce"); await p.goto(`${base}/`); await p.locator("main h1").waitFor();
    const caption = p.locator(".atlas-hero-provenance");
    measurements.style = await caption.evaluate(e => {
      const s = getComputedStyle(e); const ancestors = [];
      for (let node = e; node; node = node.parentElement) ancestors.push(getComputedStyle(node).opacity);
      return { color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight, ancestors };
    });
    assert.ok(measurements.style.ancestors.every(opacity => Number(opacity) === 1));
    const rgb = measurements.style.color.match(/[\d.]+/g).map(Number); assert.ok(rgb.length === 3 || rgb[3] === 1);
    // The opening caption now sits inside the first-screen hero. Center it above
    // fixed mobile navigation before comparing actual rendered text with its
    // underlying raster; Playwright's default scroll-into-view does not account
    // for that overlay. Keep the original 4.5:1 threshold unchanged.
    await caption.evaluate(e => e.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
    const captionPosition = await caption.evaluate(e => {
      const rect = e.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
    });
    assert.ok(captionPosition.top >= 0 && captionPosition.bottom <= captionPosition.viewportHeight - (width <= 390 ? 70 : 0),
      "Caption must be visibly unobscured before raster contrast measurement");
    const original = await caption.screenshot({ path: `${output}/caption-${width}-${theme}.png`, animations: "disabled" });
    // Measurement only: reveal the raster background; never substitute corrected
    // colors. Restore the exact inline attribute before checking text/geometry.
    const before = await caption.evaluate(e => ({ style: e.getAttribute("style"), text: e.textContent, rect: e.getBoundingClientRect().toJSON() }));
    await caption.evaluate(e => e.style.setProperty("color", "transparent", "important"));
    const background = await caption.screenshot({ path: `${output}/caption-${width}-${theme}-background.png`, animations: "disabled" });
    await caption.evaluate((e, style) => style === null ? e.removeAttribute("style") : e.setAttribute("style", style), before.style);
    const after = await caption.evaluate(e => ({ style: e.getAttribute("style"), text: e.textContent, rect: e.getBoundingClientRect().toJSON() }));
    assert.deepEqual(after, before);
    measurements.contrast = contrast(original, background, rgb.slice(0, 3));
    await p.screenshot({ path: `${output}/overview-${width}-${theme}.png`, fullPage: true });
    assert.ok(measurements.contrast.minimum >= 4.5, "Normal caption text must have at least 4.5:1 contrast");
  });
}
for (const [width, height] of [[320, 640], [390, 844]]) {
  await check(`Brief keyboard focus ${width}×${height}`, async measurements => {
    const p = await browser.newPage({
      viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: "reduce"
    });
    p.on("pageerror", error => errors.push(String(error)));
    await p.goto(`${base}/brief`);
    await p.locator("main h1").waitFor();
    await p.evaluate(() => document.fonts.ready);

    const pending = new Set(["Show local records", "Show national findings"]);
    measurements.controls = [];
    // Reproduce the auditor's natural Tab sequence, including the browser's own focus scrolling.
    for (let step = 0; step < 45 && pending.size; step++) {
      await p.keyboard.press("Tab");
      const control = await p.evaluate(async names => {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const focused = document.activeElement;
        const name = focused.innerText?.trim();
        if (!names.includes(name)) return null;

        const label = document.createRange();
        label.selectNodeContents(focused);
        const dock = document.querySelector(".brief-dock");
        const lines = Array.from(label.getClientRects());
        const covered = lines.some(rect => {
          const x = (rect.left + rect.right) / 2;
          return [0.15, 0.45, 0.7, 0.9].some(fraction =>
            dock.contains(document.elementFromPoint(x, rect.top + fraction * rect.height)));
        });
        return { name, covered, focusVisible: focused.matches(":focus-visible") };
      }, [...pending]);
      if (!control) continue;
      pending.delete(control.name);
      measurements.controls.push(control);
      const focused = p.locator(":focus");
      await p.keyboard.press("Enter");
      assert.equal(await focused.getAttribute("aria-expanded"), "true", `${control.name} opens with Enter`);
      await p.keyboard.press("Enter");
      assert.equal(await focused.getAttribute("aria-expanded"), "false", `${control.name} closes with Enter`);
    }
    assert.deepEqual([...pending], [], "Both Brief disclosures must be reachable by Tab");
    for (const control of measurements.controls) {
      assert.ok(control.focusVisible, `${control.name} must show keyboard focus`);
      assert.equal(control.covered, false, `The export toolbar covers the focused label for ${control.name}`);
    }
  });
}
await check("Brief desktop toolbar stays sticky", async measurements => {
  const p = await page(1440, "light", "reduce");
  await p.goto(`${base}/brief`);
  const dock = p.locator(".brief-dock");
  await dock.waitFor();
  await p.evaluate(() => document.fonts.ready);
  measurements.position = await dock.evaluate(element => getComputedStyle(element).position);
  assert.equal(measurements.position, "sticky");
  const positions = [];
  for (const offset of [1100, 1450]) {
    await p.evaluate(y => window.scrollTo(0, y), offset);
    await p.waitForFunction(y => window.scrollY === y, offset);
    positions.push((await dock.boundingBox()).y);
  }
  measurements.verticalPositions = positions;
  assert.ok(positions[0] >= 0 && positions[0] === positions[1], "Toolbar stays pinned as the Brief scrolls");
  const print = await dock.getByRole("button", { name: "Print / save PDF" }).boundingBox();
  assert.ok(print && print.y >= 0 && print.y + print.height <= p.viewportSize().height);
});
await browser.close();
assert.deepEqual(errors, []);
console.log(JSON.stringify(results.map(({ name, status, measurements }) => ({ name, status, viewport: measurements.viewport, contrast: measurements.contrast })), null, 2));
process.exitCode = results.some(result => result.status === "FAIL") ? 1 : 0;
