import { Link } from "react-router-dom";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import {
  PLANNING_DEFAULTS_DESCRIPTION,
  PLANNING_DEFAULTS_LABEL
} from "../data/planningScenarioDefaults";

type NumericField = "eligible_population"|"reach"|"capacity"|"baseline_window_months"|"alternative_window_months"|"horizon_months"|"fixed_cost"|"per_participant_cost";

const fields: Array<{key:NumericField;label:string;step?:number;scale?:number;suffix?:string}> = [
  {key:"eligible_population",label:"Potentially eligible"},
  {key:"reach",label:"Intended reach",step:1,scale:100,suffix:"%"},
  {key:"capacity",label:"Program capacity"},
  {key:"baseline_window_months",label:"Baseline recognition window",suffix:"mo"},
  {key:"alternative_window_months",label:"Planning recognition window",suffix:"mo"},
  {key:"horizon_months",label:"Planning horizon",suffix:"mo"},
  {key:"fixed_cost",label:"Fixed program cost",suffix:"USD"},
  {key:"per_participant_cost",label:"Cost per participant",suffix:"USD"}
];

export function PilotPage() {
  const {scenario,scenarioResult,setScenario} = useArtifact();

  if (!scenario || !scenarioResult) {
    return <section className="page page-stack">
      <ContextBar />
      <header className="page-heading">
        <p className="eyebrow">PILOT PLANNER</p>
        <h1>Scope a feasible pilot</h1>
        <p>Planning assumptions are currently unavailable or invalid. Reviewed national burden remains available; no causal effect or savings estimate is inferred.</p>
      </header>
      <div className="empty-state">
        <strong>No valid planning scenario result is available.</strong>
        <p>Planning inputs are separate from reviewed analytical evidence and can be restored without changing the MEPS burden artifact.</p>
      </div>
    </section>;
  }

  const update = (key: NumericField, raw: string, scale = 1) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setScenario({...scenario,[key]:n/scale} as Scenario);
  };

  return <section className="page page-stack">
    <ContextBar />
    <div className="heading-row">
      <header className="page-heading"><p className="eyebrow">PILOT PLANNER</p><h1>Scope a feasible pilot</h1><p>Transparent recognition/navigation arithmetic from analyst-supplied assumptions. This is not a prediction or causal ROI estimate.</p></header>
      <div className="caution cool"><strong>Plan · Test · Learn</strong><span>Every scenario names the pathway step and mechanism it is allowed to change.</span></div>
    </div>
    <div className="pilot-grid">
      <form className="card assumption-card" onSubmit={e=>e.preventDefault()}>
        <h2>Planning assumptions</h2>
        <p className="subtle"><strong>{PLANNING_DEFAULTS_LABEL}</strong><br />{PLANNING_DEFAULTS_DESCRIPTION}</p>
        {fields.map(field => <label key={field.key}><span>{field.label}</span><span className="input-wrap"><input type="number" min="0" step={field.step ?? 1} value={(scenario[field.key] as number)*(field.scale ?? 1)} onChange={e=>update(field.key,e.target.value,field.scale ?? 1)} /><small>{field.suffix}</small></span></label>)}
      </form>
      <article className="card result-card">
        <h2>Baseline vs recognition/navigation scenario</h2>
        <p className="subtle">Deterministic planning arithmetic · not observed evidence or an evidence-derived effect</p>
        <dl className="result-list">
          <div><dt>Intended reach</dt><dd>{scenarioResult.intended_reach.toLocaleString()}</dd></div>
          <div><dt>Reached participants</dt><dd>{scenarioResult.reached_participants.toLocaleString()}</dd></div>
          <div><dt>Capacity gap</dt><dd>{scenarioResult.capacity_gap.toLocaleString()}</dd></div>
          <div><dt>Baseline person-month exposure</dt><dd>{scenarioResult.baseline_person_months.toLocaleString()}</dd></div>
          <div><dt>Planning person-month exposure</dt><dd>{scenarioResult.alternative_person_months.toLocaleString()}</dd></div>
          <div><dt>Difference in person-month exposure</dt><dd>{scenarioResult.difference_person_months.toLocaleString()}</dd></div>
          <div><dt>Program-resource requirement</dt><dd>{new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(scenarioResult.program_resource_requirement)}</dd></div>
        </dl>
        <div className="target-box"><strong>Target pathway step</strong><span>{scenario.target_pathway_step}</span><strong>Mechanism</strong><span>{scenario.mechanism}</span></div>
        <div className="guardrail compact"><strong>Not savings or ROI.</strong><p>The resource requirement is a program input. The person-month difference is a planning exposure quantity, not observed improvement.</p></div>
        <Link className="button" to="/brief">Preview Planning Brief</Link>
      </article>
    </div>
  </section>;
}
