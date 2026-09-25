import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";

export function mergeBriefLocalContext(
  selectedLocalContext: LocalContextRecord[],
  pilotLocalContext: LocalContextRecord | null
): LocalContextRecord[] {
  const merged = new Map<string, LocalContextRecord>();

  for (const record of selectedLocalContext) {
    merged.set(record.indicator_id, record);
  }

  if (pilotLocalContext) {
    merged.set(pilotLocalContext.indicator_id, pilotLocalContext);
  }

  return Array.from(merged.values());
}
