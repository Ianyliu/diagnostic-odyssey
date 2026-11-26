import type { Estimate } from "./types.ts";
import { validateEstimate } from "./validate-estimate.ts";

export const canExportEstimate = (estimate: Estimate): boolean =>
  estimate.release_status === "reviewed_released" &&
  estimate.display_status === "analytical_artifact" &&
  estimate.value !== null;

export const canDisplayDistributionSummary = (estimate: Estimate): boolean =>
  canExportEstimate(estimate) &&
  estimate.distribution_summary !== undefined &&
  validateEstimate(estimate).length === 0;
