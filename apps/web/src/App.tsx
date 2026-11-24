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

// Strategy AI Studio (Prompt Studio + Explore) is available by default.
// Explicit VITE_FUTURE_AI_EXPERIENCE_DEMO=off excludes its route and chunk.
const FutureAIExperiencePage = import.meta.env.VITE_FUTURE_AI_EXPERIENCE_DEMO !== "off"
  ? lazy(() => import("./concept/FutureAIExperiencePage"))
  : null;

export function App() {
  const [showFutureConcept, setShowFutureConcept] = useState(FutureAIExperiencePage !== null);
  return (
    <ErrorBoundary>
      <ArtifactProvider>
        <ArtifactState>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<OverviewPage />} />
              <Route path="burden" element={<BurdenPage />} />
              <Route path="burden/medical" element={<MedicalBurdenPage />} />
              <Route
                path="burden/work"
                element={
                  <DomainPage
                    domainId="work-function"
                    title="Work & Function"
                    description="Standalone route for work/function measures; zero proxy borrowing."
                  />
                }
              />
              <Route
                path="burden/admin"
                element={
                  <DomainPage
                    domainId="healthcare-work-admin"
                    title="Administrative Work"
                    description="Time and navigation barriers measured in native units."
                  />
                }
              />
              <Route
                path="burden/human"
                element={
                  <DomainPage
                    domainId="mental-human"
                    title="Psychological Distress"
                    description="K6 and PHQ-2 screening measures—not clinical diagnoses."
                  />
                }
              />
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
                path="concept/future-ai"
                element={
                  FutureAIExperiencePage && showFutureConcept ? (
                    <Suspense fallback={<p className="page" role="status">Opening AI Strategist…</p>}>
                      <FutureAIExperiencePage onHide={() => setShowFutureConcept(false)} />
                    </Suspense>
                  ) : (
                    <Navigate to="/brief" replace />
                  )
                }
              />
              <Route
                path="advisor"
                element={
                  FutureAIExperiencePage && showFutureConcept ? (
                    <Suspense fallback={<p className="page" role="status">Opening AI Strategist…</p>}>
                      <FutureAIExperiencePage onHide={() => setShowFutureConcept(false)} />
                    </Suspense>
                  ) : (
                    <Navigate to="/brief" replace />
                  )
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
