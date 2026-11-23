import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
const entry=readFileSync(resolve(here,"../api/ai-preview.ts"),"utf8");
const cases=[
 {key:"TYPES",filename:"types.ts",normalize:(x:string)=>x.replace(/^export /gm,"")},
 {key:"GUARDS",filename:"guards.ts",normalize:(x:string)=>x.replace(/^import .*;\n/gm,"").replace(/^export /gm,"")},
 {key:"INDEX",filename:"index.ts",normalize:(x:string)=>x.replace(/^import .*;\n/gm,"").replace(/^export \{.*\} from .*;\n/gm,"").replace(/^export type \* from .*;\n/gm,"").replace(/^export /gm,"")}
];
test("Vercel entry mirrors trusted planning-guidance source without drift",()=>{
 for(const item of cases){
  const source=readFileSync(resolve(here,"../../../packages/planning-guidance/src",item.filename),"utf8");
  const start="// BEGIN_CANONICAL_"+item.key+"\n";
  const end="\n// END_CANONICAL_"+item.key;
  const a=entry.indexOf(start),b=entry.indexOf(end);
  assert.ok(a>=0&&b>a,item.filename+" markers missing");
  assert.equal(entry.slice(a+start.length,b),item.normalize(source).trimEnd(),item.filename+" source drift");
 }
 const imports=entry.split("\n").filter(line=>/^import /m.test(line));
 assert.deepEqual(imports,['import {createHash,randomBytes,timingSafeEqual} from "node:crypto";'],
  "No runtime imports beyond built-in crypto");
 assert.doesNotMatch(entry,/from ["'](?:\.|@diagnostic-odyssey\/)/);
});
