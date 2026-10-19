import type {
  AnalysisContext,
  LocalContextArtifact,
  LocalContextRecord
} from "@diagnostic-odyssey/contracts";

export interface LocalContextSelectionState {
  artifactVersion: string | null;
  indicatorIds: string[];
}

export const createEmptyLocalContextSelection = (): LocalContextSelectionState => ({
  artifactVersion: null,
  indicatorIds: []
});

export const createLocalContextSelectionForArtifact = (
  artifact: LocalContextArtifact
): LocalContextSelectionState => ({
  artifactVersion: artifact.manifest.artifact_version,
  indicatorIds: artifact.indicators.filter(isSelectableLocalContextRecord).map(record => record.indicator_id)
});

export const isSelectableLocalContextRecord = (
  record: LocalContextRecord
): boolean =>
  record.release_status === "reviewed_released" &&
  (record.state === "loaded" || record.state === "partial");

export function updateLocalContextSelection(
  current: LocalContextSelectionState,
  artifact: LocalContextArtifact,
  indicatorId: string,
  selected: boolean
): LocalContextSelectionState {
  const artifactVersion = artifact.manifest.artifact_version;
  const versionMatches = current.artifactVersion === artifactVersion;
  const indicatorIds = versionMatches ? current.indicatorIds : [];

  const record = artifact.indicators.find(
    indicator => indicator.indicator_id === indicatorId
  );

  if (!record || !isSelectableLocalContextRecord(record)) {
    return {
      artifactVersion,
      indicatorIds
    };
  }

  if (selected) {
    return {
      artifactVersion,
      indicatorIds: indicatorIds.includes(indicatorId)
        ? indicatorIds
        : [...indicatorIds, indicatorId]
    };
  }

  return {
    artifactVersion,
    indicatorIds: indicatorIds.filter(id => id !== indicatorId)
  };
}

export const clearLocalContextSelection = (
  artifact: LocalContextArtifact | null
): LocalContextSelectionState => ({
  artifactVersion: artifact?.manifest.artifact_version ?? null,
  indicatorIds: []
});

export function resolveSelectedLocalContext(
  selection: LocalContextSelectionState,
  localContextStatus: "loading" | "loaded" | "error",
  artifact: LocalContextArtifact | null
): LocalContextRecord[] {
  if (
    localContextStatus !== "loaded" ||
    !artifact ||
    selection.artifactVersion !== artifact.manifest.artifact_version
  ) {
    return [];
  }

  const recordsById = new Map(
    artifact.indicators.map(record => [record.indicator_id, record] as const)
  );

  return selection.indicatorIds.flatMap(indicatorId => {
    const record = recordsById.get(indicatorId);
    return record && isSelectableLocalContextRecord(record) ? [record] : [];
  });
}

export function deriveBriefContextWithSelectedLocalContext(
  context: AnalysisContext,
  localContextStatus: "loading" | "loaded" | "error",
  artifact: LocalContextArtifact | null,
  selectedRecords: LocalContextRecord[]
): AnalysisContext {
  return {
    ...context,
    local_context_id:
      localContextStatus === "loaded" &&
      artifact !== null &&
      selectedRecords.length > 0
        ? artifact.manifest.artifact_version
        : null
  };
}
