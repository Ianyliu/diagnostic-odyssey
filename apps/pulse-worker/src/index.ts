import { allowedReadToken, equalSecret } from "./authentication.ts";
import { receiveStagingEmail, type InboundEmail } from "./email.ts";
import { createIntakeStore, type IntakeBucket, type StagingInbox } from "./storage.ts";

export interface StagingWorkerEnv {
  PULSE_STAGING_ENABLED?: string;
  PULSE_INTAKE: IntakeBucket;
  PULSE_STAGING_RECIPIENT?: string;
  PULSE_EXPECTED_SENDER?: string;
  PULSE_EXPECTED_ENVELOPE_SENDER?: string;
  PULSE_DKIM_DOMAIN?: string;
  PULSE_INBOX_TOKEN?: string;
  PULSE_RETENTION_DAYS?: string;
  PULSE_EMAIL_PER_HOUR?: string;
  PULSE_QUARANTINE_PER_HOUR?: string;
  PULSE_HOURLY_EXPECTED_SINCE?: string;
}

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, noarchive",
  Vary: "Authorization",
};

function optionalInteger(value: string | undefined) {
  if (!value || !/^[1-9][0-9]{0,3}$/u.test(value)) return undefined;
  return Number(value);
}

function storeFor(env: StagingWorkerEnv) {
  const retentionDays = optionalInteger(env.PULSE_RETENTION_DAYS);
  const emailPerHour = optionalInteger(env.PULSE_EMAIL_PER_HOUR);
  const quarantinePerHour = optionalInteger(env.PULSE_QUARANTINE_PER_HOUR);
  const hourlyExpectedSince = env.PULSE_HOURLY_EXPECTED_SINCE;
  return createIntakeStore(env.PULSE_INTAKE, {
    ...(retentionDays !== undefined ? { retentionDays } : {}),
    ...(emailPerHour !== undefined ? { emailPerHour } : {}),
    ...(quarantinePerHour !== undefined ? { quarantinePerHour } : {}),
    ...(hourlyExpectedSince ? { hourlyExpectedSince } : {}),
  });
}

type ReadProjection = (ifNoneMatch?: string) => Promise<{ etag: string; data: StagingInbox | null }>;

export async function serveStagingInbox(
  request: Request,
  enabled: boolean,
  token: string | undefined,
  read: ReadProjection,
): Promise<Response> {
  const url = new URL(request.url);
  if (!enabled || !allowedReadToken(token) || url.pathname !== "/v1/inbox" || url.search) {
    return Response.json({ error: "not_found" }, { status: 404, headers: responseHeaders });
  }
  const value = request.headers.get("authorization");
  const supplied = value?.startsWith("Bearer ") ? value.slice(7) : undefined;
  if (!allowedReadToken(supplied) || !equalSecret(supplied, token)) {
    return Response.json({ error: "authentication_required" }, { status: 401, headers: responseHeaders });
  }
  if (request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, {
      status: 405, headers: { ...responseHeaders, Allow: "GET" },
    });
  }

  const conditional = request.headers.get("if-none-match");
  try {
    const { data, etag } = await read(conditional && conditional.length <= 160 ? conditional : undefined);
    const headers = { ...responseHeaders, ETag: etag };
    return data ? Response.json(data, { headers }) : new Response(null, { status: 304, headers });
  } catch {
    return Response.json({ error: "staging_inbox_unavailable" }, { status: 503, headers: responseHeaders });
  }
}

const worker = {
  async email(message: InboundEmail, env: StagingWorkerEnv): Promise<void> {
    try {
      await receiveStagingEmail(message, {
        enabled: env.PULSE_STAGING_ENABLED === "on",
        recipient: env.PULSE_STAGING_RECIPIENT,
        expectedFrom: env.PULSE_EXPECTED_SENDER,
        expectedEnvelopeFrom: env.PULSE_EXPECTED_ENVELOPE_SENDER,
        signingDomain: env.PULSE_DKIM_DOMAIN,
      }, () => storeFor(env));
    } catch {
      // A storage/R2 failure must be visible to the platform, without logging message data.
      throw new Error("Staging email intake unavailable.");
    }
  },
  fetch(request: Request, env: StagingWorkerEnv): Promise<Response> {
    return serveStagingInbox(request, env.PULSE_STAGING_ENABLED === "on", env.PULSE_INBOX_TOKEN,
      ifNoneMatch => storeFor(env).readInboxIfChanged(new Date(), ifNoneMatch));
  },
  async scheduled(_event: unknown, env: StagingWorkerEnv): Promise<void> {
    if (env.PULSE_STAGING_ENABLED !== "on") return;
    const store = storeFor(env);
    const now = new Date();
    await store.recoverPending(now);
    await store.purgeExpired(now);
  },
};

export default worker;
