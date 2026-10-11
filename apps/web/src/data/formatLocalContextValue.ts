import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";

type FormattableLocalContextValue = Pick<
  LocalContextRecord,
  "value" | "unit" | "margin_of_error"
>;

export function formatLocalContextValue(
  record: FormattableLocalContextValue
): string {
  if (record.value === null) return "Missing / not available";

  if (record.unit === "percent" && typeof record.value === "number") {
    const estimate = record.value.toFixed(1) + "%";
    if (record.margin_of_error === null) return estimate;
    return (
      estimate +
      " ±" +
      record.margin_of_error.toFixed(1) +
      " percentage points"
    );
  }

  if (record.unit === "designations" && typeof record.value === "number") {
    return Math.trunc(record.value).toLocaleString("en-US");
  }

  if (record.unit === "HPSA score points" && typeof record.value === "number") {
    return String(record.value) + " points";
  }

  return String(record.value);
}
