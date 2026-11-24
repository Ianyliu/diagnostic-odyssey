import type { ReviewedGeminiResponse } from "../components/AiGeminiPanel";
import type { GoalId } from "./storyboard";
import { RoleLabel } from "./ConceptPrimitives";

function verifiedNumber(value:number, unit:string) {
  return value.toLocaleString("en-US",{maximumSignificantDigits:7})+" "+unit;
}

/**
 * A goal-specific presentation of the SAME validated Stage 2 result.
 * No additional inference, synthesis, effect estimates or web literature are
 * implied by switching goal tabs. The server alone resolves numerical values.
 */
export function ConceptLiveSummary({goal,result}:{goal:GoalId;result:ReviewedGeminiResponse|null}) {
  if (!result) return <aside className="fc-live-goal-summary" aria-label="Protected Gemini result not yet generated">
    <RoleLabel kind="result">Protected Preview / optional</RoleLabel>
    <p><strong>Connect the current Brief to this view.</strong> Run the consented Gemini analysis in the panel above.
      The cards below remain illustrative research and planning examples until a validated result is returned.</p>
  </aside>;

  const national=new Map(result.selected_evidence.national.map(item=>[item.id,item]));
  const supported=result.result.supported_findings.flatMap(item=>{
    const verified=national.get(item.id);
    return verified?[verified]:[];
  });
  return <section className="fc-live-goal-summary" aria-label="Current validated Gemini output">
    <div className="fc-live-goal-heading">
      <div><RoleLabel kind="result">Gemini-selected IDs / server-verified evidence</RoleLabel>
        <h3>{goal==="explain_brief"?"Reviewed findings for this Brief":
          goal==="explore_interventions"?"Intervention evidence gate":
          goal==="identify_data_gaps"?"Pending operational data questions":
          "What this evidence can—and cannot—compare"}</h3></div>
      <span className="fc-live-goal-tag">Validated Preview</span>
    </div>
    {goal==="explain_brief" && <>
      <p>These values are resolved from independently checked reviewed artifact bytes, not calculated or modified by Gemini.</p>
      <div className="fc-live-finding-grid">{supported.length ? supported.map(item=><article key={item.id}>
        <small>Reviewed MEPS 2024 · {item.source_id}</small>
        <h4>{item.label}</h4>
        <strong>{verifiedNumber(item.value,item.unit)}</strong>
        <p>Reported interval: {verifiedNumber(item.lower,item.unit)} to {verifiedNumber(item.upper,item.unit)}</p>
      </article>):<p>No eligible national finding was selected in this run.</p>}</div>
      <p className="fc-muted">{result.selected_evidence.local.length} WV implementation indicator(s) in this selection. Geographic context does not rescale national burden.</p>
    </>}
    {goal==="explore_interventions" && <>
      <p><strong>Insufficient evidence for intervention-effect claims.</strong> No effectiveness, avoided spending, or locally transferable causal effect has passed independent admission.</p>
      <p>Use the research workflow below to frame questions and inspect linked example publications. Those examples were not retrieved or reviewed by this Gemini run.</p>
      <p className="fc-muted">Intervention state: {result.result.sections.interventions.replaceAll("_"," ")} · {result.result.intervention_options.length} admitted options.</p>
    </>}
    {goal==="identify_data_gaps" && <>
      <p>Gemini may select bounded server-defined operational request templates. These are not findings of missing data and have not been added to your Data Requests.</p>
      {result.result.draft_requests.length?<ul className="fc-live-requests">{result.result.draft_requests.map(request=><li key={request.proposal_id}>
        <strong>{request.template.id.replaceAll("_"," ")}</strong>
        <span>Fields to verify: {request.template.field_codes.join(", ")}.</span>
        <small>Pending analyst review · aggregate only · owner not verified</small>
      </li>)}</ul>:<p>No pending operational request template was selected.</p>}
    </>}
    {goal==="compare_strategies" && <>
      <p><strong>No evidence-based strategy ranking is available.</strong> The current Gemini contract selects source-backed descriptive findings; it does not evaluate comparative effectiveness, local applicability, costs, or ROI.</p>
      <p>Use the interactive comparison below as a question framework, not a comparison of measured outcomes.</p>
      <p className="fc-muted">Evidence-bound selection: {supported.length} supported national finding(s); {result.result.draft_requests.length} operational draft(s); zero admitted comparative effects.</p>
    </>}
    <details><summary>Source integrity and interpretation boundaries</summary>
      <p>National artifact: {result.provenance.national_artifact_version} · SHA-256 {result.provenance.national_release_sha256}</p>
      {result.provenance.local_artifact_version && <p>Local context: {result.provenance.local_artifact_version} · SHA-256 {result.provenance.local_release_sha256}</p>}
      <p>{result.result.warnings.length} mandatory warning(s) retained. The detailed warnings and draft status remain in the protected Gemini result above.</p>
    </details>
  </section>;
}
