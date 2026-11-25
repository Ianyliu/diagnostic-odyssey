import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import type { ResearchReport } from "../../../packages/community-pulse/src/research.ts";
import { MAX_DELIVERY_BYTES, MAX_REPORT_BYTES, researchReportDigest } from "../../../packages/community-pulse/src/transport.ts";
import { readHistoryEndpoint } from "../../web/src/server/community-pulse/historyEndpoint.ts";
import { reconcileAgentMail, serveAgentMailWebhook } from "../src/agentmail.ts";
import worker from "../src/index.ts";
import { serveResearchHistory } from "../src/historyEndpoint.ts";
import { MemoryR2 } from "../src/offlineBucket.ts";
import { createIntakeStore } from "../src/storage.ts";

const now = new Date("2026-11-25T13:01:00.000Z");
const providerReceivedAt = new Date(now.valueOf() - 20_000).toISOString();
const inboxId = "pulse-0123456789abcdef0123456789abcdef@agentmail.to";
const sender = "researcher@managed.example.invalid";
const domain = "managed.example.invalid";
const apiKey = "am_fixture_read_only_mailbox_key_not_a_real_secret";
const secretBytes = Buffer.alloc(32, 0x42);
const secret = "whsec_" + secretBytes.toString("base64");
const readToken = "fixture-only-worker-read-token-protected-preview-2026";
const workerOrigin = "https://community-pulse-staging.synthetic.workers.dev";
const webhookUrl = workerOrigin + "/v1/agentmail/webhook";
const messagesPath = "/v0/inboxes/" + encodeURIComponent(inboxId) + "/messages";
const firstMessageId = "<fixture-one@managed.example.invalid>";
const qualifiedResults = { spf: "pass", spf_domain: domain, dkim: "pass", dkim_domain: domain, dmarc: "pass", dmarc_domain: domain };
const report: ResearchReport = {
  schema_version: "0.2.1", kind: "research_report", run_id: "agentmail-fixture-1", report_type: "on_demand",
  status: "completed", title: "Synthetic AgentMail delivery",
  items: [{ kind: "open_question", title: "Fixture question", text: "Does the restricted intake preserve the café fixture?", sources: [] }],
  reason_codes: [],
};

type ReceiverEnv = Parameters<typeof serveAgentMailWebhook>[1];
type EventOptions = {
  id?: string;
  eventId?: string;
  eventType?: string;
  message?: Record<string, unknown>;
  raw?: string;
  timestamp?: number;
  signFor?: string;
  signature?: string;
  contentLength?: number;
  method?: string;
};

function message(overrides: Record<string, unknown> = {}) {
  return {
    inbox_id: inboxId,
    thread_id: "synthetic-thread",
    message_id: firstMessageId,
    labels: ["received"],
    timestamp: providerReceivedAt,
    from: "Synthetic Researcher <" + sender + ">",
    to: [inboxId],
    size: 780,
    updated_at: providerReceivedAt,
    created_at: providerReceivedAt,
    subject: "Synthetic transport qualification",
    text: JSON.stringify(report),
    authentication_results: qualifiedResults,
    ...overrides,
  };
}

function webhook(options: EventOptions = {}): Request {
  const raw = options.raw ?? JSON.stringify({
    type: "event",
    event_type: options.eventType ?? "message.received",
    event_id: options.eventId ?? "evt_fixture_agentmail",
    // Webhook data only identifies the provider message. The Get Message response is authoritative.
    message: options.message ?? { inbox_id: inboxId, message_id: firstMessageId },
    thread: { inbox_id: inboxId, thread_id: "synthetic-thread" },
  });
  const id = options.id ?? "msg_fixture_agentmail";
  const timestamp = String(options.timestamp ?? Math.floor(now.valueOf() / 1_000));
  const digest = createHmac("sha256", secretBytes).update(id + "." + timestamp + ".").update(options.signFor ?? raw).digest("base64");
  const headers = new Headers({
    "content-type": "application/json",
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": options.signature ?? "v1," + digest,
  });
  if (options.contentLength !== undefined) headers.set("content-length", String(options.contentLength));
  const method = options.method ?? "POST";
  return new Request(webhookUrl, { method, ...method !== "GET" ? { body: raw } : {}, headers });
}

