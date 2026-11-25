import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";

const MAX_HEADER_CHARS = 12_288;
const MAX_HEADERS = 80;
const MAX_PARTS = 12;
const MAX_DEPTH = 3;
const BOUNDARY_PATTERN = /^[A-Za-z0-9'()+_,./:=?-]{1,70}$/u;
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export type MailBody = {
  mediaType: "text/plain" | "application/json";
  text: string;
};

export class InvalidMime extends Error {}

function readHeaders(block: string): Map<string, string[]> {
  if (block.length > MAX_HEADER_CHARS) throw new InvalidMime("oversized_headers");
  const result = new Map<string, string[]>();
  let last: string[] | undefined;
  let count = 0;
  for (const line of block.split("\n")) {
    const hasControl = [...line].some(character => {
      const code = character.charCodeAt(0);
      return (code < 32 && code !== 9) || code === 127;
    });
    if (line.length > 998 || hasControl) throw new InvalidMime("invalid_header");
    if (/^[ \t]/u.test(line)) {
      if (!last) throw new InvalidMime("unexpected_header_fold");
      last[last.length - 1] += " " + line.trim();
      continue;
    }
    const colon = line.indexOf(":");
    const key = line.slice(0, colon).toLowerCase();
    if (colon < 1 || !/^[a-z0-9-]+$/u.test(key) || ++count > MAX_HEADERS) {
      throw new InvalidMime("invalid_header");
    }
    last = result.get(key) ?? [];
    last.push(line.slice(colon + 1).trim());
    result.set(key, last);
  }
  return result;
}

function uniqueHeader(headers: Map<string, string[]>, name: string): string | null {
  const values = headers.get(name);
  if (!values) return null;
  if (values.length !== 1) throw new InvalidMime("ambiguous_mime_header");
  return values[0] ?? null;
}

function mediaType(value: string): { type: string; parameters: Map<string, string> } {
  const [rawType, ...entries] = value.split(";");
  const type = rawType?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u.test(type)) throw new InvalidMime("invalid_content_type");
  const parameters = new Map<string, string>();
  for (const entry of entries) {
    const match = /^([a-z0-9_-]+)\s*=\s*(?:"([^"\\]+)"|([^\s"]+))$/iu.exec(entry.trim());
    if (!match) throw new InvalidMime("invalid_mime_parameter");
    const key = match[1]!.toLowerCase();
    if (parameters.has(key)) throw new InvalidMime("duplicate_mime_parameter");
    parameters.set(key, match[2] ?? match[3]!);
  }
  return { type, parameters };
}

function decodeBody(body: string, encoding: string, charset: string, maxOutputBytes: number): string {
  let bytes: Buffer;
  if (encoding === "base64") {
    const packed = body.replace(/[\t \n]/gu, "");
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(packed)) {
      throw new InvalidMime("invalid_transfer_encoding");
    }
    bytes = Buffer.from(packed, "base64");
    if (bytes.toString("base64") !== packed) throw new InvalidMime("invalid_transfer_encoding");
  } else if (encoding === "quoted-printable") {
    const output = Buffer.alloc(body.length);
    let length = 0;
    for (let offset = 0; offset < body.length; offset += 1) {
      const character = body[offset]!;
      if (character !== "=") {
        output[length++] = body.charCodeAt(offset);
      } else if (body[offset + 1] === "\n") {
        offset += 1;
      } else {
        const hex = body.slice(offset + 1, offset + 3);
        if (!/^[a-f0-9]{2}$/iu.test(hex)) throw new InvalidMime("invalid_transfer_encoding");
        output[length++] = Number.parseInt(hex, 16);
        offset += 2;
      }
    }
    bytes = output.subarray(0, length);
  } else if (encoding === "7bit" || encoding === "8bit" || encoding === "binary") {
    bytes = Buffer.from(body, "latin1");
    if (encoding === "7bit" && bytes.some(byte => byte > 0x7f)) {
      throw new InvalidMime("invalid_transfer_encoding");
    }
  } else {
    throw new InvalidMime("unsupported_transfer_encoding");
  }
  if (bytes.byteLength > maxOutputBytes) throw new InvalidMime("oversized_report");
  if (charset === "us-ascii" && bytes.some(byte => byte > 0x7f)) {
    throw new InvalidMime("invalid_charset");
  }
  try {
    return decoder.decode(bytes);
  } catch {
    throw new InvalidMime("invalid_utf8");
  }
}

