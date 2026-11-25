import { syntheticSnapshot } from "../../../../../packages/community-pulse/src/fixtures.ts";
import { buildSyntheticInbox } from "../../../../../packages/community-pulse/src/transport-fixtures.ts";
import type { CommunityPulseDataSource } from "./runtime.ts";
import type { InboxEntry } from "../../data/communityPulseResponse.ts";

const inbox = buildSyntheticInbox();
const reportsByReceipt = new Map(inbox.candidates.map(item => [item.receiptId, item.report]));

const candidateClaims: NonNullable<InboxEntry["candidate_claims"]> = [
  { text: "The clinic reported a planned schedule revision.", verification: "unverified" },
  { text: "A research draft inferred an exact capacity reduction. No reviewed source supports that number.", verification: "unsupported" },
  { text: "Two discovery leads give different grant deadlines. The issuing notice still needs verification.", verification: "conflicting" }
];

export const fixtureDataSource: CommunityPulseDataSource = {
  async read() {
    return {
      schema_version: "0.2.1",
      snapshot: syntheticSnapshot,
      inbox: inbox.receipts.map(receipt => {
        const report = reportsByReceipt.get(receipt.receiptId) ?? null;
        return {
          receipt: {
            ingestion_id: receipt.receiptId,
            received_at: receipt.receivedAt,
            content_sha256: receipt.rawSha256,
            transport: receipt.channel === "email" ? "email" : "manual_file",
            status: receipt.disposition,
            reason_code: receipt.reasonCodes[0] ?? null,
            provider: receipt.provider,
            review_status: receipt.disposition === "quarantined" ? "rejected"
              : !report || report.items.length === 0 ? "none"
              : report.report_type === "daily_synthesis" ? "needs_verification" : "pending"
          },
          report,
          ...(report?.report_type === "daily_synthesis" ? { candidate_claims: candidateClaims } : {})
        };
      })
    };
  }
};
