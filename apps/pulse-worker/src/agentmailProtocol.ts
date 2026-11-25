import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

const apiOrigin = "https://api.agentmail.to";
const MAX_HEADER_ID = 160;
const MAX_SIGNATURES = 8;
const TIMESTAMP_TOLERANCE_SECONDS = 300;
const MAX_API_RESPONSE_BYTES = 256 * 1024;

export class AgentMailTooLarge extends Error {}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export async function readBoundedBytes(source: Request | Response, max: number): Promise<Uint8Array> {
  const size = source.headers.get("content-length");
  if (size !== null && (!/^\d{1,12}$/u.test(size) || Number(size) > max)) {
    throw new AgentMailTooLarge();
  }

  const reader = source.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel().catch(() => {});
        throw new AgentMailTooLarge();
      }
      if (value.byteLength) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function decodeAgentMailJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

export function svixSigningKey(secret: string | undefined): Buffer | undefined {
  const encoded = /^whsec_([A-Za-z0-9+/]{22,172}={0,2})$/u.exec(secret ?? "")?.[1];
  if (!encoded) return undefined;
  const key = Buffer.from(encoded, "base64");
  const canonical = key.toString("base64");
  return key.byteLength >= 16 && key.byteLength <= 128 &&
    (encoded === canonical || encoded === canonical.replace(/=+$/u, "")) ? key : undefined;
}

export function svixEnvelope(headers: Headers, now: Date) {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const value = headers.get("svix-signature");
  if (!id || id.length > MAX_HEADER_ID || !/^[a-z0-9_-]+$/iu.test(id) || !timestamp ||
    !/^[1-9][0-9]{8,11}$/u.test(timestamp) || !value || value.length > 512 ||
    Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp)) > TIMESTAMP_TOLERANCE_SECONDS) return undefined;

  const tokens = value.split(/ +/u);
  if (tokens.length > MAX_SIGNATURES) return undefined;
  const signatures = tokens.flatMap(token => {
    const encoded = /^v1,([A-Za-z0-9+/]{43}=)$/u.exec(token)?.[1];
    if (!encoded) return [];
    const signature = Buffer.from(encoded, "base64");
    return signature.byteLength === 32 && signature.toString("base64") === encoded ? [signature] : [];
  });
  return signatures.length ? { prefix: id + "." + timestamp + ".", signatures } : undefined;
}

export function validSvixSignature(
  envelope: NonNullable<ReturnType<typeof svixEnvelope>>, key: Buffer, bytes: Uint8Array,
): boolean {
  const expected = createHmac("sha256", key).update(envelope.prefix).update(bytes).digest();
  return envelope.signatures.some(signature => timingSafeEqual(signature, expected));
}

export function isAgentMailMessageId(id: unknown): id is string {
  return typeof id === "string" && id.length <= 250 &&
    /^(?:[A-Za-z0-9][A-Za-z0-9_.:@+-]*|<[A-Za-z0-9_.@%+=-]+>)$/u.test(id);
}

export function isAgentMailPageToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_+/=.%-]{1,1024}$/u.test(token);
}

/** Fetch only from the fixed US AgentMail API. Message, attachment and body URLs are never followed. */
export async function agentMailMessages(
  fetcher: typeof fetch, key: string, inbox: string, messageId?: string, query?: URLSearchParams,
): Promise<unknown> {
  const url = new URL("/v0/inboxes/" + encodeURIComponent(inbox) + "/messages" +
    (messageId ? "/" + encodeURIComponent(messageId) : ""), apiOrigin);
  if (query) url.search = query.toString();
  const response = await fetcher(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json", Authorization: "Bearer " + key },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok || !/^application\/json(?:\s*;|$)/iu.test(response.headers.get("content-type") ?? "")) {
    await response.body?.cancel().catch(() => {});
    throw Error("AgentMail message API unavailable");
  }
  return decodeAgentMailJson(await readBoundedBytes(response, MAX_API_RESPONSE_BYTES));
}
