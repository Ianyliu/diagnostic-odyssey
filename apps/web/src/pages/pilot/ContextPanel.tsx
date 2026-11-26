import { Link } from "react-router-dom";
import type { DataRequest, LocalContextRecord } from "@diagnostic-odyssey/contracts";
import { formatLocalContextValue } from "../../data/formatLocalContextValue";
import { formatPublishedLocalContextUncertainty } from "../../data/localContextPresentation";

export function ContextPanel({
  pilotLocalContext,
  currentOperationalDataRequests,
  clearPilotLocalContext
}: {
  pilotLocalContext: LocalContextRecord | null;
  currentOperationalDataRequests: DataRequest[];
  clearPilotLocalContext: () => void;
}) {
  return (
    <section id="pilot-context" className="atlas-pilot-context">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">ATTACHED LOCAL CONTEXT</p>
          <h3>Local planning context</h3>
        </div>
        <Link className="text-button" to="/local-context">
          {pilotLocalContext ? "Change in Local context →" : "Select in Local context →"}
        </Link>
      </div>
      {pilotLocalContext ? (
        <div className="atlas-context-chip-card">
          <strong>{pilotLocalContext.label}</strong>
          <span>{formatLocalContextValue(pilotLocalContext)}</span>
          <small>{pilotLocalContext.geography_name} · {formatPublishedLocalContextUncertainty(pilotLocalContext)}</small>
          <button type="button" className="text-button" onClick={clearPilotLocalContext}>
            Remove from Strategy Lab
          </button>
        </div>
      ) : (
        <p className="subtle">No local indicator attached; context never alters numeric scenario math.</p>
      )}
      <div className="atlas-footer-links">
        <Link className="button secondary" to="/data-requests">
          Open Data Requests ({currentOperationalDataRequests.length})
        </Link>
      </div>
    </section>
  );
}
