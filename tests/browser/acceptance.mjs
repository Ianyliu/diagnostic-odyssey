/* global process, console, window, document, innerWidth, innerHeight, getComputedStyle, performance, Event, MutationObserver, NodeFilter */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const { chromium } = require("playwright");
const axe = require("axe-core");
const playwrightVersion = require("playwright/package.json").version;
const baseURL = process.env.QA_BASE_URL ?? "http://127.0.0.1:4175";
const output = process.env.QA_OUTPUT ?? "/tmp/diagnostic-browser-baseline";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const browserVersion = browser.version();
const filter = process.env.QA_FILTER ? new RegExp(process.env.QA_FILTER) : null;
const matrix = [];
const snapshots = {};
async function check(name, body) {
  if (filter && !filter.test(name)) return;
  const start = Date.now();
  try {
    const details = await body();
    matrix.push({ name, status: "PASS", ms: Date.now() - start, details });
  } catch (error) {
    matrix.push({
      name,
      status: "FAIL",
      ms: Date.now() - start,
      error: String(error.stack ?? error),
    });
  }
  for (const context of browser.contexts()) await context.close();
  await writeFile(
    `${output}/qa-results.json`,
    JSON.stringify(
      {
        baseURL,
        browserVersion,
        playwrightVersion,
        axeVersion: axe.version,
        matrix,
        snapshots,
      },
      null,
      2,
    ),
  );
}
async function ready(page, path = "/") {
  await page.goto(`${baseURL}${path}`);
  await page.locator("main h1").waitFor();
  await page
    .locator("main")
    .getByText("Something went wrong", { exact: false })
    .count()
    .then((n) => assert.equal(n, 0));
}
async function navigate(page, name) {
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  if (!(await nav.isVisible()))
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  await nav.getByRole("link", { name, exact: true }).click();
  await page.locator("main h1").waitFor();
}
async function assertThemeColor(page, expectedTheme) {
  if (expectedTheme) {
    await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, expectedTheme);
  }
  assert.equal(await page.locator('meta[name="theme-color"]').count(), 1);
  const colors = await page.evaluate(() => ({
    metadata: document.querySelector('meta[name="theme-color"]').content,
    canvas: getComputedStyle(document.documentElement).getPropertyValue("--do-canvas").trim(),
  }));
  assert.equal(colors.metadata, colors.canvas);
}
async function exportBrief(page, filename) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON companion" }).click();
  const file = await download;
  await file.saveAs(`${output}/${filename}.json`);
  const parsed = JSON.parse(
    await readFile(`${output}/${filename}.json`, "utf8"),
  );
  if (parsed.scenario) {
    for (const [section, keys] of Object.entries({
      input: [
        "eligible_population", "reach", "capacity", "baseline_window_months",
        "alternative_window_months", "horizon_months", "fixed_cost", "per_participant_cost",
      ],
      result: [
        "intended_reach", "reached_participants", "capacity_gap", "baseline_person_months",
        "alternative_person_months", "difference_person_months", "fixed_program_cost",
        "variable_program_cost", "program_resource_requirement",
      ],
    })) {
      for (const key of keys) {
        const value = parsed.scenario[section]?.[key];
        assert.ok(
          typeof value === "number" && Number.isFinite(value),
          `Invalid or missing JSON scenario ${section}.${key}: ${value}`,
        );
      }
    }
    const effect = parsed.scenario.result.bounded_effect;
    if (effect !== undefined) {
      assert.ok(effect && typeof effect === "object", "Invalid JSON bounded effect");
      for (const key of ["value_low", "value_high"]) {
        assert.ok(
          typeof effect[key] === "number" && Number.isFinite(effect[key]),
          `Invalid or missing JSON bounded effect ${key}: ${effect[key]}`,
        );
      }
    }
  }
  return parsed;
}
const routes = [
  "/",
  "/burden",
  "/burden/medical",
  "/burden/work",
  "/burden/admin",
  "/burden/human",
  "/local-context",
  "/pilot",
  "/evidence",
  "/data-requests",
  "/brief",
];
for (const [device, viewport] of Object.entries({
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 360, height: 800 },
}))
  for (const theme of ["light", "dark"])
    await check(`11 direct routes: ${device} ${theme}`, async () => {
      const context = await browser.newContext({
        viewport,
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      const details = [];
      for (const route of routes) {
        await ready(page, route);
        await assertThemeColor(page, theme);
        const overflow = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert.ok(
          overflow.scroll <= overflow.width + 1,
          `${route} horizontal overflow ${JSON.stringify(overflow)}`,
        );
        assert.equal(await page.locator("main h1").count(), 1);
        details.push({
          route,
          heading: await page.locator("main h1").innerText(),
          overflow,
        });
        if (["/", "/pilot", "/brief", "/local-context"].includes(route))
          await page.screenshot({
            path: `${output}/${device}-${theme}-${route === "/" ? "overview" : route.slice(1)}.png`,
            fullPage: true,
          });
      }
      assert.deepEqual(errors, []);
      await context.close();
      return details;
    });
await check(
  "history, keyboard skip link, mobile menu and anchor focus",
  async () => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await ready(page);
    await page.keyboard.press("Tab");
    assert.equal(
      await page.locator(":focus").innerText(),
      "Skip to main content",
    );
    const focus = await page
      .locator(":focus")
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    assert.notEqual(focus, "none");
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => document.activeElement?.id === "overview-title",
    );
    await navigate(page, "Burden");
    await navigate(page, "Pilot planner");
    await page.locator("#pilot-capacity").fill("2345");
    await page.goBack();
    assert.ok(page.url().endsWith("/burden"));
    await page
      .getByRole("heading", { name: "Burden overview", exact: true })
      .waitFor();
    await page.goForward();
    assert.ok(page.url().endsWith("/pilot"));
    await page
      .getByRole("heading", { name: "Scope a feasible pilot", exact: true })
      .waitFor();
    assert.equal(await page.locator("#pilot-capacity").inputValue(), "2345");
    await page
      .getByRole("navigation", { name: "Pilot planner sections" })
      .getByRole("link", { name: "Sensitivity", exact: true })
      .click();
    await page.waitForFunction(
      () => document.activeElement?.id === "sensitivity-title",
    );
    assert.ok(
      await page
        .locator("#sensitivity")
        .evaluate(
          (el) =>
            el.getBoundingClientRect().top >= 0 &&
            el.getBoundingClientRect().top < innerHeight,
        ),
    );
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(":focus").innerText(), "Menu");
    await context.close();
    return { focus };
  },
);
await check(
  "full explicit selection workflow, sensitivities, actual JSON, stale requests, print restoration",
  async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await ready(page, "/brief");
    const baseline = await exportBrief(page, "default-brief");
    snapshots.defaultBrief = baseline;
    assert.equal(baseline.burden_findings.length, 21);
    assert.equal(baseline.local_context.length, 0);
    assert.deepEqual(baseline.scenario.result, {
      scenario_id: "illustrative-navigation-pilot-default",
      intended_reach: 3000,
      reached_participants: 3000,
      capacity_gap: 0,
      baseline_person_months: 36000,
      alternative_person_months: 18000,
      difference_person_months: 18000,
      fixed_program_cost: 300000,
      variable_program_cost: 900000,
      program_resource_requirement: 1200000,
      target_pathway_step: "recognition-to-referral",
      target_mechanism: "navigation-support",
    });
    await navigate(page, "Burden");
    assert.ok((await page.getByText("95%", { exact: false }).count()) > 0);
    await navigate(page, "Local context");
    await page.getByRole("checkbox").filter({ visible: true }).first().check();
    await page
      .getByRole("button", { name: /^Use .* in Pilot planning$/ })
      .first()
      .click();
    await navigate(page, "Pilot planner");
    await page.getByLabel("Test assumption").selectOption("capacity");
    await page
      .getByText("View sensitivity values as a table", { exact: true })
      .click();
    snapshots.capacitySensitivity = await page
      .locator("#sensitivity tbody tr")
      .allTextContents();
    assert.deepEqual(snapshots.capacitySensitivity, [
      "1,5001,5001,500",
      "2,2507502,250",
      "3,00003,000",
      "3,75003,000",
      "4,50003,000",
    ]);
    await page.getByLabel("Test assumption").selectOption("reach");
    snapshots.reachSensitivity = await page
      .locator("#sensitivity tbody tr")
      .allTextContents();
    assert.deepEqual(snapshots.reachSensitivity, [
      "15% (0.15)01,800",
      "20% (0.2)02,400",
      "25% (0.25)03,000",
      "30% (0.3)6003,000",
      "35% (0.35)1,2003,000",
    ]);
    await page
      .getByLabel("Test assumption")
      .selectOption("alternative_window_months");
    snapshots.windowSensitivity = await page
      .locator("#sensitivity tbody tr")
      .allTextContents();
    assert.deepEqual(snapshots.windowSensitivity, [
      "4 mo24,0003,000",
      "5 mo21,0003,000",
      "6 mo18,0003,000",
      "7 mo15,0003,000",
      "8 mo12,0003,000",
    ]);
    await page.getByLabel("Test assumption").selectOption("capacity");
    await page
      .getByRole("button", { name: "Add to data requests", exact: true })
      .click();
    await navigate(page, "Data requests");
    const request = page
      .locator(".data-request-sheet")
      .filter({ hasText: "SESSION PLANNING REQUEST" });
    assert.equal(await request.count(), 1);
    assert.equal(await request.getByRole("checkbox").isChecked(), false);
    await request.getByRole("checkbox").check();
    await navigate(page, "Planning brief");
    const selected = await exportBrief(page, "selected-brief");
    assert.equal(selected.local_context.length, 1);
    assert.equal(selected.data_requests.length, 1);
    assert.deepEqual(selected.burden_findings, baseline.burden_findings);
    assert.deepEqual(selected.scenario.result, baseline.scenario.result);
    await navigate(page, "Pilot planner");
    await page.locator("#pilot-capacity").fill("2000");
    await navigate(page, "Data requests");
    await page
      .getByText("Stale for applied scenario", { exact: true })
      .waitFor();
    await navigate(page, "Planning brief");
    const stale = await exportBrief(page, "stale-brief");
    assert.equal(stale.data_requests.length, 0);
    assert.ok(stale.warnings.some((w) => /stale/i.test(w)));
    await navigate(page, "Data requests");
    await page.getByRole("button", { name: "Refresh data request" }).click();
    await navigate(page, "Planning brief");
    const refreshed = await exportBrief(page, "refreshed-brief");
    assert.equal(refreshed.data_requests.length, 1);
    assert.equal(refreshed.scenario.result.reached_participants, 2000);
    snapshots.selectedBrief = selected;
    snapshots.staleBrief = stale;
    snapshots.refreshedBrief = refreshed;
    const details = page.locator("main details");
    const before = await details.evaluateAll((els) => els.map((e) => e.open));
    await page.evaluate(() => {
      window.print = () => {
        window.dispatchEvent(new Event("beforeprint"));
      };
    });
    await page.getByRole("button", { name: "Print / save PDF" }).click();
    assert.ok(
      (await details.evaluateAll((els) => els.map((e) => e.open))).every(
        Boolean,
      ),
    );
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: `${output}/planning-brief.pdf`,
      format: "Letter",
      printBackground: true,
    });
    await page.screenshot({
      path: `${output}/brief-print.png`,
      fullPage: true,
    });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    assert.deepEqual(
      await details.evaluateAll((els) => els.map((e) => e.open)),
      before,
    );
    await page.emulateMedia({ media: "screen" });
    await context.close();
    return {
      national: 21,
      local: 1,
      requests: 1,
      sensitivity: snapshots.capacitySensitivity,
    };
  },
);
for (const [name, script] of Object.entries({
  missingMatchMedia: () => {
    window.matchMedia = undefined;
  },
  incompleteMatchMedia: () => {
    window.matchMedia = () => ({ matches: false, media: "", onchange: null });
  },
  throwingMatchMedia: () => {
    window.matchMedia = () => {
      throw new Error("blocked media query");
    };
  },
  blockedStorage: () => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("denied");
      },
    });
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
  },
}))
  await check(`browser API fallback: ${name}`, async () => {
    const context = await browser.newContext();
    await context.addInitScript(script);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await ready(page, "/");
    await ready(page, "/brief");
    await assertThemeColor(page);
    assert.deepEqual(errors, []);
    await context.close();
  });
