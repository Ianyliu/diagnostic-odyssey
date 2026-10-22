import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
test("Stage 2 preserves all PR132 manual research and provider handoff features",()=>{
 const source=readFileSync(resolve(here,"../src/components/AiHandoff.tsx"),"utf8");
 for(const landmark of ["enrichAiHandoff","AI_RESEARCH_MODULES","AI_RESEARCH_MODULE_LABELS",
   "copyAndOpenAiProvider","AI_PUBLIC_RESEARCH_LINKS","availableAiProviders",
   "AiGeminiPanel","__DO_GEMINI_STAGE2_PREVIEW__"]){
  assert.ok(source.includes(landmark),landmark+" must remain in the dialog");
 }
 assert.match(source,/querySelectorAll<HTMLElement>\("button, input, select, textarea/);
 const config=readFileSync(resolve(here,"../vite.config.ts"),"utf8");
 assert.match(config,/process\.env\.VERCEL_ENV === "preview" && process\.env\.AI_GUIDANCE_ENABLED === "on"/);
 assert.match(source,/typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean"/);
 assert.doesNotMatch(source,/import\.meta\.env\.VITE_GEMINI_STAGE2_PREVIEW/);
});
