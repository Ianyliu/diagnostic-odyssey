import type {
  LocalContextArtifact,
  LocalContextRecord
} from "@diagnostic-odyssey/contracts";
import { isSelectableLocalContextRecord } from "./localContextSelection.ts";

export interface PilotLocalContextSelectionState {
  artifactVersion: string | null;
  indicatorId: string | null;
}

export const createEmptyPilotLocalContextSelection =
  (): PilotLocalContextSelectionState => ({
    artifactVersion: null,
    indicatorId: null
  });

export const createPilotLocalContextSelectionForArtifact = (
  artifact: LocalContextArtifact
): PilotLocalContextSelectionState => ({
  artifactVersion: artifact.manifest.artifact_version,
  indicatorId: null
});

export function selectPilotLocalContext(
  current: PilotLocalContextSelectionState,
  artifact: LocalContextArtifact,
  indicatorId: string
): PilotLocalContextSelectionState {
  const artifactVersion = artifact.manifest.artifact_version;
  const currentIndicatorId =
    current.artifactVersion === artifactVersion ? current.indicatorId : null;
  const record = artifact.indicators.find(
    indicator => indicator.indicator_id === indicatorId
  );

  if (!record || !isSelectableLocalContextRecord(record)) {
    return {
      artifactVersion,
      indicatorId: currentIndicatorId
    };
  }

  return {
    artifactVersion,
    indicatorId: record.indicator_id
  };
}

export const clearPilotLocalContextSelection = (
  artifact: LocalContextArtifact | null
): PilotLocalContextSelectionState =>
  artifact
    ? createPilotLocalContextSelectionForArtifact(artifact)
    : createEmptyPilotLocalContextSelection();

export function resolvePilotLocalContext(
  selection: PilotLocalContextSelectionState,
  localContextStatus: "loading" | "loaded" | "error",
  artifact: LocalContextArtifact | null
): LocalContextRecord | null {
  if (
    localContextStatus !== "loaded" ||
    !artifact ||
    selection.artifactVersion !== artifact.manifest.artifact_version ||
    selection.indicatorId === null
  ) {
    return null;
  }

  const record = artifact.indicators.find(
    indicator => indicator.indicator_id === selection.indicatorId
  );

  return record && isSelectableLocalContextRecord(record) ? record : null;
}
