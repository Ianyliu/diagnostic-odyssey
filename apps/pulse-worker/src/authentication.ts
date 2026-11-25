import { createHash, timingSafeEqual } from "node:crypto";
import { normalizedMailbox } from "../../../packages/community-pulse/src/transport.ts";

const AUTH_SERVICE = "mx.cloudflare.net";
const HEADER_SCAN_LIMIT = 16 * 1024;
const FIELD_LIMIT = 4096;
const domain = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/iu;
const selector = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/iu;
const sigBytes = /^[A-Za-z0-9+/]{8,}={0,2}$/u;

export interface CloudflareAuthentication { deliveryId: string }

export interface SenderPolicy {
  from: string;
  envelopeFrom: string;
  dkimDomain: string;
}

export function equalSecret(actual: string, expected: string): boolean {
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest());
}

export function allowedReadToken(value: string | undefined): value is string {
  return value !== undefined && /^[A-Za-z0-9_-]{43,128}$/u.test(value);
}

/** The recipient is an intake-only capability; its random local part is independent of the read token. */
export function isPrivateRecipient(value: string | undefined): value is string {
  if (!value || value.length > 254) return false;
  const [local, host, ...extra] = value.split("@");
  return !!(local && host && /^[a-z][a-z0-9-]{0,12}-[a-f0-9]{32,48}$/u.test(local) &&
    domain.test(host) && extra.length === 0);
}

function startOfBody(bytes: Uint8Array) {
  const end = Math.min(bytes.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i + 1 < end; i++) {
    if (bytes[i] === 10 && bytes[i + 1] === 10) return i;
    if (i + 3 < end && bytes[i] === 13 && bytes[i + 1] === 10 &&
      bytes[i + 2] === 13 && bytes[i + 3] === 10) return i;
  }
  return -1;
}

/** Headers may coalesce repeated fields. Read their raw order before comparing the platform view. */
function extractIngressFields(raw: Uint8Array): Map<string, string[]> | undefined {
  const end = startOfBody(raw);
  if (end < 1) return undefined;
  let headers: string;
  try {
    headers = new TextDecoder("utf-8", { fatal: true }).decode(raw.subarray(0, end));
  } catch {
    return undefined;
  }
  if (headers.includes("\0")) return undefined;
  const result = new Map<string, string[]>();
  let active: string[] | undefined;
  for (const line of headers.split(/\r?\n/u)) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      const last = active?.length ? active.length - 1 : -1;
      if (!active || last < 0) return undefined;
      active[last] = (active[last] ?? "") + " " + line.trim();
      continue;
    }
    const colon = line.indexOf(":");
    const key = line.slice(0, colon).toLowerCase();
    if (colon < 1 || !/^[a-z0-9-]+$/u.test(key)) return undefined;
    active = result.get(key) ?? [];
    active.push(line.slice(colon + 1).trim());
    result.set(key, active);
  }
  return result;
}

function canonicalWhitespace(value: string): string {
  return value.replace(/[ \t\r\n]+/gu, " ").trim();
}

/** Separate method clauses outside quoted-string and RFC 8601 comment syntax. */
function authenticationClauses(value: string): string[] | undefined {
  if (value.length > FIELD_LIMIT) return undefined;
  const clauses: string[] = [];
  let clause = "";
  let commentDepth = 0;
  let quoted = false;
  let escaped = false;
  for (const c of value) {
    if (escaped) {
      if (quoted) clause += c;
      escaped = false;
    } else if (c === "\\" && (quoted || commentDepth > 0)) {
      if (quoted) clause += c;
      escaped = true;
    } else if (!quoted && c === "(") {
      if (commentDepth === 0) clause += " ";
      commentDepth++;
    } else if (commentDepth > 0) {
      if (c === ")") commentDepth--;
    } else if (c === '"') {
      quoted = !quoted;
      clause += c;
    } else if (c === ";" && !quoted) {
      clauses.push(clause.trim());
      clause = "";
    } else {
      clause += c;
    }
  }
  if (quoted || commentDepth > 0 || escaped) return undefined;
  clauses.push(clause.trim());
  return clauses;
}

function parameters(input: string): Map<string, string> | undefined {
  const fields = new Map<string, string>();
  let remaining = input.trim();
  while (remaining) {
    const found = /^(?:reason|[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*)\s*=\s*(?:"(?:[^"\\]|\\.)*"|[^\s";]+)(?=\s|$)/iu.exec(remaining)?.[0];
    if (!found) return undefined;
    const split = found.indexOf("=");
    const key = found.slice(0, split).trim().toLowerCase();
    if (fields.has(key)) return undefined;
    fields.set(key, found.slice(split + 1).trim().replace(/^"(.*)"$/u, "$1"));
    remaining = remaining.slice(found.length).trim();
  }
  return fields;
}

