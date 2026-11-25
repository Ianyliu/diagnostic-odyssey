import {
  choice, count, date, identifier, instant, line, list, nullable, object, unique,
  url, uuid, validateShape, wireVersion, type ValidationResult
} from "./schema.ts";
import { countyName, stateNames, westVirginiaCounties } from "./geography.ts";
import { dateMatchesPrecision } from "./temporal.ts";
import {
  assertionTypes, changeTypes, datePrecisions, dateRoles, domains, geoRelations, recordStatuses,
  type AssertionType, type ChangeType, type DatePrecision, type DateRole, type Domain,
  type GeoRelation, type RecordStatus
} from "./vocabulary.ts";

const geoTypes = ["county", "state", "national_context", "unknown"] as const;
const coverageStatuses = ["complete", "partial", "not_monitored", "unavailable"] as const;
const evidenceClasses = ["primary_official_document", "official_statement_as_reported", "independent_origins",
  "single_origin", "attributed_interested_party"] as const;
const correctionActions = ["correct", "retract", "expire"] as const;

export interface RevisionRef { record_id: string; revision: number }
export interface TypedDate {
  role: DateRole; precision: DatePrecision; value: string | null; as_written: string | null; evidence_ids: string[];
}
export interface GeographicRelation {
  relation: GeoRelation; geo_type: typeof geoTypes[number]; as_written: string | null;
  fips_codes: string[]; resolution_method: "documented_registry" | "not_resolved"; evidence_ids: string[];
}
export interface EvidenceRecord {
  evidence_id: string; source_id: string; canonical_url: string; publisher: string; origin_publisher: string;
  republished_from: string | null; locator: string; retrieved_at: string; published_at: string | null;
  provenance_class: typeof evidenceClasses[number];
}
export interface LedgerClaim {
  claim_id: string; text: string; assertion_type: AssertionType; attributed_to: string | null; evidence_ids: string[];
}
export interface LedgerRecord extends RevisionRef {
  title: string; change_type: ChangeType; domains: Domain[]; status: RecordStatus; status_as_of: string;
  dates: TypedDate[]; geographic_relations: GeographicRelation[]; claims: LedgerClaim[]; supersedes: RevisionRef[];
  reviewed_interpretation: { text: string; claim_ids: string[] } | null;
  verification_path: string | null;
}
export interface CoverageRecord {
  scope: "west_virginia" | "county";
  county_fips: string | null; domain: Domain; status: typeof coverageStatuses[number];
  eligible: number; due: number; checked: number; window_started_at: string; window_ended_at: string;
  last_success_at: string | null; reason_codes: string[];
}
export interface Tombstone extends RevisionRef {
  action: typeof correctionActions[number]; at: string; reason_code: string; replacement: RevisionRef | null;
}
export interface EventSnapshot {
  schema_version: typeof wireVersion; kind: "event_snapshot"; snapshot_id: string; created_at: string;
  previous_snapshot_id: string | null; records: LedgerRecord[]; evidence: EvidenceRecord[];
  coverage: CoverageRecord[]; tombstones: Tombstone[];
}

const refFields = { record_id: uuid, revision: count(1, 100_000) };
const revisionRef = object(refFields);
const evidenceIds = unique(identifier, 12, 1);
const record = object({
  ...refFields, title: line(120), change_type: choice(changeTypes), domains: unique(choice(domains), 8, 1),
  status: choice(recordStatuses), status_as_of: date,
  dates: list(object({
    role: choice(dateRoles), precision: choice(datePrecisions), value: nullable(line(32)),
    as_written: nullable(line(180)), evidence_ids: evidenceIds
  }), 15),
  geographic_relations: list(object({
    relation: choice(geoRelations), geo_type: choice(geoTypes), as_written: nullable(line(180)),
    fips_codes: unique(line(5), 55), resolution_method: choice(["documented_registry", "not_resolved"]),
    evidence_ids: evidenceIds
  }), 16, 1),
  claims: list(object({
    claim_id: identifier, text: line(500), assertion_type: choice(assertionTypes),
    attributed_to: nullable(line(120)), evidence_ids: evidenceIds
  }), 20, 1),
  supersedes: list(revisionRef, 12),
  reviewed_interpretation: nullable(object({ text: line(500), claim_ids: unique(identifier, 20, 1) })),
  verification_path: nullable(line(500))
});
const evidence = object({
  evidence_id: identifier, source_id: identifier, canonical_url: url, publisher: line(120),
  origin_publisher: line(120), republished_from: nullable(url), locator: line(200),
  retrieved_at: instant, published_at: nullable(instant), provenance_class: choice(evidenceClasses)
});
const coverage = object({
  scope: choice(["west_virginia", "county"]), county_fips: nullable(line(5)),
  domain: choice(domains), status: choice(coverageStatuses),
  eligible: count(0, 100_000), due: count(0, 100_000), checked: count(0, 100_000),
  window_started_at: instant, window_ended_at: instant, last_success_at: nullable(instant),
  reason_codes: unique(identifier, 16)
});
const tombstone = object({
  ...refFields, action: choice(correctionActions), at: instant, reason_code: identifier, replacement: nullable(revisionRef)
});
export const eventSnapshotSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:diagnostic-odyssey:community-pulse:event-snapshot:0.2.1",
  ...object({
    schema_version: choice([wireVersion]), kind: choice(["event_snapshot"]), snapshot_id: uuid,
    created_at: instant, previous_snapshot_id: nullable(uuid), records: list(record, 200),
    evidence: list(evidence, 400), coverage: list(coverage, 500), tombstones: list(tombstone, 300)
  })
};

