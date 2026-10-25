import type { DataRequest, Scenario } from "@diagnostic-odyssey/contracts";
import { isDataRequestCurrentForScenario, sensitivityFieldFromDataRequestId } from "./dataRequestTemplates.ts";
import { pilotInputFields } from "./pilotInputDraft.ts";
import { formatAppliedAssumption } from "../pages/briefAssumptions.ts";

const decisionQuestions = {
  capacity: "Can available capacity support the pilot's intended reach?",
  reach: "Is the assumed outreach and enrollment reach operationally feasible?",
  alternative_window_months: "Is the assumed recognition window operationally feasible?"
} as const;

/** Presentation only: never enrich a canonical request or reconstruct past inputs. */
export function buildDataRequestHandoff(request: DataRequest, scenario: Scenario | null) {
  const field = sensitivityFieldFromDataRequestId(request.request_id);
  if (!field) return null;
  const current = scenario !== null && isDataRequestCurrentForScenario(request, scenario);
  return {
    decisionQuestion: decisionQuestions[field],
    current,
    appliedInputs: current ? pilotInputFields.map(input => ({
      key: input.key,
      label: input.label,
      value: formatAppliedAssumption(scenario, input)
    })) : []
  };
}
