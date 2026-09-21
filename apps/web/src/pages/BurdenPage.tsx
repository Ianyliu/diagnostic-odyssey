import { Link } from "react-router-dom";
import type { Estimate } from "@diagnostic-odyssey/contracts";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";

const formatValue = (estimate: Estimate) => {
  if (estimate.value === null) return estimate.release_status === "suppressed" ? "Suppressed" : "Not released";
  if (estimate.unit === "USD/year") return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(estimate.value);
  if (estimate.unit === "USD/person/year") return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(estimate.value);
  if (estimate.unit === "people") return new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:1}).format(estimate.value);
  return `${new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(estimate.value)} ${estimate.unit}`;
};

export function BurdenPage() {
  const {bundle} = useArtifact();
  if (!bundle) return null;
  return <section className="page page-stack">
    <ContextBar />
    <div className="heading-row">
      <header className="page-heading">
        <p className="eyebrow">BURDEN</p>
        <h1>Burden overview</h1>
        <p>Make hidden economic, healthcare-work, and human burden visible without turning descriptive burden into attributable cost.</p>
      </header>
      <div className="caution"><strong>Gross burden is not attributable burden.</strong><span>Fixture values are illustrative—not diagnostic-delay cost, local prevalence, or payer savings.</span></div>
    </div>
    <div className="domain-grid">
      {bundle.burden_domains.map(domain => <article className="card domain-card" key={domain.domain_id}>
        <div className="card-title-row"><div><h2>{domain.label}</h2><span>{domain.availability_state}</span></div><span className="status status-fixture">Illustrative / gated</span></div>
        <div className="measure-list">
          {domain.measures.map(estimate => <div className="measure" key={estimate.estimate_id}>
            <div><strong>{estimate.label}</strong><span>{estimate.allowed_interpretation}</span></div>
            <div className="measure-value">{formatValue(estimate)}<small>{estimate.release_status.replaceAll("_"," ")}</small></div>
          </div>)}
        </div>
        <p className="limitations">{domain.limitations.join(" ")}</p>
      </article>)}
    </div>
    <div className="guardrail"><strong>Native units stay separate.</strong><p>Administrative time, spending, screening measures, access constraints, and work friction are not added into one opaque score. Missing or unreleased measures show no implied magnitude.</p></div>
    <Link className="button" to="/pilot">Continue to Pilot Planner</Link>
  </section>;
}
