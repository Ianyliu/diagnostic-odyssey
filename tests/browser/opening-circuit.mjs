/* global process, console, document, window, getComputedStyle, innerWidth, innerHeight, PerformanceObserver */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";

const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const { chromium } = require("playwright");

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4188";
const out = process.env.QA_OUTPUT ?? "/tmp/opening-circuit-qa";
await mkdir(out, { recursive: true });

const browser = await chromium.launch(
  process.env.QA_CHROME ? { executablePath: process.env.QA_CHROME } : { channel: "chrome" }
);

const results = [];

function boxesOverlap(a, b) {
  return !(
    a.right <= b.left - 1 ||
    b.right <= a.left - 1 ||
    a.bottom <= b.top - 1 ||
    b.bottom <= a.top - 1
  );
}

async function checkHeroAndScrollJourney(page, label, expectedOpening, expectedJourneyOnScroll) {
  await page.locator("#overview-title").waitFor();
  await page.locator(".atlas-care-horizon").waitFor();
  await page.locator(".atlas-journey").waitFor();

  const heroMetrics = await page.evaluate(() => {
    const hero = document.querySelector(".atlas-hero-band").getBoundingClientRect();
    const title = document.querySelector("#overview-title").getBoundingClientRect();
    const horizon = document.querySelector(".atlas-care-horizon").getBoundingClientRect();
    const header = document.querySelector(".site-header")?.getBoundingClientRect() ?? { height: 0 };
    const navWrap = Array.from(document.querySelectorAll(".primary-nav a")).some(a => {
      const r = a.getBoundingClientRect();
      return r.height > 54;
    });
    return {
      heroTop: hero.top,
      heroBottom: hero.bottom,
      titleBottom: title.bottom,
      horizonTop: horizon.top,
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      viewportHeight: innerHeight,
      headerHeight: header.height,
      navWrap
    };
  });

  assert.ok(heroMetrics.width <= heroMetrics.viewport + 2, `${label} initial horizontal overflow ${JSON.stringify(heroMetrics)}`);
  assert.equal(heroMetrics.navWrap, false, `${label} primary nav wrapped`);
  assert.ok(heroMetrics.headerHeight <= (heroMetrics.viewport <= 980 ? 140 : 88), `${label} header too tall: ${heroMetrics.headerHeight}`);
  assert.equal(await page.locator(".overview-page.is-opening").count(), expectedOpening ? 1 : 0, `${label} is-opening`);
  assert.ok(heroMetrics.titleBottom < heroMetrics.viewportHeight, `${label} hero headline clipped below fold`);

  if (expectedOpening) {
    // Wait for Chapter I to settle or interrupt cleanly via scroll wheel to verify Chapter IV stays independent!
    await page.locator(".atlas-journey").scrollIntoViewIfNeeded();
    if (expectedJourneyOnScroll) {
      await page.locator(".atlas-journey.is-playing").waitFor({ state: "attached", timeout: 3000 });
    }
  } else {
    await page.locator(".atlas-journey").scrollIntoViewIfNeeded();
    assert.equal(await page.locator(".atlas-journey.is-playing").count(), expectedJourneyOnScroll ? 1 : 0, `${label} unexpected journey playing`);
  }

  const g = await page.evaluate(() => {
    const journey = document.querySelector(".atlas-journey").getBoundingClientRect();
    const replayEl = document.querySelector(".atlas-journey-replay");
    const btn = replayEl.getBoundingClientRect();
    const canvas = document.querySelector(".atlas-journey-canvas");
    const desktopVisible = getComputedStyle(canvas).display !== "none";
    const mobileVisible = getComputedStyle(document.querySelector(".atlas-journey-mobile")).display !== "none";
    const stopRects = Array.from(document.querySelectorAll(".atlas-journey-stop")).map(el => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent?.trim() ?? "",
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height
      };
    });
    const spur = document.querySelector(".atlas-journey-spur");
    const spurDash = spur ? getComputedStyle(spur).strokeDasharray : "";
    return {
      journeyTop: journey.top,
      journeyBottom: journey.bottom,
      left: journey.left,
      right: journey.right,
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      viewportHeight: innerHeight,
      desktopVisible,
      mobileVisible,
      stopRects,
      spurPresent: Boolean(spur),
      spurDash,
      buttonHeight: btn.height,
      buttonBottom: btn.bottom
    };
  });

  assert.ok(g.left >= -2 && g.right <= g.viewport + 2, `${label} panel overflow ${JSON.stringify(g)}`);
  assert.ok(g.width <= g.viewport + 2, `${label} horizontal overflow ${JSON.stringify(g)}`);
  assert.ok(g.buttonHeight >= 40, `${label} replay height ${g.buttonHeight}`);
  assert.equal(await page.getByRole("button", { name: "Replay animation" }).count(), 1);
  assert.equal(g.spurPresent, true, `${label} missing optional spur`);

  if (g.viewport >= 761) {
    assert.equal(g.desktopVisible, true, `${label} desktop canvas hidden`);
    assert.equal(g.stopRects.length, 5, `${label} expected 5 stops`);
    for (let i = 0; i < g.stopRects.length; i++) {
      const s = g.stopRects[i];
      assert.ok(s.left >= -2 && s.right <= g.viewport + 2, `${label} stop ${i} horizontal clip ${JSON.stringify(s)}`);
      for (let j = i + 1; j < g.stopRects.length; j++) {
        assert.equal(
          boxesOverlap(s, g.stopRects[j]),
          false,
          `${label} overlapping stops ${s.text} and ${g.stopRects[j].text}: ${JSON.stringify([s, g.stopRects[j]])}`
        );
      }
    }
  } else {
    assert.equal(g.mobileVisible, true, `${label} mobile timeline hidden`);
  }

  return { heroMetrics, g };
}