interface MockOptions {
  records?: Record<string, unknown>[];
  list?: (query: URLSearchParams) => Response;
  get?: (id: string) => Response | undefined;
  env?: Partial<ReceiverEnv>;
  intakeOptions?: Parameters<typeof createIntakeStore>[1];
}

function fixture(options: MockOptions = {}) {
  const bucket = new MemoryR2(now);
  const env = {
    PULSE_STAGING_ENABLED: "on",
    PULSE_AGENTMAIL_MODE: "qualified",
    PULSE_AGENTMAIL_INBOX_ID: inboxId,
    PULSE_AGENTMAIL_API_KEY: apiKey,
    PULSE_AGENTMAIL_RECONCILE: "on",
    PULSE_AGENTMAIL_WEBHOOK_SECRET: secret,
    PULSE_EXPECTED_SENDER: sender,
    PULSE_INBOX_TOKEN: readToken,
    ...options.env,
    PULSE_INTAKE: bucket,
  } satisfies ReceiverEnv & { PULSE_INBOX_TOKEN: string };
  const calls: URL[] = [];
  const store = createIntakeStore(bucket, options.intakeOptions);
  const defaultRecords = options.records ?? [message()];
  const fetcher: typeof fetch = async (resource, init) => {
    const request = new Request(resource, init);
    const url = new URL(request.url);
    calls.push(url);
    assert.equal(request.method, "GET");
    assert.equal(url.origin, "https://api.agentmail.to");
    assert.equal(request.headers.get("authorization"), "Bearer " + apiKey);
    assert.equal(request.redirect, "error");
    if (url.pathname === messagesPath) {
      return options.list?.(url.searchParams) ?? Response.json({ count: defaultRecords.length, messages: defaultRecords });
    }
    assert.ok(url.pathname.startsWith(messagesPath + "/"), url.pathname);
    const id = decodeURIComponent(url.pathname.slice(messagesPath.length + 1));
    const record = defaultRecords.find(item => item.message_id === id);
    return options.get?.(id) ?? (record ? Response.json(record) : new Response(null, { status: 404 }));
  };
  return {
    env, bucket, store, calls,
    serve: (input = webhook(), at = now) => serveAgentMailWebhook(input, env, () => store, at, fetcher),
    reconcile: (at = now) => reconcileAgentMail(env, () => store, at, fetcher),
    inbox: (at = now) => store.readInbox(new Date(at.valueOf() + 1_000)),
  };
}

test("signed AgentMail delivery uses the authoritative scoped Get Message API and updates the private dashboard", async () => {
  const run = fixture({ env: {
    PULSE_AGENTMAIL_MODE: "synthetic",
    PULSE_AGENTMAIL_SYNTHETIC_REPORT_SHA256: researchReportDigest(report),
  } });
  const incoming = webhook({
    message: { inbox_id: inboxId, message_id: firstMessageId, text: "Injected webhook projection — café", from: sender, to: [inboxId] },
  });
  const signed = incoming.headers.get("svix-signature");
  assert.ok(signed);
  incoming.headers.set("svix-signature", "v1," + Buffer.alloc(32).toString("base64") + " " + signed);
  assert.ok((await run.serve(incoming)).ok);
  assert.equal(run.calls.length, 1);
  const entries = (await run.inbox()).inbox;
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0]?.report, report);
  assert.equal(entries[0]?.receipt.status, "accepted");
  assert.equal(entries[0]?.receipt.provider, "agentmail-staging-email");
  assert.equal(entries[0]?.receipt.review_status, "pending");
  assert.equal(entries[0]?.receipt.content_sha256, createHash("sha256").update(JSON.stringify(report)).digest("hex"));
  assert.equal([...run.bucket.objects.values()].some(value => value.body.includes("Injected webhook projection")), false);

  const unsigned = new Request(webhookUrl, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  assert.equal((await worker.fetch(unsigned, run.env)).status, 401);
  const privateHistory = new Request(workerOrigin + "/v1/history?mode=all");
  assert.equal((await worker.fetch(privateHistory, run.env)).status, 401);
  const stageEnv = {
    VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "feat/community-pulse-fixture-phase-f", COMMUNITY_PULSE_MODE: "fixture",
    PULSE_STAGING_INBOX_ENABLED: "on", PULSE_STAGING_WORKER_URL: workerOrigin, PULSE_STAGING_WORKER_TOKEN: readToken,
  };
  const read = (view: string, env = stageEnv) => readHistoryEndpoint(
    new Request("https://protected.example.invalid/api/community-pulse-history?" + view), env,
    (resource, init) => serveResearchHistory(new Request(resource, init), true, readToken, () => run.store, new Date(now.valueOf() + 1_000)),
  );
  const summary = await read("view=history&mode=all");
  assert.equal(summary.status, 200);
  const recent = (await summary.json()).records;
  assert.equal(recent.length, 1);
  assert.equal(recent[0].title, report.title);
  const detail = await read("view=report&ref=" + encodeURIComponent(recent[0].ref));
  assert.equal(detail.status, 200);
  assert.deepEqual((await detail.json()).report, report);
  assert.equal((await read("view=history&mode=all", { ...stageEnv, VERCEL_ENV: "production" })).status, 404);
});

