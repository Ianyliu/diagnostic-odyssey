import { Link } from "react-router-dom";
import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import {
  formatEstimateInterval,
  formatEstimateValue
} from "../data/formatEstimateValue";

function EstimateIntervalText({estimate}: {estimate: Estimate}) {
  if (!canExportEstimate(estimate)) return null;
  const interval = formatEstimateInterval(estimate);
  const accessibleInterval = interval
    .replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ")
    .replace(/^CI\s*/, "Confidence interval: ");

  return <small className="measure-interval">
    <span aria-hidden="true">{interval}</span>
    <span className="sr-only">{accessibleInterval}</span>
  </small>;
}

export function BurdenPage() {
  const {bundle} = useArtifact();
  if (!bundle) return null;

  const intervalMethods = Array.from(new Set(
    bundle.burden_domains
      .flatMap(domain => domain.measures)
      .filter(canExportEstimate)
      .map(estimate => estimate.interval_type)
      .filter((intervalType): intervalType is string => intervalType !== null)
  ));

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
    <div className="uncertainty-note">
      <strong>Survey uncertainty</strong>
      <p>Intervals shown are the reviewed 95% confidence intervals from the MEPS survey-weighted analysis.</p>
      <details className="interval-disclosure">
        <summary>About these intervals</summary>
        <p>Confidence intervals come directly from the reviewed MEPS artifact; no interval is recomputed in the web application. Survey weighting and design are preserved in the reviewed artifact metadata. These intervals describe sampling uncertainty for the descriptive survey estimates; they do not make gross burden attributable or causal.</p>
        {intervalMethods.length > 0 && <>
          <p><strong>Exact interval method metadata:</strong></p>
          <ul>{intervalMethods.map(method => <li key={method}>{method}</li>)}</ul>
        </>}
      </details>
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
                <EstimateIntervalText estimate={estimate} />
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