await check("appearance persistence and reduced motion opening", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await ready(page);
  assert.equal(
    await page.locator(".overview-provenance.is-playing").count(),
    0,
  );
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await assertThemeColor(page, "dark");
  await page.reload();
  await page.locator("main h1").waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await assertThemeColor(page, "dark");
  await context.close();
});

await check("browser theme color follows bootstrap, explicit preferences, system changes and other tabs", async () => {
  // Prevent React from running so this exercises the actual pre-render bootstrap.
  for (const [preference, system, expected] of [
    ["system", "light", "light"], ["system", "dark", "dark"],
    ["dark", "light", "dark"], ["light", "dark", "light"],
  ]) {
    const context = await browser.newContext({colorScheme: system});
    await context.addInitScript(preference => {
      window.localStorage.setItem("diagnostic-odyssey.theme", preference);
    }, preference);
    await context.route("**/assets/*.js", route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(baseURL);
    await assertThemeColor(page, expected);
    await context.close();
  }

  const context = await browser.newContext({colorScheme: "light", reducedMotion: "reduce"});
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await ready(page);
  await assertThemeColor(page, "light");
  await page.emulateMedia({colorScheme: "dark"});
  await assertThemeColor(page, "dark");
  await page.getByLabel("Appearance", {exact: true}).selectOption("light");
  await assertThemeColor(page, "light");
  await page.emulateMedia({colorScheme: "light"});
  await page.emulateMedia({colorScheme: "dark"});
  await assertThemeColor(page, "light");
  await page.reload();
  await page.locator("main h1").waitFor();
  await assertThemeColor(page, "light");

  const other = await context.newPage();
  await ready(other);
  await other.getByLabel("Appearance", {exact: true}).selectOption("dark");
  await assertThemeColor(page, "dark");
  await other.getByLabel("Appearance", {exact: true}).selectOption("system");
  await assertThemeColor(page, "dark");
  await page.emulateMedia({colorScheme: "light"});
  await assertThemeColor(page, "light");
  await context.close();
});

await check(
  "invalid numeric drafts preserve last applied scenario and JSON",
  async () => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await ready(page, "/pilot");
    await page.locator("#pilot-reach").fill("1e-1000000000");
    await page.getByText("Draft not applied", { exact: true }).waitFor();
    await navigate(page, "Planning brief");
    const tiny = await exportBrief(page, "invalid-tiny-draft");
    assert.equal(tiny.scenario.input.reach, 0.25);
    await navigate(page, "Pilot planner");
    await page.locator("#pilot-fixed_cost").fill("1e308");
    await page.locator("#pilot-per_participant_cost").fill("1e308");
    await page.getByText("Draft not applied", { exact: true }).waitFor();
    await navigate(page, "Planning brief");
    const overflow = await exportBrief(page, "invalid-overflow-draft");
    assert.equal(overflow.scenario.input.per_participant_cost, 300);
    await navigate(page, "Pilot planner");
    await page.locator("#pilot-reach").fill("0");
    assert.equal(
      await page.locator("#pilot-reach").getAttribute("aria-invalid"),
      "false",
    );
    await navigate(page, "Planning brief");
    const zero = await exportBrief(page, "zero-reach");
    assert.equal(zero.scenario.input.reach, 0);
    assert.equal(zero.scenario.result.reached_participants, 0);
    await context.close();
  },
);
await check("extreme finite scenario layout and invalid sensitivity remain usable", async () => {
  const layouts = [];
  for (const width of [1440, 820, 360]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 }, colorScheme: theme,
        reducedMotion: "reduce", acceptDownloads: true,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await ready(page, "/pilot");
      const assertScientificTokens = async (selector, scenarioLabel) => {
        const tokens = await page.locator(selector).evaluateAll((elements) => elements.flatMap(element => {
          const bounds = element.parentElement.getBoundingClientRect();
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const found = [];
          while (walker.nextNode()) {
            const node = walker.currentNode;
            for (const match of node.textContent.matchAll(/\$?\d+(?:\.\d+)?e[+-]?\d+/gi)) {
              const range = document.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
              found.push({ text: match[0], lines: new Set(rects.map(rect => Math.round(rect.top))).size,
                contained: rects.every(rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1) });
            }
          }
          return found;
        }));
        assert.ok(tokens.length > 0, `No scientific tokens in ${scenarioLabel}: ${selector}`);
        for (const token of tokens) {
          assert.equal(token.lines, 1, `Scientific token split (${scenarioLabel}, ${width}px, ${theme}): ${JSON.stringify(token)}`);
          assert.ok(token.contained, `Scientific token exceeds its row (${scenarioLabel}, ${width}px, ${theme}): ${JSON.stringify(token)}`);
        }
        return tokens;
      };
      await page.locator("#pilot-fixed_cost").fill("1e308");
      assert.equal(await page.locator("#pilot-fixed_cost").getAttribute("aria-invalid"), "false");
      const assertResourceToken = async (fixedCost) => {
        const token = await page.locator('.decision-visual[aria-labelledby="resource-composition-title"] .visual-headline').evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
          const parent = element.parentElement.getBoundingClientRect();
          return {
            text: element.textContent,
            lines: new Set(rects.map(rect => Math.round(rect.top))).size,
            contained: rects.every(rect => rect.left >= parent.left - 1 && rect.right <= parent.right + 1),
          };
        });
        assert.equal(token.lines, 1, `Scientific resource token split across lines (${fixedCost}, ${width}px, ${theme}): ${JSON.stringify(token)}`);
        assert.ok(token.contained, `Scientific resource token exceeds its heading (${fixedCost}, ${width}px, ${theme}): ${JSON.stringify(token)}`);
        return token;
      };
      const scientificToken = await assertResourceToken("1e308");
      const scientificLedgerTokens = await assertScientificTokens(".pilot-result-ledger dd", "1e308 cost Pilot");
      for (const route of ["pilot", "brief"]) {
        if (route === "brief") await navigate(page, "Planning brief");
        const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        layouts.push({ route, theme, ...layout });
        await page.screenshot({ path: `${output}/extreme-${route}-${width}-${theme}.png` });
        assert.ok(layout.scroll <= layout.width + 1, `Extreme finite ${route} ${theme} overflow: ${JSON.stringify(layout)}`);
      }
      const brief = await exportBrief(page, `extreme-finite-${width}-${theme}`);
      const scientificBriefTokens = await assertScientificTokens(".brief-applied-assumptions dd, .brief-output-list dd", "1e308 cost Brief");
      assert.equal(brief.scenario.input.fixed_cost, 1e308);
      assert.equal(brief.scenario.result.fixed_program_cost, 1e308);
      await navigate(page, "Pilot planner");
      await page.locator("#pilot-fixed_cost").fill(String(Number.MAX_VALUE));
      assert.equal(await page.locator("#pilot-fixed_cost").getAttribute("aria-invalid"), "false");
      const maxScientificToken = await assertResourceToken("Number.MAX_VALUE");
      const maxLedgerTokens = await assertScientificTokens(".pilot-result-ledger dd", "MAX cost Pilot");
      await page.screenshot({ path: `${output}/extreme-max-pilot-${width}-${theme}.png` });
      const maxLayout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(maxLayout.scroll <= maxLayout.width + 1, `MAX_VALUE resource page overflow: ${JSON.stringify(maxLayout)}`);
      await navigate(page, "Planning brief");
      const maxBrief = await exportBrief(page, `extreme-max-cost-${width}-${theme}`);
      const maxBriefTokens = await assertScientificTokens(".brief-applied-assumptions dd, .brief-output-list dd", "MAX cost Brief");
      const maxBriefLayout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(maxBriefLayout.scroll <= maxBriefLayout.width + 1, `MAX_VALUE resource Brief overflow: ${JSON.stringify(maxBriefLayout)}`);
      assert.equal(maxBrief.scenario.input.fixed_cost, Number.MAX_VALUE);
      assert.equal(maxBrief.scenario.result.fixed_program_cost, Number.MAX_VALUE);
      layouts.push({ width, theme, scientificToken, scientificLedgerTokens, scientificBriefTokens, maxScientificToken, maxLedgerTokens, maxBriefTokens, maxLayout, maxBriefLayout });
      await navigate(page, "Pilot planner");
      await page.locator("#pilot-fixed_cost").fill("1e308");
      await page.locator("#pilot-capacity").fill(String(Number.MAX_VALUE));
      assert.equal(await page.locator("#pilot-capacity").getAttribute("aria-invalid"), "false");
      await page.getByLabel("Test assumption").selectOption("capacity");
      await page.locator("#sensitivity .field-error[role=status]").waitFor();
      assert.equal(await page.locator("#sensitivity tbody tr").count(), 0);
      assert.equal(await page.locator("#sensitivity .sensitivity-action").count(), 0);
      assert.equal(await page.getByText("Draft not applied", { exact: true }).count(), 0);
      await navigate(page, "Planning brief");
      const capacityBrief = await exportBrief(page, `extreme-capacity-${width}-${theme}`);
      assert.equal(capacityBrief.scenario.input.capacity, Number.MAX_VALUE);
      assert.equal(capacityBrief.scenario.result.reached_participants, 3000);
      await navigate(page, "Pilot planner");
      for (const [key, value] of Object.entries({ fixed_cost: "0", per_participant_cost: "0", baseline_window_months: "0", alternative_window_months: "0", horizon_months: "0", reach: "100", eligible_population: String(Number.MAX_VALUE) })) {
        await page.locator(`#pilot-${key}`).fill(value);
      }
      assert.equal(await page.getByText("Draft not applied", { exact: true }).count(), 0);
      const maxReachedPilotTokens = await assertScientificTokens(".pilot-result-ledger dd", "MAX reached Pilot");
      const maxReachedPilotLayout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(maxReachedPilotLayout.scroll <= maxReachedPilotLayout.width + 1, `MAX reached Pilot overflow: ${JSON.stringify(maxReachedPilotLayout)}`);
      await page.screenshot({ path: `${output}/extreme-max-reached-pilot-${width}-${theme}.png` });
      await navigate(page, "Planning brief");
      const maxReachedBriefTokens = await assertScientificTokens(".brief-applied-assumptions dd, .brief-output-list dd", "MAX reached Brief");
      const maxReachedBriefLayout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(maxReachedBriefLayout.scroll <= maxReachedBriefLayout.width + 1, `MAX reached Brief overflow: ${JSON.stringify(maxReachedBriefLayout)}`);
      const maxReached = await exportBrief(page, `extreme-max-reached-${width}-${theme}`);
      assert.equal(maxReached.scenario.input.eligible_population, Number.MAX_VALUE);
      assert.equal(maxReached.scenario.input.capacity, Number.MAX_VALUE);
      assert.equal(maxReached.scenario.input.reach, 1);
      assert.equal(maxReached.scenario.result.reached_participants, Number.MAX_VALUE);
      assert.equal(maxReached.scenario.result.baseline_person_months, 0);
      assert.equal(maxReached.scenario.result.program_resource_requirement, 0);
      layouts.push({width, theme, maxReachedPilotTokens, maxReachedBriefTokens, maxReachedPilotLayout, maxReachedBriefLayout});
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
  return { layouts };
});
for (const theme of ["light", "dark"])
  await check(`rendered WCAG accessibility: ${theme}`, async () => {
    const context = await browser.newContext({
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const results = [];
    for (const route of routes) {
      await ready(page, route);
      await page.addScriptTag({ content: axe.source });
      const result = await page.evaluate(() =>
        axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        }),
      );
      results.push({
        route,
        violations: result.violations,
        incomplete: result.incomplete.map(({ id, nodes }) => ({
          id,
          count: nodes.length,
        })),
      });
    }
    await writeFile(
      `${output}/axe-${theme}.json`,
      JSON.stringify(results, null, 2),
    );
    const violations = results.flatMap((r) =>
      r.violations.map((v) => ({
        route: r.route,
        id: v.id,
        impact: v.impact,
        count: v.nodes.length,
      })),
    );
    assert.deepEqual(violations, []);
    await context.close();
    return results.map((r) => ({ route: r.route, incomplete: r.incomplete }));
  });

