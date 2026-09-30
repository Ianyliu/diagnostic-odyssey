import {
  linkedConditionCandidateIds,
  linkedConditionPrecisionRuleVersion,
  validateLinkedConditionCandidateFile,
  type LinkedConditionCandidateId,
  type LinkedConditionCandidateValidationIssue
} from "./linked-condition-candidate.ts";

export const reviewedLinkedConditionArtifactVersion =
  "meps-2024-linked-condition-service-use-reviewed-20260929-v1" as const;
export const linkedConditionProductPolicyVersion = "linked_condition_product_policy_v1" as const;

export const linkedConditionProductPolicyV1 = {
  u09_linked_service_use_person_share: "admitted_secondary_descriptive",
  u09_linked_service_use_encounters_mean: "reviewed_not_product_admitted",
  u09_linked_service_use_office_encounters_mean: "reviewed_not_product_admitted",
  u09_linked_service_use_outpatient_encounters_mean: "suppressed_precision",
  u09_linked_service_use_emergency_encounters_mean: "suppressed_precision",
  u09_linked_service_use_inpatient_encounters_mean: "suppressed_unsupported_zero"
} as const;

export const linkedConditionCandidateAPresentationV1 = {
  candidate_id: "u09_linked_service_use_person_share",
  section_heading: "Documented U09-linked service-use footprint",
  measure_label: "Share with at least one 2024 encounter linked in MEPS to an exact U09 condition record",
  always_visible_explanation: "This is not the share diagnosed or recognized with Long COVID and does not measure Long-COVID-attributable healthcare use.",
  technical_limitations: [
    "Exact U09 is not equivalent to the governed operational-current Long COVID definition.",
    "Absence of U09 does not mean absence of Long COVID.",
    "Absence of a qualifying linked encounter does not mean absence of healthcare.",
    "Calendar-year 2024 encounters may occur before or after the Round 3/1 current-status anchor.",
    "Condition-event linkage does not establish causation.",
    "116 of 259 qualifying U09-linked events also carry at least one non-U09 condition link."
  ]
} as const;

export const reviewedLinkedConditionProvenanceV1 = {
  candidate_workflow_run_id: "36609436930",
  candidate_artifact_id: "11053325408",
  candidate_artifact_digest: "sha256:48aadea0db4e1c0bb6a2191286f0481dd256279f5ee020037aa15d2a2909296a",
  analytical_sha: "2a0309d1d29e623aac0d285fe49cf99717a3c777",
  candidate_schema_version: "2.0",
  source_candidate_estimates_sha256: "f87336132f84646606502a5e5acd4e4fa130a9e0ed5676e51f170d8c8ec0c24a"
} as const;

type Issue = LinkedConditionCandidateValidationIssue;
const forbidden = new Set(["DUPERSID", "CONDIDX", "EVNTIDX", "CLNKIDX"]);
const rec = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
const closed = (x: Record<string, unknown>, keys: readonly string[], p: string): Issue[] => {
  const ok = new Set(keys);
  return Object.keys(x).filter(k => !ok.has(k)).map(k => ({path: p + "." + k, message: "unexpected property"}));
};
const scan = (x: unknown, p: string, out: Issue[]): void => {
  if (Array.isArray(x)) return x.forEach((v, i) => scan(v, p + "[" + i + "]", out));
  if (!rec(x)) return;
  for (const [k, v] of Object.entries(x)) {
    if (forbidden.has(k)) out.push({path: p + "." + k, message: "respondent/event identifier fields are forbidden"});
    if (Array.isArray(v) && /(rows|records)$/i.test(k) && v.some(rec))
      out.push({path: p + "." + k, message: "arbitrary row-level object arrays are forbidden"});
    scan(v, p + "." + k, out);
  }
};
const exactArray = (x: unknown, y: readonly unknown[]): boolean =>
  Array.isArray(x) && x.length === y.length && x.every((v, i) => Object.is(v, y[i]));
const support = (x: unknown): readonly unknown[] | null =>
  rec(x) ? [x.unweighted_person_n, x.represented_strata_n, x.represented_stratum_psu_pairs_n, x.represented_singleton_strata_n] : null;

