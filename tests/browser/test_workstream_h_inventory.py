"""Mutation tests: verifier must reject genuinely omitted or inconsistent outputs."""
import json
import os
from pathlib import Path
import tempfile
import unittest

from workstream_h_inventory import check_inventory, expected_pdfs


class FailClosedInventoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = Path(os.environ["WORKSTREAM_H_QA_OUTPUT"])
        cls.matrix = json.loads((cls.source / "matrix-results.json").read_text())
        cls.files = expected_pdfs(cls.matrix["mode"])
        # Validate real, fully rendered source once, before mutations.
        check_inventory(cls.source)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="h-dh1-negative-")
        self.addCleanup(self.temp.cleanup)
        self.fixture = Path(self.temp.name)
        # Hard-link immutable artifacts; modified JSON is unlinked first so the
        # originating evidence and other test cases can never be changed.
        for item in self.source.iterdir():
            if item.is_file() and item.suffix in {".json", ".pdf", ".png"}:
                os.link(item, self.fixture / item.name)

    def edit_json(self, name, edit):
        path = self.fixture / name
        data = json.loads(path.read_text())
        edit(data)
        path.unlink()
        path.write_text(json.dumps(data) + "\n")

    def fails_with(self, pattern):
        with self.assertRaisesRegex(AssertionError, pattern):
            check_inventory(self.fixture)

    def test_missing_expected_pdf_even_when_manifest_omits_it(self):
        missing = sorted(self.files)[0]
        (self.fixture / missing).unlink()
        self.edit_json("matrix-results.json", lambda d: d["pdfs"].__setitem__(
            slice(None), [entry for entry in d["pdfs"] if entry["file"] != missing]))
        self.fails_with("Missing PDF manifest entries")

    def test_missing_physical_pdf_with_manifest_intact(self):
        (self.fixture / sorted(self.files)[0]).unlink()
        self.fails_with("Physical PDF inventory mismatch")

    def test_missing_manifest_entry_with_physical_pdf_intact(self):
        self.edit_json("matrix-results.json", lambda d: d["pdfs"].pop())
        self.fails_with("Missing PDF manifest entries")

    def test_altered_print_status(self):
        self.edit_json("matrix-results.json", lambda d: d["printCombinations"][0].__setitem__(
            "status", "NOT_APPLICABLE_DISABLED"))
        self.fails_with("Wrong print status")

    def test_duplicate_print_coordinate(self):
        self.edit_json("matrix-results.json", lambda d: d["printCombinations"].__setitem__(
            1, dict(d["printCombinations"][0])))
        self.fails_with("Duplicate print coordinate")

    def test_missing_print_row(self):
        self.edit_json("matrix-results.json", lambda d: d["printCombinations"].pop())
        self.fails_with("Missing print coordinates")

    def test_duplicate_pdf_manifest_entry(self):
        self.edit_json("matrix-results.json", lambda d: d["pdfs"].append(dict(d["pdfs"][0])))
        self.fails_with("Duplicate PDF manifest entry")

    def test_mistyped_pdf_metadata(self):
        self.edit_json("matrix-results.json", lambda d: d["pdfs"][0].__setitem__("selected", "34"))
        self.fails_with("Incorrect PDF metadata")

    def test_missing_canonical_json(self):
        (self.fixture / (sorted(self.files)[0] + ".json")).unlink()
        self.fails_with("Canonical companion inventory mismatch")

    def test_unexpected_pdf(self):
        extra = self.fixture / "accidental-extra.pdf"
        os.link(self.fixture / sorted(self.files)[0], extra)
        self.fails_with("Physical PDF inventory mismatch")

    def test_missing_required_png_does_not_get_regenerated(self):
        png = sorted(self.fixture.glob("*.png"))[0]
        png.unlink()
        self.fails_with("Raster PNG inventory mismatch")
        self.assertFalse(png.exists(), "Inventory-only verification must NOT repair PNGs")

    def test_truncated_png(self):
        png = sorted(self.fixture.glob("*.png"))[0]
        png.unlink()
        png.write_bytes(b"\x89PNG\r\n\x1a\n")
        self.fails_with("Truncated raster PNG")

    def test_duplicate_verification_result(self):
        self.edit_json("pdf-verification.json", lambda d: d["results"].append(dict(d["results"][0])))
        self.fails_with("Missing, extra, or duplicate verified PDFs")


if __name__ == "__main__":
    unittest.main()
