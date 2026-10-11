"""Offline provenance tests with contract-valid, synthetic-only retained artifacts.

No real sources, reviewer approvals, applicability authorizations or rights are asserted.
"""
import copy
import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator
from verify_provenance import CONTEXT_FIELDS, ProvenanceError, verify

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SCHEMA = json.loads((HERE.parent / "schema/narrative-intervention-references.v1.schema.json").read_text())
Draft202012Validator.check_schema(SCHEMA)
SCHEMA_VALIDATOR = Draft202012Validator(SCHEMA)
CASES = json.loads((HERE / "fixtures/schema-cases.v1.json").read_text())["cases"]
POSITIVES = {c["name"]: c["catalog"] for c in CASES if c["expected_schema"] and c["expected_runtime"]}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def runtime_validate(catalog):
    """Call the *committed* TypeScript validator in Node 22, not a Python imitation."""
    code = (
        "import { validateNarrativeReferenceCatalog as validate } "
        "from './packages/narrative-references/src/index.ts';"
        "let text='';for await (const s of process.stdin) text+=s;"
        "process.stdout.write(JSON.stringify(validate(JSON.parse(text))));"
    )
    process = subprocess.run(
        ["node", "--experimental-strip-types", "--input-type=module", "-e", code],
        cwd=REPO, input=json.dumps(catalog), text=True, capture_output=True, check=True
    )
    return json.loads(process.stdout)


class ProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.payload = b"SYNTHETIC retained response bytes; not scientific evidence."
        self.source_sha = digest(self.payload)
        self.source = {
            "source_id": "syn-source", "retrieval_id": "synthetic-retrieval",
            "retention_id": "synthetic-retention", "url": "https://example.invalid/synthetic",
            "retrieved_at": "2026-10-11T09:00:00Z",
            "retained_format": "original_response_bytes", "media_type": "text/plain",
            "source_sha256": self.source_sha,
            "archive": self.write("archive/source.txt", self.payload)
        }
        self.rights_evidence = {
            "source_id": "syn-source", "retrieval_id": "synthetic-retrieval",
            "retention_id": "synthetic-retention", "record_id": "synthetic-rights",
            "status": "documented_license",
            "evidence_note": "SYNTHETIC TEST STRING. NOT A REAL LICENSE OR PERMISSION."
        }
        self.rights = {k: v for k, v in self.rights_evidence.items() if k != "evidence_note"}
        self.rights["record"] = self.write_json("rights/record.json", self.rights_evidence)

        self.candidate = copy.deepcopy(POSITIVES["candidate_draft"])
        self.candidate["manifest"]["catalog_id"] = "synthetic-catalog"
        self.adjust_record(self.candidate["records"][0])
        self.package = {
            "state": "candidate",
            "candidate": self.write_json("catalog/candidate.json", self.candidate),
            "sources": [self.source], "rights": [self.rights],
            "review": None, "applicability": None, "release": None
        }

    def adjust_record(self, record):
        record["source"].update({
            "source_id": self.source["source_id"],
            "source_sha256": self.source_sha,
            "retrieved_at": self.source["retrieved_at"], "url": self.source["url"]
        })
        record["applicability"].update({
            "population": "SYNTHETIC_COHORT_A", "condition_definition": "SYNTHETIC_CONDITION_A",
            "setting": "SYNTHETIC_SETTING_A", "payer": "SYNTHETIC_PAYER_A",
            "geography": "SYNTHETIC_REGION_A", "pathway_step": "SYNTHETIC_STEP_A",
            "mechanism": "SYNTHETIC_MECHANISM_A"
        })

    def write(self, path, data):
        p = self.root / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return {"path": path, "sha256": digest(data)}

    def write_json(self, path, value):
        return self.write(path, json.dumps(value, sort_keys=True).encode("utf-8"))

    def update_candidate(self):
        self.package["candidate"] = self.write_json("catalog/candidate.json", self.candidate)

    def update_rights(self):
        self.rights["record"] = self.write_json("rights/record.json", self.rights_evidence)

    def update_review(self):
        self.package["review"] = self.write_json("review/review.json", self.review)

    def update_applicability(self):
        self.package["applicability"] = self.write_json("policy/applicability.json", self.applicability)

    def update_release(self):
        self.package["release"] = self.write_json("release/release.json", self.release)

    def full_contract(self, catalog):
        errors = list(SCHEMA_VALIDATOR.iter_errors(catalog))
        self.assertEqual(errors, [], [str(e) for e in errors[:3]])
        self.assertEqual(runtime_validate(catalog), [], "TypeScript runtime semantic validation")

    def make_release(self):
        cd = self.package["candidate"]["sha256"]
        record = copy.deepcopy(POSITIVES["released"]["records"][0])
        self.adjust_record(record)
        record["source"] = copy.deepcopy(self.candidate["records"][0]["source"])
        record["claim_id"] = self.candidate["records"][0]["claim_id"]
        record["proposed_claim_wording"] = self.candidate["records"][0]["proposed_claim_wording"]
        record["causal_use_class"] = self.candidate["records"][0]["causal_use_class"]
        record["allowed_use"] = self.candidate["records"][0]["allowed_use"]
        record["applicability"] = copy.deepcopy(self.candidate["records"][0]["applicability"])
        record["review"] = {
            "reviewer_id": "synthetic-reviewer", "reviewed_at": "2026-10-11T10:00:00Z",
            "review_note": "Synthetic claim review; no genuine human decision"
        }
        decision = {
            "claim_id": record["claim_id"],
            "source_id": record["source"]["source_id"],
            "source_sha256": record["source"]["source_sha256"],
            "approved_claim_wording": record["approved_claim_wording"],
            "causal_use_class": record["causal_use_class"],
            "allowed_use": record["allowed_use"],
            "limitations": copy.deepcopy(record["limitations"]),
            "prohibited_stronger_claims": copy.deepcopy(record["prohibited_stronger_claims"]),
            "applicability": copy.deepcopy(record["applicability"]),
            "review_note": record["review"]["review_note"]
        }
        self.review = {
            "candidate_sha256": cd, "catalog_id": self.candidate["manifest"]["catalog_id"],
            "claim_ids": [record["claim_id"]], "disposition": "approved",
            "reviewer_id": record["review"]["reviewer_id"],
            "reviewed_at": record["review"]["reviewed_at"],
            "claim_decisions": [decision]
        }
        self.update_review()
        rd = self.package["review"]["sha256"]
        self.applicability = {
            "candidate_sha256": cd, "review_sha256": rd,
            "claim_ids": [record["claim_id"]], "version": "synthetic-v1",
            "context_decisions": [{
                "claim_id": record["claim_id"],
                "catalog_id": self.candidate["manifest"]["catalog_id"],
                "source_id": record["source"]["source_id"],
                "context": {key: record["applicability"][key] for key in CONTEXT_FIELDS},
                "allowed_use": record["allowed_use"], "decision": "applicable"
            }]
        }
        self.update_applicability()
        self.release = copy.deepcopy(POSITIVES["released"])
        self.release["manifest"]["catalog_id"] = self.candidate["manifest"]["catalog_id"]
        self.release["manifest"]["review_manifest_sha256"] = rd
        self.release["manifest"]["applicability_manifest_sha256"] = self.package["applicability"]["sha256"]
        self.release["records"] = [record]
        self.update_release()
        self.package["state"] = "reviewed_released"

    def reject(self, message):
        with self.assertRaises(ProvenanceError) as caught:
            verify(self.root, self.package)
        self.assertIn(message, str(caught.exception))

    def test_candidate_full_contract_retention(self):
        self.full_contract(self.candidate)
        result = verify(self.root, self.package)
        self.assertEqual(result["state"], "candidate")
        self.assertEqual(result["verified_sources"], 1)
        self.assertFalse(result["admitted"])

    def test_approved_unreleased_full_contract_retention(self):
        original = self.candidate["records"][0]["source"]
        record = copy.deepcopy(POSITIVES["reviewed_not_released"]["records"][0])
        self.adjust_record(record)
        record["source"] = copy.deepcopy(original)
        self.candidate["records"] = [record]
        self.update_candidate()
        self.full_contract(self.candidate)
        self.assertEqual(verify(self.root, self.package)["state"], "candidate")

    def test_rejected_full_contract_retention(self):
        record = copy.deepcopy(POSITIVES["rejected"]["records"][0])
        self.adjust_record(record)
        record["source"] = copy.deepcopy(self.candidate["records"][0]["source"])
        self.candidate["records"] = [record]
        self.update_candidate()
        self.full_contract(self.candidate)
        self.assertFalse(verify(self.root, self.package)["admitted"])

    def test_released_full_contract_byte_chain_and_context(self):
        self.make_release()
        self.full_contract(self.candidate)
        self.full_contract(self.release)
        result = verify(self.root, self.package)
        self.assertTrue(result["byte_chain_verified"])
        self.assertFalse(result["admitted"], "never treat synthetic approval as authority")

    def test_missing_or_tampered_source_bytes(self):
        (self.root / "archive/source.txt").write_bytes(b"altered")
        self.reject("tampered")
        (self.root / "archive/source.txt").unlink()
        self.reject("missing")

    def test_rights_companion_status_mismatch(self):
        self.rights["status"] = "unresolved"
        self.reject("retained rights evidence identity/status mismatch: status")

    def test_retained_rights_status_mismatch(self):
        self.rights_evidence["status"] = "unresolved"
        self.update_rights()
        self.reject("retained rights evidence identity/status mismatch: status")

    def test_rights_identity_mismatch_against_retained_document(self):
        for field in ("source_id", "retrieval_id", "retention_id", "record_id"):
            with self.subTest(field=field):
                self.rights_evidence[field] = "forged-" + field
                self.update_rights()
                self.reject("retained rights evidence identity/status mismatch: " + field)
                self.rights_evidence[field] = self.rights[field]
                self.update_rights()

    def test_missing_or_unstructured_rights_evidence(self):
        (self.root / "rights/record.json").unlink()
        self.reject("missing")
        self.rights_evidence.pop("record_id")
        self.update_rights()
        self.reject("retained rights evidence")

    def test_missing_rights_record_or_retention_identity(self):
        self.package["rights"] = []
        self.reject("rights")
        self.package["rights"] = [self.rights]
        self.rights["retention_id"] = "wrong"
        self.reject("retention")

    def test_unresolved_rights_block_release_even_when_evidence_matches(self):
        self.make_release()
        self.rights["status"] = "unresolved"
        self.rights_evidence["status"] = "unresolved"
        self.update_rights()
        self.reject("release rights unresolved")

    def test_source_claim_digest_mismatch(self):
        self.candidate["records"][0]["source"]["source_sha256"] = "f" * 64
        self.update_candidate()
        self.reject("claim/source")

    def test_duplicate_claim_ids(self):
        self.candidate["records"].append(copy.deepcopy(self.candidate["records"][0]))
        self.update_candidate()
        self.reject("duplicate")

    def test_archive_path_escape(self):
        self.source["archive"]["path"] = "../archive/source.txt"
        self.reject("unsafe")

    def test_candidate_cannot_assert_release(self):
        self.package["review"] = {"path": "fake", "sha256": "a" * 64}
        self.reject("candidate")

    def test_missing_review_and_applicability(self):
        self.package["state"] = "reviewed_released"
        self.reject("missing")

    def test_tampered_review_bytes(self):
        self.make_release()
        (self.root / self.package["review"]["path"]).write_bytes(b"changed")
        self.reject("tampered")

    def test_tampered_applicability_bytes(self):
        self.make_release()
        (self.root / self.package["applicability"]["path"]).write_bytes(b"changed")
        self.reject("tampered")

    def test_release_manifest_digest_mismatch(self):
        self.make_release()
        self.release["manifest"]["review_manifest_sha256"] = "f" * 64
        self.update_release()
        self.reject("released manifest")

    def test_review_candidate_binding_mismatch(self):
        self.make_release()
        self.review["candidate_sha256"] = "f" * 64
        self.update_review()
        self.reject("review/candidate")

    def test_missing_claim_level_decision(self):
        self.make_release()
        self.review["claim_decisions"] = []
        self.update_review()
        self.reject("claim-level review decisions missing")

    def test_changed_released_wording_same_claim_and_source(self):
        self.make_release()
        self.release["records"][0]["approved_claim_wording"] = "Forged synthetic wording"
        self.update_release()
        self.full_contract(self.release)
        self.reject("released claim differs from exact review decision: approved_claim_wording")

    def test_changed_released_intended_use_and_limitations(self):
        for field, value in (
            ("allowed_use", "planning_option_to_investigate"),
            ("causal_use_class", "qualitative_experience"),
            ("limitations", ["Altered limitation"]),
            ("prohibited_stronger_claims", ["Altered stronger claim"])
        ):
            with self.subTest(field=field):
                self.make_release()
                self.release["records"][0][field] = value
                self.update_release()
                self.full_contract(self.release)
                self.reject("released claim differs from exact review decision: " + field)

    def test_changed_released_review_identity_and_note(self):
        self.make_release()
        self.release["records"][0]["review"]["review_note"] = "Forged note"
        self.update_release()
        self.reject("released reviewer identity/decision note mismatch")

    def test_review_decision_source_mismatch(self):
        self.make_release()
        self.review["claim_decisions"][0]["source_sha256"] = "f" * 64
        self.update_review()
        self.reject("review decision source identity mismatch")

    def test_context_claim_identity_mismatch(self):
        self.make_release()
        self.applicability["context_decisions"][0]["claim_id"] = "SYN26-OTHER-99"
        self.update_applicability()
        self.reject("context/candidate/source identity mismatch")

    def test_context_allowed_use_mismatch(self):
        self.make_release()
        self.applicability["context_decisions"][0]["allowed_use"] = "planning_option_to_investigate"
        self.update_applicability()
        self.reject("context/review allowed-use mismatch")

    def test_context_payer_or_geography_mismatch(self):
        for field in ("payer", "geography", "condition_definition", "population",
                      "setting", "pathway_step", "mechanism"):
            with self.subTest(field=field):
                self.make_release()
                self.applicability["context_decisions"][0]["context"][field] = "DIFFERENT_CONTEXT"
                self.update_applicability()
                self.reject("context/review applicability mismatch")

    def test_wildcard_or_unspecified_context_rejected(self):
        for value in ("*", "ALL", "any payer", "not reported", "", "unknown"):
            with self.subTest(value=value):
                self.make_release()
                self.applicability["context_decisions"][0]["context"]["payer"] = value
                self.update_applicability()
                self.reject("missing, wildcard or unspecified exact-context payer")

    def test_missing_context_decision_rejected(self):
        self.make_release()
        self.applicability["context_decisions"] = []
        self.update_applicability()
        self.reject("exact-context decision records missing")

    def test_duplicate_context_decision_rejected(self):
        self.make_release()
        self.applicability["context_decisions"].append(
            copy.deepcopy(self.applicability["context_decisions"][0])
        )
        self.update_applicability()
        self.reject("duplicate exact-context decision")

    def test_mismatched_review_digest_in_applicability(self):
        self.make_release()
        self.applicability["review_sha256"] = "f" * 64
        self.update_applicability()
        self.reject("applicability/review/claim binding mismatch")


if __name__ == "__main__":
    unittest.main()
