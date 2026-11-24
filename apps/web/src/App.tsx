import { lazy, Suspense, useState } from "react";
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

// Illustrative concept / Strategy AI Studio is available by default; explicit build-time "off" excludes its route and chunk.
const FutureAIExperiencePage = import.meta.env.VITE_FUTURE_AI_EXPERIENCE_DEMO !== "off"
  ? lazy(() => import("./concept/FutureAIExperiencePage")) : null;

export function App() {
  const [showFutureConcept, setShowFutureConcept] = useState(FutureAIExperiencePage !== null);
  const advisorAvailable = FutureAIExperiencePage !== null && showFutureConcept;
  return (
    <ErrorBoundary>
      <ArtifactProvider>
        <ArtifactState>
          <Routes>
            <Route element={<AppShell advisorAvailable={advisorAvailable} />}>
              <Route index element={<OverviewPage advisorAvailable={advisorAvailable} />} />
              <Route path="burden" element={<BurdenPage />} />
              <Route path="burden/medical" element={<MedicalBurdenPage />} />
              <Route path="burden/work" element={<DomainPage domainId="work-function" title="Work and function" description="Standalone route reserved for released work/function measures; no proxy borrowing." />} />
              <Route path="burden/admin" element={<DomainPage domainId="healthcare-work-admin" title="Administrative time" description="Healthcare paperwork, bills, and navigation hours." />} />
              <Route path="burden/human" element={<DomainPage domainId="mental-human" title="Human & distress measures" description="K6 and PHQ-2 remain screening measures, not diagnoses." />} />
              <Route path="local-context" element={<LocalContextPage />} />
              <Route path="pilot" element={<PilotPage />} />
              <Route path="evidence" element={<EvidencePage />} />
              <Route path="data-requests" element={<DataRequestsPage />} />
              <Route
                path="brief"
                element={
                  <BriefPage
                    conceptAvailable={FutureAIExperiencePage !== null}
                    showFutureConcept={showFutureConcept}
                    onFutureConceptChange={setShowFutureConcept}
                  />
                }
              />
              <Route
                path="advisor"
                element={
                  FutureAIExperiencePage && showFutureConcept
                    ? <Suspense fallback={<p className="page" role="status">Opening Strategy AI Studio…</p>}><FutureAIExperiencePage onHide={() => setShowFutureConcept(false)} /></Suspense>
                    : <Navigate to="/brief" replace />
                }
              />
              <Route
                path="concept/future-ai"
                element={
                  FutureAIExperiencePage && showFutureConcept
                    ? <Suspense fallback={<p className="page" role="status">Opening Strategy AI Studio…</p>}><FutureAIExperiencePage onHide={() => setShowFutureConcept(false)} /></Suspense>
                    : <Navigate to="/brief" replace />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ArtifactState>
      </ArtifactProvider>
    </ErrorBoundary>
  );
}
