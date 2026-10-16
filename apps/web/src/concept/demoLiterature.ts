/**
 * A small, manually checked, STATIC literature illustration for the Future AI storyboard.
 *
 * THESE SOURCES ARE NOT ADMITTED INTO Diagnostic Odyssey's reviewed evidence registry.
 * Nothing here may feed PlanningBrief, Pilot, numeric model parameters or canonical exports.
 * Source summaries were checked against the linked publisher/PMC pages on 2026-10-15.
 * This is a worked example of evidence appraisal, NOT a literature search or live AI output.
 */
export const DEMO_LITERATURE_REVIEW_DATE = "2026-10-15";
export const DEMO_LITERATURE_NOTICE =
  "Worked literature example · source-linked but NOT independently admitted to Diagnostic Odyssey evidence. No live AI, no systematic search, no treatment or policy recommendation.";

export const demoPublications = [
  {
    id: "mir-2025",
    title: "Addressing Inequalities in Long Covid Healthcare: A Mixed-Methods Study on Building Inclusive Services",
    citation: "Mir et al. · Health Expectations · 2025",
    doi: "10.1111/hex.70336",
    url: "https://doi.org/10.1111/hex.70336",
    design: "UK mixed-methods analysis of care pathways and inclusion",
    setting: "Northwest London primary care and specialist access",
    finding: "Interview and service evidence described referral and diagnosis barriers among disadvantaged groups. Linked clinical records were incomplete for a full equity analysis.",
    interpretation: "Supports formulating pathway-access and stratified measurement questions, not a causal effect of a navigation programme.",
    limitations: "Observational and context-specific; no randomized navigation-versus-usual-care effect or US cost estimate.",
    type: "observational"
  },
  {
    id: "feltz-cornelis-2024",
    title: "Integrated care policy recommendations for complex multisystem long term conditions and long COVID",
    citation: "van der Feltz-Cornelis et al. · Scientific Reports · 2024",
    doi: "10.1038/s41598-024-64060-1",
    url: "https://doi.org/10.1038/s41598-024-64060-1",
    design: "UK Delphi consensus involving patients and healthcare professionals",
    setting: "Integrated primary and specialist care in the United Kingdom",
    finding: "480 participants informed consensus priorities around coordinated multidisciplinary care and communication across service levels.",
    interpretation: "Informs a proposed care-coordination and professional-support workflow, but is not a comparative intervention trial.",
    limitations: "Consensus priorities are not measured patient benefit, referral improvement, cost savings or diagnostic-delay reduction.",
    type: "consensus"
  },
  {
    id: "mcgregor-2024",
    title: "Clinical effectiveness of an online supervised group physical and mental health rehabilitation programme for adults with post-covid-19 condition (REGAIN)",
    citation: "McGregor et al. · BMJ · 2024 (population clarification published May 2024)",
    doi: "10.1136/bmj-2023-076506",
    url: "https://doi.org/10.1136/bmj-2023-076506",
    correctionUrl: "https://doi.org/10.1136/bmj.q988",
    design: "Randomized trial: eight-week online supervised group rehabilitation versus an online usual-care advice session",
    setting: "England and Wales; 585 adults at least three months after discharge from hospital for COVID-19",
    finding: "The published adjusted mean difference in health-related quality-of-life PROPr at three months was 0.03 (95% CI 0.01 to 0.05).",
    interpretation: "Evidence about this rehabilitation intervention in a selected post-hospital population only. It does not test remote referral navigation or diagnostic delay.",
    limitations: "Post-hospital eligibility, online access and the specific comparator limit transportability; no Diagnostic Odyssey Pilot effect or preventable-cost parameter follows.",
    type: "randomized_trial"
  },
  {
    id: "curvelo-2024",
    title: "Health care for patients with long COVID: a scoping review",
    citation: "Curvelo et al. · Revista da Escola de Enfermagem da USP · 2024",
    doi: "10.1590/1980-220X-REEUSP-2024-0056en",
    url: "https://doi.org/10.1590/1980-220X-REEUSP-2024-0056en",
    design: "Scoping review of 13 primary studies published through June 2023",
    setting: "Multiple health-service settings",
    finding: "Mapped care including symptom-focused treatment and telerehabilitation, and identified fragmentation in published descriptions of long COVID services.",
    interpretation: "Provides background motivation to examine coordination, not proof that one strategy resolves fragmentation.",
    limitations: "Small, heterogeneous evidence map; not a pooled comparative effectiveness or cost-effectiveness estimate.",
    type: "scoping_review"
  }
] as const;

