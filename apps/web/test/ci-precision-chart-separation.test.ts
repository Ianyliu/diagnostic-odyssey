import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { formatEstimateInterval, formatNativeValue } from "../src/data/formatEstimateValue.ts";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

test("small nonzero native measures and their confidence limits never round to zero", () => {
  assert.equal(formatNativeValue(.366525672, "visits/person/year"), "0.37 visits/person/year");
  assert.equal(formatNativeValue(.1276347236, "discharges/person/year"), "0.13 discharges/person/year");
  assert.equal(formatNativeValue(.0004, "proportion"), "0.04%");
  assert.equal(formatNativeValue(0, "proportion"), "0%");
  assert.equal(formatNativeValue(97260052511.99054, "USD/year"), "$97.3B");
  assert.match(formatEstimateInterval({interval_low:.069596,interval_high:.185673,interval_type:"95% t CI",unit:"discharges/person/year"}), /^95% CI 0\.07–0\.19 discharges\/person\/year$/);
});

test("mean estimate mini-chart plots sampling CI; released quartiles remain a separate IQR text", () => {
  const measures = read("../src/components/BurdenMeasureList.tsx");
  const typical = read("../src/components/DistributionSummaryText.tsx");
  assert.match(measures, /low=\{estimate\.interval_low\}/);
  assert.match(measures, /high=\{estimate\.interval_high\}/);
  assert.doesNotMatch(measures, /low=\{estimate\.distribution_summary\?\.p25/);
  assert.match(typical, /Typical Range \(25th–75th percentile\)/);
  assert.match(measures, /intervalLabel=\{estimate\.interval_type \? "95% confidence interval"/);
  assert.match(measures, /formatEstimateInterval\(estimate\)/);
});
