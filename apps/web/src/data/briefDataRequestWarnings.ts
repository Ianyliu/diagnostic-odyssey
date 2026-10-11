import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import { staleSelectedDataRequestExclusionWarning } from "@diagnostic-odyssey/brief-core";
export { staleSelectedDataRequestExclusionWarning };

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