type Snapshot = {
  unit: string; value: number; se: number; lo: number; hi: number; target: number;
  nonzero: number; events: number; denom: number; df: number; rse: number | null;
  width: number; precision: string; reasons: readonly string[]; reporting: string;
  targetSupport: readonly number[]; nonzeroSupport: readonly number[];
};

const snapshots: Record<LinkedConditionCandidateId, Snapshot> = {
  u09_linked_service_use_person_share: {unit:"proportion",value:0.04796093404373186,se:0.01140890642074523,lo:0.02542838707094154,hi:0.07049348101652217,target:380,nonzero:22,events:109,denom:6831165.1075489996,df:159,rse:0.2378791541120182,width:0.04506509394558063,precision:"meps_precise",reasons:[],reporting:"reportable",targetSupport:[380,99,185,33],nonzeroSupport:[22,21,21,21]},
  u09_linked_service_use_encounters_mean: {unit:"encounters/person/year",value:0.1973708941306436,se:0.06722129795093537,lo:0.0646090852602324,hi:0.3301327030010547,target:380,nonzero:22,events:109,denom:6831165.1075489996,df:159,rse:0.3405836420158299,width:0.2655236177408223,precision:"meps_questionable_precision",reasons:["rse_30_to_50"],reporting:"reportable_with_caution",targetSupport:[380,99,185,33],nonzeroSupport:[22,21,21,21]},
  u09_linked_service_use_office_encounters_mean: {unit:"encounters/person/year",value:0.1562085830927701,se:0.05513049229600549,lo:0.04732606960015301,hi:0.2650910965853873,target:380,nonzero:17,events:86,denom:6831165.1075489996,df:159,rse:0.3529287008721169,width:0.2177650269852343,precision:"meps_questionable_precision",reasons:["rse_30_to_50"],reporting:"reportable_with_caution",targetSupport:[380,99,185,33],nonzeroSupport:[17,17,17,17]},
  u09_linked_service_use_outpatient_encounters_mean: {unit:"encounters/person/year",value:0.03350284715268952,se:0.01902069550751614,lo:-0.004062954438858124,hi:0.07106864874423717,target:380,nonzero:7,events:21,denom:6831165.1075489996,df:159,rse:0.5677337039693717,width:0.07513160318309529,precision:"meps_unstable_precision",reasons:["rse_above_50"],reporting:"suppress_precision",targetSupport:[380,99,185,33],nonzeroSupport:[7,7,7,7]},
  u09_linked_service_use_emergency_encounters_mean: {unit:"encounters/person/year",value:0.007659463885183907,se:0.006239326370914688,lo:-0.004663182067592815,hi:0.01998210983796063,target:380,nonzero:2,events:2,denom:6831165.1075489996,df:159,rse:0.8145904810627459,width:0.02464529190555344,precision:"meps_unstable_precision",reasons:["rse_above_50"],reporting:"suppress_precision",targetSupport:[380,99,185,33],nonzeroSupport:[2,2,2,2]},
  u09_linked_service_use_inpatient_encounters_mean: {unit:"encounters/person/year",value:0,se:0,lo:0,hi:0,target:380,nonzero:0,events:0,denom:6831165.1075489996,df:159,rse:null,width:0,precision:"unsupported_zero",reasons:["zero_positive_support"],reporting:"suppress_unsupported_zero",targetSupport:[380,99,185,33],nonzeroSupport:[0,0,0,0]}
};

