import { Link } from "react-router-dom";
import type {
  EvidenceRecord,
  LocalContextRecord,
  Scenario
} from "@diagnostic-odyssey/contracts";
import { buildDecisionTrace } from "../data/decisionTrace";
import "./DecisionTrace.css";

export function DecisionTrace({
  burdenEstimateCount,
  pilotLocalContext,
  localContextStatus,
  scenario,
  currentDataRequestCount,
  evidence,
  dataRequestHref
}: {
  burdenEstimateCount: number;
  pilotLocalContext: LocalContextRecord | null;
  localContextStatus: "loading" | "loaded" | "error";
  scenario: Scenario;
  currentDataRequestCount: number;
  evidence: EvidenceRecord[];
  dataRequestHref: string;
}) {
  const items = buildDecisionTrace({
    burdenEstimateCount,
    pilotLocalContext,
    localContextStatus,
    scenario,
    currentDataRequestCount,
    evidence
  });

  return <div className="decision-trace" role="group" aria-label="Decision provenance ledger">
    <p className="decision-trace-boundary">
      Evidence → explicit analyst context → planning scope → evidence/data gap.
      This is a provenance and decision ledger, not a proven causal chain.
    </p>
    <ol>
      {items.map((item, index) => <li key={item.key}>
        <span className="decision-trace-step" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div className="decision-trace-body">
          <strong className="decision-trace-label">{item.label}</strong>
          <p className="decision-trace-detail">{item.detail}</p>
          {item.key === "local-context" && !pilotLocalContext &&
            <Link className="text-button" to="/local-context">
              {localContextStatus === "loaded" ? "Review Local Context" : "Open Local Context status"}
            </Link>}
          {item.key === "measurement" &&
            <Link className="text-button" to={dataRequestHref}>
              {currentDataRequestCount === 0 ? "Create or review a data request" : "Review current data requests"}
            </Link>}
        </div>
      </li>)}
    </ol>
  </div>;
}