async function tabToReplay(page) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.matches(".preview-replay"))) return;
  }
  throw Error("Replay was unreachable using Tab");
}

async function stillFocusedOnSameReplay(page) {
  return page.evaluate(
    () =>
      document.activeElement === document.querySelector(".preview-replay") &&
      document.activeElement === window.__replayFocusAnchor
  );
}

try {
  const matrixConfigs = [
    { width: 320, height: 640 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 761, height: 900 },
    { width: 768, height: 900 },
    { width: 790, height: 900 },
    { width: 1024, height: 900 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 }
  ];

  for (const { width, height } of matrixConfigs) {
    for (const theme of ["light", "dark"]) {
      for (const motion of ["no-preference", "reduce"]) {
        const label = `${width}x${height}-${theme}-${motion}`;
        const p = await browser.newPage({ viewport: { width, height }, colorScheme: theme, reducedMotion: motion });
        try {
          await p.addInitScript(() => {
            window.openingShifts = [];
            new PerformanceObserver(list => {
              for (const e of list.getEntries()) if (!e.hadRecentInput) window.openingShifts.push(e.value);
            }).observe({ type: "layout-shift", buffered: true });
          });
          await p.goto(`${base}/`);
          const geo = await checkHeroAndScrollJourney(p, label, motion === "no-preference", motion === "no-preference");
          if (motion === "reduce") {
            assert.equal(
              await p.evaluate(() =>
                document.getAnimations().filter(a => a.animationName?.startsWith("atlas-")).length
              ),
              0
            );
          }
          if ([320, 761, 1280, 1440].includes(width) && theme === "light" && motion === "no-preference") {
            await p.screenshot({ path: `${out}/${label}-journey-mid.png`, animations: "allow" });
          }
          await p.locator(".overview-page.is-opening").waitFor({ state: "detached", timeout: 9500 });
          await p.locator(".atlas-journey.is-playing").waitFor({ state: "detached", timeout: 9500 });
          if ([320, 761, 1280, 1440].includes(width) && theme === "light") {
            await p.screenshot({ path: `${out}/${label}-complete.png`, animations: "disabled" });
          }
          const cls = await p.evaluate(() => window.openingShifts.reduce((a, b) => a + b, 0));
          assert.ok(cls < 0.03, `${label} layout shift ${cls}`);
          results.push({ label, status: "PASS", geo, layoutShift: cls });
        } catch (e) {
          results.push({ label, status: "FAIL", error: String(e.stack ?? e) });
        } finally {
          await p.close();
        }
      }
    }
  }

  const p = await browser.newPage({ viewport: { width: 390, height: 900 } });
  try {
    await p.goto(`${base}/`);
    await p.locator(".overview-page.is-opening").waitFor({ state: "detached", timeout: 6000 });
    await p.locator(".atlas-journey").scrollIntoViewIfNeeded();
    await p.locator(".atlas-journey.is-playing").waitFor({ state: "attached", timeout: 3000 });
    await p.locator(".atlas-journey.is-playing").waitFor({ state: "detached", timeout: 6500 });
    await p.reload();
    await checkHeroAndScrollJourney(p, "seen flag", false, false);
    await p.getByRole("button", { name: "Replay animation" }).click();
    assert.equal(await p.locator(".atlas-journey.is-playing").count(), 1, "manual replay starts journey");
    assert.ok(
      await p.evaluate(() => document.getAnimations().some(a => a.animationName?.startsWith("atlas-"))),
      "replay must start atlas animation"
    );
    await p.screenshot({ path: `${out}/replay-mobile.png`, animations: "allow" });
    await p.keyboard.press("Tab");
    await p.locator(".atlas-journey.is-playing").waitFor({ state: "detached", timeout: 2000 });
    await p.getByRole("button", { name: "Replay animation" }).focus();
    await p.keyboard.press("Enter");
    assert.equal(await p.locator(".atlas-journey.is-playing").count(), 1);
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.locator(".atlas-journey.is-playing").waitFor({ state: "detached", timeout: 2000 });
    await p.getByRole("button", { name: "Replay animation" }).click();
    assert.equal(await p.locator(".atlas-journey.is-playing").count(), 0, "reduced replay remains static");
    results.push({ label: "replay-keyboard-reduced-switch", status: "PASS" });
  } catch (e) {
    results.push({ label: "replay-keyboard-reduced-switch", status: "FAIL", error: String(e.stack ?? e) });
  } finally {
    await p.close();
  }

  const focus = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });
  try {
    await focus.goto(`${base}/`);
    await focus.locator(".preview-replay").scrollIntoViewIfNeeded();
    await focus.locator(".preview-replay").waitFor();
    await tabToReplay(focus);
    await focus.evaluate(() => {
      window.__replayFocusAnchor = document.querySelector(".preview-replay");
    });
    assert.equal(await stillFocusedOnSameReplay(focus), true, "Tab must focus Replay");
    await focus.keyboard.press("Enter");
    assert.equal(await focus.locator(".atlas-journey.is-playing").count(), 1, "Enter must replay");
    assert.equal(await stillFocusedOnSameReplay(focus), true, "Enter must not detach the focused node");
    assert.ok(
      await focus.evaluate(() => document.getAnimations().some(a => a.animationName === "atlas-trace")),
      "Enter replay must animate SVG trace"
    );
    await focus.evaluate(() => {
      window.__firstReplayPath = document.querySelector(".atlas-journey-path");
    });
    await focus.keyboard.press("Enter");
    assert.equal(await stillFocusedOnSameReplay(focus), true, "rapid Enter must preserve DOM identity and focus");
    assert.equal(await focus.locator(".atlas-journey.is-playing").count(), 1);
    assert.equal(
      await focus.evaluate(() => document.querySelector(".atlas-journey-path") !== window.__firstReplayPath),
      true,
      "rapid replay must reconstruct the animated pathway SVG"
    );
    await focus.keyboard.press("Tab");
    await focus.locator(".atlas-journey.is-playing").waitFor({ state: "detached", timeout: 2000 });
    assert.equal(
      await focus.evaluate(() => document.activeElement !== document.body),
      true,
      "Tab interruption must not land on BODY"
    );
    await focus.keyboard.press("Shift+Tab");
    assert.equal(await stillFocusedOnSameReplay(focus), true, "Shift+Tab returns to persistent Replay");
    await focus.keyboard.press("Enter");
    assert.equal(await stillFocusedOnSameReplay(focus), true);
    await focus.emulateMedia({ reducedMotion: "reduce" });
    await focus.locator(".atlas-journey.is-playing").waitFor({ state: "detached", timeout: 2000 });
    assert.equal(await stillFocusedOnSameReplay(focus), true, "motion preference switch preserves keyboard focus");
    await focus.keyboard.press("Enter");
    assert.equal(await focus.locator(".atlas-journey.is-playing").count(), 0, "reduced replay remains static");
    assert.equal(await stillFocusedOnSameReplay(focus), true);
    await focus.emulateMedia({ reducedMotion: "no-preference" });
    await focus.keyboard.press("Enter");
    assert.equal(await focus.locator(".atlas-journey.is-playing").count(), 1);
    assert.equal(await stillFocusedOnSameReplay(focus), true);
    results.push({ label: "keyboard-replay-focus-identity", status: "PASS" });
  } catch (e) {
    results.push({ label: "keyboard-replay-focus-identity", status: "FAIL", error: String(e.stack ?? e) });
  } finally {
    await focus.close();
  }

  const p2 = await browser.newContext();
  await p2.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("blocked");
      }
    });
  });
  const blockedPage = await p2.newPage();
  await blockedPage.setViewportSize({ width: 1280, height: 800 });
  try {
    await blockedPage.goto(`${base}/`);
    await checkHeroAndScrollJourney(blockedPage, "blocked storage initial", false, false);
    await blockedPage.getByRole("button", { name: "Replay animation" }).click();
    assert.equal(await blockedPage.locator(".atlas-journey.is-playing").count(), 1, "blocked storage manual replay");
    await blockedPage.keyboard.press("Tab");
    await blockedPage.locator(".atlas-journey.is-playing").waitFor({ state: "detached", timeout: 2000 });
    results.push({ label: "blocked-storage-interrupt", status: "PASS" });
  } catch (e) {
    results.push({ label: "blocked-storage-interrupt", status: "FAIL", error: String(e.stack ?? e) });
  } finally {
    await p2.close();
  }

  for (const url of ["/?review=1", "/#context", "/burden"]) {
    const q = await browser.newPage({ viewport: { width: 768, height: 900 } });
    try {
      await q.goto(`${base}${url}`);
      assert.equal(await q.locator(".overview-page.is-opening").count(), 0);
      assert.equal(await q.locator(".atlas-journey.is-playing").count(), 0);
      if (url !== "/burden") await checkHeroAndScrollJourney(q, `direct ${url}`, false, false);
      results.push({ label: `direct ${url}`, status: "PASS" });
    } catch (e) {
      results.push({ label: `direct ${url}`, status: "FAIL", error: String(e.stack ?? e) });
    } finally {
      await q.close();
    }
  }

  const zoom = await browser.newPage({ viewport: { width: 720, height: 900 }, reducedMotion: "reduce" });
  try {
    await zoom.goto(`${base}/`);
    await zoom.locator(".atlas-journey").waitFor();
    await zoom.evaluate(() => {
      document.documentElement.style.zoom = "200%";
    });
    const g = await zoom.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      display: getComputedStyle(document.querySelector(".atlas-journey")).display
    }));
    assert.ok(g.width <= g.viewport + 2, JSON.stringify(g));
    assert.notEqual(g.display, "none");
    await zoom.screenshot({ path: `${out}/200percent-zoom.png` });
    results.push({ label: "200percent-zoom", status: "PASS", g });
  } catch (e) {
    results.push({ label: "200percent-zoom", status: "FAIL", error: String(e.stack ?? e) });
  } finally {
    await zoom.close();
  }
} finally {
  await browser.close();
}

await writeFile(`${out}/results.json`, JSON.stringify({ sha: process.env.QA_SHA, results }, null, 2));
console.log(JSON.stringify(results.map(({ label, status, error }) => ({ label, status, error }))));
if (results.some(r => r.status !== "PASS")) process.exitCode = 1;
