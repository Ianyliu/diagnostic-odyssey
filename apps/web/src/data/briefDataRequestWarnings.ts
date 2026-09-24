import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";

export function staleSelectedDataRequestExclusionWarning(
  count: number
): string | null {
  if (count <= 0) return null;
  if (count === 1) {
    return "1 selected data request is stale for the current scenario and has been excluded from this Planning Brief until explicitly refreshed.";
  }
  return `${count} selected data requests are stale for the current scenario and have been excluded from this Planning Brief until explicitly refreshed.`;
}

export function withStaleSelectedDataRequestWarning(
  brief: PlanningBrief,
  staleCount: number
): PlanningBrief {
  const warning = staleSelectedDataRequestExclusionWarning(staleCount);
  if (!warning || brief.warnings.includes(warning)) return brief;
  return {
    ...brief,
    warnings: [...brief.warnings, warning]
  };
}