export function validateReviewedLinkedConditionCandidateSnapshot(x: unknown): Issue[] {
  const out = [...validateLinkedConditionCandidateFile(x)];
  if (!rec(x) || !Array.isArray(x.candidates)) return out;
  const byId = new Map<string, Record<string, unknown>>();
  for (const c of x.candidates) if (rec(c) && str(c.candidate_id)) byId.set(c.candidate_id, c);
  for (const id of linkedConditionCandidateIds) {
    const c = byId.get(id), e = snapshots[id];
    if (!c) continue;
    const pairs: Array<[string, unknown]> = [
      ["unit",e.unit],["value",e.value],["standard_error",e.se],["interval_low",e.lo],
      ["interval_high",e.hi],["unweighted_target_n",e.target],["unweighted_nonzero_person_n",e.nonzero],
      ["observed_qualifying_event_n",e.events],["weighted_denominator",e.denom],
      ["ci_degrees_of_freedom",e.df],["relative_standard_error",e.rse],["interval_width",e.width],
      ["precision_status",e.precision],["precision_reporting_status",e.reporting],
      ["precision_rule_version",linkedConditionPrecisionRuleVersion]
    ];
    for (const [f, expected] of pairs) if (!Object.is(c[f], expected))
      out.push({path:"reviewed.candidates."+id+"."+f,message:"must exactly match reviewed run 36609436930"});
    if (!exactArray(c.precision_reason_codes,e.reasons))
      out.push({path:"reviewed.candidates."+id+".precision_reason_codes",message:"must exactly match reviewed run 36609436930"});
    if (!exactArray(support(c.target_support),e.targetSupport))
      out.push({path:"reviewed.candidates."+id+".target_support",message:"must exactly match reviewed run 36609436930"});
    if (!exactArray(support(c.nonzero_support),e.nonzeroSupport))
      out.push({path:"reviewed.candidates."+id+".nonzero_support",message:"must exactly match reviewed run 36609436930"});
    if (c.ci_df_source !== "full PERSON / PERWT24F survey design")
      out.push({path:"reviewed.candidates."+id+".ci_df_source",message:"must preserve reviewed CI-df source"});
    if (c.product_release_eligible !== false)
      out.push({path:"reviewed.candidates."+id+".product_release_eligible",message:"historical candidate release eligibility must remain false"});
  }
  return out;
}

export function validateLinkedConditionProductPolicy(x: unknown): Issue[] {
  const out: Issue[] = [];
  if (!rec(x)) return [{path:"product_policy",message:"must be an object"}];
  out.push(...closed(x,["schema_version","artifact_family","policy_version","reviewed_artifact_version","runtime_selected","candidate_states","candidate_a_presentation"],"product_policy"));
  if (x.schema_version!=="1.0") out.push({path:"product_policy.schema_version",message:"must be 1.0"});
  if (x.artifact_family!=="linked_condition_service_use_product_policy") out.push({path:"product_policy.artifact_family",message:"invalid artifact family"});
  if (x.policy_version!==linkedConditionProductPolicyVersion) out.push({path:"product_policy.policy_version",message:"unknown product policy version"});
  if (x.reviewed_artifact_version!==reviewedLinkedConditionArtifactVersion) out.push({path:"product_policy.reviewed_artifact_version",message:"unknown reviewed artifact version"});
  if (x.runtime_selected!==false) out.push({path:"product_policy.runtime_selected",message:"PR 1 must remain runtime inactive"});
  if (!Array.isArray(x.candidate_states)||x.candidate_states.length!==6) out.push({path:"product_policy.candidate_states",message:"must contain exactly six governed candidates"});
  else {
    const seen=new Set<string>();
    x.candidate_states.forEach((v,i)=>{
      const p="product_policy.candidate_states["+i+"]";
      if(!rec(v)){out.push({path:p,message:"must be an object"});return;}
      out.push(...closed(v,["candidate_id","product_policy_state"],p));
      if(!str(v.candidate_id)||!linkedConditionCandidateIds.includes(v.candidate_id as LinkedConditionCandidateId)){out.push({path:p+".candidate_id",message:"unknown candidate ID"});return;}
      const id=v.candidate_id as LinkedConditionCandidateId;
      if(seen.has(id)) out.push({path:p+".candidate_id",message:"duplicate candidate ID"}); seen.add(id);
      if(v.product_policy_state!==linkedConditionProductPolicyV1[id]) out.push({path:p+".product_policy_state",message:"must equal frozen v1 assignment"});
    });
    for(const id of linkedConditionCandidateIds) if(!seen.has(id)) out.push({path:"product_policy.candidate_states",message:"missing governed candidate "+id});
  }
  const a=x.candidate_a_presentation;
  if(!rec(a)) out.push({path:"product_policy.candidate_a_presentation",message:"must be an object"});
  else {
    out.push(...closed(a,["candidate_id","section_heading","measure_label","always_visible_explanation","technical_limitations"],"product_policy.candidate_a_presentation"));
    for(const f of ["candidate_id","section_heading","measure_label","always_visible_explanation"] as const)
      if(a[f]!==linkedConditionCandidateAPresentationV1[f]) out.push({path:"product_policy.candidate_a_presentation."+f,message:"must match independently reviewed Candidate A wording"});
    if(!exactArray(a.technical_limitations,linkedConditionCandidateAPresentationV1.technical_limitations))
      out.push({path:"product_policy.candidate_a_presentation.technical_limitations",message:"must match reviewed technical limitations"});
  }
  scan(x,"product_policy",out); return out;
}

