import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / ".github/workflows/local-context-candidate.yml"
EXPECTED_OUTPUTS = ROOT / "analysis/local_context/expected_candidate_output_files.txt"
PIPELINE = ROOT / "analysis/local_context/pipeline.py"
VERIFIER = ROOT / "analysis/local_context/verify_candidate_output.sh"


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
            "artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/",
            text,
        )
        self.assertIn("sha256sum -c SHA256SUMS", text)

    def test_future_candidates_bind_to_active_reviewed_meps_version(self):
        pipeline = PIPELINE.read_text(encoding="utf-8")
        self.assertIn(
            'NATIONAL_ARTIFACT_VERSION = "meps-2024-long-covid-candidate-20260926T011343Z"',
            pipeline,
        )
        self.assertNotIn(
            'NATIONAL_ARTIFACT_VERSION = "meps-2024-long-covid-candidate-20260923T020607Z"',
            pipeline,
        )

    def test_expected_output_file_set_has_one_governed_source(self):
        expected_names = [
            line.strip()
            for line in EXPECTED_OUTPUTS.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        self.assertEqual(len(expected_names), 7)
        self.assertEqual(len(expected_names), len(set(expected_names)))

        pipeline = PIPELINE.read_text(encoding="utf-8")
        verifier = VERIFIER.read_text(encoding="utf-8")
        workflow = WORKFLOW.read_text(encoding="utf-8")

        self.assertIn("load_expected_candidate_output_files()", pipeline)
        self.assertIn("expected_candidate_output_files.txt", verifier)
        self.assertIn(r"path: ${{ env.OUTPUT_DIR }}/", workflow)

        upload_section = workflow.split(
            "- name: Upload preliminary candidate for independent review", 1
        )[1]
        for name in expected_names:
            self.assertNotIn(f"${{{{ env.OUTPUT_DIR }}}}/{name}", upload_section)

    def test_verifier_runs_before_directory_upload(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        verify_index = text.index(
            'bash analysis/local_context/verify_candidate_output.sh "$OUTPUT_DIR"'
        )
        upload_index = text.index(
            "- name: Upload preliminary candidate for independent review"
        )
        self.assertLess(verify_index, upload_index)


if __name__ == "__main__":
    unittest.main()
