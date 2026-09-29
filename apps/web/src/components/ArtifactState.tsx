import type { ReactNode } from "react";
import { useArtifact } from "../data/ArtifactContext";

export function ArtifactState({children}: {children: ReactNode}) {
  const {status,error} = useArtifact();
  if (status === "loading") return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <main id="main-content" className="page artifact-state-page" tabIndex={-1}>
      <div className="state-card" role="status">
        <p className="eyebrow">ARTIFACT CHECK</p>
        <h1>Validating the evidence workspace</h1>
        <p>Checking the versioned analytical artifact and release state before rendering.</p>
      </div>
    </main>
  </>;
  if (status === "error") return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <main id="main-content" className="page artifact-state-page" tabIndex={-1}>
      <div className="state-card error" role="alert">
        <p className="eyebrow">ARTIFACT UNAVAILABLE</p>
        <h1>The analytical artifact could not be loaded.</h1>
        <p>{error}</p>
        <p>No substitute evidence or estimate has been created.</p>
      </div>
    </main>
  </>;
  return <>{children}</>;
}
