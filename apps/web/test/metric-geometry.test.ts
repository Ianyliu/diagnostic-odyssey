import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Estimate, LocalContextRecord } from "@diagnostic-odyssey/contracts";
import {
  getBurdenScaleDomain,
  getLocalContextScaleDomain,
  metricAriaDescription,
  metricGeometry
} from "../src/data/metricGeometry.ts";

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

const bundle = JSON.parse(
  readFileSync(
    new URL("../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json", import.meta.url),
    "utf8"
  )
) as { burden_domains: Array<{ measures: Estimate[] }> };
const allEstimates = bundle.burden_domains.flatMap(d => d.measures);

const local = JSON.parse(
  readFileSync(
    new URL("../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json", import.meta.url),
    "utf8"
  )
) as { indicators: LocalContextRecord[] };
const allLocal = local.indicators;

test("subpixel-width CI is not extended across a forced visual minimum", () => {
  const g = metricGeometry(0.4000005, "proportion", 0.4, 0.400001);
  close(g.intervalLeftPercent, 40);
  close(g.intervalWidthPercent, 0.0001);
  close(g.intervalMidpointPercent, 40.00005);
  assert.equal(g.narrowInterval, true);
  assert.equal(g.hasInterval, true);
  const aria = metricAriaDescription({
    label: "Synthetic",
    value: 0.4000005,
    unit: "proportion",
    low: 0.4,
    high: 0.400001,
    intervalLabel: "95% CI",
    narrowInterval: g.narrowInterval
  });
  assert.match(aria, /95% CI 40% to 40\.0001%/);
  assert.match(aria, /tick marks its position/);
});

test("ordinary CI uses exact rendered end-to-end width on 0–100% axis", () => {
  const g = metricGeometry(0.35, "proportion", 0.2, 0.5);
  close(g.min, 0);
  close(g.max, 1);
  close(g.pointPercent, 35);
  close(g.intervalLeftPercent, 20);
  close(g.intervalWidthPercent, 30);
  assert.equal(g.narrowInterval, false);
  assert.match(
    metricAriaDescription({
      label: "Ordinary",
      value: 0.35,
      unit: "proportion",
      low: 0.2,
      high: 0.5,
      intervalLabel: "95% CI"
    }),
    /95% CI 20% to 50%/
  );
});

test("true zero-length interval becomes a tick, but absent interval is never synthesized", () => {
  const same = metricGeometry(0.4, "proportion", 0.4, 0.4);
  assert.equal(same.intervalWidthPercent, 0);
  assert.equal(same.narrowInterval, true);
  const missing = metricGeometry(0.4, "proportion");
  assert.equal(missing.hasInterval, false);
  assert.equal(missing.narrowInterval, false);
  assert.match(
    metricAriaDescription({ label: "No interval", value: 0.4, unit: "proportion" }),
    /No uncertainty interval is displayed/
  );
});

test("descriptive IQR remains separate from statistical confidence interval", () => {
  const g = metricGeometry(7, "hours/person/year", 6.999999, 7.000001);
  assert.equal(g.narrowInterval, true);
  const aria = metricAriaDescription({
    label: "Typical range",
    value: 7,
    unit: "hours/person/year",
    low: 6.999999,
    high: 7.000001,
    intervalStyle: "range",
    narrowInterval: true
  });
  assert.match(aria, /descriptive interquartile range \(not a confidence interval\)/);
  assert.match(aria, /6\.999999 hours\/person\/year to 7\.000001 hours\/person\/year/);
  const precise = metricAriaDescription({
    label: "Reviewed",
    value: 7,
    unit: "hours/person/year",
    low: 6.9,
    high: 7.1,
    intervalStyle: "range",
    intervalLabel: "Interquartile range (25th–75th percentile; not a confidence interval)"
  });
  assert.match(precise, /25th–75th percentile; not a confidence interval/);
});

test("ACS percentage indicators use fixed 0–100% scale so 6.0% and 86.1% compare truthfully", () => {
  const uninsured = allLocal.find(r => r.indicator_id === "wv.acs.uninsured_pct")!;
  const broadband = allLocal.find(r => r.indicator_id === "wv.acs.broadband_pct")!;
  const domU = getLocalContextScaleDomain(uninsured, allLocal)!;
  const domB = getLocalContextScaleDomain(broadband, allLocal)!;
  assert.equal(domU.min, 0);
  assert.equal(domU.max, 100);
  assert.equal(domB.max, 100);
  const geoU = metricGeometry(uninsured.value as number, uninsured.unit, null, null, domU);
  const geoB = metricGeometry(broadband.value as number, broadband.unit, null, null, domB);
  close(geoU.pointPercent, 6.0);
  close(geoB.pointPercent, 86.1);
});

test("HRSA designation counts share discipline total [0, 123] and [0, 119]; HPSA score points omit bar", () => {
  const pcTotal = allLocal.find(r => r.indicator_id === "wv.hrsa.primary-care.designated-distinct-count")!;
  const pcFqhc = allLocal.find(r => r.indicator_id === "wv.hrsa.primary-care.designation-type.federally-qualified-health-center")!;
  const pcScore = allLocal.find(r => r.indicator_id === "wv.hrsa.primary-care.max-score")!;
  const mhTotal = allLocal.find(r => r.indicator_id === "wv.hrsa.mental-health.designated-distinct-count")!;
  const mhRural = allLocal.find(r => r.indicator_id === "wv.hrsa.mental-health.rural-status.rural")!;
  const mhScore = allLocal.find(r => r.indicator_id === "wv.hrsa.mental-health.max-score")!;

  assert.equal(getLocalContextScaleDomain(pcTotal, allLocal)?.max, 123);
  assert.equal(getLocalContextScaleDomain(pcFqhc, allLocal)?.max, 123);
  assert.equal(getLocalContextScaleDomain(mhTotal, allLocal)?.max, 119);
  assert.equal(getLocalContextScaleDomain(mhRural, allLocal)?.max, 119);
  assert.equal(getLocalContextScaleDomain(pcScore, allLocal), null);
  assert.equal(getLocalContextScaleDomain(mhScore, allLocal), null);
});

test("Burden measures use native score bounds, shared unit+cohort family scales, and omit standalone metrics", () => {
  const k6 = allEstimates.find(e => e.estimate_id === "meps24-k6-score-mean")!;
  const phq2 = allEstimates.find(e => e.estimate_id === "meps24-phq2-score-mean")!;
  const grossMean = allEstimates.find(e => e.estimate_id === "meps24-gross-all-cause-spending-mean")!;
  const oopMean = allEstimates.find(e => e.estimate_id === "meps24-out-of-pocket-spending-mean")!;
  const pop = allEstimates.find(e => e.estimate_id === "meps24-current-long-covid-population")!;
  const discharges = allEstimates.find(e => e.estimate_id === "meps24-hospital-discharges-mean")!;

  assert.equal(getBurdenScaleDomain(k6, allEstimates)?.max, 24);
  assert.equal(getBurdenScaleDomain(phq2, allEstimates)?.max, 6);

  const domGross = getBurdenScaleDomain(grossMean, allEstimates)!;
  const domOop = getBurdenScaleDomain(oopMean, allEstimates)!;
  assert.equal(domGross.max, domOop.max);
  assert.ok(domGross.max > 17000);

  assert.equal(getBurdenScaleDomain(pop, allEstimates), null);
  assert.equal(getBurdenScaleDomain(discharges, allEstimates), null);
});
