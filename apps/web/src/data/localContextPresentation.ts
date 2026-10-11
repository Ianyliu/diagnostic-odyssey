import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";

const INCLUDE_IN_BRIEF_LABEL = "Include in Planning Brief";

export function formatLocalContextUncertaintyType(type: string | null): string {
  if (type === null) return "Not published";
  if (type === "published_90_percent_margin_of_error") {
    return "Published 90% margin of error";
  }
  return "Source-defined uncertainty";
}

export interface LocalContextSelectionAccessibility {
  displayTitle: string;
  controlId: string;
  titleId: string;
  actionLabelId: string;
  disambiguatorId: string | null;
  labelledBy: string;
  accessibleName: string;
}

export function getLocalContextSelectionAccessibility(
  record: Pick<LocalContextRecord, "indicator_id" | "label">,
  displayLabel?: string
): LocalContextSelectionAccessibility {
  const token = record.indicator_id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const controlId = "select-local-context-" + token;
  const titleId = controlId + "-title";
  const actionLabelId = controlId + "-action-label";
  const displayTitle = displayLabel ?? record.label;
  const needsDisambiguator =
    displayLabel !== undefined && displayLabel !== record.label;
  const disambiguatorId = needsDisambiguator
    ? controlId + "-indicator-label"
    : null;
  const labelledBy = [
    titleId,
    ...(disambiguatorId ? [disambiguatorId] : []),
    actionLabelId
  ].join(" ");
  const accessibleName = [
    displayTitle,
    ...(needsDisambiguator ? [record.label] : []),
    INCLUDE_IN_BRIEF_LABEL
  ].join(" ");

  return {
    displayTitle,
    controlId,
    titleId,
    actionLabelId,
    disambiguatorId,
    labelledBy,
    accessibleName
  };
}

export function formatPublishedLocalContextUncertainty(
  record: Pick<
    LocalContextRecord,
    "margin_of_error" | "confidence_level" | "unit"
  >
): string {
  if (record.margin_of_error === null) {
    return "Not applicable / not published";
  }

  const margin =
    record.unit === "percent"
      ? record.margin_of_error.toFixed(1) + " percentage points"
      : String(record.margin_of_error) + " " + record.unit;

  const confidence =
    record.confidence_level === null
      ? "native confidence level not published"
      : (record.confidence_level * 100).toFixed(0) + "% confidence level";

  return "±" + margin + " · " + confidence;
}
