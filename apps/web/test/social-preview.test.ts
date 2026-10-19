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
