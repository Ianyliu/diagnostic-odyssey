import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type ArtifactBundle,
  type DataRequest,
  type LocalContextArtifact,
  type LocalContextRecord,
  type Scenario,
  type ScenarioResult
} from "@diagnostic-odyssey/contracts";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import {
  clearLocalContextSelection,
  createEmptyLocalContextSelection,
  createLocalContextSelectionForArtifact,
  resolveSelectedLocalContext,
  updateLocalContextSelection,
  type LocalContextSelectionState
} from "./localContextSelection";
import {
  clearPilotLocalContextSelection,
  createEmptyPilotLocalContextSelection,
  createPilotLocalContextSelectionForArtifact,
  resolvePilotLocalContext,
  selectPilotLocalContext,
  type PilotLocalContextSelectionState
} from "./pilotLocalContextSelection";
import { createPlanningScenarioDefaults } from "./planningScenarioDefaults";
import { loadReviewedMepsArtifact } from "./reviewedArtifact";
import { loadReviewedWvLocalContextArtifact } from "./reviewedLocalContext";
import { isDataRequestCurrentForScenario } from "./dataRequestTemplates";
import { acquisitionResolver, sanitizeBaseDataRequest } from "@diagnostic-odyssey/acquisition-hints";

interface ArtifactState {
  status: "loading" | "loaded" | "error";
  bundle: ArtifactBundle | null;
  error: string | null;
  localContext: LocalContextArtifact | null;
  localContextStatus: "loading" | "loaded" | "error";
  localContextError: string | null;
  selectedLocalContextIds: string[];
  selectedLocalContext: LocalContextRecord[];
  setLocalContextSelected: (indicatorId: string, selected: boolean) => void;
  clearSelectedLocalContext: () => void;
  pilotLocalContextId: string | null;
  pilotLocalContext: LocalContextRecord | null;
  setPilotLocalContext: (indicatorId: string) => void;
  clearPilotLocalContext: () => void;
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
  attachAcquisitionHint: (requestId: string) => boolean;
  removeAcquisitionHint: (requestId: string) => void;
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
  const [localContextSelection, setLocalContextSelection] =
    useState<LocalContextSelectionState>(createEmptyLocalContextSelection);
  const [pilotLocalContextSelection, setPilotLocalContextSelection] =
    useState<PilotLocalContextSelectionState>(createEmptyPilotLocalContextSelection);
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
      setLocalContextSelection(
        createLocalContextSelectionForArtifact(candidate)
      );
      setPilotLocalContextSelection(
        createPilotLocalContextSelectionForArtifact(candidate)
      );
      setLocalContextError(null);
      setLocalContextStatus("loaded");
    } catch (cause) {
      setLocalContext(null);
      setLocalContextSelection(createEmptyLocalContextSelection());
      setPilotLocalContextSelection(createEmptyPilotLocalContextSelection());
      setLocalContextError(cause instanceof Error ? cause.message : String(cause));
      setLocalContextStatus("error");
    }
  }, []);

  const selectedLocalContext = useMemo(
    () =>
      resolveSelectedLocalContext(
        localContextSelection,
        localContextStatus,
        localContext
      ),
    [localContextSelection, localContextStatus, localContext]
  );

  const selectedLocalContextIds = useMemo(
    () => selectedLocalContext.map(record => record.indicator_id),
    [selectedLocalContext]
  );

  const pilotLocalContext = useMemo(
    () =>
      resolvePilotLocalContext(
        pilotLocalContextSelection,
        localContextStatus,
        localContext
      ),
    [pilotLocalContextSelection, localContextStatus, localContext]
  );

  const pilotLocalContextId = pilotLocalContext?.indicator_id ?? null;

  const setLocalContextSelected = (indicatorId: string, selected: boolean) => {
    if (localContextStatus !== "loaded" || !localContext) return;
    setLocalContextSelection(current =>
      updateLocalContextSelection(current, localContext, indicatorId, selected)
    );
  };

  const clearSelectedLocalContext = () => {
    setLocalContextSelection(clearLocalContextSelection(localContext));
  };

  const setPilotLocalContext = (indicatorId: string) => {
    if (localContextStatus !== "loaded" || !localContext) return;
    setPilotLocalContextSelection(current =>
      selectPilotLocalContext(current, localContext, indicatorId)
    );
  };

  const clearPilotLocalContext = () => {
    setPilotLocalContextSelection(clearPilotLocalContextSelection(localContext));
  };

  const scenarioResult = useMemo(() => {
    if (!scenario) return null;
    try { return calculateScenario(scenario); }
    catch { return null; }
  }, [scenario]);

  const availableDataRequests = useMemo(() => {
    const requests = new Map<string, DataRequest>();
    for (const request of bundle?.data_requests ?? []) {
      requests.set(request.request_id, request);
    }
    for (const request of analystDataRequests) {
      requests.set(request.request_id, request);
    }
    return Array.from(requests.values());
  }, [bundle, analystDataRequests]);

  const selectedDataRequests = useMemo(() => {
    const selected = new Set(briefDataRequestIds);
    return availableDataRequests.filter(
      request =>
        selected.has(request.request_id) &&
        isDataRequestCurrentForScenario(request, scenario)
    );
  }, [availableDataRequests, briefDataRequestIds, scenario]);

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

  const attachAcquisitionHint = (requestId: string): boolean => {
    // Enrich a session copy only; reviewed ArtifactBundle objects are never modified.
    const request = analystDataRequests.find(item => item.request_id === requestId);
    if (!request || !bundle || !scenarioResult) return false;
    const resolved = acquisitionResolver.attach(request, bundle.context, scenario);
    if (resolved.state !== "reviewed") return false;
    upsertAnalystDataRequest(resolved.request);
    return true; // Brief selection is untouched.
  };
  const removeAcquisitionHint = (requestId: string) => {
    const request = analystDataRequests.find(item => item.request_id === requestId);
    if (request) upsertAnalystDataRequest(sanitizeBaseDataRequest(request));
  };

  return (
    <ArtifactContext.Provider
      value={{
        status,
        bundle,
        error,
        localContext,
        localContextStatus,
        localContextError,
        selectedLocalContextIds,
        selectedLocalContext,
        setLocalContextSelected,
        clearSelectedLocalContext,
        pilotLocalContextId,
        pilotLocalContext,
        setPilotLocalContext,
        clearPilotLocalContext,
        scenario,
        scenarioResult,
        setScenario,
        analystDataRequests,
        availableDataRequests,
        briefDataRequestIds,
        selectedDataRequests,
        upsertAnalystDataRequest,
        removeAnalystDataRequest,
        toggleDataRequestForBrief,
        attachAcquisitionHint,
        removeAcquisitionHint
      }}
    >
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifact(): ArtifactState {
  const value = useContext(ArtifactContext);
  if (!value) throw new Error("useArtifact must be used inside ArtifactProvider");
  return value;
}
