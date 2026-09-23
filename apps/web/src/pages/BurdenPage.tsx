import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateValue } from "../data/formatEstimateValue";

export function BurdenPage() {
  const {bundle} = useArtifact();
  if (!bundle) return null;

  return <section className="page page-stack">
    <ContextBar />
    <div className="heading-row">
      <header className="page-heading">
        <p className="eyebrow">BURDEN</p>
        <h1>Burden overview</h1>
        <p>Reviewed national MEPS evidence makes economic, healthcare-work, and human burden visible without turning descriptive burden into attributable cost.</p>
      </header>
      <div className="caution">
        <strong>Gross burden is not attributable burden.</strong>
        <span>Reviewed MEPS estimates are national and descriptive—not diagnostic-delay cost, local prevalence, preventable spending, or savings.</span>
      </div>
    </div>
    <div className="domain-grid">
      {bundle.burden_domains.map(domain => {
        const reviewed = domain.measures.length > 0 && domain.measures.every(canExportEstimate);
        return <article className="card domain-card" key={domain.domain_id}>
          <div className="card-title-row">
            <div><h2>{domain.label}</h2><span>{domain.availability_state}</span></div>
            <span className={`status ${reviewed ? "status-ok" : "status-scaffold"}`}>
              {reviewed ? "Reviewed national evidence" : "Not release-eligible"}
            </span>
          </div>
          <div className="measure-list">
            {domain.measures.map(estimate => <div className="measure" key={estimate.estimate_id}>
              <div><strong>{estimate.label}</strong><span>{estimate.allowed_interpretation}</span></div>
              <div className="measure-value">
                {formatEstimateValue(estimate)}
                <small>{estimate.release_status === "reviewed_released" ? "Reviewed analytical estimate" : estimate.release_status.replaceAll("_"," ")}</small>
              </div>
            </div>)}
          </div>
          <p className="limitations">{domain.limitations.join(" ")}</p>
        </article>;
      })}
    </div>
    <div className="guardrail">
      <strong>Native units stay separate.</strong>
      <p>Administrative time, spending, screening measures, utilization, and access experience are not added into one opaque score. Out-of-pocket spending remains nested within total spending, and K6/PHQ-2 remain screening/distress measures rather than diagnoses.</p>
    </div>
    <Link className="button" to="/pilot">Continue to Pilot Planner</Link>
  </section>;
}
