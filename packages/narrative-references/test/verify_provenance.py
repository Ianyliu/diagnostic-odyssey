#!/usr/bin/env python3
"""Offline synthetic-compatible provenance verifier. Does not authorize source admission."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

HEX = re.compile(r"^[0-9a-f]{64}$")
ALLOWED = {"candidate", "reviewed_released"}


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
    actual = (resolved_root / name).resolve(strict=True)
    require(actual.is_relative_to(resolved_root) and actual.is_file(),
            "unsafe or missing file")
    data = actual.read_bytes()
    require(sha(data) == expected, "tampered/mismatched bytes: " + name)
    return data


def verified_json(root, descriptor):
    try:
        return json.loads(read_verified(root, descriptor))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ProvenanceError("invalid JSON manifest") from exc


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
        require(r["status"] in ("documented_permission", "documented_license", "unresolved"),
                "invalid rights status")
        require(isinstance(r["record_id"], str) and r["record_id"],
                "rights record identity missing")
        require(isinstance(r["retention_id"], str) and r["retention_id"] and
                r["retention_id"] == source_by_id[r["source_id"]]["retention_id"],
                "rights retention identity mismatch")
        verified_json(root, r["record"])
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
    require(applicability["candidate_sha256"] == cd and
            applicability["review_sha256"] == rd and
            set(applicability["claim_ids"]) == set(ids) and
            len(applicability["claim_ids"]) == len(ids) and
            isinstance(applicability["version"], str) and applicability["version"],
            "applicability/review/claim binding mismatch")
    require(release["manifest"]["release_status"] == "reviewed_released" and
            release["manifest"]["catalog_id"] == candidate["manifest"]["catalog_id"] and
            release["manifest"]["review_manifest_sha256"] == rd and
            release["manifest"]["applicability_manifest_sha256"] == ad,
            "released manifest digests/identity mismatch")
    released_records = release["records"]
    require(len(released_records) == len(records) and
            set(r["claim_id"] for r in released_records) == set(ids),
            "released catalog/claim identity mismatch")
    candidate_sources = {r["claim_id"]: r["source"] for r in records}
    for r in released_records:
        require(r["release_status"] == "reviewed_released" and
                r["reviewer_status"] == "approved" and r["approved_claim_wording"] and
                r["source"] == candidate_sources[r["claim_id"]],
                "released record state/source mismatch")
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
