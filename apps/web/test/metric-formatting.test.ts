import assert from "node:assert/strict";
import test from "node:test";
import { formatMetricValue } from "../src/data/metricFormatting.ts";

test("mini-visual labels preserve proportions rather than rounding to integers", () => {
  assert.equal(formatMetricValue(.8167, "proportion"), "81.7%");
  assert.equal(formatMetricValue(.0004, "proportion"), "0.04%");
  assert.equal(formatMetricValue(0, "proportion"), "0%");
  assert.equal(formatMetricValue(6.04, "percent"), "6.0%");
});

test("mini-visual labels retain native currency, people, and small measurements", () => {
  assert.equal(formatMetricValue(14238, "USD/person/year"), "$14,238");
  assert.match(formatMetricValue(97300000000, "USD/year"), /^\$97\.3B$/);
  assert.equal(formatMetricValue(0.28, "hours/person/year"), "0.28 hours/person/year");
  assert.equal(formatMetricValue(23, "HPSA score points"), "23 points");
  assert.equal(formatMetricValue(12, "designations"), "12");
});
