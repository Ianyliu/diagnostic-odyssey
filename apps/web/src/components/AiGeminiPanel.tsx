import { useEffect, useRef, useState } from "react";
import type { AiHandoffTextV1 } from "../data/aiHandoff.ts";

type Selection = {
  schema_version:"do.gemini-reviewed.v1"; national_artifact_version:string;
  local_artifact_version:string|null; finding_ids:string[]; local_ids:string[];
  brief_generated_at:string;
};
type Finding = {id:string;label:string;value:number;unit:string;lower:number;upper:number;source_id:string;source_locator:string};
type Local = {id:string;label:string;value:number;unit:string;source_id:string;source_locator:string;source_vintage:string};
type Draft = {proposal_id:string;disposition:"pending";template:{id:string;field_codes:string[];owner_code:string;privacy_code:string}};
type ResponseBody = {
  mode:"reviewed_evidence_preview";provenance:{national_artifact_version:string;national_release_sha256:string;local_artifact_version:string|null;local_release_sha256:string|null};
  model:string;selected_evidence:{national:Finding[];local:Local[]};
  result:{snapshot_fingerprint:string;generation:{state:string};sections:{findings:string;interventions:string;requests:string};
  supported_findings:{id:string;value:number}[];draft_requests:Draft[];warnings:{id:string;code:string}[];
  intervention_options:unknown[];boundary:string};
};

