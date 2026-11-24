import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { BurdenMeasureList } from "../components/BurdenMeasureList";
import { useArtifact } from "../data/ArtifactContext";
import { formatDataStateLabel } from "../data/presentationLabels";
import "./Ledger.css";

interface DomainPageProps {
  domainId: string;
  title: string;
  description: string;
  secondaryContent?: ReactNode;
}

export function DomainPage({
  domainId,
  title,
  description,
  secondaryContent
}: DomainPageProps) {
  const { bundle } = useArtifact();
  if (!bundle) return null;

  const domain = bundle.burden_domains.find(d => d.domain_id === domainId);
  const reviewed = domain?.measures.length
    ? domain.measures.every(canExportEstimate)
    : false;

  return (
    <section className="page page-stack domain-ledger-page">
      <header className="page-heading">
        <Link className="text-button" to="/burden">← Back to Costs</Link>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {domain ? (
        <article className="card domain-card ledger-panel">
          <div className="card-title-row">
            <div>
              <h2>{domain.label}</h2>
              <p className="subtle">
                {formatDataStateLabel(domain.availability_state)} · {domain.measures.length}{" "}
                {domain.measures.length === 1 ? "measure" : "measures"}
              </p>
            </div>
            <span className={`status ${reviewed ? "status-reviewed" : "status-unavailable"}`}>
              {reviewed ? "Reviewed national evidence" : "Not release-eligible"}
            </span>
          </div>
          <BurdenMeasureList estimates={domain.measures} />
        </article>
      ) : (
        <div className="state-card">
          <strong>Standalone route reserved without proxy borrowing.</strong>
          <span>Missing domain does not mean zero burden.</span>
        </div>
      )}
      {secondaryContent}
    </section>
  );
}
