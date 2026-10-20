/* Effective HTTP + browser enforcement smoke on QA_BASE_URL.
 * Local proxy mode verifies browser behavior with simulated headers only.
 * Use an immutable actual Vercel preview URL for real served-header attestation.
 */
/* global process, console, window, document, getComputedStyle, localStorage, fetch, performance, setTimeout */
import assert from "node:assert/strict";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const { chromium } = require("playwright");
const base=(process.env.QA_BASE_URL ?? "http://127.0.0.1:4200").replace(/\/$/,"");
const mode=process.env.QA_SECURITY_MODE ?? "simulated";
const output=process.env.QA_OUTPUT ?? "/tmp/workstream-k";
await mkdir(output,{recursive:true});
const report={base,mode,checks:[],violations:[],externalRequests:[]};
const check=(name, fn)=>Promise.resolve().then(fn).then(details=>{report.checks.push({name,status:"PASS",details});}).catch(err=>{report.checks.push({name,status:"FAIL",error:String(err.stack??err)});});
const required={
 "x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer",
 "x-frame-options":"DENY",
 "permissions-policy":"camera=(), microphone=(), geolocation=(), payment=()"
};
let csp;
const routes=["/","/brief","/pilot","/burden","/data-requests","/theme-init.js","/diagnostic-odyssey-mark.svg"];
for(const path of routes){
 await check("HTTP security headers "+path,async()=>{
   const response=await fetch(base+path,{redirect:"manual"});
   assert.equal(response.status,200);
   for(const [key,value] of Object.entries(required)) assert.equal(response.headers.get(key),value,key+" on "+path);
   const policy=response.headers.get("content-security-policy");
   assert.ok(policy && policy.includes("script-src 'self'") && policy.includes("frame-ancestors 'none'"));
   assert.ok(policy.includes("style-src-attr 'none'"));
   assert.ok(!/unsafe-inline|unsafe-eval/.test(policy));
   if(csp) assert.equal(policy,csp);
   else csp=policy;
   if(path==="/"||["/brief","/pilot","/burden","/data-requests"].includes(path)){
     assert.match(response.headers.get("content-type")??"",/text\/html/i,"SPA document must be HTML");
     assert.match(await response.text(), /<script src="\/theme-init\.js"><\/script>/);
   }else if(path==="/theme-init.js"){
     assert.match(response.headers.get("content-type")??"",/javascript/i,"theme JS must be JS, not SPA HTML");
     assert.match(await response.text(),/diagnostic-odyssey\.theme/);
   }
   return {status:response.status,contentType:response.headers.get("content-type"),csp:policy};
 });
}
await check("hashed bundle JavaScript and CSS are protected",async()=>{
 const html=await (await fetch(base+"/")).text();
 const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match=>match[1]);
 assert.ok(assets.some(asset=>asset.endsWith(".js")),"expected bundled module");
 assert.ok(assets.some(asset=>asset.endsWith(".css")),"expected bundled stylesheet");
 for(const asset of assets){
   const response=await fetch(base+asset);
   assert.equal(response.status,200,asset);
   assert.equal(response.headers.get("content-security-policy"),csp,asset);
   assert.equal(response.headers.get("x-content-type-options"),"nosniff",asset);
   assert.match(response.headers.get("content-type")??"",asset.endsWith(".css")?/text\/css/i:/javascript/i,asset);
 }
 return assets;
});
const browser=await chromium.launch({channel:"chrome",headless:true});
for(const [theme,width] of [["light",390],["dark",1440]]){
 for(const path of ["/","/burden","/pilot","/brief"]){
 await check("Chromium CSP, first paint, no egress: "+theme+" "+width+" "+path,async()=>{
   const context=await browser.newContext({colorScheme:theme,viewport:{width,height:900},reducedMotion:"reduce",acceptDownloads:true});
   const page=await context.newPage();
   const errors=[],external=[];
   await context.addInitScript(preference=>{
      try{localStorage.setItem("diagnostic-odyssey.theme",preference);}catch{ /* blocked storage is a supported fallback */ }
      document.addEventListener("securitypolicyviolation",ev=>{
        (window.__violations??=[]).push({directive:ev.effectiveDirective,blockedURI:ev.blockedURI});
      });
      document.addEventListener("DOMContentLoaded",()=>{window.__themeAtDCL=document.documentElement.dataset.theme;});
   },theme);
   page.on("pageerror",err=>errors.push(String(err)));
   page.on("request",request=>{if(!request.url().startsWith(base)&&!request.url().startsWith("blob:"))external.push(request.url());});
   await page.goto(base+path,{waitUntil:"networkidle"});
   await page.locator("main h1").waitFor();
   const observed=await page.evaluate(()=>({
     first:window.__themeAtDCL,current:document.documentElement.dataset.theme,
     meta:document.querySelector('meta[name="theme-color"]').content,
     violations:window.__violations??[],
     bootstrap:performance.getEntriesByType("resource").some(x=>x.name.endsWith("/theme-init.js"))
   }));
   assert.equal(observed.first,theme);
   assert.equal(observed.current,theme);
   assert.equal(observed.meta,theme==="dark"?"#09131b":"#f5f2eb");
   assert.equal(observed.bootstrap,true,"parser-blocking theme initializer loaded");
   assert.deepEqual(errors,[]);
   assert.deepEqual(observed.violations,[],"unintended CSP violations");
   assert.deepEqual(external,[],"static app must not issue cross-origin requests");
   if(path==="/burden"){
     const span=page.locator(".metric-visual-interval").first();
     if(await span.count())assert.ok(await span.evaluate(el=>el.style.left.endsWith("%") && el.style.width.endsWith("%")),"React percentage positions and widths remain set via CSSOM (including legitimate zero-width intervals)");
   }
   report.violations.push(...observed.violations.map(v=>({...v,path,theme})));
   report.externalRequests.push(...external.map(url=>({url,path,theme})));
   await context.close();
   return observed;
 });
 }
}
await check("protected Brief: actual canonical JSON download, physical PDF, keyboard focus",async()=>{
 const context=await browser.newContext({acceptDownloads:true,reducedMotion:"reduce",viewport:{width:390,height:900}});
 const page=await context.newPage();
 await page.goto(base+"/brief");
 await page.locator("main h1").waitFor();
 await page.keyboard.press("Tab");
 assert.equal(await page.locator(":focus").innerText(),"Skip to main content");
 const event=page.waitForEvent("download");
 await page.getByRole("button",{name:"Export JSON companion"}).click();
 const download=await event;
 const companion=JSON.parse(await readFile(await download.path(),"utf8"));
 assert.equal(companion.burden_findings?.length,21,"reviewed national findings survive CSP");
 assert.equal(companion.local_context?.length,34,"reviewed default local context survives CSP");
 const pdf=await page.pdf({format:"Letter",printBackground:true});
 assert.equal(pdf.subarray(0,5).toString(),"%PDF-");
 assert.ok(pdf.length>15000,"nonempty physical browser PDF");
 await context.close();
 return {national:companion.burden_findings.length,local:companion.local_context.length,pdfBytes:pdf.length};
});
await check("CSP actually rejects injected inline scripts, styles, and frames",async()=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 await page.goto(base+"/");
 await page.locator("main h1").waitFor();
 const before=await page.evaluate(()=>new Promise(resolve=>{
   const events=[];
   const handler=e=>events.push(e.effectiveDirective);
   document.addEventListener("securitypolicyviolation",handler);
   const s=document.createElement("script");
   s.textContent="window.__unexpectedInlineExecution = true;";
   document.body.append(s);
   const div=document.createElement("div");
   div.setAttribute("style","display:none");
   document.body.append(div);
   setTimeout(()=>{document.removeEventListener("securitypolicyviolation",handler);resolve({ran:window.__unexpectedInlineExecution===true,display:getComputedStyle(div).display,events});},150);
 }));
 assert.equal(before.ran,false,"inline executable JS must be blocked");
 assert.equal(before.display,"block","setAttribute inline styling blocked");
 assert.ok(before.events.some(e=>e==="script-src-elem"||e==="script-src"));
 assert.ok(before.events.some(e=>e==="style-src-attr"||e==="style-src"));
 await page.goto("about:blank");
 await page.setContent('<iframe src="'+base+'/brief"></iframe>');
 await page.waitForTimeout(800);
 assert.equal(await page.frameLocator("iframe").locator("main h1").count(),0,"frame-ancestors blocks embedding");
 await context.close();
 return before;
});
await browser.close();
report.status=report.checks.every(row=>row.status==="PASS")?"PASS":"FAIL";
await writeFile(output+"/security-results.json",JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,checks:report.checks.map(row=>({name:row.name,status:row.status,error:row.error})),mode,base},null,2));
if(report.status!=="PASS")process.exitCode=1;
