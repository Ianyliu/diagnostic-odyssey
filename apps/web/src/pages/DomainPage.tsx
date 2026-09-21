import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
export function DomainPage({domainId,title,description}:{domainId:string;title:string;description:string}) {
 const {bundle}=useArtifact(); if(!bundle) return null; const domain=bundle.burden_domains.find(d=>d.domain_id===domainId);
 return <section className="page page-stack"><ContextBar/><header className="page-heading"><h1>{title}</h1><p>{description}</p></header>{domain?<article className="card"><h2>{domain.label}</h2><p className="subtle">State: {domain.availability_state}</p>{domain.measures.map(m=><div className="measure" key={m.estimate_id}><div><strong>{m.label}</strong><span>{m.system_boundary}</span></div><div className="measure-value">{m.value===null?"Not released":String(m.value)}<small>{m.unit}</small></div></div>)}<p className="limitations">{domain.limitations.join(" ")}</p></article>:<div className="state-card"><strong>Not yet represented by a standalone artifact domain.</strong><span>This route remains available without borrowing values from another domain.</span></div>}</section>;
}
