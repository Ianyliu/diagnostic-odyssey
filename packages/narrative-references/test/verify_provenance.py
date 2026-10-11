#!/usr/bin/env python3
"""Offline synthetic-compatible provenance verifier. Does not authorize source admission."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

HEX = re.compile(r"^[0-9a-f]{64}$")
ALLOWED = {"candidate", "reviewed_released"}
RIGHTS_STATES = {"documented_permission", "documented_license", "unresolved"}
CONTEXT_FIELDS = (
    "population", "condition_definition", "setting", "payer",
    "geography", "pathway_step", "mechanism"
)
REVIEW_FIELDS = (
    "approved_claim_wording", "causal_use_class", "allowed_use",
    "limitations", "prohibited_stronger_claims", "applicability"
)
EXPLICIT_UNKNOWN = {
    "unknown", "any", "all", "unspecified", "not specified", "not reported",
    "n/a", "none", "any payer", "all payers"
}


class ProvenanceError(ValueError):
    pass


def require(ok, message):
    if not ok:
        raise ProvenanceError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_verified(root, descriptor):
    require(isinstance(descriptor, dict), "file descriptor must be an object")
    name = descriptor.get("path")
    expected = descriptor.get("sha256")
    require(isinstance(name, str) and isinstance(expected, str) and HEX.fullmatch(expected),
            "file requires path and lowercase SHA-256")
    path = PurePosixPath(name)
    require(not path.is_absolute() and bool(path.parts) and
            all(p not in (".", "..") for p in path.parts) and
            not name.startswith("/") and "\\" not in name,
            "unsafe archive-relative path")
    resolved_root = root.resolve(strict=True)
    try:
        actual = (resolved_root / name).resolve(strict=True)
        require(actual.is_relative_to(resolved_root) and actual.is_file(),
                "unsafe or missing file")
        data = actual.read_bytes()
    except OSError as exc:
        raise ProvenanceError("missing or unreadable retained file: " + name) from exc
    require(sha(data) == expected, "tampered/mismatched bytes: " + name)
    return data


def verified_json(root, descriptor):
    try:
        return json.loads(read_verified(root, descriptor))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ProvenanceError("invalid JSON manifest") from exc


def exact_fields(value, keys, label):
    require(isinstance(value, dict) and set(value) == set(keys),
            label + " must contain exactly the required structured fields")


def exact_context(value):
    exact_fields(value, CONTEXT_FIELDS, "exact context")
    for field in CONTEXT_FIELDS:
        item = value[field]
        require(isinstance(item, str) and bool(item.strip()) and
                item == item.strip() and "*" not in item and
                item.casefold() not in EXPLICIT_UNKNOWN and
                not item.casefold().startswith(("any ", "all ")),
                "missing, wildcard or unspecified exact-context " + field)


def verify(root, package):
    require(isinstance(package, dict) and
            set(package) == {"state", "candidate", "sources", "rights", "review", "applicability", "release"},
            "invalid provenance companion structure")
    state = package["state"]
    require(state in ALLOWED, "unknown release state")
    candidate = verified_json(root, package["candidate"])
    require(candidate["manifest"]["release_status"] == "candidate", "candidate snapshot required")
    require(candidate["manifest"]["review_manifest_sha256"] is None and
            candidate["manifest"]["applicability_manifest_sha256"] is None,
            "candidate cannot embed approval digests")
    records = candidate["records"]
    require(isinstance(records, list), "candidate records required")
    ids = [r["claim_id"] for r in records]
    require(len(ids) == len(set(ids)), "duplicate claim IDs")
    sources = package["sources"]
    rights = package["rights"]
    require(isinstance(sources, list) and isinstance(rights, list), "source and rights arrays required")
    source_by_id = {}
    for s in sources:
        sid = s["source_id"]
        require(sid not in source_by_id, "duplicate source archive identity")
        require(s["media_type"] in ("application/pdf", "text/html", "text/plain"),
                "unsupported retained byte media type")
        require(s["retained_format"] == "original_response_bytes",
                "retained-byte format must specify original response bytes")
        read_verified(root, s["archive"])
        require(s["archive"]["sha256"] == s["source_sha256"], "source archive digest mismatch")
        require(isinstance(s["retrieval_id"], str) and s["retrieval_id"],
                "retrieval identity required")
        source_by_id[sid] = s
    right_by_id = {}
    for r in rights:
        require(r["source_id"] not in right_by_id, "duplicate rights identity")
        require(r["source_id"] in source_by_id and
                r["retrieval_id"] == source_by_id[r["source_id"]]["retrieval_id"],
                "rights/source retention identity mismatch")
        require(r["status"] in RIGHTS_STATES,
                "invalid rights status")
        require(isinstance(r["record_id"], str) and r["record_id"],
                "rights record identity missing")
        require(isinstance(r["retention_id"], str) and r["retention_id"] and
                r["retention_id"] == source_by_id[r["source_id"]]["retention_id"],
                "rights retention identity mismatch")
        evidence = verified_json(root, r["record"])
        exact_fields(evidence, (
            "source_id", "retrieval_id", "retention_id", "record_id",
            "status", "evidence_note"
        ), "retained rights evidence")
        for field in ("source_id", "retrieval_id", "retention_id", "record_id", "status"):
            require(evidence[field] == r[field],
                    "retained rights evidence identity/status mismatch: " + field)
        require(isinstance(evidence["evidence_note"], str) and
                bool(evidence["evidence_note"].strip()),
                "retained rights evidence note missing")
        right_by_id[r["source_id"]] = r
    require(set(source_by_id) == set(right_by_id), "missing/extra rights record")
    for record in records:
        sr = record["source"]
        sid = sr["source_id"]
        require(sid in source_by_id, "claim source archive missing")
        s = source_by_id[sid]
        require(sr["source_sha256"] == s["source_sha256"] and
                sr["retrieved_at"] == s["retrieved_at"] and
                sr["url"] == s["url"], "claim/source identity mismatch")
        require(record["release_status"] != "reviewed_released",
                "released records forbidden in candidate")
    if state == "candidate":
        require(package["review"] is None and package["applicability"] is None and
                package["release"] is None, "candidate must not assert release verification")
        return {"state": state, "claims": len(ids), "verified_sources": len(sources),
                "admitted": False}
    require(records, "cannot release empty candidate")
    require(package["review"] is not None and package["applicability"] is not None and
            package["release"] is not None, "missing review/applicability/release")
    require(all(r["status"] != "unresolved" for r in rights), "release rights unresolved")
    review = verified_json(root, package["review"])
    applicability = verified_json(root, package["applicability"])
    release = verified_json(root, package["release"])
    cd = package["candidate"]["sha256"]
    rd = package["review"]["sha256"]
    ad = package["applicability"]["sha256"]
    require(review["candidate_sha256"] == cd and review["catalog_id"] ==
            candidate["manifest"]["catalog_id"] and
            set(review["claim_ids"]) == set(ids) and len(review["claim_ids"]) == len(ids),
            "review/candidate/claim binding mismatch")
    require(review["disposition"] == "approved" and
            isinstance(review["reviewer_id"], str) and review["reviewer_id"] and
            isinstance(review["reviewed_at"], str) and review["reviewed_at"],
            "review decision identity missing or not approved")
    # Claim-level reviewed scientific content is authoritative for the release.
    # In particular, proposed candidate wording cannot become approval by copying.
    decisions = review.get("claim_decisions")
    require(isinstance(decisions, list) and len(decisions) == len(ids),
            "claim-level review decisions missing or incomplete")
    by_id = {r["claim_id"]: r for r in records}
    by_decision = {}
    for d in decisions:
        exact_fields(d, ("claim_id", "source_id", "source_sha256",
                         "approved_claim_wording", "causal_use_class", "allowed_use",
                         "limitations", "prohibited_stronger_claims", "applicability",
                         "review_note"), "claim-level review decision")
        cid = d["claim_id"]
        require(cid in by_id and cid not in by_decision,
                "missing/duplicate claim-level review decision identity")
        require(d["source_id"] == by_id[cid]["source"]["source_id"] and
                d["source_sha256"] == by_id[cid]["source"]["source_sha256"],
                "review decision source identity mismatch")
        require(isinstance(d["approved_claim_wording"], str) and
                bool(d["approved_claim_wording"].strip()) and
                isinstance(d["review_note"], str) and bool(d["review_note"].strip()),
                "missing reviewed wording or claim-level review note")
        for field in ("causal_use_class", "allowed_use", "applicability"):
            require(d[field] == by_id[cid][field],
                    "review decision changed candidate " + field)
        require(isinstance(d["limitations"], list) and
                bool(d["limitations"]) and
                isinstance(d["prohibited_stronger_claims"], list) and
                bool(d["prohibited_stronger_claims"]) and
                all(isinstance(v, str) and bool(v.strip()) for k in (
                    "limitations", "prohibited_stronger_claims") for v in d[k]),
                "review decision requires explicit limitations and prohibited claims")
        by_decision[cid] = d
    require(set(by_decision) == set(ids), "review decision claim set mismatch")

    require(applicability["candidate_sha256"] == cd and
            applicability["review_sha256"] == rd and
            set(applicability["claim_ids"]) == set(ids) and
            len(applicability["claim_ids"]) == len(ids) and
            isinstance(applicability["version"], str) and applicability["version"],
            "applicability/review/claim binding mismatch")
    contexts = applicability.get("context_decisions")
    require(isinstance(contexts, list) and contexts,
            "exact-context decision records missing")
    reviewed_contexts = set()
    covered_claims = set()
    for decision in contexts:
        exact_fields(decision, ("claim_id", "catalog_id", "source_id",
                                "context", "allowed_use", "decision"),
                     "exact-context decision record")
        cid = decision["claim_id"]
        require(cid in by_id and
                decision["catalog_id"] == candidate["manifest"]["catalog_id"] and
                decision["source_id"] == by_id[cid]["source"]["source_id"],
                "context/candidate/source identity mismatch")
        require(decision["allowed_use"] == by_decision[cid]["allowed_use"],
                "context/review allowed-use mismatch")
        require(decision["decision"] in ("applicable", "not_applicable"),
                "unknown exact-context decision")
        context = decision["context"]
        exact_context(context)
        require(all(context[k] == by_decision[cid]["applicability"][k]
                    for k in CONTEXT_FIELDS),
                "context/review applicability mismatch")
        key = (cid,) + tuple(context[k] for k in CONTEXT_FIELDS) + (
            decision["allowed_use"],)
        require(key not in reviewed_contexts, "duplicate exact-context decision")
        reviewed_contexts.add(key)
        covered_claims.add(cid)
    require(covered_claims == set(ids), "incomplete exact-context policy coverage")

    require(release["manifest"]["release_status"] == "reviewed_released" and
            release["manifest"]["catalog_id"] == candidate["manifest"]["catalog_id"] and
            release["manifest"]["review_manifest_sha256"] == rd and
            release["manifest"]["applicability_manifest_sha256"] == ad,
            "released manifest digests/identity mismatch")
    released_records = release["records"]
    require(len(released_records) == len(records) and
            set(r["claim_id"] for r in released_records) == set(ids),
            "released catalog/claim identity mismatch")
    for r in released_records:
        cid = r["claim_id"]
        original, decision = by_id[cid], by_decision[cid]
        require(r["release_status"] == "reviewed_released" and
                r["reviewer_status"] == "approved" and
                r["source"] == original["source"] and
                r["proposed_claim_wording"] == original["proposed_claim_wording"],
                "released record state/source/candidate wording mismatch")
        for field in REVIEW_FIELDS:
            require(r[field] == decision[field],
                    "released claim differs from exact review decision: " + field)
        require(r["review"]["reviewer_id"] == review["reviewer_id"] and
                r["review"]["reviewed_at"] == review["reviewed_at"] and
                r["review"]["review_note"] == decision["review_note"],
                "released reviewer identity/decision note mismatch")
    # External author/authority checks remain a separate independent human gate.
    return {"state": state, "claims": len(ids), "verified_sources": len(sources),
            "byte_chain_verified": True, "admitted": False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, help="local immutable retention root")
    parser.add_argument("companion", type=Path, help="local provenance companion JSON")
    args = parser.parse_args()
    try:
        result = verify(args.root, json.loads(args.companion.read_text(encoding="utf-8")))
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"verified": False, "reason": str(exc)}))
        return 1
    print(json.dumps({"verified": True, **result}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