test("invalid signatures, tampering, expired and future timestamps do not initialize storage or call AgentMail", async () => {
  const run = fixture();
  const unsigned = webhook();
  unsigned.headers.delete("svix-signature");
  for (const [input, status] of [
    [unsigned, 401],
    [webhook({ signature: "v1," + Buffer.alloc(32).toString("base64") }), 401],
    [webhook({ signFor: "Different raw bytes" }), 401],
    [webhook({ timestamp: Math.floor(now.valueOf() / 1_000) - 601 }), 401],
    [webhook({ timestamp: Math.floor(now.valueOf() / 1_000) + 601 }), 401],
    [webhook({ method: "GET" }), 405],
  ] as const) {
    const response = await serveAgentMailWebhook(input, run.env, () => assert.fail("Storage initialized for rejected request"), now,
      async () => assert.fail("Loaded message for rejected request"));
    assert.equal(response.status, status);
  }
  assert.equal(run.bucket.objects.size, 0);
});

test("wrong inbox, malformed webhook JSON, and unexpected events fail before mailbox retrieval", async () => {
  for (const [input, status] of [
    [webhook({ message: { inbox_id: "other@agentmail.to", message_id: firstMessageId } }), 403],
    [webhook({ eventType: "message.sent" }), 400],
    [webhook({ eventType: "message.received.unauthenticated" }), 400],
    [webhook({ raw: '{"type":"event"' }), 400],
  ] as const) {
    const run = fixture();
    assert.equal((await run.serve(input)).status, status);
    assert.equal(run.calls.length, 0);
    assert.equal((await run.inbox()).inbox.length, 0);
  }
});

test("replayed webhooks and duplicate provider notifications expose one private accepted run", async () => {
  const run = fixture();
  assert.ok((await run.serve()).ok);
  assert.ok((await run.serve()).ok);
  assert.ok((await run.serve(webhook({ id: "msg_second_webhook_scope", eventId: "evt_fixture_agentmail" }))).ok);
  assert.ok((await run.serve(webhook({ id: "msg_other_event", eventId: "evt_second_provider_notification" }))).ok);
  const entries = (await run.inbox()).inbox;
  assert.equal(run.calls.length, 1);
  assert.equal(entries.filter(entry => entry.receipt.status === "accepted").length, 1);
  assert.equal(entries.filter(entry => entry.report).length, 1);
  assert.equal([...run.bucket.objects.keys()].filter(key => key.startsWith("s0/runs/")).length, 1);
});

test("provider-authenticated domains, expected sender and exact API inbox are independent admission checks", async () => {
  for (const override of [
    { authentication_results: undefined, headers: {
      "Authentication-Results": "forged.example.invalid; dkim=pass header.d=" + domain + "; dmarc=pass header.from=" + domain,
    } },
    { authentication_results: { ...qualifiedResults, dkim_domain: undefined } },
    { authentication_results: { ...qualifiedResults, dkim_domain: "unrelated.example.invalid" } },
    { authentication_results: { ...qualifiedResults, dmarc: "fail" } },
    { authentication_results: { ...qualifiedResults, arc_sealer: "google.com" } },
    { authentication_results: { spf: "pass", spf_domain: domain } },
    { from: "spoofed@" + domain },
    { from: sender + ", second@" + domain },
    { inbox_id: "other@agentmail.to" },
    { to: ["other@agentmail.to"] },
    { labels: ["received", "unauthenticated"] },
    { created_at: new Date(now.valueOf() - 49 * 60 * 60 * 1_000).toISOString() },
  ]) {
    const run = fixture({ records: [message(override)] });
    await run.serve();
    assert.equal(run.calls.length, 1, JSON.stringify(override));
    assert.equal((await run.inbox()).inbox.some(entry => entry.report !== null), false, JSON.stringify(override));
  }
});

