import type { AnalysisContext, Estimate, LocalContextRecord } from "@diagnostic-odyssey/contracts";

const families = new Set(["meps", "acs", "hrsa_hpsa"]);
const freshnessStates = new Set(["fixed_vintage", "snapshot_as_of", "stale_snapshot", "unknown"]);

export interface EvidenceFreshness {
  source_ref: string;
  source_name: string;
  source_family: "meps" | "acs" | "hrsa_hpsa";
  observation_vintage: string;
  source_release: string | null;
  source_modified_on: string | null;
  retrieved_at: string | null;
  reviewed_at: string | null;
  artifact_version: string;
  freshness_state: "fixed_vintage" | "snapshot_as_of" | "stale_snapshot" | "unknown";
  assessed_on: string | null;
}

/** Attach timing only to eligible source and artifact pairs carried by this Brief. */
export function selectBriefEvidenceFreshness(
  entries: readonly EvidenceFreshness[] | undefined,
  context: AnalysisContext,
  findings: readonly Estimate[],
  local: readonly LocalContextRecord[]
): EvidenceFreshness[] {
  const selected: EvidenceFreshness[] = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const { source_ref, source_name, source_family, observation_vintage, source_release, source_modified_on, retrieved_at,
      reviewed_at, artifact_version, freshness_state, assessed_on } = entry;
    if (!families.has(source_family) || !freshnessStates.has(freshness_state) ||
      typeof source_name !== "string" || typeof observation_vintage !== "string" ||
      ![source_release, source_modified_on, retrieved_at, reviewed_at, assessed_on].every(value =>
        value === null || typeof value === "string")) continue;
    const included = source_family === "meps"
      ? artifact_version === context.artifact_version && findings.some(finding =>
        finding.source_ref === source_ref && finding.artifact_version === artifact_version)
      : artifact_version === context.local_context_id && local.some(record => record.source_ref === source_ref);
    if (!included || selected.some(record => record.source_ref === source_ref && record.artifact_version === artifact_version)) continue;
    selected.push({ source_ref, source_name, source_family, observation_vintage, source_release, source_modified_on, retrieved_at,
      reviewed_at, artifact_version, freshness_state, assessed_on });
  }
  return selected;
}