function selectionFor(snapshot:AiHandoffTextV1):Selection {
  const p=snapshot.envelope.payload;
  return {
    schema_version:"do.gemini-reviewed.v1",
    national_artifact_version:p.artifact_version,
    local_artifact_version:p.local_context.length ? p.context.local_context_id : null,
    finding_ids:p.burden_findings.map(f=>f.estimate_id),
    local_ids:p.local_context.map(l=>l.indicator_id),
    brief_generated_at:p.generated_at
  };
}
const warningLabels:Record<string,string>={
  all_cause_not_attributable:"National all-cause spending and service use are descriptive, not Long COVID-attributable costs.",
  diagnostic_delay_effect_unmeasured:"No causal or diagnostic-delay attribution is established.",
  wv_context_does_not_rescale_national:"West Virginia implementation context does not rescale national MEPS findings.",
  survey_cis_not_causal_effect:"Survey uncertainty intervals do not measure intervention effects.",
  nested_expenditure_components_not_additive:"Nested spending components cannot be added to total spending.",
  phq2_k6_not_diagnosis:"PHQ-2 and K6 are screening or distress measures, not diagnoses.",
  esaq_annualized_time_not_longitudinal_status:"ESAQ time measures are annualized; later responses do not establish continued Long COVID.",
  no_independently_admitted_intervention_effect:"No intervention has passed independent evidence-and-applicability admission.",
  scenario_and_assumptions_not_verified_or_included:"Pilot scenario assumptions, results and sensitivities are excluded from this Gemini analysis.",
  ai_output_pending_independent_review:"Gemini selections and operational requests are drafts, not reviewed evidence."
};
function human(n:number,unit:string){return n.toLocaleString("en-US",{maximumSignificantDigits:7})+" "+unit;}
export function AiGeminiPanel({snapshot,sourceKey}:{snapshot:AiHandoffTextV1|null;sourceKey:string}) {
  const [token,setToken]=useState("");
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [shown,setShown]=useState<{key:string;data:ResponseBody}|null>(null);
  const controller=useRef<AbortController|null>(null);
  const key=JSON.stringify([sourceKey,snapshot?.envelope.generated_at,snapshot?.envelope.provenance.national_artifact_version]);
  const liveKey=useRef(key);
  liveKey.current=key;
  useEffect(()=>{
    controller.current?.abort();
    setShown(null);
    setBusy(false);
    setStatus("");
    return ()=>controller.current?.abort();
  },[key]);
  const run=async()=>{
    if(!snapshot||!consent||busy||!token.trim())return;
    const startedKey=key;
    controller.current?.abort();
    const ctl=new AbortController();
    controller.current=ctl;setBusy(true);setShown(null);setStatus("Verifying the selected reviewed artifact IDs…");
    const headers={"Authorization":"Bearer "+token.trim(),"Content-Type":"application/json"};
    const selection=selectionFor(snapshot);
    const endpoint="/api/ai-guidance";
    const send=async(action:"prepare"|"analyze",challenge:string|null)=>{
      const response=await fetch(endpoint,{method:"POST",headers,cache:"no-store",
        credentials:"same-origin",signal:ctl.signal,
        body:JSON.stringify({action,selection,consent:true,challenge})});
      if(!response.ok){
        if(response.status===401)throw Error("Operator credential rejected.");
        if(response.status===404)throw Error("Gemini is disabled for this deployment.");
        if(response.status===409||response.status===422)throw Error("The reviewed selection is stale or invalid. Regenerate the Brief preview.");
        if(response.status===429)throw Error("Preview request limit reached.");
        throw Error("Protected Gemini analysis is unavailable (HTTP "+response.status+").");
      }
      return response.json();
    };
    try {
      const prepared=await send("prepare",null) as {challenge?:string};
      if(typeof prepared.challenge!=="string")throw Error("The server did not prepare a validated snapshot.");
      if(liveKey.current!==startedKey||ctl.signal.aborted)return;
      setStatus("Requesting bounded candidate IDs from Gemini…");
      const result=await send("analyze",prepared.challenge) as ResponseBody;
      if(liveKey.current!==startedKey||ctl.signal.aborted)return;
      if(result.mode!=="reviewed_evidence_preview"||result.result?.generation.state!=="available")throw Error("A validated response was not available.");
      setShown({key:startedKey,data:result});
      setStatus("Preview result validated against the reviewed source artifacts.");
    }catch(error){
      if(!ctl.signal.aborted&&liveKey.current===startedKey)
        setStatus(error instanceof Error?error.message:"The protected analysis did not complete.");
    }finally{
      if(liveKey.current===startedKey&&!ctl.signal.aborted){setBusy(false);setConsent(false);}
    }
  };
  const selected=shown?.key===key?shown.data:null;
  const byId=new Map(selected?.selected_evidence.national.map(row=>[row.id,row])??[]);
  return <section className="ai-gemini-panel" aria-labelledby="ai-gemini-title">
    <h3 id="ai-gemini-title">Analyze with Gemini <span className="ai-gemini-tag">Protected Preview only</span></h3>
    <p>This separate, optional action uses only the selected reviewed 2024 MEPS IDs and West Virginia context IDs from the frozen Brief.
      The server verifies its own artifact bytes and supplies all numbers and warnings; Gemini can only choose candidate IDs.</p>
    <p><strong>Not sent:</strong> your optional question, patient information, numerical values from the browser, scenarios, analyst-authored data requests, or intervention claims.
      The two operational request templates below are independently labeled as unreviewed drafts, not your selected Brief requests.</p>
    {snapshot?.envelope.payload.scenario && <p className="ai-handoff-help">The current Pilot scenario is intentionally omitted because the server does not independently recompute it.</p>}
    {!!snapshot?.envelope.payload.data_requests.length && <p className="ai-handoff-help">
      {snapshot.envelope.payload.data_requests.length} selected Brief data request(s) are not passed to Gemini; those analyst-authored requests do not have a verified server-owned template mapping.</p>}
    <label htmlFor="ai-gemini-operator">Preview operator credential (session only; never saved)</label>
    <input id="ai-gemini-operator" type="password" autoComplete="off" value={token}
      onChange={e=>setToken(e.target.value)} placeholder="Paste AI_PREVIEW_TOKEN" />
    <label className="ai-gemini-consent" htmlFor="ai-gemini-consent">
      <input id="ai-gemini-consent" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
      I authorize sending this aggregate, ID-only reviewed-evidence selection to Google Gemini for one analysis.
    </label>
    <button className="button" type="button" disabled={!snapshot||busy||!consent||!token.trim()}
      onClick={()=>void run()}>{busy?"Analyzing…":"Analyze with Gemini"}</button>
    <p className="ai-handoff-help" role="status" aria-live="polite">{status}</p>
    {selected && <div className="ai-gemini-results" aria-label="Validated Gemini planning guidance">
      <p><strong>Source:</strong> {selected.provenance.national_artifact_version}; reviewed SHA-256 {selected.provenance.national_release_sha256}.
        {selected.provenance.local_artifact_version && <> Local context: {selected.provenance.local_artifact_version}.</>}</p>
      <p><strong>Scientific status:</strong> {selected.result.boundary.replaceAll("_"," ")}.
        Interventions: {selected.result.sections.interventions.replaceAll("_"," ")}.
        Operational request drafts: {selected.result.sections.requests.replaceAll("_"," ")}.</p>
      <h4>Gemini-selected supported national findings ({selected.result.supported_findings.length})</h4>
      {selected.result.supported_findings.length===0?<p>No supported findings were selected.</p>:
      <ul>{selected.result.supported_findings.map(f=>{
        const verified=byId.get(f.id);
        return <li key={f.id}><strong>{verified?.label??f.id}</strong>: {verified?human(verified.value,verified.unit):"Unavailable"}
          {verified&&<> (95% interval: {human(verified.lower,verified.unit)} to {human(verified.upper,verified.unit)})</>}
          <small> · Source {verified?.source_id??f.id}</small></li>;
      })}</ul>}
      <details><summary>Selected West Virginia implementation context ({selected.selected_evidence.local.length})</summary>
        <ul>{selected.selected_evidence.local.map(l=><li key={l.id}>
          <strong>{l.label}</strong>: {human(l.value,l.unit)} · {l.source_id} ({l.source_vintage})
        </li>)}</ul>
        <p>Geographic context only; not local Long COVID prevalence or cost.</p>
      </details>
      <h4>Draft operational data requests ({selected.result.draft_requests.length})</h4>
      {selected.result.draft_requests.length===0?<p>No operational draft was selected.</p>:
       <ul>{selected.result.draft_requests.map(d=><li key={d.proposal_id}>
         <strong>{d.template.id.replaceAll("_"," ")}</strong> — {d.template.field_codes.join(", ")}.
         Ownership to verify; aggregate only; pending independent review.</li>)}</ul>}
      <h4>Mandatory scientific limitations</h4>
      <ul>{selected.result.warnings.map(w=><li key={w.id}>{warningLabels[w.code]??w.code}</li>)}</ul>
      <p><strong>Insufficient evidence:</strong> no independently admitted intervention effectiveness or attributable costs.
        This output cannot change the Brief, source status, analyst selections, or published evidence.</p>
    </div>}
  </section>;
}