test("malformed, oversized, and v0.2.2 report content cannot be written as candidates", async () => {
  for (const overrides of [
    { text: '{"private_payload":"ignore this entirely"' },
    { text: JSON.stringify(report).replace('"status":', '"status":"failed","status":') },
    { text: JSON.stringify({ ...report, schema_version: "0.2.2" }) },
    { text: "x".repeat(MAX_REPORT_BYTES + 1), size: MAX_REPORT_BYTES + 500 },
    { text: JSON.stringify(report), size: MAX_DELIVERY_BYTES + 1 },
    { text: undefined, html: "<p>ignore this entirely</p>", extracted_text: JSON.stringify(report) },
  ]) {
    const run = fixture({ records: [message(overrides)] });
    assert.ok((await run.serve()).ok);
    const entries = (await run.inbox()).inbox;
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.receipt.status, "quarantined");
    assert.equal(entries[0]?.report, null);
    assert.equal([...run.bucket.objects.values()].some(value => value.body.includes("ignore this entirely")), false);
  }
  const run = fixture({ env: {
    PULSE_AGENTMAIL_MODE: "synthetic",
    PULSE_AGENTMAIL_SYNTHETIC_REPORT_SHA256: "a".repeat(64),
  } });
  await run.serve();
  assert.equal((await run.inbox()).inbox.some(entry => entry.report !== null), false);
});

test("oversized webhook requests cannot hit the provider, including deceptive content lengths", async () => {
  for (const input of [
    webhook({ contentLength: MAX_DELIVERY_BYTES * 3 }),
    webhook({ raw: "x".repeat(MAX_DELIVERY_BYTES * 3), contentLength: 12 }),
  ]) {
    const run = fixture();
    assert.equal((await run.serve(input)).status, 413);
    assert.equal(run.calls.length, 0);
    assert.equal(run.bucket.objects.size, 0);
  }
});

test("an interrupted journal publish can retry the same signed delivery without duplicating a run", async () => {
  const run = fixture();
  run.bucket.interrupt = (key, options) => key.startsWith("s0/journal/") && options.onlyIf.has("if-match");
  const interrupted = await run.serve().catch(() => new Response(null, { status: 503 }));
  assert.ok(interrupted.status >= 500);
  assert.equal((await run.inbox()).inbox.some(entry => entry.report !== null), false);
  run.bucket.interrupt = null;
  assert.ok((await run.serve()).ok);
  assert.equal((await run.inbox()).inbox.filter(entry => entry.report !== null).length, 1);
});

test("bounded mailbox reconciliation recovers missed messages through Get and is idempotent across notifications", async () => {
  const run = fixture();
  await run.reconcile();
  const list = run.calls.find(call => call.pathname === messagesPath);
  assert.ok(list);
  const limit = Number(list.searchParams.get("limit"));
  assert.ok(Number.isSafeInteger(limit) && limit > 0 && limit <= 100);
  assert.ok(run.calls.some(call => decodeURIComponent(call.pathname).endsWith("/" + firstMessageId)));
  assert.equal((await run.inbox()).inbox.filter(entry => entry.report !== null).length, 1);
  await run.reconcile();
  assert.ok((await run.serve()).ok);
  assert.equal((await run.inbox()).inbox.filter(entry => entry.report !== null).length, 1);
});

test("a transient mailbox failure can retry the same event without a false terminal receipt", async () => {
  let transient = true;
  const run = fixture({ get: () => transient ? new Response(null, { status: 503 }) : undefined });
  assert.equal((await run.serve()).status, 503);
  assert.equal((await run.inbox()).inbox.length, 0);
  transient = false;
  assert.ok((await run.serve()).ok);
  assert.equal((await run.inbox()).inbox.filter(entry => entry.report !== null).length, 1);
});

