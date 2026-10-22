/* global process, console */
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
  const workspace=page.locator(".fc-live-workspace");
  await workspace.waitFor();
  assert.match(await page.locator(".fc-banner").innerText(),/protected Preview/i);
  assert.equal(actions.length,0,"No model calls or prepare requests on page load");
  assert.equal(await page.getByRole("tab").count(),4);
  assert.equal(await workspace.locator(".ai-gemini-panel").count(),1);
  assert.equal(await workspace.getByRole("button",{name:"Analyze with Gemini"}).isDisabled(),true);
  await workspace.getByLabel(/Preview operator credential/).fill("preview-browser-test-only");
  await workspace.getByLabel(/I authorize sending this aggregate/).check();
  await workspace.getByRole("button",{name:"Analyze with Gemini"}).click();
  await workspace.getByText(/Preview result validated against the reviewed source artifacts/).waitFor();
  assert.deepEqual(actions,["prepare","analyze"]);
  assert.match(await page.locator(".fc-live-goal-summary").innerText(),/Reviewed findings for this Brief/);
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
  assert.equal(errors.length,0,JSON.stringify(errors));
  await page.screenshot({path:out+"/integrated-live-preview.png",fullPage:true});
  await writeFile(out+"/result.json",JSON.stringify({result:"PASS",requestActions:actions,errors},null,2));
  console.log("PASS protected Gemini concept: consent, 2-step prepare/analyze, four tab views, no repeated calls");
}finally{
  await browser.close();
}
