import { useMemo } from "react";
import { buildPlanningBrief } from "@diagnostic-odyssey/brief-core";
import { validateScenario, validateScenarioResult } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { mergeBriefLocalContext } from "../data/briefLocalContext";
import { deriveBriefContextWithSelectedLocalContext } from "../data/localContextSelection";
import { withStaleSelectedDataRequestWarning } from "../data/briefDataRequestWarnings";
import { createAiHandoffText } from "../data/aiHandoff";
import { inspectAiHandoffSource } from "../data/aiHandoffSession";
import { projectConceptBrief } from "./conceptBrief";

/**
 * Reuse the canonical Brief composition for concept presentation and the
 * strictly ID-only protected Stage 2 Gemini transfer. All generated numerical
 * fields stay in the browser; the server must resolve its own reviewed values.
 *
 * Memoization is essential: the Brief generated_at changes on recomposition,
 * and must not invalidate a consented Gemini response simply by switching tabs.
 */
export function useConceptBrief() {
  const {
    status, bundle, localContext, localContextStatus,
    selectedLocalContext, selectedLocalContextIds, pilotLocalContext, pilotLocalContextId,
    scenario, scenarioResult, briefDataRequestIds, selectedDataRequests
  } = useArtifact();

  const brief = useMemo(() => {
    if (!bundle) return null;
    const selected = mergeBriefLocalContext(selectedLocalContext, pilotLocalContext);
    const base = buildPlanningBrief({
      context: deriveBriefContextWithSelectedLocalContext(bundle.context, localContextStatus, localContext, selected),
      estimates: bundle.burden_domains.flatMap(domain => domain.measures),
      localContext: selected,
      scenario: scenario && scenarioResult ? {input: scenario, result: scenarioResult} : null,
      evidence: bundle.evidence, dataRequests: selectedDataRequests
    });
    const staleCount = Math.max(0, briefDataRequestIds.length - selectedDataRequests.length);
    return withStaleSelectedDataRequestWarning(base, staleCount);
  }, [bundle, localContext, localContextStatus, selectedLocalContext, pilotLocalContext,
    scenario, scenarioResult, briefDataRequestIds, selectedDataRequests]);

  const concept = useMemo(() => brief && bundle
    ? projectConceptBrief(brief, bundle, localContext, localContextStatus) : null,
    [brief, bundle, localContext, localContextStatus]);

  const scenarioValid = !scenario || (!!scenarioResult &&
    !validateScenario(scenario).length && !validateScenarioResult(scenarioResult).length &&
    scenario.scenario_id === scenarioResult.scenario_id &&
    scenario.target_pathway_step === scenarioResult.target_pathway_step &&
    scenario.mechanism === scenarioResult.target_mechanism);
  const source = inspectAiHandoffSource(brief, {
    status, localContextStatus,
    localArtifactVersion: localContext?.manifest.artifact_version ?? null,
    scenario, scenarioValid, selectedLocalContextIds, pilotLocalContextId, briefDataRequestIds
  });
  const liveSnapshot = useMemo(() => {
    if (!brief || source.problem) return null;
    try { return createAiHandoffText(brief); }
    catch { return null; }
  }, [brief, source.problem]);

  return concept && {
    ...concept,
    live: {
      snapshot: liveSnapshot,
      sourceKey: source.key,
      reason: source.problem ?? (liveSnapshot ? null : "Current Brief could not be validated for protected AI analysis.")
    }
  };
}
