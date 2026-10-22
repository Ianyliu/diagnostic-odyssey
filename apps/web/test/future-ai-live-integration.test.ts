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
  assert.match(page,/useConceptBrief\(previewGeminiEnabled\)/);
  assert.match(page,/previewGeminiEnabled && <section ref=\{workbench\} className="fc-unified-workbench"/);
  assert.match(page,/<AiHandoffInline brief=\{snapshot\?\.live\.brief \?\? null\} sourceState=\{snapshot\.live\.sourceState\}/);
  assert.match(page,/fc-workflow-panel" hidden=\{workflow !== "prompt"\}/);
  assert.match(page,/fc-workflow-panel" hidden=\{workflow !== "gemini"\}/);
  assert.match(page,/Use this view as prompt starting point/);
  assert.match(page,/setSuggestion\(previous => \(\{goal: suggestedPromptGoals\[goal\]/);
  assert.match(page,/suggestedPromptGoals: Record<GoalId,AiGoal>/);
  assert.match(page,/previewGeminiEnabled && <ConceptLiveSummary goal=\{goal\} result=\{liveResult\}/);
  assert.match(page,/onValidated=\{data=>setValidated\(\{identity:liveIdentity,data\}\)\}/);
  assert.match(page,/validated\?\.identity === liveIdentity/);
  assert.match(page,/One validated result can be explored across the four views below/);
  assert.doesNotMatch(page,/fetch\(|localStorage|sessionStorage|GEMINI_API_KEY/);
});

test("live Gemini concept input is the canonical memoized Brief, ID-only and fail closed",()=>{
  const hook=read("concept/useConceptBrief.ts");
  const panel=read("components/AiGeminiPanel.tsx");
  assert.match(hook,/useMemo\(\(\) => \{/);
  assert.match(hook,/buildPlanningBrief\(/);
  assert.match(hook,/withStaleSelectedDataRequestWarning\(/);
  assert.match(hook,/inspectAiHandoffSource\(brief,/);
  assert.match(hook,/if \(!liveEnabled \|\| !brief \|\| source.problem\) return null/);
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

test("Planning Brief distinguishes protected live workspace from illustrative concept",()=>{
  const brief=read("pages/BriefPage.tsx");
  assert.match(brief,/typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean"/);
  assert.match(brief,/Explore AI evidence workspace/);
  assert.match(brief,/Preview only · Reviewed-data Gemini requires operator authentication and explicit consent/);
  assert.match(brief,/Interactive concept only · No live AI or model API calls/);
});

test("unified Prompt Studio reuses all six canonical handoff goals, transfers and safety checks",()=>{
  const handoff=read("components/AiHandoff.tsx");
  const page=read("concept/FutureAIExperiencePage.tsx");
  const hook=read("concept/useConceptBrief.ts");
  for(const marker of [
    "AI_GOALS.map", "AI_RESEARCH_MODULES.map", "Copy complete prompt",
    "Download Markdown", "Select complete prompt", "copyAndOpenAiProvider",
    "Search published research", "Regenerate preview", "Optional question"
  ]) assert.ok(handoff.includes(marker), marker);
  assert.match(handoff,/export function AiHandoffInline/);
  assert.match(handoff,/open=\{inline \|\| undefined\}/);
  assert.match(handoff,/if \(inline\) \{/);
  assert.match(handoff,/stage2Preview && !inline && <AiGeminiPanel/);
  assert.match(handoff,/suggestion\?\.serial/);
  assert.match(page,/setWorkflow\("prompt"\)/);
  assert.match(hook,/sourceState,/);
  assert.match(hook,/brief,\s*sourceState,/);
  assert.doesNotMatch(page,/copyAiHandoffText\(|downloadAiHandoff\(/);
});
