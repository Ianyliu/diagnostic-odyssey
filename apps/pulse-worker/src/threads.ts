import { randomUUID } from "node:crypto";
import { validateResearchThread, type ResearchThread, type ThreadEntryDraft, type ThreadProjection }
  from "../../../packages/community-pulse/src/threads.ts";
import type { ResearchDetail } from "../../../packages/community-pulse/src/history.ts";
import { uuid } from "../../../packages/community-pulse/src/schema.ts";
import type { IntakeBucket } from "./storage.ts";

const threadKey = (id: string) => "s0/threads/" + id;
const uuidPattern = new RegExp(uuid.pattern, "u");
const maxBytes = 32 * 1024;
type ResolveReport = (ref: string) => Promise<ResearchDetail | null>;

/** Call only from a trusted reviewer operation. The request-facing adapter exposes projection reads only. */
export function createThreadStore(bucket: IntakeBucket, resolveReport: ResolveReport, entryId = randomUUID) {
  function checked(value: unknown): ResearchThread {
    const result = validateResearchThread(value);
    if (!result.ok || new TextEncoder().encode(JSON.stringify(value)).length > maxBytes) {
      throw Error("Invalid bounded research thread");
    }
    return result.value;
  }

  async function stored(id: string) {
    if (!uuidPattern.test(id)) return null;
    const object = await bucket.get(threadKey(id));
    if (!object) return null;
    if (object.size > maxBytes) throw Error("Thread exceeds read limit");
    const thread = checked(await object.json());
    if (thread.id !== id) throw Error("Mismatched thread");
    return { thread, etag: object.etag };
  }

  async function create(topic: string, description: string, id = randomUUID()) {
    const draft = checked({ schema_version: "1", id, topic, description, timeline: [] });
    const result = await bucket.put(threadKey(draft.id), JSON.stringify(draft), {
      onlyIf: new Headers({ "If-None-Match": "*" }),
    });
    return result ? draft : null;
  }

  async function append(id: string, revision: number, trustedReviewer: string, change: ThreadEntryDraft, now = new Date()) {
    const prior = await stored(id);
    if (!prior || prior.thread.timeline.length !== revision) return null;
    const next = checked({ ...prior.thread, timeline: [...prior.thread.timeline, {
      ...change, id: entryId(), revision: revision + 1, at: now.toISOString(), reviewer: trustedReviewer
    }] });
    for (const cite of change.citations) {
      const report = await resolveReport(cite.ref);
      if (!report || report.digest !== cite.digest || !report.report.items[cite.item_index]) {
        throw Error("Reviewer citation is unavailable");
      }
    }
    const result = await bucket.put(threadKey(id), JSON.stringify(next), {
      onlyIf: new Headers({ "If-Match": '"' + prior.etag + '"' }),
    });
    return result ? next : null;
  }

  async function read(id: string): Promise<ThreadProjection | null> {
    const found = await stored(id);
    if (!found) return null;
    const thread = found.thread;
    const reports = new Map<string, Promise<ResearchDetail | null>>();
    return { ...thread, timeline: await Promise.all(thread.timeline.map(async row => ({
      ...row, citations: await Promise.all(row.citations.map(async cite => {
        let lookup = reports.get(cite.ref);
        if (!lookup) {
          lookup = resolveReport(cite.ref);
          reports.set(cite.ref, lookup);
        }
        const report = await lookup;
        const available = report?.digest === cite.digest && !!report.report.items[cite.item_index];
        return { ...cite, availability: available ? "available" as const : "unavailable" as const };
      })),
    }))) };
  }

  return { create, append, read };
}
