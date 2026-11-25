import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { MAX_DELIVERY_BYTES, type IntakeReceipt } from "../../../packages/community-pulse/src/transport.ts";
import type { ResearchReport } from "../../../packages/community-pulse/src/research.ts";
import { authenticateCloudflareMail, isPrivateRecipient } from "../src/authentication.ts";
import { receiveStagingEmail, type EmailReceiverOptions, type InboundEmail, type ReceiverStore } from "../src/email.ts";

import worker from "../src/index.ts";
import { MemoryR2 } from "../src/offlineBucket.ts";
import { readStagingInbox } from "../../web/src/server/community-pulse/stagingEndpoint.ts";

const receivedAt = new Date("2026-11-25T13:01:00.000Z");
const recipient = "pulse-0123456789abcdef0123456789abcdef@staging.example.invalid";
const sender = "researcher@mail.example.invalid";
const signer = "mail.example.invalid";
const policy = { from: sender, envelopeFrom: sender, dkimDomain: signer };
const options: EmailReceiverOptions = { enabled: true, recipient, expectedFrom: sender, signingDomain: signer };
const emailBody: ResearchReport = {
  schema_version: "0.2.1", kind: "research_report", run_id: "fixture-mail-01", report_type: "hourly_scout",
  status: "completed", title: "A synthetic lead",
  items: [{ kind: "open_question", title: "A local question", text: "Consider checking the synthetic fixture — no findings asserted.", sources: [] }],
  reason_codes: [],
};
const firstTrusted = "mx.cloudflare.net; dkim=pass header.d=mail.example.invalid header.s=fixture header.b=ABCDEFGH; " +
  "dmarc=pass header.from=mail.example.invalid policy.dmarc=reject; spf=pass smtp.mailfrom=researcher@mail.example.invalid";
const defaultSignature = "v=1; a=rsa-sha256; d=mail.example.invalid; s=fixture; h=from:message-id:content-type:content-transfer-encoding; " +
  "bh=MNOPhash; b=ABCDEFGH12345678";
const encode = (s: string) => new TextEncoder().encode(s);

interface EmailInput {
  body?: string;
  headerLines?: string[];
  authenticationResults?: string[];
  from?: string;
  envelopeFrom?: string;
  envelopeTo?: string;
  signature?: string;
  contentType?: string;
  observedSize?: number;
  raw?: ReadableStream<Uint8Array>;
  omitMessageId?: boolean;
}

function email(input: EmailInput = {}) {
  const auth = input.authenticationResults ?? [firstTrusted];
  const lines = [
    ...auth.map(value => "Authentication-Results: " + value),
    "From: " + (input.from ?? sender),
    "To: " + recipient,
    ...input.omitMessageId ? [] : ["Message-ID: <fixture-a@mail.example.invalid>"],
    "DKIM-Signature: " + (input.signature ?? defaultSignature),
    "Content-Type: " + (input.contentType ?? "text/plain; charset=utf-8"),
    "Content-Transfer-Encoding: 8bit",
    ...input.headerLines ?? [],
    "",
    input.body ?? JSON.stringify(emailBody),
  ];
  const bytes = encode(lines.join("\r\n"));
  const rejected: string[] = [];
  return {
    bytes,
    rejected,
    message: {
      from: input.envelopeFrom ?? sender, to: input.envelopeTo ?? recipient,
      raw: input.raw ?? new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } }),
      rawSize: input.observedSize ?? bytes.byteLength,
      headers: new Headers(auth.map((value): [string, string] => ["authentication-results", value.replace(/\r?\n[ \t]+/gu, " ")])),
      setReject(reason: string) { rejected.push(reason); },
    } satisfies InboundEmail,
  };
}

function fakeStore(rates: Partial<Record<"email" | "quarantine", boolean>> = {}) {
  const stored: { receipt: IntakeReceipt; report: ResearchReport | null }[] = [];
  const counters: string[] = [];
  const store: ReceiverStore = {
    async tryConsumeRate(_now, key) {
      counters.push(key);
      return rates[key] ?? true;
    },
    async saveDelivery(receipt, report) {
      stored.push({ receipt, report });
      return { disposition: receipt.disposition };
    },
  };
  return { store, stored, counters };
}

test("requires a high-entropy staging alias and checks exact envelope recipient before reading or accessing storage", async () => {
  assert.equal(isPrivateRecipient(recipient), true);
  assert.equal(isPrivateRecipient("pulse@staging.example.invalid"), false);
  assert.equal(isPrivateRecipient("pulse-SHORT@staging.example.invalid"), false);
  const fixture = email({ envelopeTo: "public@staging.example.invalid" });
  await receiveStagingEmail(fixture.message, options, () => { throw new Error("store must not be opened"); }, receivedAt);
  assert.deepEqual(fixture.rejected, ["Address unavailable."]);
  await receiveStagingEmail(email().message, { ...options, enabled: false },
    () => { throw new Error("disabled store opened"); }, receivedAt);
});

