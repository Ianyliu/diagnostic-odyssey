"""Synthetic offline tests: real file bytes, never fabricated scientific reviewer evidence."""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from verify_provenance import ProvenanceError, verify

def digest(data):
    return hashlib.sha256(data).hexdigest()

class ProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.payload = b"SYNTHETIC retained response bytes; not scientific evidence."
        self.source_sha = digest(self.payload)
        self.source = {
            "source_id": "syn-source", "retrieval_id": "synthetic-retrieval",
            "retention_id": "synthetic-retention",
            "url": "https://example.invalid/synthetic",
            "retrieved_at": "2026-10-11T09:00:00Z",
            "retained_format": "original_response_bytes", "media_type": "text/plain",
            "source_sha256": self.source_sha,
            "archive": self.write("archive/source.txt", self.payload)
        }
        self.rights = {"source_id": "syn-source", "retrieval_id": "synthetic-retrieval",
                       "retention_id": "synthetic-retention", "record_id": "synthetic-rights",
                       "status": "documented_license",
                       "record": self.write("rights/record.json", b'{"synthetic_notice":"not real rights evidence"}')}
        self.candidate = {
            "manifest": {"catalog_id": "synthetic-catalog", "release_status": "candidate",
                         "review_manifest_sha256": None, "applicability_manifest_sha256": None},
            "records": [{"claim_id": "SYN26-TEST-01", "release_status": "candidate",
                         "source": {"source_id": "syn-source", "source_sha256": self.source_sha,
                                    "retrieved_at": "2026-10-11T09:00:00Z",
                                    "url": "https://example.invalid/synthetic"}}]
        }
        candidate_file = self.write_json("catalog/candidate.json", self.candidate)
        self.package = {"state": "candidate", "candidate": candidate_file,
                        "sources": [self.source], "rights": [self.rights],
                        "review": None, "applicability": None, "release": None}

    def write(self, path, data):
        p = self.root / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return {"path": path, "sha256": digest(data)}

    def write_json(self, path, value):
        return self.write(path, json.dumps(value, sort_keys=True).encode("utf-8"))

    def update_candidate(self):
        self.package["candidate"] = self.write_json("catalog/candidate.json", self.candidate)

    def make_release(self):
        cd = self.package["candidate"]["sha256"]
        review = {"candidate_sha256": cd, "catalog_id": "synthetic-catalog",
                  "claim_ids": ["SYN26-TEST-01"], "disposition": "approved",
                  "reviewer_id": "test-only", "reviewed_at": "2026-10-11T10:00:00Z"}
        self.package["review"] = self.write_json("review/review.json", review)
        rd = self.package["review"]["sha256"]
        app = {"candidate_sha256": cd, "review_sha256": rd,
               "claim_ids": ["SYN26-TEST-01"], "version": "synthetic-v1"}
        self.package["applicability"] = self.write_json("policy/applicability.json", app)
        r = copy.deepcopy(self.candidate["records"][0])
        r.update({"release_status": "reviewed_released",
                  "reviewer_status": "approved", "approved_claim_wording": "Test only"})
        release = {"manifest": {"catalog_id": "synthetic-catalog",
                               "release_status": "reviewed_released",
                               "review_manifest_sha256": rd,
                               "applicability_manifest_sha256": self.package["applicability"]["sha256"]},
                   "records": [r]}
        self.package["release"] = self.write_json("release/release.json", release)
        self.package["state"] = "reviewed_released"

    def reject(self, fragment):
        with self.assertRaises(ProvenanceError, msg=fragment):
            verify(self.root, self.package)

    def test_candidate_byte_chain_not_admission(self):
        result = verify(self.root, self.package)
        self.assertEqual(result["state"], "candidate")
        self.assertFalse(result["admitted"])

    def test_release_byte_chain_still_not_authenticity(self):
        self.make_release()
        result = verify(self.root, self.package)
        self.assertTrue(result["byte_chain_verified"])
        self.assertFalse(result["admitted"])

    def test_tampered_and_missing_archive_rejected(self):
        (self.root / "archive/source.txt").write_bytes(b"altered")
        self.reject("tamper")
        (self.root / "archive/source.txt").unlink()
        self.reject("missing")

    def test_missing_rights_and_identity_mismatch(self):
        self.package["rights"] = []
        self.reject("rights")
        self.package["rights"] = [self.rights]
        self.rights["retention_id"] = "wrong"
        self.reject("retention")

    def test_source_claim_digest_mismatch(self):
        self.candidate["records"][0]["source"]["source_sha256"] = "f" * 64
        self.update_candidate()
        self.reject("claim/source")

    def test_duplicate_claims(self):
        self.candidate["records"].append(copy.deepcopy(self.candidate["records"][0]))
        self.update_candidate()
        self.reject("duplicate")

    def test_path_escape_rejected(self):
        self.source["archive"]["path"] = "../archive/source.txt"
        self.reject("unsafe")

    def test_candidate_cannot_claim_release(self):
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
        release_path = self.package["release"]["path"]
        release = json.loads((self.root / release_path).read_text())
        release["manifest"]["review_manifest_sha256"] = "f" * 64
        self.package["release"] = self.write_json(release_path, release)
        self.reject("released manifest")

    def test_review_candidate_binding_mismatch(self):
        self.make_release()
        review_path = self.package["review"]["path"]
        review = json.loads((self.root / review_path).read_text())
        review["candidate_sha256"] = "f" * 64
        self.package["review"] = self.write_json(review_path, review)
        self.reject("review/candidate")

    def test_applicability_identity_mismatch(self):
        self.make_release()
        path = self.package["applicability"]["path"]
        app = json.loads((self.root / path).read_text())
        app["claim_ids"] = ["SYN26-OTHER-99"]
        self.package["applicability"] = self.write_json(path, app)
        self.reject("applicability/review")

    def test_unresolved_rights_block_release(self):
        self.make_release()
        self.rights["status"] = "unresolved"
        self.reject("rights unresolved")

if __name__ == "__main__":
    unittest.main()
