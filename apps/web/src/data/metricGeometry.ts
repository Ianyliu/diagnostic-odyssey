import type { Estimate, LocalContextRecord } from "@diagnostic-odyssey/contracts";
import { formatMetricTick, formatMetricValue } from "./metricFormatting.ts";

/** The interval width is a true percentage of the plotted scale, with no minimum. */
export const NARROW_INTERVAL_THRESHOLD_PERCENT = 1.5;

export interface MetricScaleDomain {
  readonly min: number;
  readonly max: number;
  readonly note: string;
}

function defaultMaxForUnit(unit: string, rawMax: number, min: number): number {
  if (unit === "proportion") return 1;
  if (unit === "percent") return Math.max(100, rawMax);
  const padding = Math.max(Math.abs(rawMax - min) * 0.08, Math.abs(rawMax) * 0.04, 1e-9);
  return rawMax + padding;
}

export function metricGeometry(
  value: number,
  unit: string,
  low: number | null = null,
  high: number | null = null,
  scaleDomain?: Pick<MetricScaleDomain, "min" | "max">
) {
  const lower = low ?? value;
  const upper = high ?? value;
  const rawMax = Math.max(0, upper, value);
  const min =
    scaleDomain !== undefined
      ? scaleDomain.min
      : unit === "proportion" || unit === "percent"
        ? 0
        : Math.min(0, lower, value);
  const max =
    scaleDomain !== undefined
      ? Math.max(scaleDomain.max, rawMax)
      : defaultMaxForUnit(unit, rawMax, min);
  const span = Math.max(max - min, 1e-9);
  const pct = (x: number) => Math.max(0, Math.min(100, ((x - min) / span) * 100));
  const left = pct(lower);
  const width = Math.max(0, pct(upper) - left);
  const hasInterval = low !== null && high !== null;
  return {
    min,
    max,
    hasInterval,
    zeroPercent: pct(0),
    pointPercent: pct(value),
    intervalLeftPercent: left,
    intervalWidthPercent: width,
    intervalMidpointPercent: left + width / 2,
    narrowInterval: hasInterval && width < NARROW_INTERVAL_THRESHOLD_PERCENT
  };
}

function normalizedDenominatorFamily(denominator: string): string {
  return denominator.replace(/,?\s*with valid [A-Z0-9_]+$/i, "").trim().toLowerCase();
}

const SCORE_BOUNDS: Readonly<Record<string, { max: number; label: string }>> = {
  "meps24-k6-score-mean": { max: 24, label: "K6 0–24 score scale" },
  "meps24-phq2-score-mean": { max: 6, label: "PHQ-2 0–6 score scale" }
};

/**
 * Derive an honest, comparable chart scale for a reviewed Burden estimate.
 * Returns null for standalone incompatible metrics (e.g. people count or hospital discharges)
 * so decorative row-local charts are omitted instead of implying comparability.
 */
export function getBurdenScaleDomain(
  estimate: Estimate,
  allEstimates: readonly Estimate[]
): MetricScaleDomain | null {
  if (typeof estimate.value !== "number" || !Number.isFinite(estimate.value)) return null;

  if (estimate.unit === "proportion") {
    return { min: 0, max: 1, note: "Fixed 0–100% scale" };
  }

  const fixedScore = SCORE_BOUNDS[estimate.estimate_id];
  if (fixedScore) {
    return { min: 0, max: fixedScore.max, note: fixedScore.label };
  }

  const familyKey = `${estimate.unit}::${normalizedDenominatorFamily(estimate.denominator)}`;
  const peers = allEstimates.filter(
    candidate =>
      candidate.release_status === "reviewed_released" &&
      typeof candidate.value === "number" &&
      Number.isFinite(candidate.value) &&
      `${candidate.unit}::${normalizedDenominatorFamily(candidate.denominator)}` === familyKey
  );

  if (peers.length < 2) {
    return null;
  }

  let familyMax = Math.max(
    estimate.value,
    estimate.interval_high ?? estimate.value,
    estimate.distribution_summary?.p75 ?? estimate.value
  );
  for (const peer of peers) {
    if (typeof peer.value !== "number") continue;
    familyMax = Math.max(
      familyMax,
      peer.value,
      peer.interval_high ?? peer.value,
      peer.distribution_summary?.p75 ?? peer.value
    );
  }
  const paddedMax = familyMax * 1.04;
  return {
    min: 0,
    max: paddedMax,
    note: `Shared ${formatMetricTick(0, estimate.unit, false)}–${formatMetricTick(paddedMax, estimate.unit, true)} family scale`
  };
}

/**
 * Derive a truthful scale for a reviewed West Virginia Local Context indicator:
 * - ACS percentages: fixed 0–100% scale
 * - HRSA HPSA designation counts: shared [0, discipline designated-total] scale (0–123, 0–119)
 * - Standalone HPSA score points: null (omitted instead of misleading row-local bar)
 */
export function getLocalContextScaleDomain(
  record: LocalContextRecord,
  allRecords: readonly LocalContextRecord[]
): MetricScaleDomain | null {
  if (typeof record.value !== "number" || !Number.isFinite(record.value)) return null;

  if (record.unit === "percent") {
    return { min: 0, max: 100, note: "Fixed 0–100% ACS scale" };
  }

  if (record.unit === "designations") {
    const prefix = record.indicator_id.startsWith("wv.hrsa.primary-care.")
      ? "wv.hrsa.primary-care."
      : record.indicator_id.startsWith("wv.hrsa.mental-health.")
        ? "wv.hrsa.mental-health."
        : null;
    if (!prefix) return null;
    const totalRecord = allRecords.find(
      item => item.indicator_id === `${prefix}designated-distinct-count` && typeof item.value === "number"
    );
    const groupMax =
      typeof totalRecord?.value === "number" && totalRecord.value > 0
        ? totalRecord.value
        : Math.max(
            record.value,
            ...allRecords
              .filter(item => item.indicator_id.startsWith(prefix) && item.unit === "designations" && typeof item.value === "number")
              .map(item => item.value as number)
          );
    const label = prefix.includes("primary-care") ? "Primary Care" : "Mental Health";
    return {
      min: 0,
      max: groupMax,
      note: `Shared ${label} HPSA scale (0–${groupMax})`
    };
  }

  return null;
}

function preciseBound(value: number, unit: string): string {
  const n = (unit === "proportion" ? value * 100 : value)
    .toLocaleString("en-US", { maximumSignificantDigits: 15 });
  return unit === "proportion" ? `${n}%` : `${n} ${unit}`;
}

export function metricAriaDescription({
  label, value, unit, low = null, high = null, intervalLabel,
  pointLabel = "Published value", intervalStyle = "confidence", narrowInterval = false
}: {
  label: string; value: number; unit: string; low?: number | null; high?: number | null;
  intervalLabel?: string | null | undefined; pointLabel?: string;
  intervalStyle?: "confidence" | "range"; narrowInterval?: boolean;
}): string {
  if (low === null || high === null)
    return `${label}: ${pointLabel} ${formatMetricValue(value, unit)}. No uncertainty interval is displayed.`;
  const kind = intervalLabel ??
    (intervalStyle === "range" ? "descriptive interquartile range (not a confidence interval)" : "published confidence interval");
  const format = narrowInterval ? preciseBound : formatMetricValue;
  const qualifier = narrowInterval
    ? " Interval too narrow to show as a bar on this scale; a tick marks its position." : "";
  return `${label}: ${pointLabel} ${format(value, unit)}; ${kind} ${format(low, unit)} to ${format(high, unit)}.${qualifier}`;
}
