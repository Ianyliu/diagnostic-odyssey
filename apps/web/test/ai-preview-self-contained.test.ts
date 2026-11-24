import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const entry=readFileSync(resolve(here,"../api/ai-preview.ts"),"utf8");

test("retired /api/ai-preview stub contains zero provider, secret, KV, or runtime-import code",()=>{
 assert.match(entry,/status:\s*404/);
 assert.match(entry,/not_found/);
 assert.doesNotMatch(entry,/generativelanguage|GEMINI_API_KEY|AI_PREVIEW_TOKEN|KV_REST_API|UPSTASH_REDIS|await fetch\(/);
 assert.equal(entry.split("\n").filter(line=>/^import /m.test(line)).length,0);
});
