/* global process, console, document, window, getComputedStyle, innerWidth, PerformanceObserver, localStorage, URL, performance */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import {readFileSync} from "node:fs";
const require=createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium}=require("playwright");
const base=process.env.QA_BASE_URL??"http://127.0.0.1:4188";
const out=process.env.QA_OUTPUT??"/tmp/opening-circuit-qa";
await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.QA_CHROME?{executablePath:process.env.QA_CHROME}:{channel:"chrome"});
const results=[];
async function check(page,label,expected) {
  await page.locator(".workspace-preview").waitFor();
  await page.locator(".headline-finding").first().waitFor();
  assert.equal(await page.locator(".headline-finding").count(),4);
  const g=await page.evaluate(()=>{
    const panel=document.querySelector(".overview-hero-motion").getBoundingClientRect();
    const brief=document.querySelector(".preview-output");
    const btn=document.querySelector(".preview-replay").getBoundingClientRect();
    return {top:panel.top,left:panel.left,right:panel.right,width:document.documentElement.scrollWidth,
      viewport:innerWidth,brief:getComputedStyle(brief).display,briefWidth:brief.getBoundingClientRect().width,
      laneCount:document.querySelector(".preview-lanes").children.length,buttonHeight:btn.height};
  });
  assert.ok(g.top<850,label+" off first-screen "+JSON.stringify(g));
  assert.ok(g.left>=-2&&g.right<=g.viewport+2,label+" panel overflow "+JSON.stringify(g));
  assert.ok(g.width<=g.viewport+2,label+" horizontal overflow "+JSON.stringify(g));
  assert.ok(g.brief!=="none"&&g.briefWidth>65,label+" missing Brief "+JSON.stringify(g));
  assert.equal(g.laneCount,3);assert.ok(g.buttonHeight>=40);
  assert.equal(await page.getByRole("button",{name:"Replay animation"}).count(),1);
  assert.equal(await page.locator(".overview-page.is-opening").count(),expected?1:0);
  return g;
}
async function tabToReplay(page) {
  // Follow the real keyboard tab order, rather than focusing the control through JS.
  for(let i=0;i<24;i++) {
    await page.keyboard.press("Tab");
    if(await page.evaluate(()=>document.activeElement?.matches(".preview-replay")))return;
  }
  throw Error("Replay was unreachable using Tab");
}
async function stillFocusedOnSameReplay(page) {
  return page.evaluate(()=>document.activeElement===document.querySelector(".preview-replay")
    &&document.activeElement===window.__replayFocusAnchor);
}
try{
  for(const width of [320,360,390,768,1024,1440])
  for(const theme of ["light","dark"])
  for(const motion of ["no-preference","reduce"]){
    const label=width+"-"+theme+"-"+motion;
    const p=await browser.newPage({viewport:{width,height:900},colorScheme:theme,reducedMotion:motion});
    try{
      await p.addInitScript(()=>{
        window.openingShifts=[];
        new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.openingShifts.push(e.value);})
          .observe({type:"layout-shift",buffered:true});
      });
      await p.goto(base+"/");
      const geo=await check(p,label,motion==="no-preference");
      if(motion==="reduce")
        assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.animationName?.startsWith("circuit-")).length),0);
      if([390,1440].includes(width)&&theme==="light"&&motion==="no-preference"){
        await p.screenshot({path:out+"/"+label+"-entry.png",animations:"allow"});
        await p.waitForTimeout(1500);
        await p.screenshot({path:out+"/"+label+"-mid.png",animations:"allow"});
      }
      await p.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:9500});
      if([320,390,1440].includes(width)&&theme==="light")
        await p.screenshot({path:out+"/"+label+"-complete.png",animations:"disabled"});
      const cls=await p.evaluate(()=>window.openingShifts.reduce((a,b)=>a+b,0));
      assert.ok(cls<.03,label+" layout shift "+cls);
      results.push({label,status:"PASS",geo,layoutShift:cls});
    }catch(e){results.push({label,status:"FAIL",error:String(e.stack)});}
    finally{await p.close();}
  }
  const p=await browser.newPage({viewport:{width:390,height:900}});
  try{
    await p.goto(base+"/");
    await p.locator(".overview-page.is-opening").waitFor({state:"detached"});
    await p.reload();
    await check(p,"seen flag",false);
    await p.getByRole("button",{name:"Replay animation"}).click();
    await check(p,"replay",true);
    assert.ok(await p.evaluate(()=>document.getAnimations().some(a=>a.animationName==="circuit-lane")));
    await p.screenshot({path:out+"/replay-mobile.png",animations:"allow"});
    await p.keyboard.press("Tab");
    await p.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:2000});
    assert.equal(await p.locator(".preview-output").isVisible(),true);
    await p.getByRole("button",{name:"Replay animation"}).focus();
    await p.keyboard.press("Enter");
    assert.equal(await p.locator(".overview-page.is-opening").count(),1);
    await p.emulateMedia({reducedMotion:"reduce"});
    await p.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:2000});
    await p.getByRole("button",{name:"Replay animation"}).click();
    await check(p,"reduced replay",false);
    results.push({label:"replay-keyboard-reduced-switch",status:"PASS"});
  }catch(e){results.push({label:"replay-keyboard-reduced-switch",status:"FAIL",error:String(e.stack)});}
  finally{await p.close();}
  const focus=await browser.newPage({viewport:{width:390,height:900},reducedMotion:"no-preference"});
  try{
    await focus.goto(base+"/");
    await focus.locator(".preview-replay").waitFor();
    await tabToReplay(focus);
    await focus.evaluate(()=>{window.__replayFocusAnchor=document.querySelector(".preview-replay");});
    assert.equal(await stillFocusedOnSameReplay(focus),true,"Tab must focus Replay");
    await focus.keyboard.press("Enter");
    assert.equal(await focus.locator(".overview-page.is-opening").count(),1,"Enter must replay");
    assert.equal(await stillFocusedOnSameReplay(focus),true,"Enter must not detach the focused node");
    assert.ok(await focus.evaluate(()=>document.getAnimations().some(a=>a.animationName==="circuit-lane")));
    await focus.evaluate(()=>{window.__firstReplayBody=document.querySelector(".preview-body");});
    await focus.keyboard.press("Enter");
    assert.equal(await stillFocusedOnSameReplay(focus),true,"rapid Enter must preserve DOM identity and focus");
    assert.equal(await focus.locator(".overview-page.is-opening").count(),1);
    assert.equal(await focus.evaluate(()=>document.querySelector(".preview-body")!==window.__firstReplayBody),true,
      "rapid replay must reconstruct the animated circuit");
    assert.ok(await focus.evaluate(()=>document.getAnimations().some(a=>a.animationName.startsWith("workspace-unfold"))),
      "rapid replay must restart shell choreography");
    await focus.keyboard.press("Tab");
    await focus.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:2000});
    assert.equal(await focus.evaluate(()=>document.activeElement!==document.body),true,
      "Tab interruption must not land on BODY");
    await focus.keyboard.press("Shift+Tab");
    assert.equal(await stillFocusedOnSameReplay(focus),true,"Shift+Tab returns to persistent Replay");
    await focus.keyboard.press("Enter");
    assert.equal(await stillFocusedOnSameReplay(focus),true);
    await focus.emulateMedia({reducedMotion:"reduce"});
    await focus.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:2000});
    assert.equal(await stillFocusedOnSameReplay(focus),true,"motion preference switch preserves keyboard focus");
    await focus.keyboard.press("Enter");
    assert.equal(await focus.locator(".overview-page.is-opening").count(),0,"reduced replay remains static");
    assert.equal(await stillFocusedOnSameReplay(focus),true);
    await focus.emulateMedia({reducedMotion:"no-preference"});
    await focus.keyboard.press("Enter");
    assert.equal(await focus.locator(".overview-page.is-opening").count(),1);
    assert.equal(await stillFocusedOnSameReplay(focus),true);
    await focus.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:9500});
    assert.equal(await stillFocusedOnSameReplay(focus),true,"natural completion preserves keyboard focus");
    await focus.screenshot({path:out+"/keyboard-focus-complete.png",animations:"disabled"});
    results.push({label:"tab-enter-repeat-interrupt-reduced-complete-focus",status:"PASS"});
  }catch(e){results.push({label:"tab-enter-repeat-interrupt-reduced-complete-focus",status:"FAIL",error:String(e.stack)});}
  finally{await focus.close();}

  const pointer=await browser.newPage({viewport:{width:390,height:900},reducedMotion:"no-preference"});
  try{
    await pointer.goto(base+"/");
    await pointer.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:9500});
    await pointer.locator(".overview-primary-cta").focus();
    await pointer.evaluate(()=>{
      window.__pointerFocusAnchor=document.activeElement;
      // Suppress only the browser's normal mouse-down focus transfer.
      // If application code explicitly focuses Replay, this negative test catches it.
      document.querySelector(".preview-replay").addEventListener("mousedown",e=>e.preventDefault(),{once:true});
    });
    await pointer.getByRole("button",{name:"Replay animation"}).click();
    assert.equal(await pointer.locator(".overview-page.is-opening").count(),1);
    assert.equal(await pointer.evaluate(()=>document.activeElement===window.__pointerFocusAnchor),true,
      "pointer replay must not programmatically steal existing focus");
    await pointer.mouse.wheel(0,200);
    await pointer.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:2000});
    assert.equal(await pointer.evaluate(()=>document.activeElement===window.__pointerFocusAnchor),true);
    results.push({label:"pointer-replay-no-focus-steal",status:"PASS"});
  }catch(e){results.push({label:"pointer-replay-no-focus-steal",status:"FAIL",error:String(e.stack)});}
  finally{await pointer.close();}


  // Run J's real motion + Replay interaction behind K's actual configured CSP,
  // applied to the built Vite preview through a Playwright response-header overlay.
  // This is browser CSP enforcement, not an attestation of deployed Vercel headers.
  const security=JSON.parse(readFileSync(new URL("../../apps/web/vercel.json",import.meta.url),"utf8"));
  assert.equal(security.headers.length,1);
  assert.equal(security.headers[0].source,"/(.*)");
  const securityHeaders=Object.fromEntries(security.headers[0].headers.map(h=>[h.key,h.value]));
  assert.ok(securityHeaders["Content-Security-Policy"].includes("script-src 'self'"));
  assert.ok(securityHeaders["Content-Security-Policy"].includes("style-src-attr 'none'"));
  assert.ok(!securityHeaders["Content-Security-Policy"].includes("unsafe-inline"));
  for(const [theme,width] of [["light",390],["dark",1440]]){
    const label="k-enforced-csp-"+theme+"-normal-motion-replay-focus";
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:"no-preference"});
    try{
      await context.route("**/*",async route=>{
        const response=await route.fetch();
        await route.fulfill({response,headers:{...response.headers(),...securityHeaders}});
      });
      await context.addInitScript(selected=>{
        try{localStorage.setItem("diagnostic-odyssey.theme",selected);}catch{/* optional storage */}
        window.__cspViolations=[];
        document.addEventListener("securitypolicyviolation",event=>{
          window.__cspViolations.push({directive:event.effectiveDirective,blockedURI:event.blockedURI});
        });
        document.addEventListener("DOMContentLoaded",()=>{window.__themeAtDCL=document.documentElement.dataset.theme;});
      },theme);
      const page=await context.newPage();
      const errors=[];
      page.on("pageerror",error=>errors.push(String(error)));
      await page.goto(base+"/");
      await check(page,label,true);
      assert.equal(await page.evaluate(()=>window.__themeAtDCL),theme,"external K bootstrap sets theme before DOMContentLoaded");
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);
      const cspResponse=await page.evaluate(()=>performance.getEntriesByType("resource").some(e=>e.name.endsWith("/theme-init.js")));
      assert.equal(cspResponse,true,"synchronous theme-init.js must execute under K CSP");
      assert.ok(await page.evaluate(()=>document.getAnimations().some(a=>a.animationName==="circuit-lane"&&a.playState==="running")),
        "normal-motion lane choreography must run under enforced K CSP");
      await page.screenshot({path:out+"/"+label+"-entry.png",animations:"allow"});
      await tabToReplay(page);
      await page.evaluate(()=>{window.__replayFocusAnchor=document.querySelector(".preview-replay");});
      await page.keyboard.press("Enter");
      assert.equal(await stillFocusedOnSameReplay(page),true,"CSP replay Enter keeps exact focused DOM button");
      assert.equal(await page.locator(".overview-page.is-opening").count(),1);
      assert.ok(await page.evaluate(()=>document.getAnimations().some(a=>a.animationName==="circuit-lane"&&a.playState==="running")),
        "CSP replay must restart the inner circuit");
      await page.keyboard.press("Enter");
      assert.equal(await stillFocusedOnSameReplay(page),true,"CSP rapid replay keeps DOM identity");
      assert.ok(await page.evaluate(()=>document.getAnimations().some(a=>a.animationName.startsWith("workspace-unfold")&&a.playState==="running")),
        "CSP rapid replay must restart the shell");
      await page.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:9500});
      assert.equal(await stillFocusedOnSameReplay(page),true,"CSP completion must retain keyboard focus");
      assert.equal(await page.locator(".preview-output").isVisible(),true);
      const violations=await page.evaluate(()=>window.__cspViolations);
      assert.deepEqual(violations,[],"normal-motion opening/Replay must have zero unexpected K CSP violations");
      assert.deepEqual(errors,[],"opening/Replay under K CSP must have no uncaught page errors");
      await page.screenshot({path:out+"/"+label+"-complete.png",animations:"disabled"});
      results.push({label,status:"PASS",security:"simulated K policy on built preview",violations});
    }catch(e){results.push({label,status:"FAIL",error:String(e.stack)});}
    finally{await context.close();}
  }

  const p2=await browser.newPage({viewport:{width:360,height:900}});
  try{
    await p2.addInitScript(()=>Object.defineProperty(window,"sessionStorage",{get(){throw Error("blocked");},configurable:true}));
    await p2.goto(base+"/");
    await check(p2,"blocked storage",false);
    await p2.getByRole("button",{name:"Replay animation"}).click();
    assert.equal(await p2.locator(".overview-page.is-opening").count(),1);
    await p2.mouse.wheel(0,250);
    await p2.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:2000});
    await check(p2,"interrupted",false);
    await tabToReplay(p2);
    await p2.keyboard.press("Enter");
    assert.equal(await p2.locator(".overview-page.is-opening").count(),1);
    assert.equal(await p2.evaluate(()=>document.activeElement?.matches(".preview-replay")),true,
      "blocked storage must not lose focus");
    await p2.keyboard.press("Enter");
    assert.equal(await p2.evaluate(()=>document.activeElement?.matches(".preview-replay")),true);
    await p2.mouse.wheel(0,200);
    await p2.locator(".overview-page.is-opening").waitFor({state:"detached",timeout:2000});
    await check(p2,"blocked repeated replay interrupted",false);
    results.push({label:"blocked-storage-interrupt-repeat-keyboard",status:"PASS"});
  }catch(e){results.push({label:"blocked-storage-interrupt",status:"FAIL",error:String(e.stack)});}
  finally{await p2.close();}
  for(const url of ["/?review=1","/#context","/burden"]){
    const q=await browser.newPage({viewport:{width:768,height:900}});
    try{await q.goto(base+url);assert.equal(await q.locator(".overview-page.is-opening").count(),0);
      if(url!=="/burden")await check(q,"direct "+url,false);
      results.push({label:"direct "+url,status:"PASS"});
    }catch(e){results.push({label:"direct "+url,status:"FAIL",error:String(e.stack)});}
    finally{await q.close();}
  }
  const zoom=await browser.newPage({viewport:{width:720,height:900},reducedMotion:"reduce"});
  try{
    await zoom.goto(base+"/");await zoom.locator(".workspace-preview").waitFor();
    await zoom.evaluate(()=>{document.documentElement.style.zoom="200%";});
    const g=await zoom.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,
      display:getComputedStyle(document.querySelector(".preview-output")).display}));
    assert.ok(g.width<=g.viewport+2,JSON.stringify(g));assert.notEqual(g.display,"none");
    await zoom.screenshot({path:out+"/200percent-zoom.png"});
    results.push({label:"200percent-zoom",status:"PASS",g});
  }catch(e){results.push({label:"200percent-zoom",status:"FAIL",error:String(e.stack)});}
  finally{await zoom.close();}
}finally{await browser.close();}
await writeFile(out+"/results.json",JSON.stringify({sha:process.env.QA_SHA,results},null,2));
console.log(JSON.stringify(results.map(({label,status,error})=>({label,status,error}))));
if(results.some(r=>r.status!=="PASS"))process.exitCode=1;
