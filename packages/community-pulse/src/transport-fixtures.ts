import { syntheticResearchReports } from "./fixtures.ts";
import {
  createResearchIntakeState, emailTransport, ingestResearchDelivery,
  type EmailIntakePolicy, type ResearchIntakeState, type VerifiedMailMetadata
} from "./transport.ts";

export const fixtureMailPolicy: EmailIntakePolicy = {
  boundary: "fixture-email-gateway",
  authenticatedFrom: "researcher@example.invalid",
  recipient: "pulse@example.invalid"
};

export function syntheticMail(
  body: string, deliveryId: string, options: { contentType?: string; authenticated?: boolean; rawFrom?: string } = {}
) {
  const raw = new TextEncoder().encode(
    [
      "From: " + (options.rawFrom ?? fixtureMailPolicy.authenticatedFrom),
      "To: " + fixtureMailPolicy.recipient,
      "Message-ID: <" + deliveryId + "@example.invalid>",
      "MIME-Version: 1.0",
      "Content-Transfer-Encoding: 8bit",
      "Content-Type: " + (options.contentType ?? "text/plain; charset=utf-8"),
      "",
      body
    ].join("\r\n")
  );
  const verifiedMail: VerifiedMailMetadata | null = options.authenticated === false ? null : {
    boundary: fixtureMailPolicy.boundary,
    deliveryId,
    authenticatedFrom: fixtureMailPolicy.authenticatedFrom,
    recipient: fixtureMailPolicy.recipient,
    dmarc: "pass",
    alignedDkim: true,
    gatewayObservedAt: "2026-11-25T13:00:00Z"
  };
  return emailTransport.receive({ raw, verifiedMail });
}

export function buildSyntheticInbox(): ResearchIntakeState {
  let state = createResearchIntakeState();
  const submissions = syntheticResearchReports.map((report, i) =>
    syntheticMail(JSON.stringify(report), "fixture-" + i));
  const scout = syntheticResearchReports[1];
  if (scout) submissions.push(syntheticMail(JSON.stringify(scout), "fixture-duplicate"));
  submissions.push(syntheticMail("Rejected input fixture.", "fixture-quarantine", { authenticated: false }));
  for (const [index, submission] of submissions.entries()) {
    state = ingestResearchDelivery(submission, state, {
      emailPolicy: fixtureMailPolicy,
      clock: () => new Date(Date.UTC(2026, 10, 25, 13, index)),
      receiptId: () => "synthetic-receipt-" + (index + 1)
    }).state;
  }
  return state;
}
