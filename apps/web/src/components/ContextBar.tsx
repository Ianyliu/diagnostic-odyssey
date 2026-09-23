import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";

export function ContextBar() {
  const {bundle} = useArtifact();
  if (!bundle) return null;

  const estimates = bundle.burden_domains.flatMap(domain => domain.measures);
  const reviewedBurden =
    estimates.length > 0 && estimates.every(canExportEstimate);
  const conditionLabel =
    bundle.context.condition_id === "long-covid-current"
      ? "Current Long COVID"
      : bundle.context.condition_id;

  return <div className="context-bar" aria-label="Analytical context">
    <strong>Analytical context</strong>
    <span className="chip">{conditionLabel}</span>
    <span className="chip">Adults {bundle.context.age_range}</span>
    <span className="chip">{bundle.context.geography_scope}</span>
    <span className="chip">
      {bundle.local_context.length > 0 ? "Local context loaded" : "Local context not yet loaded"}
    </span>
    <span className="context-version">
      {reviewedBurden ? "Reviewed artifact" : "Analytical artifact"} · {bundle.manifest.artifact_version}
    </span>
  </div>;
}
