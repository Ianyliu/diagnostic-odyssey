import type { NarrativeReference, NarrativeReferenceCatalog, NarrativeValidationIssue } from "./types.ts";

type Issue = NarrativeValidationIssue;
type JsonObject = Record<string, unknown>;
const sha256 = /^[0-9a-f]{64}$/;
const commitSha = /^[0-9a-f]{40}$/;
const claimId = /^[A-Z][A-Z0-9]*[0-9]{2}-[A-Z0-9]+-[0-9]{2}$/;
const doi = /^10\.[0-9]{4,9}\/\S+$/;
const pmcid = /^PMC[0-9]+$/;
const httpsUrl = /^https:\/\/\S+$/;
const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const sourceKinds = ["clinical_guidance", "peer_reviewed_article", "official_report"] as const;
const locatorKinds = ["section", "table", "page", "paragraph", "figure", "web_heading"] as const;
const causalClasses = [
  "clinical_guidance_non_effect", "qualitative_experience",
  "observational_pathway_description", "noncausal_service_evaluation"
] as const;
const allowedUses = ["planning_option_to_investigate", "background_context_only"] as const;
const reviewerStatuses = ["draft", "needs_review", "approved", "rejected"] as const;
const releaseStatuses = ["candidate", "reviewed_not_released", "reviewed_released", "rejected"] as const;

const sourceKeys = [
  "source_id", "citation", "title", "authors", "publication_year", "source_kind",
  "doi", "pmcid", "url", "locators", "retrieved_at", "source_sha256"
] as const;
const applicabilityKeys = [
  "population", "condition_definition", "setting", "payer", "geography",
  "pathway_step", "mechanism", "applicability_limits"
] as const;
const reviewKeys = ["reviewer_id", "reviewed_at", "review_note"] as const;
const recordKeys = [
  "claim_id", "source", "proposed_claim_wording", "approved_claim_wording",
  "prohibited_stronger_claims", "applicability", "causal_use_class", "allowed_use",
  "limitations", "reviewer_status", "review", "release_status",
  "quantitative_effect_eligible"
] as const;
const manifestKeys = [
  "schema_version", "artifact_family", "catalog_id", "release_status",
  "generated_at", "code_commit", "review_manifest_sha256", "automatic_release",
  "quantitative_effect_eligible"
] as const;