test("authenticated Cloudflare ingress accepts a UTF-8 JSON body with trusted timestamp and digest", async () => {
  const fixture = email({ authenticationResults: [firstTrusted.replace("dmarc=pass", "\r\n\tdmarc=pass")] });
  const { stored, store, counters } = fakeStore();
  await receiveStagingEmail(fixture.message, options, () => store, receivedAt);
  assert.deepEqual(fixture.rejected, []);
  assert.deepEqual(counters, ["email"]);
  const accepted = stored[0];
  assert.equal(accepted?.receipt.disposition, "accepted");
  assert.equal(accepted?.receipt.receivedAt, receivedAt.toISOString());
  assert.equal(accepted?.receipt.rawSha256, createHash("sha256").update(fixture.bytes).digest("hex"));
  assert.equal(accepted?.receipt.verifiedSender, sender);
  assert.equal(accepted?.receipt.reportedRunStatus, "completed");
  assert.deepEqual(accepted?.report, emailBody);
});

test("first failing or foreign Authentication-Results cannot be replaced by a forged later pass", () => {
  for (const bad of [
    firstTrusted.replace("dmarc=pass", "dmarc=fail"),
    firstTrusted.replace("mx.cloudflare.net", "evil.example.invalid"),
    "mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass",
    firstTrusted.replace("header.d=mail.example.invalid", "header.d=other.example.invalid"),
    firstTrusted.replace("header.from=mail.example.invalid", "header.from=other.example.invalid"),
    firstTrusted + "; dmarc=pass header.from=mail.example.invalid",
    'mx.cloudflare.net; dmarc=pass header.from=mail.example.invalid reason="dkim=pass; dmarc=pass"; spf=pass',
  ]) {
    const fixture = email({ authenticationResults: [bad, firstTrusted] });
    assert.equal(authenticateCloudflareMail(fixture.message.headers, fixture.bytes, sender, policy), undefined, bad);
  }
  const good = email({ authenticationResults: [firstTrusted, "fake.example.invalid; dmarc=fail"] });
  assert.ok(authenticateCloudflareMail(good.message.headers, good.bytes, sender, policy));
  const forgedProjection = email({ authenticationResults: ["evil.example.invalid; dmarc=pass header.from=mail.example.invalid"] });
  assert.equal(authenticateCloudflareMail(good.message.headers, forgedProjection.bytes, sender, policy), undefined);
});

test("requires the passing signature to cover full body, From and top-level MIME type and encoding", () => {
  for (const invalid of [
    defaultSignature + "; l=15",
    defaultSignature.replace("from:", ""),
    defaultSignature.replace("content-type:", ""),
    defaultSignature.replace(":content-transfer-encoding", ""),
    defaultSignature.replace("b=ABCDEFGH", "b=ZZZZZZZZ"),
  ]) {
    const fixture = email({ signature: invalid });
    assert.equal(authenticateCloudflareMail(fixture.message.headers, fixture.bytes, sender, policy), undefined, invalid);
  }
  const ambiguous = email({ headerLines: ["DKIM-Signature: " + defaultSignature + "; l=3"] });
  assert.equal(authenticateCloudflareMail(ambiguous.message.headers, ambiguous.bytes, sender, policy), undefined);
});

test("rejects forged RFC From and envelope sender and retains only reason metadata", async () => {
  const { stored, store, counters } = fakeStore();
  for (const fixture of [
    email({ from: "other@mail.example.invalid" }),
    email({ envelopeFrom: "other@mail.example.invalid" }),
    email({ from: "RESEARCHER@mail.example.invalid" })
  ]) {
    await receiveStagingEmail(fixture.message, options, () => store, receivedAt);
    assert.equal(fixture.rejected.length, 1);
  }
  assert.deepEqual(counters, ["email", "quarantine", "email", "quarantine", "email", "quarantine"]);
  assert.deepEqual(stored.map(value => value.receipt.reasonCodes[0]), [
    "message_sender_mismatch", "envelope_sender_mismatch", "message_sender_mismatch"
  ]);
  assert.equal(stored.every(value => value.report === null && value.receipt.verifiedSender === null &&
    value.receipt.assertedMessageId === null), true);
});

test("uses a stable, signed delivery identity on retries even when run ID text changes", async () => {
  const { stored, store } = fakeStore();
  await receiveStagingEmail(email().message, options, () => store, receivedAt);
  const resign = email({
    body: JSON.stringify({ ...emailBody, run_id: "changed-run-id" }),
    signature: defaultSignature.replace("b=ABCDEFGH12345678", "b=ABCDEFGH87345678"),
  });
  await receiveStagingEmail(resign.message, options, () => store, receivedAt);
  assert.match(stored[0]?.receipt.deliveryId ?? "", /^cf-mail:[0-9a-f]{64}$/u);
  assert.equal(stored[0]?.receipt.deliveryId, stored[1]?.receipt.deliveryId);
  assert.notEqual(stored[0]?.receipt.rawSha256, stored[1]?.receipt.rawSha256);
  const unsignedId = email({ signature: defaultSignature.replace(":message-id", "") });
  const noId = email({ signature: defaultSignature.replace(":message-id", ""), omitMessageId: true });
  const fallback = (value: ReturnType<typeof email>) =>
    authenticateCloudflareMail(value.message.headers, value.bytes, sender, policy)?.deliveryId;
  assert.ok(fallback(unsignedId));
  assert.equal(fallback(unsignedId), fallback(noId));
});

