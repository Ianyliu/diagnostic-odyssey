import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { BurdenMeasureList } from "../components/BurdenMeasureList";
import { ContextBar } from "../components/ContextBar";
import { IntervalWhiskerPlot } from "../components/IntervalWhiskerPlot";
import { useArtifact } from "../data/ArtifactContext";
import { formatDataStateLabel } from "../data/presentationLabels";
import "./Ledger.css";

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

  return <section className="page page-stack burden-ledger-page">
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

    <div className="ledger-layout">
      <nav className="ledger-section-nav" aria-label="Burden sections">
        <p className="ledger-index-heading">On this page</p>
        <ol>{bundle.burden_domains.map(domain =>
          <li key={domain.domain_id}><a href={`#burden-${domain.domain_id}`}>{domain.label}</a></li>
        )}</ol>
      </nav>
      <div className="burden-domain-stack">
        {bundle.burden_domains.map(domain => {
        const reviewed = domain.measures.length > 0 && domain.measures.every(canExportEstimate);
        const administrativeHourMeasures = domain.domain_id === "healthcare-work-admin"
          ? domain.measures.filter(estimate => estimate.unit === "hours/person/year")
          : [];

        return <article className="card domain-card ledger-panel" id={`burden-${domain.domain_id}`} key={domain.domain_id}>
          <div className="card-title-row burden-domain-header">
            <div>
              <h2>{domain.label}</h2>
              <p className="subtle">
                {formatDataStateLabel(domain.availability_state)} · {domain.measures.length} {domain.measures.length === 1 ? "measure" : "measures"}
              </p>
            </div>
            <span className={`ledger-evidence-state ${reviewed ? "ledger-evidence-reviewed" : "ledger-evidence-gated"}`}>
              {reviewed ? "Reviewed national evidence" : "Not release-eligible"}
            </span>
          </div>

          {administrativeHourMeasures.length > 1 && <IntervalWhiskerPlot
            estimates={administrativeHourMeasures}
            title="Annual healthcare-work time with survey uncertainty"
            description="Comparable reviewed ESAQ time measures shown together because they share hours/person/year and the same respondent universe."
          />}

          <BurdenMeasureList estimates={domain.measures} />

          {domain.limitations.length > 0 && <details className="domain-limitations technical-disclosure">
            <summary>Domain interpretation boundaries</summary>
            <p>{domain.limitations.join(" ")}</p>
          </details>}
        </article>;
        })}
      </div>
    </div>

    <div className="guardrail">
      <strong>Native units stay separate.</strong>
      <p>Administrative time, spending, screening measures, utilization, and access experience are not added into one opaque score. Out-of-pocket spending remains nested within total spending, and K6/PHQ-2 remain screening/distress measures rather than diagnoses.</p>
    </div>
    <Link className="button" to="/pilot">Continue to Pilot Planner</Link>
  </section>;
}