function uniqueDkimSignature(signatures: string[], signingDomain: string, signingSelector: string, signaturePrefix: string): Map<string, string> | undefined {
  const matching: Map<string, string>[] = [];
  for (const line of signatures) {
    if (line.length > FIELD_LIMIT) return undefined;
    const tags = new Map<string, string>();
    for (const attribute of line.split(";").map(item => item.trim()).filter(Boolean)) {
      const tag = /^([a-z][a-z0-9_]*)\s*=\s*(.*)$/iu.exec(attribute);
      if (!tag?.[1] || tag[2] === undefined) return undefined;
      const name = tag[1].toLowerCase();
      if (tags.has(name)) return undefined;
      tags.set(name, tag[2].trim());
    }
    const value = tags.get("b")?.replace(/\s/gu, "");
    if (tags.get("d")?.toLowerCase() === signingDomain && tags.get("s")?.toLowerCase() === signingSelector &&
      value && sigBytes.test(value) && value.startsWith(signaturePrefix)) {
      matching.push(tags);
    }
  }
  const signature = matching[0];
  return matching.length === 1 && !!signature && !signature.has("l") &&
    signedHeader(signature, "from") && signedHeader(signature, "content-type") ? signature : undefined;
}

function signedHeader(signature: Map<string, string>, field: string): boolean {
  return (signature.get("h") ?? "").toLowerCase().split(":").some(name => name.trim() === field);
}

function identityDigest(signature: Map<string, string>, fields: Map<string, string[]>): string {
  const messageIds = fields.get("message-id");
  const messageId = messageIds?.[0];
  const signedMessageId = messageIds?.length === 1 && messageId &&
    signedHeader(signature, "message-id") && /^<[^<>\s]{1,240}>$/u.test(messageId);
  const material = signedMessageId
    ? ["signed-message-id", signature.get("d")?.toLowerCase(), messageId]
    : ["signed-message", signature.get("d")?.toLowerCase(), signature.get("s"), signature.get("b")?.replace(/\s/gu, "")];
  return "cf-mail:" + createHash("sha256").update(JSON.stringify(material)).digest("hex");
}

/**
 * Only usable inside Cloudflare Email Routing's email event. Neither a raw header nor an arbitrary
 * Headers object attests ingress by itself. Require the platform's prepended first header and an
 * unambiguous matching signature that covers From and lacks a partial-body length tag.
 */
export function authenticateCloudflareMail(headers: Headers, raw: Uint8Array, envelopeFrom: string, policy: SenderPolicy): CloudflareAuthentication | undefined {
  if (normalizedMailbox(envelopeFrom) !== normalizedMailbox(policy.envelopeFrom)) return undefined;
  const fields = extractIngressFields(raw);
  const firstResult = fields?.get("authentication-results")?.[0];
  const exposed = headers.get("authentication-results");
  if (!firstResult || !exposed) return undefined;
  const first = canonicalWhitespace(firstResult);
  const platform = canonicalWhitespace(exposed);
  if (platform !== first && !platform.startsWith(first + ", ")) return undefined;

  const fromDomain = policy.from.split("@")[1]?.toLowerCase();
  const signingDomain = policy.dkimDomain.toLowerCase();
  if (!fromDomain || !domain.test(fromDomain) || !domain.test(signingDomain)) return undefined;

  const values = authenticationClauses(first);
  if (values?.[0]?.toLowerCase() !== AUTH_SERVICE || !values || !fields) return undefined;
  const signatures = fields.get("dkim-signature") ?? [];
  let dmarcPass = false;
  const alignedDkim = new Set<string>();
  for (const clause of values.slice(1)) {
    const method = /^(dkim|dmarc)\s*=\s*([a-z]+)(?=\s|$)(.*)$/iu.exec(clause);
    if (!method || method[3] === undefined) continue;
    const args = parameters(method[3]);
    if (!args) return undefined;
    if (method[1]?.toLowerCase() === "dmarc") {
      // Treat contradictory or repeated DMARC as an ambiguous result and fail closed.
      if (dmarcPass || method[2]?.toLowerCase() !== "pass" || args.get("header.from")?.toLowerCase() !== fromDomain) return undefined;
      dmarcPass = true;
    } else if (method[2]?.toLowerCase() === "pass" && args.get("header.d")?.toLowerCase() === signingDomain) {
      const s = args.get("header.s")?.toLowerCase();
      const b = args.get("header.b");
      if (s && selector.test(s) && b && sigBytes.test(b)) {
        const signature = uniqueDkimSignature(signatures, signingDomain, s, b);
        if (signature && (!fields.has("content-transfer-encoding") || signedHeader(signature, "content-transfer-encoding"))) {
          alignedDkim.add(identityDigest(signature, fields));
        }
      }
    }
  }

  // Explicitly approve a parent signer such as instinct.com for its managed mail subdomain only.
  // An unrelated signer must never qualify merely because SPF independently passed DMARC.
  if (!dmarcPass || alignedDkim.size !== 1 ||
    (fromDomain !== signingDomain && !fromDomain.endsWith("." + signingDomain))) return undefined;
  const [deliveryId] = alignedDkim;
  return deliveryId ? { deliveryId } : undefined;
}
