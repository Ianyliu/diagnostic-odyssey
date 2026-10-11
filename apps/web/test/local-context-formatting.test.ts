import assert from "node:assert/strict";
import test from "node:test";
import { formatLocalContextValue } from "../src/data/formatLocalContextValue.ts";
import { formatLocalContextUncertaintyType } from "../src/data/localContextPresentation.ts";

test("local HPSA values retain native precision and explicitly name score points", () => {
  for (const value of [0, 23, 24, 5.9, 5.123456789]) {
    const record = Object.freeze({value, unit: "HPSA score points", margin_of_error: null});
    assert.equal(formatLocalContextValue(record), `${value} points`);
    assert.equal(record.value, value);
    assert.equal(record.unit, "HPSA score points");
  }
});

test("missing local scores remain missing and published percent margins keep their units", () => {
  assert.equal(formatLocalContextValue({value: null, unit: "HPSA score points", margin_of_error: null}), "Missing / not available");
  const record = Object.freeze({value: 6, unit: "percent", margin_of_error: 0.2});
  assert.equal(formatLocalContextValue(record), "6.0% ±0.2 percentage points");
  assert.equal(record.margin_of_error, 0.2);
});

test("uncertainty labels explain the known published margin without inventing unknown semantics", () => {
  assert.equal(formatLocalContextUncertaintyType("published_90_percent_margin_of_error"), "Published 90% margin of error");
  assert.equal(formatLocalContextUncertaintyType(null), "Not published");
  assert.equal(formatLocalContextUncertaintyType("future_source_interval"), "Source-defined uncertainty");
});
