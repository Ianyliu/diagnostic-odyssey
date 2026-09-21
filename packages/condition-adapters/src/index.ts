export interface PathwayStep {
  id: string;
  label: string;
  description: string;
}

export interface ConditionAdapter {
  condition_id: string;
  label: string;
  reference_cohort_id: string;
  supported_age_ranges: string[];
  burden_domain_ids: string[];
  pathway_steps: PathwayStep[];
  compatibility_status: "reference_implementation" | "partial_compatibility" | "planned";
  limitations: string[];
}

export const longCovidAdapter: ConditionAdapter = {
  condition_id: "long-covid-current",
  label: "Current Long COVID",
  reference_cohort_id: "current-long-covid-adults-18-64",
  supported_age_ranges: ["18–64"],
  burden_domain_ids: ["economic-healthcare", "healthcare-work-admin", "mental-human"],
  pathway_steps: [
    { id:"recognition", label:"Recognition", description:"Recognition of persistent post-COVID symptoms as requiring follow-up." },
    { id:"recognition-to-referral", label:"Recognition to referral", description:"Navigation from recognition to an appropriate referral." },
    { id:"referral-completion", label:"Referral completion", description:"Scheduling and completion of referred care." }
  ],
  compatibility_status: "reference_implementation",
  limitations: ["Reference implementation only; local context must not be treated as local disease burden."]
};

export const mecfsAdapter: ConditionAdapter = {
  condition_id: "mecfs",
  label: "ME/CFS",
  reference_cohort_id: "mecfs-compatibility",
  supported_age_ranges: [],
  burden_domain_ids: ["economic-healthcare", "healthcare-work-admin", "mental-human"],
  pathway_steps: [
    { id:"recognition", label:"Recognition", description:"Condition recognition/diagnostic pathway step." }
  ],
  compatibility_status: "partial_compatibility",
  limitations: [
    "Compatibility skeleton only.",
    "No ME/CFS cost estimates are provided until a defensible analytical bridge is reviewed.",
    "Unavailable measures must remain unavailable rather than borrowing Long COVID values."
  ]
};

export const conditionAdapters: Record<string, ConditionAdapter> = {
  [longCovidAdapter.condition_id]: longCovidAdapter,
  [mecfsAdapter.condition_id]: mecfsAdapter
};

export function getConditionAdapter(conditionId: string): ConditionAdapter | undefined {
  return conditionAdapters[conditionId];
}
