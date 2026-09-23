import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";

export function LocalContextPage() {
  const {bundle} = useArtifact();
  if (!bundle) return null;

  const hasLocalContext = bundle.local_context.length > 0;

  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading">
      <h1>Local implementation context</h1>
      <p>Local indicators are kept separate from national burden and may inform implementation feasibility only.</p>
    </header>

    {hasLocalContext ? <div className="card">
      <h2>Reviewed local implementation indicators</h2>
      {bundle.local_context.map(x => <div className="measure" key={`${x.geography}-${x.indicator}`}>
        <div><strong>{x.indicator}</strong><span>{x.source}</span></div>
        <div className="measure-value">{x.value === null ? "Missing / not available" : String(x.value)}<small>{x.state}</small></div>
      </div>)}
    </div> : <div className="empty-state">
      <strong>No reviewed local implementation indicators are loaded yet.</strong>
      <p>National MEPS burden remains unchanged by local context. Missing local context is not a zero constraint; future local indicators may inform implementation feasibility only.</p>
    </div>}

    <div className="guardrail">
      <strong>Local context cannot mutate national disease burden.</strong>
      <p>Future HRSA or ACS implementation indicators will remain a separate evidence class and will not recalculate the reviewed national MEPS estimates.</p>
    </div>
  </section>;
}