export const reviewedLinkedConditionReconciliationV1 = {
  target_n:380,target_nonzero_person_n:22,target_zero_person_n:358,target_unique_events_n:109,
  family_counts:{office:86,outpatient:21,emergency:2,inpatient:0},
  overall_u09_linked_unique_events_n:259,events_with_additional_non_u09_condition_link_n:116,
  represented_target_strata_n:99,represented_target_stratum_psu_pairs_n:185,
  weighted_target_denominator:6831165.107549
} as const;

export function validateReviewedLinkedConditionDiagnostics(x: unknown): Issue[] {
  const out: Issue[]=[]; if(!rec(x)) return [{path:"reviewed_diagnostics",message:"must be an object"}];
  out.push(...closed(x,["schema_version","artifact_family","artifact_version","source_candidate_schema_version","analytical_sha","full_person_design","target_support","reconciliation","precision_governance","scientific_guardrails"],"reviewed_diagnostics"));
  if(x.schema_version!=="1.0") out.push({path:"reviewed_diagnostics.schema_version",message:"must be 1.0"});
  if(x.artifact_family!=="linked_condition_service_use_reviewed_diagnostics") out.push({path:"reviewed_diagnostics.artifact_family",message:"invalid artifact family"});
  if(x.artifact_version!==reviewedLinkedConditionArtifactVersion) out.push({path:"reviewed_diagnostics.artifact_version",message:"unknown reviewed artifact version"});
  if(x.source_candidate_schema_version!=="2.0") out.push({path:"reviewed_diagnostics.source_candidate_schema_version",message:"must be 2.0"});
  if(x.analytical_sha!==reviewedLinkedConditionProvenanceV1.analytical_sha) out.push({path:"reviewed_diagnostics.analytical_sha",message:"must preserve analytical SHA"});
  const r=x.reconciliation;
  if(!rec(r)) out.push({path:"reviewed_diagnostics.reconciliation",message:"must be an object"});
  else {
    const e=reviewedLinkedConditionReconciliationV1;
    for(const f of ["target_n","target_nonzero_person_n","target_zero_person_n","target_unique_events_n","overall_u09_linked_unique_events_n","events_with_additional_non_u09_condition_link_n","represented_target_strata_n","represented_target_stratum_psu_pairs_n","weighted_target_denominator"] as const)
      if(!Object.is(r[f],e[f])) out.push({path:"reviewed_diagnostics.reconciliation."+f,message:"must preserve reviewed Issue #20 reconciliation"});
    if(!rec(r.family_counts)) out.push({path:"reviewed_diagnostics.reconciliation.family_counts",message:"must be an object"});
    else for(const f of ["office","outpatient","emergency","inpatient"] as const) if(r.family_counts[f]!==e.family_counts[f]) out.push({path:"reviewed_diagnostics.reconciliation.family_counts."+f,message:"must preserve reviewed Issue #20 reconciliation"});
    if(r.passed!==true) out.push({path:"reviewed_diagnostics.reconciliation.passed",message:"must be true"});
  }
  const p=x.precision_governance;
  if(!rec(p)||p.rule_version!==linkedConditionPrecisionRuleVersion||p.rule_reviewed!==true||p.historical_candidate_product_release_eligible!==false)
    out.push({path:"reviewed_diagnostics.precision_governance",message:"must preserve precision governance and historical false release eligibility"});
  if(!Array.isArray(x.scientific_guardrails)||x.scientific_guardrails.length===0||x.scientific_guardrails.some(v=>!str(v)))
    out.push({path:"reviewed_diagnostics.scientific_guardrails",message:"must be a non-empty string array"});
  scan(x,"reviewed_diagnostics",out); return out;
}

