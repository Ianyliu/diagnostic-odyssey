import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const directory = dirname(fileURLToPath(import.meta.url));
const get = (file: string) => readFileSync(resolve(directory, file), "utf8");
const config = JSON.parse(get("../vercel.json"));
const html = get("../index.html");
const bootstrap = get("../public/theme-init.js");

function validate(input: any): void {
  assert.equal(input.rewrites.length, 1, "one rewrite rule");
  assert.equal(input.rewrites[0].destination, "/index.html");
  assert.ok(input.rewrites[0].source.includes("api/"), "SPA catch-all excludes api routes");
  assert.equal(input.headers?.length, 1, "one unconditional header rule");
  assert.equal(input.headers[0].source, "/(.*)", "cover documents, routes, JS, CSS, and images");
  assert.equal(input.headers[0].has, undefined);
  assert.equal(input.headers[0].missing, undefined);
  const entries: { key: string; value: string }[] = input.headers[0].headers;
  assert.ok(Array.isArray(entries));
  assert.equal(new Set(entries.map(item => item.key.toLowerCase())).size, entries.length, "no duplicate keys");
  const lookup = new Map(entries.map(item => [item.key.toLowerCase(), item.value]));
  assert.equal(lookup.size, 5, "approved headers only");
  assert.equal(lookup.get("x-content-type-options"), "nosniff");
  assert.equal(lookup.get("referrer-policy"), "no-referrer");
  assert.equal(lookup.get("x-frame-options"), "DENY");
  assert.equal(lookup.get("permissions-policy"), "camera=(), microphone=(), geolocation=(), payment=()");
  const raw = lookup.get("content-security-policy");
  assert.ok(raw, "mandatory enforced (not report-only) CSP");
  const parts = raw.split(";").map(part => part.trim().split(/\s+/)).filter(part => part[0]);
  const directives = new Map(parts.map(([name, ...values]) => [name, values.join(" ")]));
  assert.equal(directives.size, parts.length, "no duplicate CSP directives");
  const exact: Record<string, string> = {
    "default-src": "'none'", "base-uri": "'none'", "form-action": "'none'",
    "frame-ancestors": "'none'", "object-src": "'none'",
    "script-src": "'self'", "script-src-attr": "'none'",
    "style-src": "'self'", "style-src-elem": "'self'", "style-src-attr": "'none'",
    "img-src": "'self'", "font-src": "'self'", "connect-src": "'self'",
    "frame-src": "'none'", "worker-src": "'none'", "manifest-src": "'self'",
    "upgrade-insecure-requests": ""
  };
  assert.deepEqual(Object.fromEntries(directives), exact, "deny unsupported origins and executable inline markup");
  assert.doesNotMatch(raw, /unsafe-inline|unsafe-eval|\*|https?:|data:|blob:|nonce-|sha256-/i);
}

test("exact Vercel security configuration, source lists and SPA fallback", () => {
  validate(config);
});
test("first-paint bootstrap is blocking, same-origin and not inline", () => {
  assert.match(html, /<script src="\/theme-init\.js"><\/script>/);
  assert.doesNotMatch(html, /<script(?:\s|>)(?![^>]*\bsrc=)[^>]*>/i);
  assert.ok(html.indexOf('src="/theme-init.js"') < html.indexOf("</head>"));
  assert.ok(html.indexOf('src="/theme-init.js"') < html.indexOf('id="root"'));
  assert.doesNotMatch(html, /<style\b|\bonload=|\bonerror=/i);
  assert.match(bootstrap, /diagnostic-odyssey\.theme/);
  assert.match(bootstrap, /prefers-color-scheme: dark/);
});
test("bootstrap retains storage, system, light/dark and fallback behavior", () => {
  for (const entry of [
    { stored: "dark", system: false, expected: "dark", preference: "dark" },
    { stored: "light", system: true, expected: "light", preference: "light" },
    { stored: "system", system: true, expected: "dark", preference: "system" },
    { stored: "system", system: false, expected: "light", preference: "system" },
    { stored: "nonsense", system: true, expected: "dark", preference: "system" }
  ]) {
    const dataset: Record<string,string> = {};
    const meta = {content:""};
    runInNewContext(bootstrap,{
      localStorage: {getItem: () => entry.stored},
      matchMedia: () => ({matches: entry.system}),
      document: {documentElement: {dataset}, querySelector: () => meta}
    });
    assert.deepEqual({theme:dataset.theme, preference:dataset.themePreference, color:meta.content},
      {theme:entry.expected, preference:entry.preference, color:entry.expected === "dark" ? "#09131b" : "#f5f2eb"});
  }
  const dataset: Record<string,string> = {};
  const meta={content:""};
  runInNewContext(bootstrap,{
    localStorage:{getItem(){throw Error("blocked storage");}},
    matchMedia(){throw Error("missing API");},
    document:{documentElement:{dataset}, querySelector:()=>meta}
  });
  assert.equal(dataset.theme,"light");
  assert.equal(dataset.themePreference,"system");
  assert.equal(meta.content,"#f5f2eb");
});
test("fail closed on missing headers, policy weakening, and route gaps", () => {
  const mutate = (change: (copy: any, values: Map<string, any>) => void) => {
    const copy = structuredClone(config);
    const map = new Map(copy.headers[0].headers.map((h: any) => [h.key,h]));
    change(copy, map);
    assert.throws(() => validate(copy));
  };
  mutate((copy) => {delete copy.headers;});
  mutate((copy) => {copy.headers[0].source="/";});
  mutate((copy) => {copy.rewrites=[];});
  mutate((_copy,headers)=>{headers.get("Content-Security-Policy").value="default-src 'self'";});
  mutate((_copy,headers)=>{headers.get("Content-Security-Policy").value+= "; script-src 'self' 'unsafe-inline'";});
  mutate((_copy,headers)=>{headers.get("Content-Security-Policy").value=headers.get("Content-Security-Policy").value.replace("frame-ancestors 'none'","frame-ancestors 'self'");});
  mutate((_copy,headers)=>{headers.get("Content-Security-Policy").value=headers.get("Content-Security-Policy").value.replace("style-src-attr 'none'","style-src-attr 'unsafe-inline'");});
  mutate((_copy,headers)=>{headers.get("Content-Security-Policy").value=headers.get("Content-Security-Policy").value.replace("connect-src 'self'","connect-src *");});
  mutate((_copy,headers)=>{headers.get("X-Frame-Options").value="SAMEORIGIN";});
  mutate((_copy,headers)=>{headers.get("X-Content-Type-Options").value="off";});
  mutate((_copy,headers)=>{headers.get("Referrer-Policy").value="unsafe-url";});
  mutate((copy)=>{copy.headers[0].headers.push({key:"content-security-policy",value:"default-src *"});});
});