const ref = (value: RevisionRef) => value.record_id + "@" + value.revision;
const isAfter = (a: string, b: string) => Date.parse(a) > Date.parse(b);

export function validateEventSnapshot(value: unknown): ValidationResult<EventSnapshot> {
  const shape = validateShape<EventSnapshot>(eventSnapshotSchema, value);
  if (!shape.ok) return shape;
  const snapshot = shape.value;
  const issues: string[] = [];
  const check = (condition: boolean, problem: string) => { if (!condition) issues.push(problem); };
  const evidenceIds = new Set(snapshot.evidence.map(row => row.evidence_id));
  const active = new Map(snapshot.records.map(row => [row.record_id, row]));
  const withdrawn = new Set(snapshot.tombstones.map(ref));
  const coverageKeys = new Set(snapshot.coverage.map(row => row.scope + ":" + row.county_fips + ":" + row.domain));
  check(snapshot.previous_snapshot_id !== snapshot.snapshot_id, "snapshot cannot be its own predecessor");
  check(evidenceIds.size === snapshot.evidence.length, "duplicate evidence identifier");
  check(active.size === snapshot.records.length, "duplicate active record identifier");
  check(withdrawn.size === snapshot.tombstones.length, "duplicate tombstone");
  check(coverageKeys.size === snapshot.coverage.length, "duplicate coverage key");
  for (const row of snapshot.evidence) {
    check(!isAfter(row.retrieved_at, snapshot.created_at), "evidence retrieval after snapshot");
    check(row.published_at === null || !isAfter(row.published_at, row.retrieved_at), "evidence published after retrieval");
  }
  const hasReferences = (ids: string[]) => ids.every(id => evidenceIds.has(id));
  const corrections = new Map(snapshot.tombstones.map(row => [ref(row), row.replacement]));
  for (const row of snapshot.records) {
    check(row.status_as_of <= snapshot.created_at.slice(0, 10), "status checked after snapshot");
    check(!withdrawn.has(ref(row)), "withdrawn revision cannot appear in active records");
    const claimIds = new Set(row.claims.map(claim => claim.claim_id));
    check(claimIds.size === row.claims.length, "duplicate claim ID on active record");
    check(row.claims.every(claim => hasReferences(claim.evidence_ids) &&
      (claim.assertion_type !== "attributed_statement" || claim.attributed_to !== null)), "unresolved claim source or attribution");
    check(row.reviewed_interpretation === null ||
      row.reviewed_interpretation.claim_ids.every(id => claimIds.has(id)), "unresolved interpretation claim");
    check(row.dates.every(d => dateMatchesPrecision(d.precision, d.value) && hasReferences(d.evidence_ids)), "invalid typed date");
    check(new Set(row.supersedes.map(ref)).size === row.supersedes.length &&
      row.supersedes.every(prior => withdrawn.has(ref(prior)) && ref(prior) !== ref(row) &&
        (prior.record_id !== row.record_id || prior.revision < row.revision)), "invalid supersession");
    check(row.revision === 1 || row.supersedes.some(prior => prior.record_id === row.record_id && prior.revision === row.revision - 1),
      "missing immediate prior revision");
    for (const geo of row.geographic_relations) {
      const fips = geo.fips_codes;
      const resolved = geo.geo_type === "county" || geo.geo_type === "state";
      check(hasReferences(geo.evidence_ids) && (resolved
        ? fips.length > 0 && geo.resolution_method === "documented_registry" && fips.every(code => geo.geo_type === "county"
          ? countyName(code) !== undefined : Object.hasOwn(stateNames, code))
        : fips.length === 0 && geo.resolution_method === "not_resolved"), "unsupported geography or unresolved geography with FIPS");
    }
  }
  for (const row of snapshot.tombstones) {
    check(!isAfter(row.at, snapshot.created_at), "tombstone after snapshot");
    const replacement = row.replacement;
    check((row.action === "correct") === (replacement !== null), "invalid replacement for tombstone action");
    if (!replacement) continue;
    const current = active.get(replacement.record_id);
    check(ref(replacement) !== ref(row)
      && (replacement.record_id !== row.record_id || replacement.revision > row.revision)
      && (current?.revision === replacement.revision || corrections.has(ref(replacement))), "unresolved correction replacement");
    const seen = new Set([ref(row)]);
    let next: RevisionRef | null | undefined = replacement;
    while (next && !seen.has(ref(next))) {
      seen.add(ref(next));
      next = corrections.get(ref(next));
    }
    check(!next, "cyclic correction replacement");
  }
  for (const row of snapshot.coverage) {
    check((row.scope === "county" && row.county_fips !== null && Object.hasOwn(westVirginiaCounties, row.county_fips))
      || (row.scope === "west_virginia" && row.county_fips === null), "invalid coverage scope");
    check(row.checked <= row.due && row.due <= row.eligible &&
      !isAfter(row.window_started_at, row.window_ended_at) && !isAfter(row.window_ended_at, snapshot.created_at)
      && (row.last_success_at === null || !isAfter(row.last_success_at, row.window_ended_at)), "inconsistent coverage counts or dates");
    if (row.status === "complete") check(row.eligible > 0 && row.checked === row.due, "incomplete monitoring labeled complete");
    if (row.status === "not_monitored") check(row.eligible === 0 && row.last_success_at === null, "monitored sources labeled not monitored");
    if (row.status === "partial") check(row.checked > 0 && row.checked < row.due, "partial coverage requires both checked and missed sources");
    if (row.status === "unavailable") check(row.checked === 0 && row.due > 0, "unavailable coverage requires a missed check");
    if (row.status !== "complete") check(row.reason_codes.length > 0, "coverage gap requires a reason");
  }
  return issues.length ? { ok: false, issues } : shape;
}

