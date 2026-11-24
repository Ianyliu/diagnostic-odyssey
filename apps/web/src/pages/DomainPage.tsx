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
      <header className="apple-page-header">
        <Link className="text-button" to="/burden">← All costs</Link>
        <h1>{title}</h1>
        <p className="apple-subtitle">{description}</p>
        <p className="micro-caption">National descriptive · Not causal</p>
      </header>

      {domain ? (
        <section className="burden-domain-section">
          <div className="burden-section-head">
            <div>
              <h2>{domain.label}</h2>
              <p className="subtle">
                {formatDataStateLabel(domain.availability_state)} · {domain.measures.length}{" "}
                {domain.measures.length === 1 ? "measure" : "measures"}
              </p>
            </div>
            <span className={`status ${reviewed ? "status-reviewed" : "status-neutral"}`}>
              {reviewed ? "Reviewed national evidence" : "Not release-eligible"}
            </span>
          </div>
          <BurdenMeasureList estimates={domain.measures} />
          {domain.limitations.length > 0 && (
            <details className="apple-accordion domain-limitations">
              <summary>Domain interpretation boundaries</summary>
              <p>{domain.limitations.join(" ")}</p>
            </details>
          )}
        </section>
      ) : (
        <div className="state-card">
          <strong>Not yet represented by a standalone reviewed domain.</strong>
          <span>No proxy values borrowed. Missing domain does not mean zero burden.</span>
        </div>
      )}
      {secondaryContent}
    </section>
  );
}
