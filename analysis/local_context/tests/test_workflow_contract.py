import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / ".github/workflows/local-context-candidate.yml"


class LocalContextWorkflowContractTests(unittest.TestCase):
    def test_census_secret_is_not_job_wide_and_is_scoped_to_three_steps(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        job_env = text.split("    steps:", 1)[0]
        self.assertNotIn("CENSUS_API_KEY", job_env)
        self.assertEqual(
            text.count("CENSUS_API_KEY: ${{ secrets.CENSUS_API_KEY }}"),
            3,
        )

    def test_workflow_uses_set_verifier_and_checks_reviewed_meps_checksums(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn(
            'bash analysis/local_context/verify_candidate_output.sh "$OUTPUT_DIR"',
            text,
        )
        self.assertIn(
            "artifacts/reviewed/meps-2024-long-covid-candidate-20260923T020607Z/",
            text,
        )
        self.assertIn("sha256sum -c SHA256SUMS", text)


if __name__ == "__main__":
    unittest.main()
