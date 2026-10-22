import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
test("default research tasks and automatic goal/task refresh never bypass Brief safety",()=>{
 const source=readFileSync(resolve(here,"../src/components/AiHandoff.tsx"),"utf8");
 for(const landmark of ["enrichAiHandoff","AI_RESEARCH_MODULES","copyAndOpenAiProvider","AI_PUBLIC_RESEARCH_LINKS"]){
  assert.ok(source.includes(landmark),landmark+" manual handoff feature preserved");
 }
 assert.match(source,/useState<readonly AiResearchModule\[\]>\(\(\) => \[\.\.\.AI_RESEARCH_MODULES\]\)/);
 assert.match(source,/updatePromptOptions\(event\.target\.value as AiGoal, researchModules\)/);
 assert.match(source,/setSession\(\{\s*observed: JSON\.stringify\(\[source\.key, nextGoal, question, nextModules\]\)/);
 assert.match(source,/if \(current && brief\)/);
 assert.match(source,/transferEpoch\.current\+\+/);
 // Stage 2 adds the Gemini panel but the manual handoff still never reads secrets.
 assert.match(source,/\{stage2Preview && !inline && <AiGeminiPanel snapshot=/);
 assert.match(source,/typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean"/);
 assert.doesNotMatch(source,/GEMINI_API_KEY|AI_PREVIEW_TOKEN/);
});
