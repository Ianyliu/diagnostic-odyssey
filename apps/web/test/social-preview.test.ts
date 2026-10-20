import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
test("absolute social URL and image metadata target the approved Vercel domain",()=>{
 for(const name of ["og:url","og:image","twitter:image"]) assert.match(html,new RegExp(name));
 assert.match(html,/https:\/\/diagnostic-odyssey-psi\.vercel\.app\/og-image\.png/);
 assert.match(html,/og:image:width" content="1200"/);
 assert.match(html,/og:image:height" content="630"/);
});
test("social image metadata never advertises causal or unreviewed U09 claims",()=>{
 assert.doesNotMatch(html,/4\.8%|U09|attributable savings|causal ROI/i);
 assert.match(html,/all-cause spending is not attributable cost/i);
});

test("OG artwork is version-independent, nonnumeric and uses only local deterministic inputs",()=>{
 const source=readFileSync(new URL("../../../scripts/og/render-og-image.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(source,/meps-2024-long-covid-candidate|bundle\.json|selectHeadlineFindings|readFileSync|estimate\.value/);
 assert.match(source,/REVIEWED NATIONAL BURDEN/);
 assert.match(source,/LOCAL IMPLEMENTATION/);
 assert.match(source,/TRANSPARENT PILOT PLANS/);
 assert.match(source,/NO CAUSAL SAVINGS OR ROI/);
});

test("social artwork alt is literal, matching across OpenGraph and Twitter",()=>{
 const get=(attribute:string,name:string)=>{
   const tag=html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]+)"\\s*\\/>`));
   assert.ok(tag,`Missing metadata ${name}`);
   return tag[1];
 };
 const og=get("property","og:image:alt"),twitter=get("name","twitter:image:alt");
 assert.equal(og,twitter);
 assert.match(og,/Long COVID goes beyond the bill/);
 for (const label of ["reviewed national burden","local implementation","transparent pilot plans"]) assert.match(og,new RegExp(label,"i"));
 assert.match(og,/all-cause burden is not attributable cost/i);
 assert.doesNotMatch(og,/\\b(?:confidence intervals?|\\d+%|CI)\\b/i);
});
