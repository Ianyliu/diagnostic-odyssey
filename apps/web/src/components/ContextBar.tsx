import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";

export function ContextBar() {
  const {bundle, localContext, localContextStatus} = useArtifact();
  if (!bundle) return null;

  const estimates = bundle.burden_domains.flatMap(domain => domain.measures);
  const reviewedBurden =
    estimates.length > 0 && estimates.every(canExportEstimate);
  const conditionLabel =
    bundle.context.condition_id === "long-covid-current"
      ? "Current Long COVID"
      : bundle.context.condition_id;

  const implementationContextLabel =
    localContextStatus === "loaded" && localContext
      ? localContext.geography.geography_name +
        " (" +
        localContext.geography.geography_type +
        ")"
      : localContextStatus === "error"
        ? "Unavailable"
        : "Loading";

  return <section className="context-bar" aria-label="Analytical context">
    <div className="context-bar-title"><span>ANALYTICAL SCOPE</span><strong>{conditionLabel}</strong></div>
    <dl className="context-meta">
      <div><dt>Population</dt><dd>Adults {bundle.context.age_range}</dd></div>
      <div><dt>National burden</dt><dd>{bundle.context.geography_scope}</dd></div>
      <div><dt>Local implementation context</dt><dd>{implementationContextLabel}</dd></div>
      <div><dt>Artifact</dt><dd>{reviewedBurden ? "Reviewed burden" : "Analytical artifact"} · {bundle.manifest.artifact_version}</dd></div>
    </dl>
  </section>;
}
