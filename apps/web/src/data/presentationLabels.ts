import type {
  DataState,
  ReleaseStatus,
  ReviewerStatus
} from "@diagnostic-odyssey/contracts";

function assertNever(value: never): never {
  throw new Error(`Unhandled presentation value: ${String(value)}`);
}

export function formatDataStateLabel(value: DataState): string {
  switch (value) {
    case "loading": return "Loading";
    case "loaded": return "Available";
    case "partial": return "Partially available";
    case "empty": return "No data available";
    case "suppressed": return "Suppressed";
    case "error": return "Unavailable";
    case "stale_fallback": return "Older fallback data";
    case "unsupported_combination": return "Not supported for this combination";
    default: return assertNever(value);
  }
}

export function formatReleaseStatusLabel(value: ReleaseStatus): string {
  switch (value) {
    case "reviewed_released": return "Reviewed and released";
    case "preliminary": return "Preliminary — not released";
    case "not_released": return "Not released";
    case "suppressed": return "Suppressed";
    case "unavailable": return "Unavailable";
    default: return assertNever(value);
  }
}

export function formatReviewerStatusLabel(value: ReviewerStatus): string {
  switch (value) {
    case "approved": return "Approved";
    case "needs_review": return "Needs review";
    case "draft": return "Draft";
    case "rejected": return "Rejected";
    default: return assertNever(value);
  }
}
