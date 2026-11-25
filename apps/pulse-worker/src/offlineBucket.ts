import type { IntakeBucket, IntakeObject } from "./storage.ts";

/** Models atomic predicate evaluation, immutable reads, live pagination and optional write interruption. */
export class MemoryR2 implements IntakeBucket {
  objects = new Map<string, IntakeObject & { body: string }>();
  readKeys: string[] = [];
  trackReads = true;
  version = 0;
  clock: Date;
  pageLimit = 1000;
  interrupt: ((key: string, options: { onlyIf: Headers }) => boolean) | null = null;

  constructor(clock = new Date()) {
    this.clock = clock;
  }

  async get(key: string) {
    if (this.trackReads) this.readKeys.push(key);
    const object = this.objects.get(key);
    if (!object) return null;
    const { body, ...header } = object;
    return { ...header, async json<T>() { return JSON.parse(body) as T; } };
  }

  async put(key: string, body: string, options: { onlyIf: Headers; customMetadata?: Record<string, string> }) {
    const existing = this.objects.get(key);
    if (options.onlyIf.get("if-none-match") === "*" && existing) return null;
    const matches = options.onlyIf.get("if-match");
    if (matches && matches !== '"' + existing?.etag + '"') return null;
    if (this.interrupt?.(key, options)) throw Error("Injected R2 write interruption");
    const object = {
      key, etag: "v" + ++this.version, size: new TextEncoder().encode(body).byteLength,
      uploaded: this.clock, ...(options.customMetadata ? { customMetadata: options.customMetadata } : {})
    };
    this.objects.set(key, { ...object, body });
    return object;
  }

  async list(options: { prefix: string; limit: number; include?: string[]; cursor?: string }) {
    const matches = [...this.objects.values()].filter(r =>
      r.key.startsWith(options.prefix) && (!options.cursor || r.key > options.cursor)
    ).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    const page = matches.slice(0, Math.min(options.limit, this.pageLimit));
    const objects = page.map(({ key, etag, size, uploaded, customMetadata }) => ({
      key, etag, size, uploaded,
      ...(options.include?.includes("customMetadata") && customMetadata ? { customMetadata } : {})
    }));
    const truncated = page.length < matches.length;
    const cursor = truncated ? page.at(-1)?.key : undefined;
    return { objects, truncated, ...(cursor ? { cursor } : {}) };
  }

  async delete(keys: string[]) {
    for (const key of keys) this.objects.delete(key);
  }
}
