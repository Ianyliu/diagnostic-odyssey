import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { PlaceholderPage } from "./components/PlaceholderPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PlaceholderPage title="Overview" description="Orient to the active analytical context, burden domains, evidence status, and next decision." />} />
        <Route path="burden" element={<PlaceholderPage title="Burden overview" description="Economic/healthcare, healthcare-work/administrative, and mental/human burden with explicit scientific status." />} />
        <Route path="burden/medical" element={<PlaceholderPage title="Economic / healthcare burden" description="Gross all-cause spending, utilization, out-of-pocket burden, and released source-of-payment evidence." />} />
        <Route path="burden/work" element={<PlaceholderPage title="Work and function" description="Work/function measures remain in their native units and are not automatically monetized or added to other burden constructs." />} />
        <Route path="burden/admin" element={<PlaceholderPage title="Healthcare-work / administrative burden" description="Visit time, paperwork, bills/insurance, approval friction, and other navigation work shown as separate measures." />} />
        <Route path="burden/human" element={<PlaceholderPage title="Mental-health / human burden" description="Screening/distress measures, care/access, and qualitative recognition burden remain distinct." />} />
        <Route path="local-context" element={<PlaceholderPage title="Local implementation context" description="Replaceable state/local context informs implementation without mutating national burden estimates." />} />
        <Route path="pilot" element={<PlaceholderPage title="Pilot Planner" description="Deterministic recognition/navigation planning tied to a named pathway step and mechanism." />} />
        <Route path="evidence" element={<PlaceholderPage title="Evidence" description="Reviewed evidence records, admissibility states, limitations, and provenance." />} />
        <Route path="data-requests" element={<PlaceholderPage title="Data requests" description="Structured operational and payer data requests for questions the current open-data stack cannot answer." />} />
        <Route path="brief" element={<PlaceholderPage title="Planning Brief" description="Decision-ready synthesis with released findings, assumptions, local constraints, evidence, data needs, and warnings." />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
