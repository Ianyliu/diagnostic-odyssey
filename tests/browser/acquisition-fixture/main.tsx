// Isolated local engineering fixture. Not an application route or production import.
import React from "react";
import {createRoot} from "react-dom/client";
import {createAcquisitionResolver,createSensitivityDataRequest} from "@diagnostic-odyssey/acquisition-hints";
import {createBriefCodec} from "@diagnostic-odyssey/brief-core";
import {calculateScenario} from "@diagnostic-odyssey/scenario-engine";
import {AcquisitionGuidanceCard,AcquisitionGuidanceStatus} from "../../../apps/web/src/components/AcquisitionGuidanceCard";
import "@diagnostic-odyssey/ui/styles.css";
import "../../../apps/web/src/styles.css";
import "../../../apps/web/src/workspace.css";
import fixture from "../../../artifacts/generated/acquisition-browser-fixture/fixture.json";
const resolver=createAcquisitionResolver(fixture.bytes,fixture.pins);
const codec=createBriefCodec(resolver);
const requests=(["capacity","alternative_window_months"] as const).map(field=>resolver.attach(createSensitivityDataRequest(fixture.scenario,field),fixture.context,fixture.scenario).request);
const brief=codec.buildPlanningBrief({context:fixture.context,estimates:[],localContext:[],scenario:{input:fixture.scenario,result:calculateScenario(fixture.scenario)},evidence:[],dataRequests:requests,generatedAt:"2000-01-01T00:00:00Z"});
function download() {
  const url=URL.createObjectURL(new Blob([codec.serializeBriefJson(brief)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download="SYNTHETIC-acquisition-brief.json";link.click();URL.revokeObjectURL(url);
}
function App() {
  return <main className="page brief-content">
    <h1>Synthetic acquisition review fixture — no real admission</h1>
    <p>Engineering tests only. Neither this actor nor this registry is release evidence.</p>
    <button type="button" onClick={download}>Export synthetic JSON</button>
    {brief.acquisition_guidance?.map(guidance=><AcquisitionGuidanceCard key={guidance.request_id} guidance={guidance}/>)}
    <section aria-label="Invalid optional guidance fixture">
      <h2>Invalid optional reference — test only</h2>
      <AcquisitionGuidanceStatus resolution={resolver.resolve({...requests[0],acquisition_hint:{hint_id:"UNKNOWN"}},fixture.context,fixture.scenario)}/>
    </section>
    <section aria-label="Stale optional guidance fixture">
      <h2>Stale request binding — test only</h2>
      <AcquisitionGuidanceStatus resolution={resolver.resolve({...requests[0],acquisition_hint:{...requests[0]!.acquisition_hint!,request_fingerprint:"f".repeat(64)}},fixture.context,fixture.scenario)}/>
    </section>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
