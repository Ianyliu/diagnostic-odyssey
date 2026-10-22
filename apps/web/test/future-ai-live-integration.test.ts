import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const dir=dirname(fileURLToPath(import.meta.url));
const read=(name:string)=>readFileSync(resolve(dir,"../src",name),"utf8");

test("live Future AI Concept requires explicit Preview build gate",()=>{
  const page=read("concept/FutureAIExperiencePage.tsx");
  assert.match(page,/typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean"/);
  assert.match(page,/previewGeminiEnabled && <section className="fc-live-workspace"/);
  assert.match(page,/previewGeminiEnabled && <ConceptLiveSummary goal=\{goal\} result=\{liveResult\}/);
  assert.match(page,/onValidated=\{data=>setValidated\(\{identity:liveIdentity,data\}\)\}/);
  assert.match(page,/validated\?\.identity === liveIdentity/);
  assert.match(page,/The same validated result carries across views/);
  assert.doesNotMatch(page,/fetch\(|localStorage|sessionStorage|GEMINI_API_KEY/);
});

test("live Gemini concept input is the canonical memoized Brief, ID-only and fail closed",()=>{
  const hook=read("concept/useConceptBrief.ts");
  const panel=read("components/AiGeminiPanel.tsx");
  assert.match(hook,/useMemo\(\(\) => \{/);
  assert.match(hook,/buildPlanningBrief\(/);
  assert.match(hook,/withStaleSelectedDataRequestWarning\(/);
  assert.match(hook,/inspectAiHandoffSource\(brief,/);
  assert.match(hook,/if \(!brief \|\| source.problem\) return null/);
  assert.match(hook,/createAiHandoffText\(brief\)/);
  assert.match(panel,/finding_ids:p\.burden_findings\.map\(f=>f\.estimate_id\)/);
  assert.match(panel,/local_ids:p\.local_context\.map\(l=>l\.indicator_id\)/);
  assert.match(panel,/onValidated\?\.\(result\)/);
  assert.match(panel,/liveKey\.current!==startedKey\|\|ctl\.signal\.aborted/);
  assert.match(panel,/I authorize sending this aggregate, ID-only reviewed-evidence selection/);
});

test("four goal outcomes are read-only presentations of one validated response",()=>{
  const summary=read("concept/ConceptLiveSummary.tsx");
  for(const goal of ["explain_brief","explore_interventions","identify_data_gaps","compare_strategies"])
    assert.ok(summary.includes(goal),"expected "+goal);
  assert.match(summary,/Gemini-selected IDs \/ server-verified evidence/);
  assert.match(summary,/independently checked reviewed artifact bytes/);
  assert.match(summary,/No evidence-based strategy ranking is available/);
  assert.match(summary,/Pending analyst review/);
  assert.doesNotMatch(summary,/fetch\(|setScenario\(|upsertAnalystDataRequest\(|window\.open/);
});
