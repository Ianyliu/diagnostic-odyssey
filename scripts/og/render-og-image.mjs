/**
 * Reproducible 1200x630 PNG for social previews. Build invokes this before Vite,
 * so og:image resolves to a real PNG without optional browser/native dependencies.
 * Static nonnumeric artwork avoids stale estimates and build failures on
 * reviewed-artifact version changes. No input or external request is accepted.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { Buffer } from "node:buffer";
import console from "node:console";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { deflateSync } from "node:zlib";
const root = fileURLToPath(new URL("../../", import.meta.url));
/* Deliberately fixed, nonnumeric design: publication-version changes must not
   break a website build or leave stale numerical social metadata behind. */
const items = [
 {title:"REVIEWED NATIONAL BURDEN",detail:"MEPS - SPENDING / TIME / DISTRESS",foot:"DESCRIPTIVE SURVEY EVIDENCE"},
 {title:"LOCAL IMPLEMENTATION",detail:"HRSA + CENSUS ACS CONTEXT",foot:"NOT LOCAL DISEASE PREVALENCE"},
 {title:"TRANSPARENT PILOT PLANS",detail:"ANALYST ASSUMPTIONS STAY SEPARATE",foot:"NO CAUSAL SAVINGS OR ROI"}
];
const W=1200,H=630,pixels=new Uint8Array(W*H*4);
function rgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function rect(x,y,w,h,hex){
 const [r,g,b]=rgb(hex),x0=Math.max(0,Math.floor(x)),y0=Math.max(0,Math.floor(y));
 for(let yy=y0;yy<Math.min(H,y+h);yy++)for(let xx=x0;xx<Math.min(W,x+w);xx++){
  const k=(yy*W+xx)*4;pixels[k]=r;pixels[k+1]=g;pixels[k+2]=b;pixels[k+3]=255;
 }
}
// Compact 5x7 glyph set; fixed metrics make rendering deterministic without OS fonts.
const font = {
 "A":["01110","10001","10001","11111","10001","10001","10001"],
 "B":["11110","10001","10001","11110","10001","10001","11110"],
 "C":["01111","10000","10000","10000","10000","10000","01111"],
 "D":["11110","10001","10001","10001","10001","10001","11110"],
 "E":["11111","10000","10000","11110","10000","10000","11111"],
 "F":["11111","10000","10000","11110","10000","10000","10000"],
 "G":["01111","10000","10000","10111","10001","10001","01111"],
 "H":["10001","10001","10001","11111","10001","10001","10001"],
 "I":["11111","00100","00100","00100","00100","00100","11111"],
 "J":["00111","00010","00010","00010","10010","10010","01100"],
 "K":["10001","10010","10100","11000","10100","10010","10001"],
 "L":["10000","10000","10000","10000","10000","10000","11111"],
 "M":["10001","11011","10101","10101","10001","10001","10001"],
 "N":["10001","11001","10101","10011","10001","10001","10001"],
 "O":["01110","10001","10001","10001","10001","10001","01110"],
 "P":["11110","10001","10001","11110","10000","10000","10000"],
 "Q":["01110","10001","10001","10001","10101","10010","01101"],
 "R":["11110","10001","10001","11110","10100","10010","10001"],
 "S":["01111","10000","10000","01110","00001","00001","11110"],
 "T":["11111","00100","00100","00100","00100","00100","00100"],
 "U":["10001","10001","10001","10001","10001","10001","01110"],
 "V":["10001","10001","10001","10001","10001","01010","00100"],
 "W":["10001","10001","10001","10101","10101","10101","01010"],
 "X":["10001","10001","01010","00100","01010","10001","10001"],
 "Y":["10001","10001","01010","00100","00100","00100","00100"],
 "Z":["11111","00001","00010","00100","01000","10000","11111"],
 "0":["01110","10011","10101","10101","11001","10001","01110"],
 "1":["00100","01100","00100","00100","00100","00100","01110"],
 "2":["01110","10001","00001","00010","00100","01000","11111"],
 "3":["11110","00001","00001","01110","00001","00001","11110"],
 "4":["00010","00110","01010","10010","11111","00010","00010"],
 "5":["11111","10000","10000","11110","00001","00001","11110"],
 "6":["00111","01000","10000","11110","10001","10001","01110"],
 "7":["11111","00001","00010","00100","01000","01000","01000"],
 "8":["01110","10001","10001","01110","10001","10001","01110"],
 "9":["01110","10001","10001","01111","00001","00010","11100"],
 " ":["00000","00000","00000","00000","00000","00000","00000"],
 ".":["00000","00000","00000","00000","00000","01100","01100"],
 ",":["00000","00000","00000","00000","00100","00100","01000"],
 ":":["00000","00100","00100","00000","00100","00100","00000"],
 "-":["00000","00000","00000","11111","00000","00000","00000"],
 "/":["00001","00001","00010","00100","01000","10000","10000"],
 "$":["00100","01111","10100","01110","00101","11110","00100"],
 "%":["11001","11010","00100","01000","10110","00110","00000"],
 "'":["00100","00100","00010","00000","00000","00000","00000"],
 "(" :["00010","00100","01000","01000","01000","00100","00010"],
 ")" :["01000","00100","00010","00010","00010","00100","01000"],
 "+":["00000","00100","00100","11111","00100","00100","00000"]
};
function text(x,y,value,scale,hex){
 const s=String(value).toUpperCase().replace(/[\u2019\u2018]/g,"'").replace(/[\u2013\u2014]/g,"-");
 for(const ch of s){const g=font[ch]??font[" "];
  for(let j=0;j<7;j++)for(let i=0;i<5;i++)if(g[j][i]==="1")rect(x+i*scale,y+j*scale,scale,scale,hex);
  x+=6*scale;
 }
}
function constrainedText(x,y,v,scale,max,hex){
 let s=String(v).toUpperCase().replace(/[\u2013\u2014]/g,"-");
 while(s.length*6*scale>max && scale>1)scale--;
 if(s.length*6*scale>max)throw Error("Preview text overflow: "+v);
 text(x,y,s,scale,hex);
}
rect(0,0,W,H,"#f5f2eb");rect(0,0,16,H,"#2c6b58");
rect(565,48,590,520,"#ffffff");rect(565,48,590,8,"#2c6b58");
text(54,66,"DIAGNOSTIC ODYSSEY",4,"#153552");
rect(54,135,442,3,"#91afa9");
text(54,190,"LONG COVID",6,"#153552");
text(54,260,"GOES BEYOND",6,"#153552");
text(54,330,"THE BILL.",6,"#2c6b58");
text(54,452,"EVIDENCE INTO PLANNING",3,"#153552");
text(54,500,"WITH BOUNDARIES INTACT",2,"#285e52");
items.forEach((item,i)=>{
 const y=101+i*145;
 if(i>0)rect(595,y-21,526,2,"#e4e9e7");
 constrainedText(596,y,item.title,3,525,"#153552");
 constrainedText(596,y+40,item.detail,2,525,"#285e52");
 constrainedText(596,y+73,item.foot,2,525,"#5e6a72");
});
text(55,592,"ALL-CAUSE BURDEN IS NOT ATTRIBUTABLE COST",2,"#5e6a72");
// Pure Node PNG writer: RGBA scanlines + zlib + correctly checksummed PNG chunks.
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(buffer){let c=0xffffffff;for(const b of buffer)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){
 const t=Buffer.from(type),n=Buffer.alloc(4),c=Buffer.alloc(4);
 n.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));
 return Buffer.concat([n,t,data,c]);
}
const scan=Buffer.alloc(H*(W*4+1));
for(let y=0;y<H;y++) Buffer.from(pixels.buffer).copy(scan,y*(W*4+1)+1,y*W*4,(y+1)*W*4);
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ihdr),chunk("IDAT",deflateSync(scan,{level:9})),chunk("IEND",Buffer.alloc(0))]);
const out=join(root,"apps/web/public/og-image.png");mkdirSync(join(root,"apps/web/public"),{recursive:true});
writeFileSync(out,png);console.log("Generated nonnumeric share preview",out,W+"x"+H);