/** A publisher can use this check before activation against the current authoritative snapshot. */
export function validateSnapshotTransition(previous: EventSnapshot, proposed: unknown): ValidationResult<EventSnapshot> {
  const result = validateEventSnapshot(proposed);
  if (!result.ok) return result;
  const next = result.value;
  const oldTombstones = new Map(previous.tombstones.map(row => [ref(row), row]));
  const newTombstones = new Map(next.tombstones.map(row => [ref(row), row]));
  const nextRecords = new Map(next.records.map(row => [row.record_id, row]));
  const issues: string[] = [];
  if (next.previous_snapshot_id !== previous.snapshot_id || !isAfter(next.created_at, previous.created_at)) {
    issues.push("snapshot does not advance the current state");
  }
  for (const [key, prior] of oldTombstones) {
    const carried = newTombstones.get(key);
    const unchanged = carried && carried.action === prior.action && carried.at === prior.at &&
      carried.reason_code === prior.reason_code &&
      (carried.replacement ? ref(carried.replacement) : null) === (prior.replacement ? ref(prior.replacement) : null);
    if (!unchanged) issues.push("prior tombstone was omitted or changed: " + key);
  }
  for (const prior of previous.records) {
    const active = nextRecords.get(prior.record_id);
    if ((!active || active.revision !== prior.revision) && !newTombstones.has(ref(prior))) {
      issues.push("removed or replaced active revision lacks a tombstone: " + ref(prior));
    }
    if (active && active.revision < prior.revision) issues.push("active revision moved backwards: " + ref(prior));
    if (active?.revision === prior.revision && !sameValue(active, prior)) {
      issues.push("content changed without a new revision: " + ref(prior));
    }
  }
  for (const candidate of next.records) {
    if (previous.tombstones.some(row => row.record_id === candidate.record_id && row.revision >= candidate.revision)) {
      issues.push("active revision is at or behind a withdrawn revision: " + ref(candidate));
    }
  }
  return issues.length ? { ok: false, issues } : result;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => sameValue(value, b[index]));
  }
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) || Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}

/** Source independence is based on verified origins, rather than the number of URLs. */
export function sourceOriginGroups(evidence: readonly EvidenceRecord[]): Map<string, EvidenceRecord[]> {
  const groups = new Map<string, EvidenceRecord[]>();
  for (const row of evidence) {
    const key = row.origin_publisher.normalize("NFC").trim().toLowerCase();
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}
