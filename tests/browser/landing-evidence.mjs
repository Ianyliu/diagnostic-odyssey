/* global process */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const { chromium } = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url)("playwright");
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4175";
const output = process.env.QA_OUTPUT ?? "/tmp/landing-evidence";
const target = /\{"estimate_id":"meps24-healthcare-paperwork-time-mean",[\s\S]*?(?=,\{"estimate_id":)/;
const fixtures = [
  ["reviewed", null],
  ["missing", (source, record) => source.replace(record + ",", "")],
  ["preliminary", (source, record) => source.replace(record, record.replace('"release_status":"reviewed_released"', '"release_status":"preliminary"'))],
  ["point-only", (source, record) => source.replace(record, record.replace(/"interval_(low|high)":[^,]+/g, '"interval_$1":null'))]
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const results = [];
try {
  for (const [fixture, modify] of fixtures) {
    for (const width of [1440, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      let changed = false;
      try {
        if (modify) {
          await page.route("**/assets/*.js", async route => {
            const response = await route.fetch();
            const source = await response.text();
            const record = source.match(target)?.[0];
            const body = record ? modify(source, record) : source;
            changed ||= body !== source;
            await route.fulfill({ response, body });
          });
        }
        await page.goto(base);
        const beat = page.locator('[data-beat-id="2"]');
        const layer = page.locator(".strata-layer.is-admin");
        await beat.scrollIntoViewIfNeeded();
        assert.equal(changed, Boolean(modify), "fixture must exercise the built public bundle");
        const available = fixture === "reviewed" || fixture === "point-only";
        const figure = available ? "24.5 hrs" : "Estimate unavailable";
        for (const item of [beat, layer]) {
          assert.equal(await item.locator(".strata-whisker-point").count(), Number(available));
          assert.equal(await item.locator(".strata-whisker-range").count(), Number(fixture === "reviewed"));
          assert.equal(await item.locator(".atlas-beat-scale, .strata-layer-foot").count(), Number(available));
          assert.equal(await item.locator(".atlas-beat-figure, .strata-layer-val").textContent(), figure);
          assert.doesNotMatch(await item.textContent(), /^95% CI$/m);
        }
        assert.equal(await beat.isVisible(), true);
        assert.equal(await layer.isVisible(), width === 1440);
        assert.match(await beat.textContent(), /Survey-weighted mean annualized.*ESAQ respondents, ages 18–64.*earlier 2024 Round 3\/1/s);
        assert.match(await page.locator('[data-beat-id="3"]').textContent(), /PSAQ respondents, ages 18–64.*earlier 2024 Round 3\/1/s);
        assert.match(await page.locator(".strata-layer.is-distress").textContent(), /100%/);
        if (fixture === "reviewed") {
          assert.match(await beat.textContent(), /12\.8–36\.2 hours\/person\/year/);
          assert.match(await beat.textContent(), /median: 3 hours.*0–12 annualized hours/s);
        }
        if (fixture === "point-only") {
          assert.equal(await beat.locator(".atlas-beat-ci").count(), 0);
        }
        await page.screenshot({ path: `${output}/${fixture}-${width}.png` });
        results.push({ fixture, width, point: available, interval: fixture === "reviewed" });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
