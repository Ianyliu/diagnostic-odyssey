import { longCovidAdapter, mecfsAdapter, type ConditionAdapter } from "@diagnostic-odyssey/condition-adapters";

export type CoverageModuleStatus = "live" | "coming_soon";

export interface CoverageCatalogEntry {
  readonly id: string;
  readonly editionLabel: string;
  readonly title: string;
  readonly status: CoverageModuleStatus;
  readonly compatibilityStatus: ConditionAdapter["compatibility_status"];
  readonly badgeLabel: string;
  readonly summary: string;
  readonly conditionLabel: string;
  readonly geographyLabel: string;
  readonly sourceHighlights: readonly string[];
  readonly plannedScope: string;
  readonly whyNotBorrowed: string;
  readonly limitations: readonly string[];
}

export const COVERAGE_EDITION_BADGE = "Edition 01: Long COVID · U.S. National & West Virginia";

export const COVERAGE_CATALOG: readonly CoverageCatalogEntry[] = Object.freeze([
  Object.freeze({
    id: "edition-01-long-covid",
    editionLabel: "Edition 01 — Live now",
    title: "Long COVID · U.S. National & West Virginia",
    status: "live",
    compatibilityStatus: longCovidAdapter.compatibility_status,
    badgeLabel: "Live now",
    summary: "Reviewed national descriptive burden paired separately with West Virginia implementation terrain.",
    conditionLabel: `${longCovidAdapter.label} (Adults ${longCovidAdapter.supported_age_ranges.join(", ")})`,
    geographyLabel: "U.S. National (2024 MEPS) + West Virginia (HRSA & 2024 ACS)",
    sourceHighlights: Object.freeze([
      "Long COVID · U.S. National 2024 MEPS · 21 reviewed measures (13 economic/healthcare, 4 administrative, 4 mental-health; work & function unavailable)",
      "West Virginia · Statewide HRSA & 2024 ACS · 34 access & shortage indicators (no county data)"
    ]),
    plannedScope: "Active reference edition covering national descriptive burden, West Virginia local access terrain, deterministic pilot planning, and Strategy AI Studio.",
    whyNotBorrowed: "National MEPS burden, West Virginia HRSA/ACS indicators, and pilot planning assumptions remain strictly separate layers and are never blended into one score.",
    limitations: longCovidAdapter.limitations
  }),
  Object.freeze({
    id: mecfsAdapter.condition_id,
    editionLabel: "Coming soon",
    title: mecfsAdapter.label,
    status: "coming_soon",
    compatibilityStatus: mecfsAdapter.compatibility_status,
    badgeLabel: "Partial compatibility",
    summary: "Condition adapter skeleton only; awaiting an independently reviewed national data bridge.",
    conditionLabel: mecfsAdapter.label,
    geographyLabel: "Pending reviewed survey cohort",
    sourceHighlights: Object.freeze([]),
    plannedScope: "ME/CFS recognition and care-navigation burden module once an eligible national dataset and cohort definition pass scientific review.",
    whyNotBorrowed: "Data is never borrowed or invented across conditions. Unavailable ME/CFS measures remain unavailable rather than substituting Long COVID 2024 MEPS estimates.",
    limitations: mecfsAdapter.limitations
  }),
  Object.freeze({
    id: "additional-geographies",
    editionLabel: "Coming soon",
    title: "Additional States & Counties",
    status: "coming_soon",
    compatibilityStatus: "planned",
    badgeLabel: "Planned",
    summary: "Expanded state and county HRSA shortage and Census ACS access profiles beyond West Virginia.",
    conditionLabel: "Cross-edition local terrain",
    geographyLabel: "Additional U.S. states and counties (planned)",
    sourceHighlights: Object.freeze([]),
    plannedScope: "Reviewed HRSA Health Professional Shortage Area designations and Census ACS access indicators for additional states and counties.",
    whyNotBorrowed: "Data is never borrowed or rescaled across geographies. West Virginia indicators describe West Virginia only, and local terrain never implies local disease prevalence.",
    limitations: Object.freeze([
      "Planned geographic expansion only; no unreviewed state or county figures are loaded.",
      "Absence of a state or county module does not mean zero access or shortage constraints."
    ])
  }),
  Object.freeze({
    id: "complex-chronic-pathways",
    editionLabel: "Coming soon",
    title: "Complex Chronic Care Pathways",
    status: "coming_soon",
    compatibilityStatus: "planned",
    badgeLabel: "Planned",
    summary: "Additional multi-step recognition, referral, and care-coordination pathway templates.",
    conditionLabel: "Multi-condition pathway library (planned)",
    geographyLabel: "Pending condition-adapter review",
    sourceHighlights: Object.freeze([]),
    plannedScope: "Structured pathway templates for complex post-infectious and chronic care coordination once adapter boundaries and admissible evidence checks are reviewed.",
    whyNotBorrowed: "Data and intervention parameters are never borrowed or extrapolated across unreviewed care pathways. Every scenario remains bound to its named pathway step and mechanism.",
    limitations: Object.freeze([
      "Planned pathway-library expansion only; no cost, savings, or effectiveness estimates are supplied.",
      "New pathway steps require independent adapter and admissibility review before activation."
    ])
  })
]);

export function getCoverageCatalogEntry(id: string): CoverageCatalogEntry | undefined {
  return COVERAGE_CATALOG.find(entry => entry.id === id);
}