const hashes = {
  "meps-hc256-2024":["653891861ec18574b07f576915e6f9e423263fc947610dc34e1bd176feff7b40","b4bde859b39f626345561c05570292bb7264dd92eb76ce0c1a14d6b89076aed5"],
  "meps-hc255-2024":["2068c1c5481f615c1275374f881d6b3db09df7e516ef1f859a4223639c41ba7e","7ec48af4a8ad924b9a1214fc92e7c1f1cab02b6144eaf43b737a5932de3f38f3"],
  "meps-hc254i-2024":["42adefd0ec70466cd5fe4a4925e33c2d69f97cab42fa63dcb597e4fa594be663","c32ebf66c97234aba4ceeeda9a8fed59b1162de594674238ee58ad72721ecd02"],
  "meps-hc254g-2024":["b753f4eb816ecc3bfffd71596febdf07efc0469aeb1415af89e2f5e42fb0b087","19e81a7f816ea8bf518dd0a47ac6087bb747f5f0feffb3dd64d36c250864cda4"],
  "meps-hc254f-2024":["e45b43cea4d38ab775fbc94e4dfee9675cb48a286d174b0963f61c33fdc1aa39","dd76d6426c5f06e8435c85c7b8bb3b46db731ac0c40972dee60af22b4f65bc7b"],
  "meps-hc254e-2024":["35d5a9ce677e7a9f0e9ae62a1e5a375f6c5b448ffee12e81df405bca391009f6","23071ad1ffa7a2abf46721f4388be6b462f2fc6413dbef8323282db276081723"],
  "meps-hc254d-2024":["c9be532d0bfba870e41d80d0962554bf5e07738883c09d1567d0a41cbae0dc89","5a71c7680f11ebb7dfc5e579ea8b63e6fb090b2ff2eb9a943c7abccdc13cb464"]
} as const;

export function validateReviewedLinkedConditionSources(x: unknown): Issue[] {
  const out: Issue[]=[]; if(!rec(x)) return [{path:"source_metadata",message:"must be an object"}];
  if(x.schema_version!=="1.0"||x.artifact_family!=="linked_condition_service_use_reviewed_sources"||x.artifact_version!==reviewedLinkedConditionArtifactVersion||x.status!=="source-integrity-verified")
    out.push({path:"source_metadata",message:"invalid reviewed source metadata header"});
  if(!Array.isArray(x.sources)||x.sources.length!==7) out.push({path:"source_metadata.sources",message:"must contain exactly seven reviewed sources"});
  else {
    const seen=new Set<string>();
    x.sources.forEach((s,i)=>{
      const p="source_metadata.sources["+i+"]"; if(!rec(s)||!str(s.source_id)){out.push({path:p,message:"invalid source"});return;}
      const id=s.source_id as keyof typeof hashes; if(!(id in hashes)){out.push({path:p+".source_id",message:"unknown source ID"});return;}
      if(seen.has(id)) out.push({path:p+".source_id",message:"duplicate source ID"}); seen.add(id);
      const h=hashes[id]; if(s.archive_sha256!==h[0]||s.extracted_sha256!==h[1]||s.archive_sha256_match!==true||s.extracted_sha256_match!==true||s.required_variable_validation!=="passed")
        out.push({path:p,message:"source integrity must match reviewed metadata"});
    });
    for(const id of Object.keys(hashes)) if(!seen.has(id)) out.push({path:"source_metadata.sources",message:"missing source "+id});
  }
  scan(x,"source_metadata",out); return out;
}

