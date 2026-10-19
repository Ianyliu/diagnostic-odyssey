import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
test("OpenGraph and Twitter use the assigned canonical domain and reproducible 1200x630 PNG", () => {
  const html = read("../index.html");
  const url = "https://diagnostic-odyssey-psi.vercel.app";
  assert.match(html, /property="og:image" content="https:\/\/diagnostic-odyssey-psi\.vercel\.app\/social-card\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /property="og:image:alt"/);
  assert.ok(html.includes('rel="canonical" href="' + url + '/"'));
  const tmp = mkdtempSync(join(tmpdir(),"do-social-"));
  try {
    const script = fileURLToPath(new URL("../scripts/generate-social-card.mjs",import.meta.url));
    const path = join(tmp,"card.png");
    const env = {...process.env,DO_SOCIAL_IMAGE_OUTPUT:path};
    execFileSync(process.execPath,[script],{env});
    const first=readFileSync(path);
    assert.deepEqual([...first.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal(first.readUInt32BE(16),1200);
    assert.equal(first.readUInt32BE(20),630);
    execFileSync(process.execPath,[script],{env});
    assert.deepEqual(readFileSync(path),first);
  } finally {rmSync(tmp,{recursive:true,force:true});}
});