function issue(out: Issue[], path: string, message: string): void {
  out.push({ path, message });
}
function object(value: unknown, path: string, keys: readonly string[], out: Issue[]): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    issue(out, path, "must be a plain JSON object");
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) issue(out, path + "." + key, "unknown property is forbidden");
  }
  return true;
}
function str(value: unknown, path: string, out: Issue[]): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issue(out, path, "must be a non-empty string");
    return false;
  }
  return true;
}
function nullableStr(value: unknown, path: string, out: Issue[]): void {
  if (value !== null) str(value, path, out);
}
function match(value: unknown, regex: RegExp, path: string, out: Issue[]): void {
  if (str(value, path, out) && !regex.test(value)) issue(out, path, "invalid format");
}
function literal(value: unknown, expected: unknown, path: string, out: Issue[]): void {
  if (value !== expected) issue(out, path, "must be " + JSON.stringify(expected));
}
function oneOf(value: unknown, options: readonly string[], path: string, out: Issue[]): void {
  if (typeof value !== "string" || !options.includes(value)) issue(out, path, "invalid enum value");
}
function timestamp(value: unknown, path: string, out: Issue[]): void {
  if (!str(value, path, out)) return;
  if (!utcTimestamp.test(value) || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString() !== value) issue(out, path, "must be an exact UTC ISO timestamp with seconds");
}
function nullableTimestamp(value: unknown, path: string, out: Issue[]): void {
  if (value !== null) timestamp(value, path, out);
}
function nullableHash(value: unknown, path: string, out: Issue[]): void {
  if (value !== null) match(value, sha256, path, out);
}
function strings(value: unknown, path: string, out: Issue[], min = 0): void {
  if (!Array.isArray(value)) {
    issue(out, path, "must be an array of strings");
    return;
  }
  if (value.length < min) issue(out, path, "must contain at least " + min + " item(s)");
  value.forEach((entry: unknown, i: number) => str(entry, path + "[" + i + "]", out));
}
function source(value: unknown, path: string, out: Issue[]): void {
  if (!object(value, path, sourceKeys, out)) return;
  for (const k of ["source_id", "citation", "title"] as const) str(value[k], path + "." + k, out);
  strings(value.authors, path + ".authors", out, 1);
  if (typeof value.publication_year !== "number" || !Number.isInteger(value.publication_year) ||
      value.publication_year < 1900 || value.publication_year > 2100) {
    issue(out, path + ".publication_year", "must be a publication year from 1900 to 2100");
  }
  oneOf(value.source_kind, sourceKinds, path + ".source_kind", out);
  if (value.doi !== null) match(value.doi, doi, path + ".doi", out);
  if (value.pmcid !== null) match(value.pmcid, pmcid, path + ".pmcid", out);
  match(value.url, httpsUrl, path + ".url", out);
  if (!Array.isArray(value.locators) || value.locators.length === 0) {
    issue(out, path + ".locators", "must contain at least one exact source locator");
  } else {
    value.locators.forEach((entry: unknown, i: number) => {
      const p = path + ".locators[" + i + "]";
      if (object(entry, p, ["kind", "detail"], out)) {
        oneOf(entry.kind, locatorKinds, p + ".kind", out);
        str(entry.detail, p + ".detail", out);
      }
    });
  }
  nullableTimestamp(value.retrieved_at, path + ".retrieved_at", out);
  nullableHash(value.source_sha256, path + ".source_sha256", out);
}
function applicability(value: unknown, path: string, out: Issue[]): void {
  if (!object(value, path, applicabilityKeys, out)) return;
  for (const k of applicabilityKeys) {
    if (k === "applicability_limits") strings(value[k], path + "." + k, out);
    else str(value[k], path + "." + k, out);
  }
}
function review(value: unknown, path: string, out: Issue[]): void {
  if (!object(value, path, reviewKeys, out)) return;
  nullableStr(value.reviewer_id, path + ".reviewer_id", out);
  nullableTimestamp(value.reviewed_at, path + ".reviewed_at", out);
  str(value.review_note, path + ".review_note", out);
}
function reference(value: unknown, path: string, out: Issue[]): void {
  if (!object(value, path, recordKeys, out)) return;
  match(value.claim_id, claimId, path + ".claim_id", out);
  source(value.source, path + ".source", out);
  str(value.proposed_claim_wording, path + ".proposed_claim_wording", out);
  nullableStr(value.approved_claim_wording, path + ".approved_claim_wording", out);
  strings(value.prohibited_stronger_claims, path + ".prohibited_stronger_claims", out);
  applicability(value.applicability, path + ".applicability", out);
  oneOf(value.causal_use_class, causalClasses, path + ".causal_use_class", out);
  oneOf(value.allowed_use, allowedUses, path + ".allowed_use", out);
  strings(value.limitations, path + ".limitations", out);
  oneOf(value.reviewer_status, reviewerStatuses, path + ".reviewer_status", out);
  review(value.review, path + ".review", out);
  oneOf(value.release_status, releaseStatuses, path + ".release_status", out);
  literal(value.quantitative_effect_eligible, false, path + ".quantitative_effect_eligible", out);

  if (value.approved_claim_wording !== null && value.reviewer_status !== "approved")
    issue(out, path + ".approved_claim_wording", "approved wording requires approved reviewer status");
  if (value.reviewer_status === "rejected" && value.release_status !== "rejected")
    issue(out, path + ".release_status", "rejected review must have rejected release");
  if (value.release_status === "rejected" &&
      (value.reviewer_status !== "rejected" || value.approved_claim_wording !== null))
    issue(out, path + ".release_status", "rejected reference cannot carry approved wording");
  if (value.release_status === "reviewed_released") {
    if (value.reviewer_status !== "approved") issue(out, path + ".reviewer_status", "release requires approval");
    str(value.approved_claim_wording, path + ".approved_claim_wording", out);
    const src = value.source;
    if (typeof src === "object" && src !== null && !Array.isArray(src)) {
      match((src as JsonObject).source_sha256, sha256, path + ".source.source_sha256", out);
      timestamp((src as JsonObject).retrieved_at, path + ".source.retrieved_at", out);
    }
    const rev = value.review;
    if (typeof rev === "object" && rev !== null && !Array.isArray(rev)) {
      str((rev as JsonObject).reviewer_id, path + ".review.reviewer_id", out);
      timestamp((rev as JsonObject).reviewed_at, path + ".review.reviewed_at", out);
    }
    if (!Array.isArray(value.prohibited_stronger_claims) || value.prohibited_stronger_claims.length === 0)
      issue(out, path + ".prohibited_stronger_claims", "release requires explicit prohibited stronger claims");
    if (!Array.isArray(value.limitations) || value.limitations.length === 0)
      issue(out, path + ".limitations", "release requires explicit limitations");
  }
}
function manifest(value: unknown, path: string, out: Issue[]): void {
  if (!object(value, path, manifestKeys, out)) return;
  literal(value.schema_version, "1.0", path + ".schema_version", out);
  literal(value.artifact_family, "narrative_intervention_references", path + ".artifact_family", out);
  str(value.catalog_id, path + ".catalog_id", out);
  oneOf(value.release_status, ["candidate", "reviewed_released"], path + ".release_status", out);
  timestamp(value.generated_at, path + ".generated_at", out);
  str(value.code_commit, path + ".code_commit", out);
  nullableHash(value.review_manifest_sha256, path + ".review_manifest_sha256", out);
  literal(value.automatic_release, false, path + ".automatic_release", out);
  literal(value.quantitative_effect_eligible, false, path + ".quantitative_effect_eligible", out);
  if (value.release_status === "reviewed_released") {
    match(value.code_commit, commitSha, path + ".code_commit", out);
    match(value.review_manifest_sha256, sha256, path + ".review_manifest_sha256", out);
  }
  if (value.release_status === "candidate" && value.review_manifest_sha256 !== null)
    issue(out, path + ".review_manifest_sha256", "candidate catalog cannot imply reviewed promotion");
}

