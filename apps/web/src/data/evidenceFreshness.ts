import type { EvidenceFreshness } from "@diagnostic-odyssey/brief-core";
import { canExportEstimate, type ArtifactBundle, type Estimate, type LocalContextArtifact } from "@diagnostic-odyssey/contracts";
import { isSelectableLocalContextRecord } from "./localContextSelection.ts";
import { REVIEWED_MEPS_ARTIFACT_VERSION } from "./reviewedArtifact.ts";
import mepsSource from "../../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/hc256-source-metadata.json" with { type: "json" };

const mepsRetrievedAt = mepsSource.downloaded_at_utc.replace(" ", "T").replace(" UTC", "Z");
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string | null): value is string {
  if (value === null || !dateOnly.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}

export function getNationalEvidenceFreshness(
  bundle: ArtifactBundle | null,
  estimates: readonly Estimate[] = bundle?.burden_domains.flatMap(domain => domain.measures) ?? []
): EvidenceFreshness[] {
  if (!bundle) return [];
  const artifactVersion = bundle.manifest.artifact_version;
  const activeHc256 = artifactVersion === REVIEWED_MEPS_ARTIFACT_VERSION;
  const releasedRefs = new Set(estimates.filter(estimate =>
    canExportEstimate(estimate) && estimate.artifact_version === artifactVersion
  ).map(estimate => estimate.source_ref));

  return bundle.sources.filter(source => releasedRefs.has(source.source_ref)).map(source => {
    const hasRetrieval = activeHc256 && source.source_ref === mepsSource.source_id;
    return {
      source_ref: source.source_ref,
      source_name: source.source_name,
      source_family: "meps",
      observation_vintage: `${bundle.context.evidence_year} survey year`,
      source_release: hasRetrieval ? mepsSource.release : String(source.release_year),
      source_modified_on: null,
      retrieved_at: hasRetrieval ? mepsRetrievedAt : null,
      // The archived approval records a decision without a review timestamp.
      reviewed_at: null,
      artifact_version: artifactVersion,
      freshness_state: "fixed_vintage",
      assessed_on: null
    };
  });
}

export function getLocalEvidenceFreshness(
  artifact: LocalContextArtifact | null,
  asOf: Date = new Date()
): EvidenceFreshness[] {
  if (!artifact || artifact.manifest.release_status !== "reviewed_released") return [];
  const releasedRefs = new Set(artifact.indicators.filter(isSelectableLocalContextRecord).map(record => record.source_ref));
  const assessedOn = asOf.toISOString().slice(0, 10);
  return artifact.sources.flatMap((source): EvidenceFreshness[] => {
    if (!releasedRefs.has(source.source_ref)) return [];
    const common = {
      source_ref: source.source_ref,
      source_name: source.source_name,
      source_modified_on: source.published_update_date,
      retrieved_at: source.retrieved_at,
      reviewed_at: null,
      artifact_version: artifact.manifest.artifact_version
    };
    if (source.source_agency === "HRSA") {
      // HRSA publishes daily downloads. A prior-day snapshot cannot confirm current designation status.
      const observedOn = source.observation_as_of_date;
      const hasObservation = isCalendarDate(observedOn);
      return [{ ...common, source_family: "hrsa_hpsa", source_release: null,
        observation_vintage: hasObservation ? observedOn : "Observation date unavailable",
        freshness_state: !hasObservation || observedOn > assessedOn ? "unknown"
          : observedOn < assessedOn ? "stale_snapshot" : "snapshot_as_of",
        assessed_on: assessedOn }];
    }
    if (source.source_agency === "U.S. Census Bureau") {
      const [vintage, release] = source.source_release_vintage.split(" / ", 2);
      return [{ ...common, source_family: "acs", source_release: release ?? null,
        observation_vintage: vintage ?? source.source_release_vintage,
        freshness_state: "fixed_vintage", assessed_on: null }];
    }
    return [];
  });
}

export function getEvidenceFreshness(
  bundle: ArtifactBundle | null,
  local: LocalContextArtifact | null,
  asOf?: Date
): EvidenceFreshness[] {
  return [...getNationalEvidenceFreshness(bundle), ...getLocalEvidenceFreshness(local, asOf)];
}
