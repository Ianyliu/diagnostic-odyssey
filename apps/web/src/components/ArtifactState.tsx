import type { ReactNode } from "react";
import { useArtifact } from "../data/ArtifactContext";

export function ArtifactState({children}: {children: ReactNode}) {
  const {status,error} = useArtifact();
  if (status === "loading") return <section className="page"><div className="state-card" role="status"><strong>Loading versioned artifact…</strong><span>Validating scientific status and structure before rendering.</span></div></section>;
  if (status === "error") return <section className="page"><div className="state-card error" role="alert"><strong>Artifact unavailable</strong><span>{error}</span><span>The app will not substitute invented values.</span></div></section>;
  return <>{children}</>;
}
