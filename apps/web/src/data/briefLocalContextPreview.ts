import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";

/**
 * Presentation-only prioritization for a short, readable print synopsis.
 * Never changes the authoritative selected records, their order in JSON,
 * the Pilot-used union, or release/provenance eligibility.
 */
const FIRST_LOOK_IDS = [
  "wv.acs.no_vehicle_pct",
  "wv.acs.uninsured_pct",
  "wv.acs.broadband_pct",
  "wv.acs.poverty_pct",
  "wv.hrsa.primary-care.designated-distinct-count",
  "wv.hrsa.mental-health.designated-distinct-count"
] as const;

export function selectBriefLocalContextPreview(
  includedRecords: readonly LocalContextRecord[],
  limit = 4
): LocalContextRecord[] {
  if (!Number.isInteger(limit) || limit < 0) return [];
  const byId = new Map(includedRecords.map(record => [record.indicator_id, record]));
  const preferred = FIRST_LOOK_IDS.flatMap(id => {
    const record = byId.get(id);
    return record ? [record] : [];
  });
  const preferredIds = new Set(preferred.map(record => record.indicator_id));
  return [...preferred, ...includedRecords.filter(record => !preferredIds.has(record.indicator_id))].slice(0, limit);
}
