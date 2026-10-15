import { buildPlanningBrief } from "@diagnostic-odyssey/brief-core";
import { useArtifact } from "../data/ArtifactContext";
import { mergeBriefLocalContext } from "../data/briefLocalContext";
import { deriveBriefContextWithSelectedLocalContext } from "../data/localContextSelection";
import { withStaleSelectedDataRequestWarning } from "../data/briefDataRequestWarnings";
import { projectConceptBrief } from "./conceptBrief";

export function useConceptBrief() {
  const {bundle, localContext, localContextStatus, selectedLocalContext, pilotLocalContext, scenario, scenarioResult, briefDataRequestIds, selectedDataRequests} = useArtifact();
  if (!bundle) return null;
  const selected = mergeBriefLocalContext(selectedLocalContext, pilotLocalContext);
  const baseBrief = buildPlanningBrief({
    context: deriveBriefContextWithSelectedLocalContext(bundle.context, localContextStatus, localContext, selected),
    estimates: bundle.burden_domains.flatMap(domain => domain.measures), localContext: selected,
    scenario: scenario && scenarioResult ? {input: scenario, result: scenarioResult} : null,
    evidence: bundle.evidence, dataRequests: selectedDataRequests
  });
  // Preserve the exact warning semantics of the authoritative Planning Brief:
  // a selected but stale request cannot silently disappear from the concept view.
  const staleSelectedDataRequestCount = Math.max(0, briefDataRequestIds.length - selectedDataRequests.length);
  const brief = withStaleSelectedDataRequestWarning(baseBrief, staleSelectedDataRequestCount);
  return projectConceptBrief(brief, bundle, localContext, localContextStatus);
}
