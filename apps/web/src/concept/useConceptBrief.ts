import { buildPlanningBrief } from "@diagnostic-odyssey/brief-core";
import { useArtifact } from "../data/ArtifactContext";
import { mergeBriefLocalContext } from "../data/briefLocalContext";
import { deriveBriefContextWithSelectedLocalContext } from "../data/localContextSelection";
import { projectConceptBrief } from "./conceptBrief";

export function useConceptBrief() {
  const {bundle, localContext, localContextStatus, selectedLocalContext, pilotLocalContext, scenario, scenarioResult, selectedDataRequests} = useArtifact();
  if (!bundle) return null;
  const selected = mergeBriefLocalContext(selectedLocalContext, pilotLocalContext);
  const brief = buildPlanningBrief({
    context: deriveBriefContextWithSelectedLocalContext(bundle.context, localContextStatus, localContext, selected),
    estimates: bundle.burden_domains.flatMap(domain => domain.measures), localContext: selected,
    scenario: scenario && scenarioResult ? {input: scenario, result: scenarioResult} : null,
    evidence: bundle.evidence, dataRequests: selectedDataRequests
  });
  return projectConceptBrief(brief, bundle, localContext, localContextStatus);
}