test("AgentMail ingress and reconciliation remain disabled unless explicitly configured", async () => {
  for (const environment of [
    { PULSE_STAGING_ENABLED: "off" },
    { PULSE_AGENTMAIL_MODE: "off" },
    { PULSE_AGENTMAIL_MODE: "synthetic" },
  ] as const) {
    const run = fixture({ env: environment });
    assert.equal((await run.serve()).status, 404);
    await run.reconcile();
    assert.deepEqual(run.calls, []);
    assert.equal(run.bucket.objects.size, 0);
  }
});

test("authenticated delivery budgets cap mailbox fetches without blocking completed replays", async () => {
  const run = fixture({ intakeOptions: { emailPerHour: 1 } });
  assert.equal((await run.serve()).status, 200);
  const second = webhook({
    id: "msg_extra", eventId: "evt_extra",
    message: { inbox_id: inboxId, message_id: "<second@managed.example.invalid>" },
  });
  assert.equal((await run.serve(second)).status, 429);
  assert.equal((await run.serve()).status, 200);
  assert.equal(run.calls.length, 1);
  assert.equal((await run.inbox()).inbox.length, 1);
});

test("reconciliation checkpoints a bounded page only after every listed message is terminal", async () => {
  const secondId = "<fixture-two@managed.example.invalid>";
  const secondReport = { ...report, run_id: "agentmail-fixture-2" };
  const firstPointer = { inbox_id: inboxId, message_id: firstMessageId };
  const secondPointer = { inbox_id: inboxId, message_id: secondId };
  let transient = true;
  const run = fixture({
    records: [message(), message({ message_id: secondId, text: JSON.stringify(secondReport) })],
    get: id => transient && id === firstMessageId ? new Response(null, { status: 503 }) : undefined,
    list: query => {
      assert.equal(query.get("limit"), "2");
      assert.equal(query.get("ascending"), "true");
      return query.get("page_token") === "page-two"
        ? Response.json({ count: 1, messages: [secondPointer] })
        : Response.json({ count: 1, messages: [firstPointer], next_page_token: "page-two" });
    },
  });
  assert.equal((await run.reconcile()).deferred, 1);
  assert.equal((await run.inbox()).inbox.length, 0);
  transient = false;
  assert.equal((await run.reconcile()).processed, 1);
  assert.equal((await run.inbox()).inbox.length, 1);
  const nextTick = new Date(now.valueOf() + 60_000);
  assert.equal((await run.reconcile(nextTick)).processed, 1);
  const lists = run.calls.filter(call => call.pathname === messagesPath);
  assert.deepEqual(lists.map(call => call.searchParams.get("page_token")), [null, null, "page-two"]);
  assert.equal(lists[1]?.searchParams.get("after"), lists[2]?.searchParams.get("after"));
  assert.deepEqual((await run.inbox(nextTick)).inbox.map(entry => entry.report?.run_id).sort(), [report.run_id, secondReport.run_id]);

  const subsequentSweep = await run.reconcile(new Date(nextTick.valueOf() + 60_000));
  assert.equal(subsequentSweep.processed, 0);
  const latestList = run.calls.filter(call => call.pathname === messagesPath).at(-1);
  assert.equal(latestList?.searchParams.get("page_token"), null);
  assert.equal(latestList?.searchParams.get("after"), new Date(now.valueOf() - 2 * 60 * 60 * 1_000).toISOString());
});

test("overlapping provider retries preserve one durable pending-review item", async () => {
  const run = fixture();
  const outcomes = await Promise.all([run.serve(), run.serve()]);
  assert.ok(outcomes.every(response => response.ok));
  assert.equal((await run.inbox()).inbox.filter(entry => entry.report !== null).length, 1);
  assert.equal([...run.bucket.objects.keys()].filter(key => key.startsWith("s0/runs/")).length, 1);
});

test("oversized authoritative Get responses quarantine without retaining the body", async () => {
  const marker = "oversized API payload remains private";
  const run = fixture({ get: () => Response.json({ marker, filler: "x".repeat(MAX_DELIVERY_BYTES) }) });
  assert.equal((await run.serve()).status, 200);
  const entries = (await run.inbox()).inbox;
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.receipt.status, "quarantined");
  assert.equal(entries[0]?.receipt.reason_code, "agentmail_api_message_too_large");
  assert.equal(entries[0]?.report, null);
  assert.ok([...run.bucket.objects.values()].every(entry => !entry.body.includes(marker)));
});
