import { DEMO_LITERATURE_NOTICE, demoPublications, getDemoPublication, isSafeDemoLiteratureLink, type DemoPublication } from "./demoLiterature";

/** Source links show WHAT WAS READ FOR THE STORYBOARD, not reviewed evidence admitted to the product. */
export function DemoLiteratureNotice() {
  return <aside className="fc-demo-notice" aria-label="Literature example status">
    <strong>Example synthesis · static, not live AI</strong>
    <p>{DEMO_LITERATURE_NOTICE}</p>
    <p>Outside publications here are neither part of reviewed MEPS/WV releases nor approved intervention-effect evidence. Their results never enter Pilot calculations, Brief JSON or print.</p>
  </aside>;
}

export function DemoSourceCitation({source, compact = false}: {source: DemoPublication; compact?: boolean}) {
  return <div className="fc-demo-source">
    <span className="fc-demo-source-kind">{source.design}</span>
    <p><b>{source.citation}</b></p>
    <p>{source.title}</p>
    {!compact && <>
      <p><strong>Reported:</strong> {source.finding}</p>
      <p><strong>What this can support:</strong> {source.interpretation}</p>
      <p><strong>Limits:</strong> {source.limitations}</p>
    </>}
    <p className="fc-demo-source-links">
      {isSafeDemoLiteratureLink(source.url) && <a href={source.url} target="_blank" rel="noopener noreferrer">Read publication · DOI {source.doi} ↗</a>}
      {"correctionUrl" in source && isSafeDemoLiteratureLink(source.correctionUrl) &&
        <a href={source.correctionUrl} target="_blank" rel="noopener noreferrer">Read published population clarification ↗</a>}
    </p>
  </div>;
}

export function DemoSourceList({sourceIds}: {sourceIds: readonly DemoPublication["id"][]}) {
  return <div className="fc-demo-source-stack">{sourceIds.map(id => <DemoSourceCitation key={id} source={getDemoPublication(id)} />)}</div>;
}

/** Reusable example bibliography; entries are never promoted into approved evidence. */
export function DemoBibliography() {
  return <details className="fc-demo-bibliography"><summary>Sources behind this worked example · {demoPublications.length} publications</summary>
    <div className="fc-demo-source-stack">{demoPublications.map(source =>
      <DemoSourceCitation compact key={source.id} source={source} />)}</div>
    <p className="fc-muted">Manually checked for illustration on 2026-10-15. No systematic search, independent source admission or effectiveness synthesis was performed.</p>
  </details>;
}
