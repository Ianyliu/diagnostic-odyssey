import { randomUUID } from "node:crypto";
import {
  createResearchIntakeState, emailTransport, ingestResearchDelivery, MAX_DELIVERY_BYTES, normalizedMailbox,
  type IntakeReceipt,
} from "../../../packages/community-pulse/src/transport.ts";
import type { ResearchReport } from "../../../packages/community-pulse/src/research.ts";
import { authenticateCloudflareMail, equalSecret, isPrivateRecipient, type SenderPolicy } from "./authentication.ts";

const PROVIDER = "cloudflare-email-routing";

export interface InboundEmail {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
}

/** Narrow storage surface required by the native Email Routing adapter. */
export interface ReceiverStore {
  tryConsumeRate(now: Date, key: "email" | "quarantine"): Promise<boolean>;
  saveDelivery(receipt: IntakeReceipt, report: ResearchReport | null): Promise<{ disposition: IntakeReceipt["disposition"] }>;
}

export interface EmailReceiverOptions {
  enabled: boolean;
  recipient?: string | undefined;
  expectedFrom?: string | undefined;
  expectedEnvelopeFrom?: string | undefined;
  signingDomain?: string | undefined;
}

async function bodyWithinLimit(stream: ReadableStream<Uint8Array>): Promise<Uint8Array | undefined> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_DELIVERY_BYTES) {
        await reader.cancel();
        return undefined;
      }
      if (value.byteLength > 0) parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function quarantineReceipt(now: Date, size: number, reason: string): IntakeReceipt {
  return {
    receiptId: randomUUID(),
    channel: "email",
    receivedAt: now.toISOString(),
    disposition: "quarantined",
    reasonCodes: [reason],
    bytesReceived: Number.isSafeInteger(size) && size >= 0 ? size : 0,
    rawSha256: null,
    reportSha256: null,
    provider: PROVIDER,
    deliveryId: null,
    assertedMessageId: null,
    verifiedSender: null,
    runId: null,
    reportType: null,
    reportedRunStatus: null,
    duplicateOf: null,
  };
}

async function rejectWithReceipt(
  message: InboundEmail,
  store: ReceiverStore,
  now: Date,
  receipt: IntakeReceipt,
): Promise<void> {
  if (await store.tryConsumeRate(now, "quarantine")) {
    // Even a signed but malformed submission must never retain quoted report or raw email contents.
    await store.saveDelivery({ ...receipt, assertedMessageId: null, verifiedSender: null }, null);
  }
  message.setReject("Staging intake rejected this delivery.");
}

const mailbox = /^[a-z0-9.!#$%&'*+/=?^_{}|~-]+@[a-z0-9][a-z0-9.-]+\.[a-z]{2,63}$/iu;

function senderPolicy(options: EmailReceiverOptions): SenderPolicy | undefined {
  const from = options.expectedFrom;
  const envelopeFrom = options.expectedEnvelopeFrom || from;
  if (!from || !envelopeFrom || from.length > 254 || envelopeFrom.length > 254 ||
    !mailbox.test(from) || !mailbox.test(envelopeFrom)) return undefined;
  const signer = options.signingDomain || from.split("@")[1];
  return signer ? { from, envelopeFrom, dkimDomain: signer } : undefined;
}

export async function receiveStagingEmail(
  message: InboundEmail,
  options: EmailReceiverOptions,
  createStore: () => ReceiverStore,
  now: Date = new Date(),
): Promise<void> {
  const policy = senderPolicy(options);
  const recipient = options.recipient;
  if (!options.enabled || !policy || !isPrivateRecipient(recipient) ||
    message.to.length > 254 || !equalSecret(message.to, recipient)) {
    message.setReject("Address unavailable.");
    return;
  }

  const store = createStore();
  if (!await store.tryConsumeRate(now, "email")) {
    message.setReject("Staging intake rate limit exceeded.");
    return;
  }

  if (!Number.isSafeInteger(message.rawSize) || message.rawSize < 1 || message.rawSize > MAX_DELIVERY_BYTES) {
    await rejectWithReceipt(message, store, now, quarantineReceipt(now, message.rawSize, "invalid_or_oversized_email"));
    return;
  }
  if (normalizedMailbox(message.from) !== normalizedMailbox(policy.envelopeFrom)) {
    await rejectWithReceipt(message, store, now, quarantineReceipt(now, message.rawSize, "envelope_sender_mismatch"));
    return;
  }

  const raw = await bodyWithinLimit(message.raw);
  if (!raw) {
    await rejectWithReceipt(message, store, now, quarantineReceipt(now, message.rawSize, "oversized_delivery"));
    return;
  }
  const authentication = authenticateCloudflareMail(message.headers, raw, message.from, policy);
  if (!authentication) {
    await rejectWithReceipt(message, store, now, quarantineReceipt(now, raw.byteLength, "unverified_ingress_authentication"));
    return;
  }

  const verifiedMail = {
    boundary: PROVIDER,
    deliveryId: authentication.deliveryId,
    authenticatedFrom: policy.from,
    recipient,
    dmarc: "pass" as const,
    alignedDkim: true,
    gatewayObservedAt: now.toISOString(),
  };
  // Shared logic handles duplicate JSON keys, MIME safety, strict schema, and byte hashing.
  // Cross-invocation replay and duplicate state belong to the durable adapter.
  const outcome = ingestResearchDelivery(emailTransport.receive({ raw, verifiedMail }), createResearchIntakeState(), {
    emailPolicy: { boundary: PROVIDER, authenticatedFrom: policy.from, recipient },
    clock: () => now,
  });
  const report = outcome.state.candidates[0]?.report;
  if (outcome.receipt.disposition !== "accepted" || !report) {
    await rejectWithReceipt(message, store, now, outcome.receipt);
    return;
  }

  const saved = await store.saveDelivery(outcome.receipt, report);
  if (saved.disposition === "quarantined") message.setReject("Staging intake rejected this delivery.");
}
