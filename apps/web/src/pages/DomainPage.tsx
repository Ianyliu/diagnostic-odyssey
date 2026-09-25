import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { BurdenMeasureList } from "../components/BurdenMeasureList";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import { formatDataStateLabel } from "../data/presentationLabels";

export function DomainPage({domainId,title,description}:{domainId:string;title:string;description:string}) {
  const {bundle}=useArtifact();
  if(!bundle) return null;

  const domain=bundle.burden_domains.find(d=>d.domain_id===domainId);
  const reviewed = domain?.measures.length
    ? domain.measures.every(canExportEstimate)
    : false;

  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading"><h1>{title}</h1><p>{description}</p></header>
    {domain ? <article className="card domain-card">
      <div className="card-title-row burden-domain-header">
        <div>
          <h2>{domain.label}</h2>
          <p className="subtle">
            {formatDataStateLabel(domain.availability_state)} · {domain.measures.length} {domain.measures.length === 1 ? "measure" : "measures"}
          </p>
        </div>
        <span className={`status ${reviewed ? "status-ok" : "status-scaffold"}`}>
          {reviewed ? "Reviewed national evidence" : "Not release-eligible"}
        </span>
      </div>
      <BurdenMeasureList estimates={domain.measures} />
      {domain.limitations.length > 0 && <details className="domain-limitations technical-disclosure">
        <summary>Domain interpretation boundaries</summary>
        <p>{domain.limitations.join(" ")}</p>
      </details>}
    </article> : <div className="state-card">
      <strong>Not yet represented by a standalone reviewed domain.</strong>
      <span>This route remains available without borrowing values from another domain. Missing domain does not mean zero burden.</span>
    </div>}
  </section>;
}
