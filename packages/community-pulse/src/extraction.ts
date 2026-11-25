import { choice, identifier, line, list, nullable, object, unique, validateShape, wireVersion } from "./schema.ts";
import type { ValidationResult } from "./schema.ts";
import {
  assertionTypes, changeTypes, datePrecisions, dateRoles, domains, geoRelations, recordStatuses
} from "./vocabulary.ts";
import type { AssertionType, ChangeType, DatePrecision, DateRole, Domain, GeoRelation, RecordStatus } from "./vocabulary.ts";
import { dateMatchesPrecision } from "./temporal.ts";

const extractionStatuses = ["ok", "no_relevant_change", "needs_review", "error"] as const;
const securityCodes = ["embedded_instruction", "ambiguous_anchor", "unsafe_input"] as const;
export interface ExtractionAnchor { segment_id: string; quote: string }
interface ExtractionClaim {
  text: string;
  assertion_type: AssertionType;
  attributed_to: string | null;
  anchors: ExtractionAnchor[];
}
interface DateMention {
  role: DateRole;
  precision: DatePrecision;
  as_written: string;
  value: string | null;
  anchor: ExtractionAnchor;
}
interface PlaceMention { as_written: string; relation: GeoRelation; anchor: ExtractionAnchor }
interface ExtractedRecord {
  title: string;
  change_type: ChangeType;
  domains: Domain[];
  status_suggestion: RecordStatus;
  claims: ExtractionClaim[];
  date_mentions: DateMention[];
  place_mentions: PlaceMention[];
}
export interface ExtractionResult {
  schema_version: typeof wireVersion;
  kind: "extraction_result";
  status: typeof extractionStatuses[number];
  records: ExtractedRecord[];
  reason_codes: string[];
  security_flags: { code: typeof securityCodes[number]; segment_id: string }[];
}

const anchor = object({ segment_id: identifier, quote: line(250) });
const claim = object({
  text: line(500), assertion_type: choice(assertionTypes), attributed_to: nullable(line(120)), anchors: list(anchor, 4, 1)
});
const dateMention = object({
  role: choice(dateRoles), precision: choice(datePrecisions), as_written: line(120),
  value: nullable(line(24)), anchor
});
const placeMention = object({ as_written: line(120), relation: choice(geoRelations), anchor });
const record = object({
  title: line(120), change_type: choice(changeTypes), domains: unique(choice(domains), domains.length, 1),
  status_suggestion: choice(recordStatuses), claims: list(claim, 12, 1),
  date_mentions: list(dateMention, 16), place_mentions: list(placeMention, 16)
});

export const extractionResultSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:diagnostic-odyssey:community-pulse:extraction-result:0.2.1",
  ...object({
    schema_version: choice([wireVersion]), kind: choice(["extraction_result"]), status: choice(extractionStatuses),
    records: list(record, 5), reason_codes: unique(identifier, 8),
    security_flags: list(object({ code: choice(securityCodes), segment_id: identifier }), 16)
  })
};

export function validateExtractionResult(value: unknown): ValidationResult<ExtractionResult> {
  const result = validateShape<ExtractionResult>(extractionResultSchema, value);
  if (!result.ok) return result;
  const { status, records, reason_codes: reasonCodes } = result.value;
  const issues: string[] = [];
  if (status === "ok" && records.length === 0) issues.push("$.records: an ok extraction requires records");
  if ((status === "error" || status === "no_relevant_change") && records.length > 0) {
    issues.push("$.records: this extraction status cannot include records");
  }
  if (status === "error" && reasonCodes.length === 0) issues.push("$.reason_codes: required for a failed extraction");
  for (const [recordIndex, candidate] of records.entries()) {
    for (const [dateIndex, mention] of candidate.date_mentions.entries()) {
      if (!dateMatchesPrecision(mention.precision, mention.value)) {
        issues.push(`$.records[${recordIndex}].date_mentions[${dateIndex}].value: does not match date precision`);
      }
    }
    for (const [claimIndex, currentClaim] of candidate.claims.entries()) {
      if (currentClaim.assertion_type === "attributed_statement" && currentClaim.attributed_to === null) {
        issues.push(`$.records[${recordIndex}].claims[${claimIndex}].attributed_to: attribution is required`);
      }
    }
  }
  return issues.length === 0 ? result : { ok: false, issues };
}

/** Checks exact support locations only. A matching quote is never evidence approval. */
export function checkExtractionAnchors(
  extraction: ExtractionResult,
  segments: Readonly<Record<string, string>>
): string[] {
  const issues: string[] = [];
  for (const [recordIndex, candidate] of extraction.records.entries()) {
    const anchors = [
      ...candidate.claims.flatMap(entry => entry.anchors),
      ...candidate.date_mentions.map(mention => mention.anchor),
      ...candidate.place_mentions.map(mention => mention.anchor)
    ];
    for (const [index, entry] of anchors.entries()) {
      const segment = Object.hasOwn(segments, entry.segment_id) ? segments[entry.segment_id] : undefined;
      const first = segment?.indexOf(entry.quote) ?? -1;
      if (segment === undefined || first < 0 || segment.indexOf(entry.quote, first + 1) >= 0) {
        issues.push(`$.records[${recordIndex}].anchors[${index}]: anchor is missing or ambiguous`);
      }
    }
  }
  return issues;
}