export function validateNarrativeReference(value: unknown, path = "narrative_reference"): Issue[] {
  const issues: Issue[] = [];
  reference(value, path, issues);
  return issues;
}

export function validateNarrativeReferenceCatalog(value: unknown, path = "narrative_catalog"): Issue[] {
  const issues: Issue[] = [];
  if (!object(value, path, ["manifest", "records"], issues)) return issues;
  manifest(value.manifest, path + ".manifest", issues);
  if (!Array.isArray(value.records)) {
    issue(issues, path + ".records", "must be an array");
    return issues;
  }
  const seenClaims = new Set<string>();
  const seenSources = new Map<string, string>();
  value.records.forEach((item: unknown, i: number) => {
    const p = path + ".records[" + i + "]";
    reference(item, p, issues);
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const r = item as JsonObject;
    if (typeof r.claim_id === "string") {
      if (seenClaims.has(r.claim_id)) issue(issues, p + ".claim_id", "duplicate claim ID");
      seenClaims.add(r.claim_id);
    }
    if (r.source && typeof r.source === "object" && !Array.isArray(r.source)) {
      const src = r.source as JsonObject;
      if (typeof src.source_id === "string") {
        // The same source may have multiple claim-specific locators, but not conflicting identity or archive digests.
        const identity = JSON.stringify([
          src.citation, src.title, src.authors, src.publication_year,
          src.source_kind, src.doi, src.pmcid, src.url, src.source_sha256
        ]);
        const previous = seenSources.get(src.source_id);
        if (previous !== undefined && previous !== identity)
          issue(issues, p + ".source.source_id", "conflicting bibliographic identity for source ID");
        seenSources.set(src.source_id, identity);
      }
    }
  });
  if (value.manifest && typeof value.manifest === "object" && !Array.isArray(value.manifest)) {
    const m = value.manifest as JsonObject;
    if (m.release_status === "reviewed_released") {
      if (value.records.length === 0) issue(issues, path + ".records", "released catalog cannot be empty");
      value.records.forEach((item: unknown, i: number) => {
        if (!item || typeof item !== "object" || Array.isArray(item) ||
            (item as JsonObject).release_status !== "reviewed_released")
          issue(issues, path + ".records[" + i + "].release_status", "released catalog requires released records");
      });
    } else if (m.release_status === "candidate") {
      value.records.forEach((item: unknown, i: number) => {
        if (item && typeof item === "object" && !Array.isArray(item) &&
            (item as JsonObject).release_status === "reviewed_released")
          issue(issues, path + ".records[" + i + "].release_status", "candidate catalog cannot contain a released record");
      });
    }
  }
  return issues;
}

export function assertValidNarrativeReference(value: unknown): asserts value is NarrativeReference {
  const issues = validateNarrativeReference(value);
  if (issues.length) throw new Error(issues.map(i => i.path + ": " + i.message).join("\n"));
}
export function assertValidNarrativeReferenceCatalog(value: unknown): asserts value is NarrativeReferenceCatalog {
  const issues = validateNarrativeReferenceCatalog(value);
  if (issues.length) throw new Error(issues.map(i => i.path + ": " + i.message).join("\n"));
}
