import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { createAiHandoffEnvelope } from "./aiHandoff.ts";

/** Readiness and selections that can change even when the filtered Brief is identical. */
export interface AiHandoffSourceState {
  status: "loading" | "loaded" | "error";
  localContextStatus: "loading" | "loaded" | "error";
  localArtifactVersion: string | null;
  scenario: Scenario | null;
  scenarioValid: boolean;
  selectedLocalContextIds: readonly string[];
  pilotLocalContextId: string | null;
  briefDataRequestIds: readonly string[];
}

function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
}

export function inspectAiHandoffSource(brief: PlanningBrief | null, state: AiHandoffSourceState): {
  key: string; problem: string | null;
} {
  const unavailable = state.status !== "loaded" || !brief
    ? "The reviewed Planning Brief is unavailable. Wait for it to load or resolve the artifact error."
    : state.scenario && !state.scenarioValid
      ? "The applied scenario is invalid. Correct the Pilot inputs before generating a prompt."
      : state.localContextStatus !== "loaded"
        ? "Local-context readiness is unresolved. Restore the reviewed artifact before generating a prompt."
        : null;
  if (unavailable) return {key: stableKey({state, unavailable}), problem: unavailable};
  try {
    const payload = createAiHandoffEnvelope(brief!).payload;
    // Only the composition timestamp is volatile. Preserve every scientific field,
    // nested timestamp, limitation, provenance field and analyst selection.
    return {key: stableKey({state, payload: {...payload, generated_at: undefined}}), problem: null};
  } catch {
    // Do not interpolate untrusted source values or log prompt content on failure.
    return {key: stableKey({state, invalid: true}), problem: "This Brief failed AI handoff validation. Review its source state before trying again. Existing Brief controls remain available."};
  }
}

export function aiHandoffQuestionLength(question: string): number {
  return Array.from(question.trim()).length;
}