function multipartSections(body: string, boundary: string): string[] {
  const sections: string[] = [];
  let current: string[] | null = null;
  for (const line of body.split("\n")) {
    if (line === "--" + boundary || line === "--" + boundary + "--") {
      if (current !== null) sections.push(current.join("\n"));
      if (sections.length > MAX_PARTS) throw new InvalidMime("mime_part_limit");
      if (line.endsWith(boundary + "--")) {
        if (current === null) throw new InvalidMime("invalid_multipart");
        return sections;
      }
      current = [];
    } else if (current !== null) {
      current.push(line);
    }
  }
  throw new InvalidMime("missing_multipart_end");
}

export interface MimeMessage {
  from: string | null;
  assertedMessageId: string | null;
  bodies: MailBody[];
}

/**
 * Intentionally narrow passive MIME reader. Supports nested mixed/alternative with one report,
 * UTF-8 or ASCII text/JSON, and ordinary transfer encodings. It never opens attachments as files.
 */
export function parseMime(raw: Uint8Array, maxOutputBytes: number): MimeMessage {
  const bodyText = Buffer.from(raw).toString("latin1").replaceAll("\r\n", "\n");
  if (bodyText.includes("\r") || bodyText.includes("\u0000")) throw new InvalidMime("invalid_mime_text");

  let count = 0;
  const bodies: MailBody[] = [];
  let from: string | null = null;
  let assertedMessageId: string | null = null;

  function readEntity(entity: string, depth: number): void {
    if (depth > MAX_DEPTH || ++count > MAX_PARTS) throw new InvalidMime("mime_part_limit");
    const splitAt = entity.indexOf("\n\n");
    if (splitAt <= 0) throw new InvalidMime("missing_mime_headers");
    const headers = readHeaders(entity.slice(0, splitAt));
    if (depth === 0) {
      from = uniqueHeader(headers, "from");
      const id = uniqueHeader(headers, "message-id");
      if (id && /^<[a-z0-9._+%=-]{1,128}@[a-z0-9.-]{1,128}>$/iu.test(id)) {
        assertedMessageId = id;
      }
    }

    const { type, parameters } = mediaType(
      uniqueHeader(headers, "content-type") ?? "text/plain; charset=us-ascii"
    );
    const body = entity.slice(splitAt + 2);
    const encoder = (uniqueHeader(headers, "content-transfer-encoding") ?? "7bit").toLowerCase();
    const disposition = (uniqueHeader(headers, "content-disposition") ?? "inline").split(";")[0]!.trim().toLowerCase();
    if (type === "multipart/mixed" || type === "multipart/alternative") {
      const boundary = parameters.get("boundary");
      if (!boundary || !BOUNDARY_PATTERN.test(boundary) || !["7bit", "8bit", "binary"].includes(encoder)) {
        throw new InvalidMime("invalid_boundary");
      }
      for (const part of multipartSections(body, boundary)) readEntity(part, depth + 1);
      return;
    }
    if (type === "text/html" && disposition === "inline") return;
    if (type !== "application/json" && (type !== "text/plain" || disposition !== "inline")) {
      throw new InvalidMime("unsupported_mime_part");
    }
    if (!["inline", "attachment"].includes(disposition)) throw new InvalidMime("unsafe_disposition");
    const charset = (parameters.get("charset") ?? (type === "application/json" ? "utf-8" : "us-ascii"))
      .toLowerCase();
    if (!["utf-8", "us-ascii"].includes(charset)) throw new InvalidMime("unsupported_charset");
    bodies.push({ text: decodeBody(body, encoder, charset, maxOutputBytes), mediaType: type });
  }

  readEntity(bodyText, 0);
  if (bodies.length === 0) throw new InvalidMime("no_report_part");
  return { bodies, from, assertedMessageId };
}