export type DemoPublication = (typeof demoPublications)[number];
export type DemoTopicId = "navigation" | "education" | "coordination";

/** An illustrative match, NOT a claim that the publication evaluated the strategy. */
export const demoTopicExamples: Record<DemoTopicId, {
  sourceIds: readonly DemoPublication["id"][];
  sampleSynthesis: string;
  directness: string;
  localTranslation: string;
  candidateFields: readonly string[];
  appraisal: string;
}> = {
  navigation: {
    sourceIds: ["mir-2025", "curvelo-2024"],
    sampleSynthesis: "The selected publications motivate tracking referral completion and unequal access. They do not establish that navigation reduces diagnostic delay.",
    directness: "Indirect: access observations and a scoping review, no matched navigator-programme trial.",
    localTranslation: "Potential pilot lens: identify the starting clinical milestone, number referred, completed appointments and elapsed time among eligible referrals.",
    candidateFields: ["referral_order_date", "specialist_visit_date", "referral_status", "eligibility_denominator", "referral_geography"],
    appraisal: "Do not infer local referral gaps or intervention benefit without source availability, denominator and comparison assessment."
  },
  education: {
    sourceIds: ["feltz-cornelis-2024", "curvelo-2024"],
    sampleSynthesis: "Integrated-care consensus and a care-mapping review suggest a reason to study recognition and specialist handoffs; neither quantifies training effectiveness.",
    directness: "Indirect: consensus and descriptive synthesis, not a clinician-education comparative trial.",
    localTranslation: "Potential pilot lens: document whether training is delivered, which providers participate, and whether referral decisions change.",
    candidateFields: ["provider_role", "training_date", "training_exposure", "referral_decision_date", "eligible_encounter_count"],
    appraisal: "Training participation is not evidence of improved diagnosis, patient outcomes or resource savings."
  },
  coordination: {
    sourceIds: ["mcgregor-2024", "feltz-cornelis-2024"],
    sampleSynthesis: "A supervised online rehabilitation trial provides one outcome example, and an integrated-care consensus study describes coordination priorities. Neither directly estimates diagnostic-navigation benefit.",
    directness: "Mixed and non-matching: an RCT of rehabilitation is not an RCT of referral coordination.",
    localTranslation: "Potential pilot lens: quantify digital eligibility, supervised staffing hours, follow-up completion and barriers to participation.",
    candidateFields: ["remote_access_eligible", "contact_attempt_date", "follow_up_completed", "staff_hours", "access_barrier_category"],
    appraisal: "Do not transfer the REGAIN outcome effect to generic remote coordination, US rural clinics, Pilot savings or preventable-cost claims."
  }
};

export const demoDecisionEvidence: Record<"referral" | "capacity" | "reach", {
  sourceId: DemoPublication["id"];
  exampleFinding: string;
  candidateDefinition: string;
  sampleOutput: string;
}> = {
  referral: {
    sourceId: "mir-2025",
    exampleFinding: "Published UK mixed-methods findings describe inconsistent referral access; they do not establish a missing local dataset.",
    candidateDefinition: "Days from first eligible recognition encounter to completed specialist visit; report non-completion separately.",
    sampleOutput: "Example review output: compare median referral days by eligibility group, with denominators and censoring defined before analysis."
  },
  capacity: {
    sourceId: "feltz-cornelis-2024",
    exampleFinding: "Consensus priorities include multidisciplinary access and primary-specialist communication, rather than estimated staffing requirements.",
    candidateDefinition: "Staffed appointment slots per service/week and completed visits, stratified by geography and specialty.",
    sampleOutput: "Example review output: distinguish planned slots, staffed slots and filled slots before assuming a capacity constraint."
  },
  reach: {
    sourceId: "curvelo-2024",
    exampleFinding: "A small scoping review describes varied service delivery; reach and local enrollment rates cannot be derived from it.",
    candidateDefinition: "Unique eligible people, successfully contacted people and enrolled people over the same reporting window.",
    sampleOutput: "Example review output: a denominated eligibility-to-contact-to-enrollment cascade with attrition and missingness."
  }
};

export function getDemoPublication(id: DemoPublication["id"]): DemoPublication {
  const found = demoPublications.find(source => source.id === id);
  if (!found) throw new Error("Unknown demo literature source");
  return found;
}

export function isSafeDemoLiteratureLink(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === "https:" && u.hostname === "doi.org" && !u.search && !u.hash;
  } catch { return false; }
}
