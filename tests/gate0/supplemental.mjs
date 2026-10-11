/* global process, console, URL, document, window, Event */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium}=require('playwright'); const axe=require('axe-core');
const root=process.env.QA_SOURCE_ROOT ?? fileURLToPath(new URL('../../',import.meta.url));
const output=process.env.QA_OUTPUT ?? '/tmp/diagnostic-gate0-results'; await mkdir(output,{recursive:true});
const base=process.env.QA_BASE_URL ?? "http://127.0.0.1:4177";
const bundle=JSON.parse(await readFile(`${root}/artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json`));
const local=JSON.parse(await readFile(`${root}/artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json`));
const reviewed=bundle.burden_domains.flatMap(x=>x.measures).filter(x=>x.release_status==='reviewed_released');
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[], events=[];
async function check(name,fn){if(process.env.QA_FILTER && !new RegExp(process.env.QA_FILTER).test(name))return;try{results.push({name,status:'PASS',details:await fn()});}catch(e){results.push({name,status:'FAIL',error:String(e.stack)});for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/supplemental-failure-${results.length}.png`,fullPage:true}).catch(()=>{});}for(const c of browser.contexts())await c.close();await writeFile(`${output}/supplemental-results.json`,JSON.stringify({results,events},null,2));}
async function page(width=1440,theme='light') {const c=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce',acceptDownloads:true});const p=await c.newPage();p.setDefaultTimeout(5000);p.on('pageerror',e=>events.push({type:'pageerror',url:p.url(),message:String(e)}));return p;}
async function go(p,route){await p.goto(base+route);await p.locator('main h1').waitFor();}
async function nav(p,name){const n=p.getByRole('navigation',{name:'Primary navigation'});if(!await n.isVisible())await p.getByRole('button',{name:'Menu',exact:true}).click();await n.getByRole('link',{name,exact:true}).click();await p.locator('main h1').waitFor();}
async function exp(p,name){const d=p.waitForEvent('download');await p.getByRole('button',{name:'Export JSON companion'}).click();const f=await d;await f.saveAs(`${output}/${name}.json`);return JSON.parse(await readFile(`${output}/${name}.json`));}
await check('Reviewed metadata, 21 national findings, two Typical Ranges and Candidate A isolation',async()=>{
 assert.equal(reviewed.length,21);assert.equal(reviewed.filter(x=>x.distribution_summary).length,2);assert.equal(local.indicators.length,34);
 const p=await page();
 const snapshots={};
 for(const route of ['/','/burden','/burden/medical','/local-context','/pilot','/pilot#sensitivity','/evidence','/data-requests','/brief']){
  await go(p,route); assert.equal(await p.locator('.linked-condition-secondary-evidence').count(),route==='/burden/medical'?1:0);
  if(route==='/burden/medical'){
   await p.locator('.linked-condition-secondary-details summary').click();
   const text=await p.locator('.linked-condition-secondary-evidence').innerText();
   assert.match(text,/not.*diagnos|does not.*diagnos/i);assert.match(text,/not.*caus(?:al|ation)|does not.*caus(?:al|ation)/i);
  }
  await p.locator('main details').evaluateAll(els=>els.forEach(e=>e.open=true));
  if(route==='/burden/medical')for(const e of reviewed.filter(e=>e.system_boundary.includes('spending')||e.weight_variable==='PERWT24F')){
   const row=p.locator(`#burden-measure-${e.estimate_id}`).locator('..').locator('..');
   if(await row.count())for(const key of ['universe','denominator','system_boundary','source_ref','source_locator','statistics_method','weight_variable'])if(e[key])assert.ok((await row.textContent()).includes(e[key]),`${e.estimate_id} missing ${key}`);
  }
  snapshots[route]=await p.locator('main').ariaSnapshot();
 }
 const b=await exp(p,'metadata-brief');assert.deepEqual(b.burden_findings,reviewed);assert.deepEqual(b.evidence,[]);
 assert.ok(!JSON.stringify(b).includes('u09_linked_service_use_person_share'));assert.ok(!JSON.stringify(b.scenario).includes('linked-condition'));
 assert.equal(b.artifact_version,bundle.manifest.artifact_version);assert.deepEqual(b.context,bundle.context);
 assert.ok(b.warnings.some(x=>/not savings, ROI, causal benefit/.test(x)));assert.ok(b.warnings.some(x=>/does not modify national burden/.test(x)));
 await writeFile(`${output}/accessible-snapshots.json`,JSON.stringify(snapshots,null,2));
 return {national:21,typicalRanges:2,wv:34,fullEstimateMetadataExact:true,CandidateAOnlyMedical:true,warnings:b.warnings};
});
await check('Ordinary invalid drafts, result and request live announcements, stale selection preservation',async()=>{
 const p=await page();await go(p,'/pilot');await p.locator('#pilot-capacity').fill('2000');
 await p.waitForFunction(()=>[...document.querySelectorAll('[aria-live]')].some(x=>/Reached participants 2,000/.test(x.textContent)));
 await nav(p,'Planning brief');const valid=await exp(p,'valid-2000');
 for(const [id,value] of [['capacity',''],['capacity','-1'],['reach','101'],['alternative_window_months','13']]){
  await nav(p,'Pilot planner');await p.locator(`#pilot-${id}`).fill(value);await p.getByText('Draft not applied',{exact:true}).waitFor();assert.equal(await p.locator(`#pilot-${id}`).getAttribute('aria-invalid'),'true');
  await nav(p,'Planning brief');const invalid=await exp(p,`invalid-${id}-${value||'empty'}`);assert.deepEqual(invalid.scenario,valid.scenario);
 }
 await nav(p,'Pilot planner');await p.getByRole('button',{name:'Add to data requests',exact:true}).click();
 await p.waitForFunction(()=>[...document.querySelectorAll('[aria-live]')].some(x=>/Data request created/.test(x.textContent)));
 await nav(p,'Data requests');const r=p.locator('.data-request-sheet').filter({hasText:'SESSION PLANNING REQUEST'});assert.equal(await r.getByRole('checkbox').isChecked(),false);await r.getByRole('checkbox').check();
 assert.match(await p.locator('p[role=status]').innerText(),/selected for Planning Brief/);
 await nav(p,'Pilot planner');await p.locator('#pilot-capacity').fill('1900');await nav(p,'Data requests');assert.equal(await r.getByRole('checkbox').isChecked(),true);assert.match(await r.innerText(),/Stale for applied scenario/);
 await nav(p,'Planning brief');const stale=await exp(p,'supplemental-stale');assert.equal(stale.data_requests.length,0);
 await nav(p,'Data requests');await p.getByRole('button',{name:'Refresh data request'}).click();assert.equal(await r.getByRole('checkbox').isChecked(),true);assert.match(await p.locator('p[role=status]').innerText(),/refreshed.*selection is unchanged/);
 await nav(p,'Planning brief');const fresh=await exp(p,'supplemental-refreshed');assert.equal(fresh.data_requests.length,1);assert.equal(fresh.scenario.result.reached_participants,1900);
 return {invalidDraftsRetainScenario:true,staleSelectionRetained:true,liveAnnouncements:true};
});
await check('Select all reviewed WV records, remove context, national values never rescale',async()=>{
 const p=await page();await go(p,'/brief');const before=await exp(p,'wv-before');await nav(p,'Local context');
 await p.locator('details').evaluateAll(es=>es.forEach(e=>e.open=true));
 const boxes=p.getByRole('checkbox');let count=0;for(const box of await boxes.all())if(await box.isEnabled()){await box.check();count++;}
 await p.getByRole('button',{name:/^Use .* in Pilot planning$/}).first().click();await nav(p,'Planning brief');const selected=await exp(p,'wv-all-selected');assert.equal(count,34);assert.deepEqual([...selected.local_context].sort((a,b)=>a.indicator_id.localeCompare(b.indicator_id)),[...local.indicators].sort((a,b)=>a.indicator_id.localeCompare(b.indicator_id)));assert.deepEqual(selected.burden_findings,before.burden_findings);assert.deepEqual(selected.scenario,before.scenario);
 await nav(p,'Pilot planner');await p.getByRole('button',{name:'Remove from Pilot',exact:true}).click();await nav(p,'Local context');await p.getByRole('button',{name:'Clear selections',exact:true}).click();await nav(p,'Planning brief');const cleared=await exp(p,'wv-cleared');assert.equal(cleared.local_context.length,0);assert.deepEqual(cleared.burden_findings,before.burden_findings);assert.deepEqual(cleared.scenario,before.scenario);return {selected:34,cleared:0,nationalAndScenarioUnchanged:true};
});
await check('Print default Brief independently and verify native before/afterprint restoration',async()=>{
 const p=await page();await go(p,'/brief');const details=p.locator('main details');const before=await details.evaluateAll(es=>es.map(e=>e.open));
 await p.pdf({path:`${output}/native-planning-brief.pdf`,format:'Letter',printBackground:true});assert.deepEqual(await details.evaluateAll(es=>es.map(e=>e.open)),before);
 await p.evaluate(()=>{window.print=()=>window.dispatchEvent(new Event('beforeprint'));});await p.getByRole('button',{name:'Print / save PDF'}).click();assert.ok((await details.evaluateAll(es=>es.map(e=>e.open))).every(Boolean));
 await p.emulateMedia({media:'print'});assert.equal(await p.locator('.site-header').isVisible(),false);assert.equal(await p.locator('.brief-aside').isVisible(),false);await p.pdf({path:`${output}/explicit-planning-brief.pdf`,format:'Letter',printBackground:true});await p.screenshot({path:`${output}/supplemental-print.png`,fullPage:true});await p.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.deepEqual(await details.evaluateAll(es=>es.map(e=>e.open)),before);return {disclosures:before.length,chromeHidden:true};
});
await check('Data request controls have distinguishable accessible names',async()=>{
 const p=await page();await go(p,'/pilot');
 for(const field of ['capacity','reach','alternative_window_months']){await p.getByLabel('Test assumption').selectOption(field);await p.getByRole('button',{name:'Add to data requests',exact:true}).click();}
 await nav(p,'Data requests');const rows=p.locator('.data-request-sheet');const questions=await rows.locator('h2').allTextContents();
 await writeFile(`${output}/request-controls-accessible.txt`,await p.locator('main').ariaSnapshot());
 for(const q of questions){const checkbox=p.getByRole('checkbox',{name:q+' Include in Planning Brief',exact:true});assert.equal(await checkbox.count(),1,`Cannot identify request checkbox by question: ${q}`);}
 return {questions,distinctControls:true};
});
for(const width of [768,390])for(const theme of ['light','dark'])await check(`Expanded disclosures axe ${width}px ${theme}`,async()=>{
 const p=await page(width,theme);const data=[];for(const route of ['/','/burden','/burden/medical','/local-context','/pilot','/pilot#sensitivity','/evidence','/data-requests','/brief']){
  await go(p,route);await p.locator('main details').evaluateAll(es=>es.forEach(e=>e.open=true));await p.addScriptTag({content:axe.source});const r=await p.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));data.push({route,violations:r.violations,incomplete:r.incomplete.map(({id,nodes})=>({id,count:nodes.length}))});
 }await writeFile(`${output}/axe-expanded-${width}-${theme}.json`,JSON.stringify(data,null,2));assert.deepEqual(data.flatMap(x=>x.violations.map(v=>({route:x.route,id:v.id,count:v.nodes.length}))),[]);return data.map(({route,incomplete})=>({route,incomplete}));
});
await browser.close();console.log(JSON.stringify(results.map(({name,status,error})=>({name,status,error:error?.split('\n')[0]})),null,2));process.exitCode=results.some(x=>x.status==='FAIL')?1:0;
