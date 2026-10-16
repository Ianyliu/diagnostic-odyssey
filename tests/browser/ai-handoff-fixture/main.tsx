// Isolated test entry point. Never imported by the production application.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { buildPlanningBrief } from "@diagnostic-odyssey/brief-core";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { ArtifactProvider, useArtifact } from "../../../apps/web/src/data/ArtifactContext";
import { BriefPage } from "../../../apps/web/src/pages/BriefPage";
import { AiHandoff } from "../../../apps/web/src/components/AiHandoff";
import { createSensitivityDataRequest } from "../../../apps/web/src/data/dataRequestTemplates";
import { createPlanningScenarioDefaults } from "../../../apps/web/src/data/planningScenarioDefaults";
import { loadReviewedMepsArtifact } from "../../../apps/web/src/data/reviewedArtifact";
import type { AiHandoffSourceState } from "../../../apps/web/src/data/aiHandoffSession";
import "@diagnostic-odyssey/ui/styles.css";
import "../../../apps/web/src/styles.css";
import "../../../apps/web/src/workspace.css";

function SourceControls() {
  const state = useArtifact();
  useEffect(() => {
    const change = (event: Event) => {
      const kind = (event as CustomEvent<string>).detail;
      if (kind === "scenario") state.setScenario({...state.scenario!, capacity: state.scenario!.capacity + 1});
      if (kind === "timestamp") state.setScenario({...state.scenario!});
      if (kind === "invalid-scenario") state.setScenario({...state.scenario!, capacity: -1});
      if (kind === "local") state.setLocalContextSelected(state.localContext!.indicators[0]!.indicator_id, true);
      if (kind === "pilot-local") state.setPilotLocalContext(state.localContext!.indicators[1]!.indicator_id);
      if (kind === "request-create") state.upsertAnalystDataRequest(createSensitivityDataRequest(state.scenario!, "capacity"));
      if (kind === "request-select") state.toggleDataRequestForBrief(state.availableDataRequests[0]!.request_id);
    };
    window.addEventListener("fixture-change", change);
    return () => window.removeEventListener("fixture-change", change);
  }, [state]);
  return <p role="status">Fixture source: {state.status}; local: {state.localContextStatus}; requests: {state.availableDataRequests.length}</p>;
}

function FaultHarness() {
  const [fault, setFault] = useState("");
  useEffect(() => {
    const change = (event: Event) => setFault((event as CustomEvent<string>).detail);
    window.addEventListener("fixture-change", change);
    return () => window.removeEventListener("fixture-change", change);
  }, []);
  const national = loadReviewedMepsArtifact();
  const scenario = createPlanningScenarioDefaults();
  const estimates = national.burden_domains.flatMap(domain => domain.measures);
  const forbidden = ["suppressed", "preliminary", "illustrative_only"].map((release, i) => ({
    ...estimates[0]!, estimate_id: `FORBIDDEN_${i}`, label: `FORBIDDEN_${i}`, value: 987654321, release_status: release
  }));
  const brief = structuredClone(buildPlanningBrief({context: national.context,
    estimates: [...estimates, ...forbidden] as typeof estimates, localContext: [], evidence: national.evidence,
    scenario: {input: scenario, result: calculateScenario(scenario)}, dataRequests: []}));
  const state: AiHandoffSourceState = {status: "loaded", localContextStatus: "loaded", localArtifactVersion: null,
    scenario, scenarioValid: true, selectedLocalContextIds: [], pilotLocalContextId: null, briefDataRequestIds: []};
  if (fault === "unavailable") state.status = "error";
  if (fault === "local-unavailable") state.localContextStatus = "error";
  if (fault === "invalid") brief.artifact_version = "mismatch";
  if (["suppressed", "preliminary", "illustrative_only"].includes(fault)) {
    Object.assign(brief.burden_findings[0]!, {release_status: fault, label: "FORBIDDEN_CONSTRUCTED", value: 987654321});
  }
  if (fault === "hostile") brief.burden_findings[0]!.label = '<img src="https://unexpected.invalid/source" onerror="window.INJECTED=true">';
  return <main><h1>Controlled availability and release faults</h1><AiHandoff brief={fault === "missing" ? null : brief} sourceState={state} /><button type="button">Unrelated control remains usable</button></main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter>
  {new URLSearchParams(location.search).has("faults") ? <FaultHarness /> : <ArtifactProvider><SourceControls /><BriefPage /></ArtifactProvider>}
</BrowserRouter></React.StrictMode>);
