/* Local-only simulation of Vercel response-header application. NOT a deployed-header attestation. */
/* global process, console, URL, fetch, Buffer */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync(new URL("../../apps/web/vercel.json",import.meta.url),"utf8"));
const upstream = process.env.QA_UPSTREAM ?? "http://127.0.0.1:4199";
const port = Number(process.env.QA_PROXY_PORT ?? "4200");
if (config.headers?.length !== 1 || config.headers[0].source !== "/(.*)") throw Error("Missing global security rule");
const overlay = Object.fromEntries(config.headers[0].headers.map(({key,value})=>[key,value]));
const blocked = new Set(["connection","transfer-encoding","keep-alive","content-encoding"]);
createServer(async (req,res)=>{
  try{
    const path=req.url ?? "/";
    const response=await fetch(new URL(path,upstream),{method:"GET"});
    const headers=Object.fromEntries([...response.headers].filter(([key])=>!blocked.has(key.toLowerCase())));
    Object.assign(headers,overlay);
    res.writeHead(response.status,headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(err){console.error(err);res.writeHead(502);res.end("preview upstream unavailable");}
}).listen(port,"127.0.0.1",()=>console.log("Local simulated Vercel header proxy listening",port));