test("oversized reported and streaming messages are quarantined within bounds without saving content", async () => {
  const { stored, store } = fakeStore();
  const declaredLarge = email({ observedSize: MAX_DELIVERY_BYTES + 1 });
  await receiveStagingEmail(declaredLarge.message, options, () => store, receivedAt);
  let cancelled = false;
  const misleading = email({
    observedSize: 32,
    raw: new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(MAX_DELIVERY_BYTES + 1)); },
      cancel() { cancelled = true; },
    }),
  });
  await receiveStagingEmail(misleading.message, options, () => store, receivedAt);
  assert.equal(cancelled, true);
  assert.deepEqual(stored.map(value => value.receipt.reasonCodes[0]), ["invalid_or_oversized_email", "oversized_delivery"]);
  assert.equal(stored.every(value => value.report === null && value.receipt.rawSha256 === null), true);
});

test("malformed MIME and duplicate JSON keys cannot produce candidates", async () => {
  const { stored, store } = fakeStore();
  const badMime = email({ contentType: "text/plain; charset=unsupported" });
  const duplicate = email({ body: JSON.stringify(emailBody).replace('"status":', '"status":"failed","status":') });
  for (const fixture of [badMime, duplicate]) await receiveStagingEmail(fixture.message, options, () => store, receivedAt);
  assert.deepEqual(stored.map(value => value.receipt.reasonCodes[0]), ["unsupported_charset", "invalid_json_key"]);
  assert.equal(stored.every(value => value.report === null), true);
});

test("a rate-limited delivery cannot read its stream or write quarantine records", async () => {
  const { stored, store, counters } = fakeStore({ email: false });
  const incoming = email();
  const unconsumed = { ...incoming.message, get raw(): ReadableStream<Uint8Array> { throw new Error("must not read"); } };
  await receiveStagingEmail(unconsumed, options, () => store, receivedAt);
  assert.deepEqual(counters, ["email"]);
  assert.deepEqual(stored, []);
  assert.equal(incoming.rejected.length, 1);
});

test("a failed durable save is propagated instead of reporting success", async () => {
  const { store } = fakeStore();
  const unavailable: ReceiverStore = { ...store, async saveDelivery() { throw new Error("simulated R2 failure"); } };
  await assert.rejects(receiveStagingEmail(email().message, options, () => unavailable, receivedAt), /simulated R2 failure/u);
});

test("signed synthetic delivery appears through the private proxy without rebuilding", async () => {
  const token = "unpublished-fixture-token-only-for-this-test-2026";
  const workerUrl = "https://community-pulse-staging.test-client.workers.dev/v1/inbox";
  const workerEnv = {
    PULSE_INTAKE: new MemoryR2(),
    PULSE_STAGING_ENABLED: "on",
    PULSE_EXPECTED_SENDER: sender,
    PULSE_STAGING_RECIPIENT: recipient,
    PULSE_INBOX_TOKEN: token
  };
  const previewEnv = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "feat/community-pulse-fixture-phase-f",
    COMMUNITY_PULSE_MODE: "fixture",
    PULSE_STAGING_INBOX_ENABLED: "on",
    PULSE_STAGING_WORKER_URL: new URL(workerUrl).origin,
    PULSE_STAGING_WORKER_TOKEN: token
  };
  const proxyRead = (etag?: string) => readStagingInbox(
    new Request("https://protected.example.invalid/api/community-pulse-staging",
      etag ? { headers: { "If-None-Match": etag } } : {}),
    previewEnv,
    async (input, init) => worker.fetch(new Request(input, init), workerEnv)
  );

  assert.equal((await worker.fetch(new Request(workerUrl), workerEnv)).status, 401);
  const empty = await proxyRead();
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).inbox, []);
  const delivery = email();
  await worker.email(delivery.message, workerEnv);
  assert.deepEqual(delivery.rejected, []);
  const visible = await proxyRead(empty.headers.get("etag") ?? undefined);
  assert.equal(visible.status, 200);
  assert.equal(visible.headers.get("cache-control"), "private, no-store");
  assert.deepEqual((await visible.json()).inbox[0].report, emailBody);

  const redelivery = email({ headerLines: ["Received: by different-relay.example.invalid"] });
  await worker.email(redelivery.message, workerEnv);
  assert.deepEqual(redelivery.rejected, []);
  assert.equal((await proxyRead(visible.headers.get("etag") ?? undefined)).status, 304);
});