// Deliberately corrupt only the browser response, never reviewed files on disk.
for (const [layer, marker] of Object.entries({
  national:
    'artifact_version:"meps-2024-long-covid-candidate-20260926T011343Z"',
  local:
    'artifact_version:"local-context-wv-hrsa-acs-candidate-20260924T052332Z"',
}))
  await check(`rendered fail-closed artifact error: ${layer}`, async () => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    let replaced = false;
    await page.route("**/assets/*.js", async (route) => {
      const response = await route.fetch();
      const original = await response.text();
      const modified = original.replace(
        marker,
        'artifact_version:"invalid-browser-test-version"',
      );
      replaced ||= modified !== original;
      await route.fulfill({ response, body: modified });
    });
    await page.goto(
      `${baseURL}${layer === "national" ? "/burden" : "/local-context"}`,
    );
    await page.getByRole("alert").waitFor();
    assert.ok(
      replaced,
      "Reviewed bundle marker not found; update fault injection",
    );
    if (layer === "national") {
      // The export route must also fail closed, not only the burden route.
      await page.goto(`${baseURL}/brief`);
      await page.getByRole("alert").waitFor();
      await page
        .getByRole("heading", {
          name: "The analytical artifact could not be loaded.",
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Export JSON companion" })
          .count(),
        0,
      );
    } else {
      await page
        .getByText("Reviewed local implementation context is unavailable.", {
          exact: true,
        })
        .waitFor();
      await navigate(page, "Planning brief");
      const brief = await exportBrief(page, "unavailable-local-context");
      assert.equal(brief.local_context.length, 0);
      assert.equal(brief.burden_findings.length, 21);
    }
    await page.screenshot({
      path: `${output}/error-${layer}.png`,
      fullPage: true,
    });
    await context.close();
  });
