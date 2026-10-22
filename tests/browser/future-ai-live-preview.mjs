/* global process, console, window, navigator */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
const require=createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium}=require("playwright");
const base=process.env.QA_BASE_URL??"http://127.0.0.1:4175";
const out=process.env.QA_OUTPUT??"/tmp/future-ai-protected";
await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.QA_CHROME
  ? {executablePath:process.env.QA_CHROME,headless:true,args:["--no-sandbox"]}
  : {channel:"chrome",headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:"reduce"});
await context.addInitScript(() => {
  window.__copiedPrompt="";
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:{
    writeText:async text=>{window.__copiedPrompt=text;}
  }});
});
const page=await context.newPage();
const errors=[];
page.on("pageerror",error=>errors.push(String(error)));
const actions=[];
await page.route("**/api/ai-guidance",async route=>{
  const body=route.request().postDataJSON();
  assert.equal(route.request().method(),"POST");
  assert.equal(body.consent,true);
  assert.equal(body.selection.schema_version,"do.gemini-reviewed.v1");
  assert.ok(Array.isArray(body.selection.finding_ids));
  assert.ok(!("scenario" in body.selection));
  assert.ok(!("values" in body.selection));
  assert.equal(route.request().headers().authorization,"Bearer preview-browser-test-only");
  actions.push(body.action);
  const mock=body.action==="prepare"
    ? {challenge:"local-mocked-challenge"}
    : {
      mode:"reviewed_evidence_preview",
      provenance:{
        national_artifact_version:body.selection.national_artifact_version,
        national_release_sha256:"browser-test-source-sha-only",
        local_artifact_version:body.selection.local_artifact_version,
        local_release_sha256:body.selection.local_artifact_version?"browser-test-local-sha-only":null
      },
      model:"offline-mock",
      selected_evidence:{national:[],local:[]},
      result:{
        snapshot_fingerprint:"offline-browser-test",
        generation:{state:"available"},
        sections:{findings:"available",interventions:"insufficient_evidence",requests:"available"},
        supported_findings:[],
        draft_requests:[{proposal_id:"mock-pending",disposition:"pending",
          template:{id:"aggregate_request_test",field_codes:["test_field"],owner_code:"unverified",privacy_code:"aggregate_only"}}],
        warnings:[{id:"test-warning",code:"ai_output_pending_independent_review"}],
        intervention_options:[],
        boundary:"reviewed_evidence_only"
      }
    };
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(mock)});
});
try {
  await page.goto(base+"/concept/future-ai");
  const workbench=page.locator(".fc-unified-workbench");
  await workbench.waitFor();
  const studio=page.locator(".ai-handoff-inline");
  await studio.waitFor();
  assert.match(await page.locator(".fc-banner").innerText(),/protected Preview/i);
  assert.equal(actions.length,0,"Prompt Studio must make no model or preparation requests");
  assert.equal(await page.getByRole("tab").count(),4);
  const picker=studio.getByLabel("Analysis goal");
  assert.equal(await picker.locator("option").count(),6);
  const text=studio.locator("#ai-handoff-text");
  const original=await text.inputValue();
  assert.match(original,/## Additional research and visualization tasks/);
  const modules=studio.locator(".ai-handoff-module input");
  assert.equal(await modules.count(),3);
  for(let i=0;i<3;i++)assert.equal(await modules.nth(i).isChecked(),true);
  await picker.selectOption("executive");
  assert.notEqual(await text.inputValue(),original,"Prompt goal must update frozen text immediately");
  assert.equal(await studio.getByRole("button",{name:"Copy complete prompt"}).isEnabled(),true);
  await modules.nth(0).uncheck();
  assert.doesNotMatch(await text.inputValue(),/## Retrieved literature or search plan/);
  await modules.nth(0).check();
  await studio.locator("#ai-handoff-question").fill("What should reviewers verify?");
  assert.equal(await studio.getByRole("button",{name:"Copy complete prompt"}).isDisabled(),true);
  await studio.getByRole("button",{name:"Regenerate preview"}).click();
  assert.match(await text.inputValue(),/What should reviewers verify/);
  const exact=await text.inputValue();
  await studio.getByRole("button",{name:"Copy complete prompt"}).click();
  assert.equal(await page.evaluate(()=>window.__copiedPrompt),exact,"Clipboard must match complete frozen prompt");
  const downloading=page.waitForEvent("download");
  await studio.getByRole("button",{name:"Download Markdown"}).click();
  assert.match((await downloading).suggestedFilename(),/\.md$/);
  assert.equal(actions.length,0,"Prompt copy/download never invokes Gemini");
  await page.getByRole("tab",{name:/Identify data gaps/}).click();
  await page.getByRole("button",{name:/Use this view as prompt starting point/}).click();
  assert.equal(await picker.inputValue(),"data_gaps","Explicit exploration-to-prompt suggestion should update the original selector");
  assert.equal(await studio.getByRole("button",{name:"Copy complete prompt"}).isEnabled(),true);
  await page.getByRole("button",{name:/2 · Gemini/}).click();
  const workspace=page.locator(".fc-live-workspace");
  await workspace.waitFor();
  assert.equal(await workspace.locator(".ai-gemini-panel").count(),1);
  assert.equal(await workspace.getByRole("button",{name:"Analyze with Gemini"}).isDisabled(),true);
  await workspace.getByLabel(/Preview operator credential/).fill("preview-browser-test-only");
  await workspace.getByLabel(/I authorize sending this aggregate/).check();
  await workspace.getByRole("button",{name:"Analyze with Gemini"}).click();
  await workspace.getByText(/Preview result validated against the reviewed source artifacts/).waitFor();
  assert.deepEqual(actions,["prepare","analyze"]);
  assert.match(await page.locator(".fc-live-goal-summary").innerText(),/Pending operational data questions/);
  for(const [tab,expected] of [
    ["Explore interventions","Intervention evidence gate"],
    ["Identify data gaps","Pending operational data questions"],
    ["Compare strategies","No evidence-based strategy ranking is available"],
    ["Explain my Brief","Reviewed findings for this Brief"]
  ]){
    await page.getByRole("tab",{name:new RegExp(tab)}).click();
    assert.match(await page.locator(".fc-live-goal-summary").innerText(),new RegExp(expected));
    assert.deepEqual(actions,["prepare","analyze"],"Switching concept goals must not call Gemini again");
  }
  await page.getByRole("tab",{name:/Identify data gaps/}).click();
  assert.match(await page.locator(".fc-live-goal-summary").innerText(),/Pending analyst review/);
  assert.match(await page.locator(".fc-live-goal-summary").innerText(),/aggregate only/);
  await page.getByRole("button",{name:/1 · Prompt Studio/}).click();
  assert.equal(await picker.inputValue(),"data_gaps","Prompt selections persist between workflows");
  assert.equal(await text.inputValue()!==original,true);
  assert.deepEqual(actions,["prepare","analyze"]);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true,
    "Unified workbench should reflow at mobile width");
  assert.equal(errors.length,0,JSON.stringify(errors));
  await page.screenshot({path:out+"/integrated-live-preview.png",fullPage:true});
  await writeFile(out+"/result.json",JSON.stringify({result:"PASS",requestActions:actions,errors},null,2));
  console.log("PASS protected Gemini concept: consent, 2-step prepare/analyze, four tab views, no repeated calls");
}finally{
  await browser.close();
}
