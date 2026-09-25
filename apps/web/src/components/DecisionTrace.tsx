import { Link } from "react-router-dom";
import type {
  EvidenceRecord,
  LocalContextRecord,
  Scenario
} from "@diagnostic-odyssey/contracts";
import { buildDecisionTrace } from "../data/decisionTrace";

export function DecisionTrace({
  burdenEstimateCount,
  pilotLocalContext,
  scenario,
  currentDataRequestCount,
  evidence,
  dataRequestHref
}: {
  burdenEstimateCount: number;
  pilotLocalContext: LocalContextRecord | null;
  scenario: Scenario;
  currentDataRequestCount: number;
  evidence: EvidenceRecord[];
  dataRequestHref: string;
}) {
  const items = buildDecisionTrace({
    burdenEstimateCount,
    pilotLocalContext,
    scenario,
    currentDataRequestCount,
    evidence
  });

  return <div className="decision-trace" aria-label="Six-step decision trace">
    <p className="decision-trace-boundary">
      Evidence → explicit analyst context → planning scope → evidence/data gap.
      This is a provenance and decision ledger, not a proven causal chain.
    </p>
    <ol>
      {items.map((item, index) => <li key={item.key}>
        <span className="decision-trace-step" aria-hidden="true">{index + 1}</span>
        <div>
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
          {item.key === "local-context" && !pilotLocalContext &&
            <Link className="text-button" to="/local-context">Review Local Context</Link>}
          {item.key === "measurement" &&
            <Link className="text-button" to={dataRequestHref}>
              {currentDataRequestCount === 0 ? "Create or review a data request" : "Review current data requests"}
            </Link>}
        </div>
      </li>)}
    </ol>
  </div>;
}