export function validateReviewedLinkedConditionRunManifest(x: unknown): Issue[] {
  const out: Issue[]=[]; if(!rec(x)) return [{path:"run_manifest",message:"must be an object"}];
  const e={repository:"Ianyliu/diagnostic-odyssey",github_sha:reviewedLinkedConditionProvenanceV1.analytical_sha,github_ref:"refs/heads/main",github_ref_name:"main",workflow:"MEPS 2024 Linked-Condition Candidate",workflow_run_id:"36609436930",workflow_run_attempt:"1",phase:"candidate-only"} as const;
  for(const [k,v] of Object.entries(e)) if(x[k]!==v) out.push({path:"run_manifest."+k,message:"must preserve reviewed run provenance"});
  if(!str(x.started_at_utc)) out.push({path:"run_manifest.started_at_utc",message:"must be non-empty"});
  scan(x,"run_manifest",out); return out;
}

export function validateReviewedLinkedConditionManifest(x: unknown): Issue[] {
  const out: Issue[]=[]; if(!rec(x)) return [{path:"review_manifest",message:"must be an object"}];
  const e={schema_version:"1.0",artifact_family:"linked_condition_service_use_reviewed",artifact_version:reviewedLinkedConditionArtifactVersion,candidate_workflow_run_id:"36609436930",candidate_artifact_id:"11053325408",candidate_artifact_digest:reviewedLinkedConditionProvenanceV1.candidate_artifact_digest,analytical_sha:reviewedLinkedConditionProvenanceV1.analytical_sha,candidate_schema_version:"2.0",precision_rule_version:linkedConditionPrecisionRuleVersion,product_policy_version:linkedConditionProductPolicyVersion,automatic_release:false,runtime_selected:false,promotion_commit:null,source_candidate_estimates_sha256:reviewedLinkedConditionProvenanceV1.source_candidate_estimates_sha256,reviewed_candidate_records_file:"linked-condition-candidate-estimates.json",candidate_records_exact_json_value_preserved:true} as const;
  for(const [k,v] of Object.entries(e)) if(x[k]!==v) out.push({path:"review_manifest."+k,message:"must preserve reviewed promotion metadata"});
  if(!str(x.promotion_commit_note)) out.push({path:"review_manifest.promotion_commit_note",message:"must explain external Git promotion provenance"});
  const reviews=x.reviews;
  if(!rec(reviews)) out.push({path:"review_manifest.reviews",message:"must be an object"});
  else {
    for(const k of ["candidate_to_reviewed_invariance","provenance","construct_and_wording","suppression_policy","privacy"]) if(reviews[k]!=="approved") out.push({path:"review_manifest.reviews."+k,message:"must be approved"});
    if(reviews.product_release_scope!=="candidate_a_secondary_descriptive_policy_approved_runtime_inactive") out.push({path:"review_manifest.reviews.product_release_scope",message:"must preserve runtime-inactive scope"});
  }
  const s=x.product_release_scope;
  const required={candidate_a_policy_state:"admitted_secondary_descriptive",candidate_a_is_ordinary_national_burden_estimate:false,runtime_activation:"inactive",planning_brief_export:"excluded",overview:"excluded",decision_state_rail:"excluded",pilot_scenario:"excluded",intervention_evidence_workflow:"excluded"} as const;
  if(!rec(s)) out.push({path:"review_manifest.product_release_scope",message:"must be an object"});
  else for(const [k,v] of Object.entries(required)) if(s[k]!==v) out.push({path:"review_manifest.product_release_scope."+k,message:"must preserve approved product scope"});
  scan(x,"review_manifest",out); return out;
}

export function assertValidReviewedLinkedConditionPackage(input: {
  candidateFile: unknown; reviewedDiagnostics: unknown; sourceMetadata: unknown;
  runManifest: unknown; reviewManifest: unknown; productPolicy: unknown;
}): void {
  const issues=[
    ...validateReviewedLinkedConditionCandidateSnapshot(input.candidateFile),
    ...validateReviewedLinkedConditionDiagnostics(input.reviewedDiagnostics),
    ...validateReviewedLinkedConditionSources(input.sourceMetadata),
    ...validateReviewedLinkedConditionRunManifest(input.runManifest),
    ...validateReviewedLinkedConditionManifest(input.reviewManifest),
    ...validateLinkedConditionProductPolicy(input.productPolicy)
  ];
  scan(input,"reviewed_package",issues);
  if(issues.length) throw new Error("Invalid reviewed linked-condition package:\n"+issues.map(i=>"- "+i.path+": "+i.message).join("\n"));
}
