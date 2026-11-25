import { constants } from "node:fs";
import { open } from "node:fs/promises";
import process from "node:process";
import { TextDecoder } from "node:util";
import { researchReportSchema, validateResearchReport } from "../../packages/community-pulse/src/research.ts";
import { createResearchIntakeState, ingestResearchDelivery, manualTransport, MAX_REPORT_BYTES }
  from "../../packages/community-pulse/src/transport.ts";

const path = process.argv[2];
if (!path || process.argv.length !== 3) {
  process.stderr.write("Usage: node --experimental-strip-types scripts/community-pulse/validate-report.mjs /path/to/report.json\n");
  process.exit(2);
}

const bytes = await readReport(path).catch(() => undefined);
if (!bytes) {
  process.stderr.write("Cannot read the supplied regular file.\n");
  process.exit(2);
}
if (bytes.length > MAX_REPORT_BYTES) {
  process.stdout.write(JSON.stringify({ accepted: false, reason_codes: ["oversized_report"], max_bytes: MAX_REPORT_BYTES }) + "\n");
  process.exit(1);
}

const delivery = manualTransport.receive({ raw: bytes, format: "json", operator: "local-qualification" });
const { receipt, state } = ingestResearchDelivery(delivery, createResearchIntakeState());
let json;
try {
  json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
} catch {
  // The authoritative intake receipt already records a stable encoding or syntax error.
}
const runtime = json === undefined ? null : validateResearchReport(json);
const itemList = researchReportSchema.properties.items;
const textLimit = itemList.items.properties.text.maxLength;
const items = Array.isArray(json?.items) ? json.items : null;
const lengths = items?.flatMap((item, index) => typeof item?.text === "string"
  ? [{ path: "$.items[" + index + "].text", utf16_code_units: item.text.length }]
  : []) ?? [];
const diagnostics = {
  accepted: receipt.disposition === "accepted",
  bytes: bytes.length,
  content_sha256: receipt.rawSha256,
  canonical_report_sha256: receipt.reportSha256,
  max_bytes: MAX_REPORT_BYTES,
  item_count: items?.length ?? null,
  max_items: itemList.maxItems,
  max_text_code_units: textLimit,
  longest_text_code_units: lengths.reduce((longest, entry) => Math.max(longest ?? 0, entry.utf16_code_units), null),
  texts_over_limit: lengths.filter(entry => entry.utf16_code_units > textLimit),
  runtime_issues: runtime?.ok === false ? runtime.issues : [],
  intake_disposition: receipt.disposition,
  reason_codes: receipt.reasonCodes,
  candidates: state.candidates.length,
};
process.stdout.write(JSON.stringify(diagnostics, null, 2) + "\n");
if (!diagnostics.accepted) process.exitCode = 1;

async function readReport(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    if (!(await handle.stat()).isFile()) throw new Error("Expected a regular file");
    const buffer = new Uint8Array(MAX_REPORT_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
}
