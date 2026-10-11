/* global process, console, document, innerWidth, window, getComputedStyle, Event */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir,writeFile,readFile} from "node:fs/promises";
const require=createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium}=require("playwright");const axe=require("axe-core");
const base=process.env.QA_BASE_URL ?? "http://127.0.0.1:4194";
const synthetic=process.env.QA_FIXTURE_URL ?? "http://127.0.0.1:4195";
const output=process.env.QA_OUTPUT ?? "/tmp/diagnostic-acquisition-browser";
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const results=[];const events=[];
async function check(name,body) {
  try {await body();results.push({name,status:"PASS"});}
  catch(error) {results.push({name,status:"FAIL",error:String(error.stack ?? error)});}
  for(const context of browser.contexts()) await context.close();
  await writeFile(`${output}/results.json`,JSON.stringify({browser:browser.version(),results,events},null,2));
}
async function ready(page,path="/data-requests") {await page.goto(base+path);await page.locator("main h1").waitFor();}
async function navigate(page,name) {
  const nav=page.getByRole("navigation",{name:"Primary navigation"});
  if(!await nav.isVisible()) await page.getByRole("button",{name:"Menu",exact:true}).click();
  await nav.getByRole("link",{name,exact:true}).click();
  const titles={"Pilot planner":"Scope a feasible pilot","Data requests":"Turn uncertainty into a concrete request","Planning brief":"Long COVID burden and pilot planning brief"};
  await page.getByRole("heading",{name:titles[name],exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.menu-toggle')?.getAttribute('aria-expanded')!=="true");
}
async function download(page,name,button="Export JSON companion") {
  const pending=page.waitForEvent("download");await page.getByRole("button",{name:button,exact:true}).click();
  await (await pending).saveAs(`${output}/${name}.json`);return JSON.parse(await readFile(`${output}/${name}.json`,"utf8"));
}
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
async function newPage(width,theme) {
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:"reduce",acceptDownloads:true});
  const page=await context.newPage();await page.emulateMedia({media:"screen",colorScheme:theme,reducedMotion:"reduce"});page.setDefaultTimeout(6000);page.on("pageerror",error=>events.push(String(error)));return page;
}
for(const width of [1440,820,360]) for(const theme of ["light","dark"]) {
  await check(`production requests/Brief ${width} ${theme}: empty, pending, explicit selection, staleness, refresh and removal`,async()=>{
    const page=await newPage(width,theme);await ready(page);
    assert.equal(await page.locator(".data-request-sheet").count(),0);
    await navigate(page,"Pilot planner");await page.locator("#sensitivity").getByRole("button",{name:"Add to data requests",exact:true}).click();
    await navigate(page,"Data requests");const request=page.locator(".data-request-sheet");
    assert.equal(await request.count(),1);assert.equal(await request.getByRole("checkbox").isChecked(),false);
    await request.getByText("Acquisition guidance awaiting admission.",{exact:true}).waitFor();
    assert.equal(await request.getByRole("button",{name:/Attach reviewed acquisition/}).count(),0);
    assert.equal(await page.locator(".acquisition-guidance").count(),0);
    assert.ok(await overflow(page));await page.screenshot({path:`${output}/requests-pending-${width}-${theme}.png`,fullPage:true});
    const question=await request.locator("h2").innerText();const checkbox=request.getByRole("checkbox",{name:`${question} Include in Planning Brief`,exact:true});assert.equal(await checkbox.count(),1);
    await checkbox.focus();await page.keyboard.press("Space");assert.equal(await checkbox.isChecked(),true);
    await navigate(page,"Planning brief");let brief=await download(page,`selected-${width}-${theme}`);
    assert.equal(brief.data_requests.length,1);assert.equal(brief.acquisition_guidance,undefined);assert.equal(brief.data_requests[0].acquisition_hint,undefined);assert.equal(brief.burden_findings.length,21);
    assert.ok(await overflow(page));await page.screenshot({path:`${output}/brief-${width}-${theme}.png`,fullPage:true});
    await navigate(page,"Pilot planner");await page.locator("#pilot-capacity").fill("2000");await navigate(page,"Data requests");
    await request.getByText("Stale for applied scenario",{exact:true}).waitFor();assert.equal(await checkbox.isChecked(),true);
    await navigate(page,"Planning brief");brief=await download(page,`stale-${width}-${theme}`);assert.equal(brief.data_requests.length,0);assert.ok(brief.warnings.some(w=>/stale/.test(w)));
    await navigate(page,"Data requests");await request.getByRole("button",{name:"Refresh data request",exact:true}).click();assert.equal(await checkbox.isChecked(),true);
    await navigate(page,"Planning brief");brief=await download(page,`refreshed-${width}-${theme}`);assert.equal(brief.data_requests.length,1);assert.equal(brief.acquisition_guidance,undefined);
    await page.evaluate(()=>{window.print=()=>window.dispatchEvent(new Event("beforeprint"));});await page.getByRole("button",{name:"Print / save PDF",exact:true}).click();
    await page.emulateMedia({media:"print"});await page.pdf({path:`${output}/production-${width}-${theme}.pdf`,format:"Letter",printBackground:true});await page.evaluate(()=>window.dispatchEvent(new Event("afterprint")));await page.emulateMedia({media:"screen"});
    await navigate(page,"Data requests");await request.getByRole("button",{name:"Remove session request",exact:true}).click();assert.equal(await request.count(),0);
    await navigate(page,"Planning brief");assert.equal((await download(page,`removed-${width}-${theme}`)).data_requests.length,0);
  });
  await check(`synthetic admitted guidance ${width} ${theme}: exact card, disclosures, canonical JSON and print`,async()=>{
    const page=await newPage(width,theme);await page.goto(synthetic);await page.locator("h1").waitFor();await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
    await page.waitForFunction(t=>getComputedStyle(document.querySelector(".acquisition-guidance")).color === (t === "dark" ? "rgb(242, 244, 241)" : "rgb(24, 53, 75)"),theme);
    assert.equal(await page.getByRole("region",{name:"Reviewed acquisition guidance",exact:true}).count(),2);
    for (const name of ["Invalid optional guidance fixture","Stale optional guidance fixture"]) {
      const region=page.getByRole("region",{name,exact:true});
      assert.equal(await region.getByText("Optional acquisition guidance withheld.",{exact:true}).count(),1);
      assert.equal(await region.locator(".acquisition-guidance").count(),0);
    }
    assert.ok(await overflow(page));await page.screenshot({path:`${output}/synthetic-cards-${width}-${theme}.png`,fullPage:true});
    const first=page.locator("summary").first();await first.focus();await page.keyboard.press("Enter");assert.ok(await first.evaluate(el=>el.parentElement.open));
    await page.locator("details").evaluateAll(els=>els.forEach(el=>{el.open=true;}));assert.ok(await overflow(page));
    const brief=await download(page,`synthetic-${width}-${theme}`,"Export synthetic JSON");assert.equal(brief.acquisition_guidance.length,2);
    for(const guidance of brief.acquisition_guidance) {
      assert.match(guidance.privacy_boundary,/No individual-level intervals/);
      assert.deepEqual(guidance.reference,brief.data_requests.find(request=>request.request_id===guidance.request_id).acquisition_hint);
      assert.match(guidance.review.reviewer,/SYNTHETIC/);assert.equal(guidance.reference.hint_version,"2");
      assert.ok(guidance.official_support.every(source=>source.version==="FHIR R4 4.0.1"));
    }
    await page.addScriptTag({content:axe.source});const audit=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}}));
    await writeFile(`${output}/synthetic-axe-${width}-${theme}.json`,JSON.stringify(audit,null,2));
    assert.equal(audit.violations.length,0,JSON.stringify(audit.violations.map(v=>({id:v.id,nodes:v.nodes.length}))));
    await page.emulateMedia({media:"print"});await page.pdf({path:`${output}/synthetic-${width}-${theme}.pdf`,format:"Letter",printBackground:true});
  });
}
await browser.close();console.log(JSON.stringify(results));process.exitCode=results.some(r=>r.status!=="PASS")||events.length?1:0;