await check(
  "initial loading DOM commit before synchronous artifact validation",
  async () => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.addInitScript(() => {
      window.__qaLoadingObserved = false;
      const observer = new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes) {
            if (
              node.nodeType === 1 &&
              node.textContent.includes("Validating the evidence workspace")
            )
              window.__qaLoadingObserved = true;
          }
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await ready(page);
    assert.equal(await page.evaluate(() => window.__qaLoadingObserved), true);
    await context.close();
    return {
      note: "Initial loading DOM committed; bundled artifacts validate synchronously, so no persistent loading paint is claimed.",
    };
  },
);
await check(
  "opening animation settles, does not replay, and respects motion changes",
  async () => {
    const context = await browser.newContext({
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await ready(page);
    assert.equal(
      await page.locator(".overview-provenance.is-playing").count(),
      1,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      () => !document.querySelector(".overview-provenance.is-playing"),
    );
    await page.reload();
    await page.locator("main h1").waitFor();
    assert.equal(
      await page.locator(".overview-provenance.is-playing").count(),
      0,
    );
    await context.close();
  },
);
await check(
  "media-query subscriptions clean up across Brief navigation",
  async () => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.__qaMediaListeners = [];
      window.matchMedia = (query) => {
        const media = original(query);
        const active = new Set();
        window.__qaMediaListeners.push({ query, active });
        const add = media.addEventListener.bind(media);
        const remove = media.removeEventListener.bind(media);
        media.addEventListener = (type, listener, ...rest) => {
          if (type === "change") active.add(listener);
          return add(type, listener, ...rest);
        };
        media.removeEventListener = (type, listener, ...rest) => {
          if (type === "change") active.delete(listener);
          return remove(type, listener, ...rest);
        };
        return media;
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await ready(page, "/brief");
    const counts = () =>
      page.evaluate(() =>
        window.__qaMediaListeners.reduce(
          (counts, { query, active }) => ({
            ...counts,
            [query]: (counts[query] ?? 0) + active.size,
          }),
          {},
        ),
      );
    for (let i = 0; i < 3; i++) {
      assert.equal((await counts()).print, 1);
      await navigate(page, "Pilot planner");
      assert.equal((await counts()).print, 0);
      await navigate(page, "Planning brief");
    }
    assert.equal((await counts())["(prefers-color-scheme: dark)"], 1);
    await context.close();
  },
);
async function tabTo(page, target, reverse = false) {
  for (let index = 0; index < 180; index++) {
    await page.keyboard.press(reverse ? "Shift+Tab" : "Tab");
    if (await target.evaluate((el) => document.activeElement === el)) return;
  }
  throw new Error("Keyboard target was unreachable in the tab sequence");
}
await check(
  "keyboard-only selections, scenario control, request opt-in and JSON export",
  async () => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      acceptDownloads: true,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await ready(page, "/local-context");
    const selection = page
      .getByRole("checkbox")
      .filter({ visible: true })
      .first();
    await tabTo(page, selection);
    await page.keyboard.press("Space");
    assert.equal(await selection.isChecked(), true);
    const pilotContext = page
      .getByRole("button", { name: /^Use .* in Pilot planning$/ })
      .first();
    await tabTo(page, pilotContext);
    await page.keyboard.press("Enter");
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await tabTo(
      page,
      nav.getByRole("link", { name: "Pilot planner", exact: true }),
      true,
    );
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: "Scope a feasible pilot", exact: true })
      .waitFor();
    const capacity = page.locator("#pilot-capacity");
    await tabTo(page, capacity);
    assert.notEqual(
      await capacity.evaluate(
        (el) => getComputedStyle(el.closest(".input-wrap") ?? el).outlineStyle,
      ),
      "none",
    );
    await page.screenshot({ path: `${output}/keyboard-control-focus.png` });
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("2500");
    assert.equal(await capacity.inputValue(), "2500");
    const create = page.getByRole("button", {
      name: "Add to data requests",
      exact: true,
    });
    await tabTo(page, create);
    await page.keyboard.press("Enter");
    await tabTo(
      page,
      nav.getByRole("link", { name: "Data requests", exact: true }),
      true,
    );
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", {
        name: "Turn uncertainty into a concrete request",
        exact: true,
      })
      .waitFor();
    const request = page
      .locator(".data-request-sheet")
      .filter({ hasText: "SESSION PLANNING REQUEST" })
      .getByRole("checkbox");
    await tabTo(page, request);
    assert.equal(await request.isChecked(), false);
    await page.keyboard.press("Space");
    assert.equal(await request.isChecked(), true);
    await tabTo(
      page,
      nav.getByRole("link", { name: "Planning brief", exact: true }),
      true,
    );
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", {
        name: "Long COVID burden and pilot planning brief",
        exact: true,
      })
      .waitFor();
    const exportButton = page.getByRole("button", {
      name: "Export JSON companion",
    });
    await tabTo(page, exportButton);
    const download = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    const file = await download;
    await file.saveAs(`${output}/keyboard-brief.json`);
    const brief = JSON.parse(
      await readFile(`${output}/keyboard-brief.json`, "utf8"),
    );
    assert.equal(brief.local_context.length, 1);
    assert.equal(brief.data_requests.length, 1);
    assert.equal(brief.scenario.input.capacity, 2500);
    assert.equal(brief.scenario.result.reached_participants, 2500);
    assert.equal(brief.burden_findings.length, 21);
    await context.close();
    return { local: 1, requests: 1, capacity: 2500, national: 21 };
  },
);
await check("cold browser load measurements", async () => {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await ready(page, "/pilot");
    samples.push(
      await page.evaluate(() => ({
        navigation: performance.getEntriesByType("navigation")[0].toJSON(),
        paint: performance.getEntriesByType("paint").map((p) => p.toJSON()),
        resources: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes("/assets/"))
          .map((r) => r.toJSON()),
      })),
    );
    await context.close();
  }
  return samples;
});
await browser.close();
await writeFile(
  `${output}/qa-matrix.md`,
  [
    "# Rendered browser acceptance matrix",
    `Base URL: ${baseURL}`,
    `Browser: system Google Chrome ${browserVersion}; Playwright ${playwrightVersion}; axe ${axe.version}`,
    ...matrix.map(
      (r) =>
        `- ${r.status}: ${r.name}${r.status === "FAIL" ? ` — ${r.error.split("\n")[0]}` : ""}`,
    ),
  ].join("\n"),
);
console.log(
  JSON.stringify(
    matrix.map(({ name, status, error }) => ({
      name,
      status,
      error: error?.split("\n")[0],
    })),
    null,
    2,
  ),
);
process.exitCode = matrix.some((r) => r.status === "FAIL") ? 1 : 0;
