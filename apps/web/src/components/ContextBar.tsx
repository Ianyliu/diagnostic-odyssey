import { useArtifact } from "../data/ArtifactContext";
export function ContextBar() {
  const {bundle} = useArtifact();
  if (!bundle) return null;
  return <div className="context-bar" aria-label="Analytical context">
    <strong>Analytical context</strong>
    <span className="chip">Current Long COVID</span>
    <span className="chip">Adults {bundle.context.age_range}</span>
    <span className="chip">National evidence</span>
    <span className="chip">WV working context</span>
    <span className="context-version">{bundle.manifest.artifact_version} · {bundle.manifest.display_status}</span>
  </div>;
}
