import { evidenceClaimLabel } from "@diagnostic-odyssey/evidence-core";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";

export function EvidencePage() {
  const {bundle} = useArtifact();
  if (!bundle) return null;

  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading">
      <h1>What this analysis supports</h1>
      <p>Intervention-effect evidence is kept separate from descriptive burden and planning assumptions.</p>
    </header>

    {bundle.evidence.length === 0 ? <div className="empty-state">
      <strong>No reviewed intervention-effect parameter is loaded.</strong>
      <p>Unsupported causal effects, savings, ROI, and preventable-cost claims remain unavailable. The reviewed national MEPS burden is descriptive evidence, not an intervention-effect estimate.</p>
    </div> : bundle.evidence.map(x => <article className="card" key={x.evidence_id}>
      <div className="card-title-row">
        <h2>{x.allowed_use}</h2>
        <span className="status status-scaffold">{evidenceClaimLabel(x)}</span>
      </div>
      <p>{x.source}</p>
      <p className="limitations">{x.limitations.join(" ")}</p>
    </article>)}
  </section>;
}
