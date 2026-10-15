import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ArtifactState } from "./components/ArtifactState";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ArtifactProvider } from "./data/ArtifactContext";
import { OverviewPage } from "./pages/OverviewPage";
import { BurdenPage } from "./pages/BurdenPage";
import { DomainPage } from "./pages/DomainPage";
import { MedicalBurdenPage } from "./pages/MedicalBurdenPage";
import { LocalContextPage } from "./pages/LocalContextPage";
import { PilotPage } from "./pages/PilotPage";
import { EvidencePage } from "./pages/EvidencePage";
import { DataRequestsPage } from "./pages/DataRequestsPage";
import { BriefPage } from "./pages/BriefPage";

// Exact opt-in only. Vite eliminates the lazy import and fixtures from default builds.
const FutureAIExperiencePage = import.meta.env.VITE_FUTURE_AI_EXPERIENCE_DEMO === "on"
  ? lazy(() => import("./concept/FutureAIExperiencePage")) : null;

export function App() {
  return <ErrorBoundary><ArtifactProvider><ArtifactState><Routes>
    <Route element={<AppShell />}>
      <Route index element={<OverviewPage />} />
      <Route path="burden" element={<BurdenPage />} />
      <Route path="burden/medical" element={<MedicalBurdenPage />} />
      <Route path="burden/work" element={<DomainPage domainId="work-function" title="Work and function" description="Standalone route reserved for released work/function measures; no proxy borrowing." />} />
      <Route path="burden/admin" element={<DomainPage domainId="healthcare-work-admin" title="Healthcare-work / administrative burden" description="Invisible work remains in separate native-unit measures." />} />
      <Route path="burden/human" element={<DomainPage domainId="mental-human" title="Mental-health / human burden" description="Screening, distress, service use, and recognition experience remain distinct." />} />
      <Route path="local-context" element={<LocalContextPage />} />
      <Route path="pilot" element={<PilotPage />} />
      <Route path="evidence" element={<EvidencePage />} />
      <Route path="data-requests" element={<DataRequestsPage />} />
      <Route path="brief" element={<BriefPage />} />
      <Route path="concept/future-ai" element={FutureAIExperiencePage
        ? <Suspense fallback={<p className="page" role="status">Opening concept workspace…</p>}><FutureAIExperiencePage /></Suspense>
        : <Navigate to="/brief" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes></ArtifactState></ArtifactProvider></ErrorBoundary>;
}
