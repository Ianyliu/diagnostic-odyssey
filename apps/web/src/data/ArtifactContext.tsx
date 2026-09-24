import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type ArtifactBundle,
  type DataRequest,
  type LocalContextArtifact,
  type Scenario,
  type ScenarioResult
} from "@diagnostic-odyssey/contracts";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { createPlanningScenarioDefaults } from "./planningScenarioDefaults";
import { loadReviewedMepsArtifact } from "./reviewedArtifact";
import { loadReviewedWvLocalContextArtifact } from "./reviewedLocalContext";

interface ArtifactState {
  status: "loading" | "loaded" | "error";
  bundle: ArtifactBundle | null;
  error: string | null;
  localContext: LocalContextArtifact | null;
  localContextStatus: "loading" | "loaded" | "error";
  localContextError: string | null;
  scenario: Scenario | null;
  scenarioResult: ScenarioResult | null;
  setScenario: (scenario: Scenario) => void;
  analystDataRequests: DataRequest[];
  availableDataRequests: DataRequest[];
  briefDataRequestIds: string[];
  selectedDataRequests: DataRequest[];
  upsertAnalystDataRequest: (request: DataRequest) => void;
  removeAnalystDataRequest: (requestId: string) => void;
  toggleDataRequestForBrief: (requestId: string) => void;
}

const ArtifactContext = createContext<ArtifactState | null>(null);

export function ArtifactProvider({children}: {children: ReactNode}) {
  const [status, setStatus] = useState<ArtifactState["status"]>("loading");
  const [bundle, setBundle] = useState<ArtifactBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localContext, setLocalContext] = useState<LocalContextArtifact | null>(null);
  const [localContextStatus, setLocalContextStatus] =
    useState<ArtifactState["localContextStatus"]>("loading");
  const [localContextError, setLocalContextError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [analystDataRequests, setAnalystDataRequests] = useState<DataRequest[]>([]);
  const [briefDataRequestIds, setBriefDataRequestIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const candidate = loadReviewedMepsArtifact();
      setBundle(candidate);
      setScenario(createPlanningScenarioDefaults());
      setError(null);
      setStatus("loaded");
    } catch (cause) {
      setBundle(null);
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    try {
      const candidate = loadReviewedWvLocalContextArtifact();
      setLocalContext(candidate);
      setLocalContextError(null);
      setLocalContextStatus("loaded");
    } catch (cause) {
      setLocalContext(null);
      setLocalContextError(cause instanceof Error ? cause.message : String(cause));
      setLocalContextStatus("error");
    }
  }, []);

  const scenarioResult = useMemo(() => {
    if (!scenario) return null;
    try { return calculateScenario(scenario); }
    catch { return null; }
  }, [scenario]);

  const availableDataRequests = useMemo(() => {
    const requests = new Map<string, DataRequest>();
    for (const request of bundle?.data_requests ?? []) requests.set(request.request_id, request);
    for (const request of analystDataRequests) requests.set(request.request_id, request);
    return Array.from(requests.values());
  }, [bundle, analystDataRequests]);

  const selectedDataRequests = useMemo(() => {
    const selected = new Set(briefDataRequestIds);
    return availableDataRequests.filter(request => selected.has(request.request_id));
  }, [availableDataRequests, briefDataRequestIds]);

  const upsertAnalystDataRequest = (request: DataRequest) => {
    setAnalystDataRequests(current => [
      ...current.filter(item => item.request_id !== request.request_id),
      request
    ]);
  };

  const removeAnalystDataRequest = (requestId: string) => {
    setAnalystDataRequests(current => current.filter(item => item.request_id !== requestId));
    setBriefDataRequestIds(current => current.filter(id => id !== requestId));
  };

  const toggleDataRequestForBrief = (requestId: string) => {
    if (!availableDataRequests.some(request => request.request_id === requestId)) return;
    setBriefDataRequestIds(current =>
      current.includes(requestId)
        ? current.filter(id => id !== requestId)
        : [...current, requestId]
    );
  };

  return (
    <ArtifactContext.Provider value={{
      status,
      bundle,
      error,
      localContext,
      localContextStatus,
      localContextError,
      scenario,
      scenarioResult,
      setScenario,
      analystDataRequests,
      availableDataRequests,
      briefDataRequestIds,
      selectedDataRequests,
      upsertAnalystDataRequest,
      removeAnalystDataRequest,
      toggleDataRequestForBrief
    }}>
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifact(): ArtifactState {
  const value = useContext(ArtifactContext);
  if (!value) throw new Error("useArtifact must be used inside ArtifactProvider");
  return value;
}
