/** Only reviewed provider home pages are used; prompt and optional question never appear in URLs. */
export const AI_PROVIDER_CHOICES = Object.freeze([
  Object.freeze({id: "chatgpt", label: "ChatGPT", home: "https://chatgpt.com/"}),
  Object.freeze({id: "claude", label: "Claude", home: "https://claude.ai/new"}),
  Object.freeze({id: "gemini", label: "Gemini", home: "https://gemini.google.com/app"}),
  Object.freeze({id: "copilot", label: "Copilot", home: "https://copilot.microsoft.com/"})
] as const);
export type AiHandoffProvider = (typeof AI_PROVIDER_CHOICES)[number];

/** Undefined shows the public provider set; an empty build flag means copy-only. */
export function availableAiProviders(buildSetting: string | undefined): readonly AiHandoffProvider[] {
  if (buildSetting === undefined) return AI_PROVIDER_CHOICES;
  const requested = new Set(buildSetting.split(",").map(item => item.trim().toLowerCase()).filter(Boolean));
  return AI_PROVIDER_CHOICES.filter(provider => requested.has(provider.id));
}

/** Fixed public-topic research links: never interpolate Brief, geography or optional question. */
const pubmed = (term: string): string => "https://pubmed.ncbi.nlm.nih.gov/?term=" + encodeURIComponent(term);
export const AI_PUBLIC_RESEARCH_LINKS = Object.freeze([
  Object.freeze({
    label: "PubMed · Long COVID and care navigation",
    url: pubmed('("long COVID"[tiab] OR "post-COVID condition"[tiab] OR PASC[tiab]) AND ("Patient Navigation"[MeSH] OR navigat*[tiab] OR "care coordination"[tiab])')
  }),
  Object.freeze({
    label: "PubMed · Systematic reviews",
    url: pubmed('("long COVID"[tiab] OR "post-COVID condition"[tiab]) AND ("care coordination"[tiab] OR navigat*[tiab]) AND systematic[sb]')
  }),
  Object.freeze({
    label: "ClinicalTrials.gov · Long COVID care navigation",
    url: "https://clinicaltrials.gov/search?term=" + encodeURIComponent("long COVID care navigation")
  })
]);
