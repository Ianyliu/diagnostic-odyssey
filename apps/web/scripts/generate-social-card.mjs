/**
 * Deterministic social preview artwork. No network, font downloads, or native packages.
 * npm run build generates public/social-card.png before Vite copies public assets.
 * PNG is built from opaque pixels and compressed with Node's built-in zlib.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const W = 1200, H = 630;
const rgba = new Uint8Array(W * H * 4);
const palette = {
  navy: [14, 32, 45], navyLight: [25, 51, 65], teal: [89, 200, 179],
  blue: [136, 186, 216], gold: [225, 190, 123], cream: [248, 248, 238],
  muted: [190, 204, 208], line: [57, 79, 90]
};
function rect(x, y, w, h, rgb) {
  for (let j = Math.max(0,y); j < Math.min(H,y+h); j++)
    for (let i = Math.max(0,x); i < Math.min(W,x+w); i++) {
      const p = (j * W + i) * 4;
      rgba.set([rgb[0], rgb[1], rgb[2], 255], p);
    }
}
// Five-by-seven vector-derived bitmap glyphs, deliberately bundled to avoid platform fonts.
const glyphs = {
 A:["01110","10001","10001","11111","10001","10001","10001"],
 B:["11110","10001","10001","11110","10001","10001","11110"],
 C:["01111","10000","10000","10000","10000","10000","01111"],
 D:["11110","10001","10001","10001","10001","10001","11110"],
 E:["11111","10000","10000","11110","10000","10000","11111"],
 F:["11111","10000","10000","11110","10000","10000","10000"],
 G:["01111","10000","10000","10111","10001","10001","01110"],
 H:["10001","10001","10001","11111","10001","10001","10001"],
 I:["11111","00100","00100","00100","00100","00100","11111"],
 J:["00111","00010","00010","00010","10010","10010","01100"],
 K:["10001","10010","10100","11000","10100","10010","10001"],
 L:["10000","10000","10000","10000","10000","10000","11111"],
 M:["10001","11011","10101","10101","10001","10001","10001"],
 N:["10001","11001","10101","10011","10001","10001","10001"],
 O:["01110","10001","10001","10001","10001","10001","01110"],
 P:["11110","10001","10001","11110","10000","10000","10000"],
 Q:["01110","10001","10001","10001","10101","10010","01101"],
 R:["11110","10001","10001","11110","10100","10010","10001"],
 S:["01111","10000","10000","01110","00001","00001","11110"],
 T:["11111","00100","00100","00100","00100","00100","00100"],
 U:["10001","10001","10001","10001","10001","10001","01110"],
 V:["10001","10001","10001","10001","10001","01010","00100"],
 W:["10001","10001","10001","10101","10101","10101","01010"],
 X:["10001","10001","01010","00100","01010","10001","10001"],
 Y:["10001","10001","01010","00100","00100","00100","00100"],
 Z:["11111","00001","00010","00100","01000","10000","11111"],
 "0":["01110","10011","10101","10101","11001","10001","01110"],
 "1":["00100","01100","00100","00100","00100","00100","01110"],
 "2":["01110","10001","00001","00010","00100","01000","11111"],
 "4":["00010","00110","01010","10010","11111","00010","00010"],
 "/":["00001","00001","00010","00100","01000","10000","10000"],
 "-":["00000","00000","00000","11111","00000","00000","00000"],
 ".":["00000","00000","00000","00000","00000","01100","01100"],
 ":":["00000","01100","01100","00000","01100","01100","00000"],
 " ":["00000","00000","00000","00000","00000","00000","00000"]
};
function lettering(str, x, y, scale, color) {
  for (const ch of str.toUpperCase()) {
    const rows = glyphs[ch] ?? glyphs[" "];
    for (let r=0;r<7;r++) for(let c=0;c<5;c++)
      if(rows[r][c]==="1") rect(x+c*scale,y+r*scale,scale,scale,color);
    x += 6*scale;
  }
}
rect(0, 0, W, H, palette.navy);
rect(0, 0, W, 12, palette.teal);
rect(0, 12, 16, H-12, palette.navyLight);
rect(64, 65, 64, 8, palette.teal);
lettering("REVIEWED PUBLIC EVIDENCE", 64, 91, 3, palette.teal);
lettering("DIAGNOSTIC", 64, 166, 8, palette.cream);
lettering("ODYSSEY", 64, 245, 8, palette.cream);
lettering("EVIDENCE INTO PLANNING", 66, 347, 4, palette.muted);
rect(64, 432, 1072, 2, palette.line);
const lanes = [
  {x:64,color:palette.teal,title:"REVIEWED EVIDENCE",subtitle:"NATIONAL MEPS 2024"},
  {x:434,color:palette.blue,title:"LOCAL CONTEXT",subtitle:"HRSA AND ACS"},
  {x:804,color:palette.gold,title:"ASSUMPTIONS",subtitle:"TRANSPARENT PILOTS"}
];
for (const lane of lanes) {
  rect(lane.x, 465, 321, 6, lane.color);
  lettering(lane.title, lane.x, 496, 2, palette.cream);
  lettering(lane.subtitle, lane.x, 537, 2, palette.muted);
}
rect(64, 597, 1072, 1, palette.line);
// PNG encoder with standard CRC32 per chunk and a deterministic deflate stream.
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes) {
    crc ^= byte;
    for(let i=0;i<8;i++) crc=(crc>>>1) ^ ((crc&1)?0xedb88320:0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name=Buffer.from(type,"ascii");
  const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([len,name,data,crc]);
}
const stride=W*4, pixels=Buffer.alloc((stride+1)*H);
for(let y=0;y<H;y++) {
  pixels[y*(stride+1)]=0; // PNG filter 0; avoids platform-dependent optimisation.
  pixels.set(rgba.subarray(y*stride,(y+1)*stride),y*(stride+1)+1);
}
const ihdr=Buffer.alloc(13);
ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([
 Buffer.from([137,80,78,71,13,10,26,10]),
 chunk("IHDR",ihdr),chunk("IDAT",deflateSync(pixels,{level:9})),chunk("IEND",Buffer.alloc(0))
]);
writeFileSync(process.env.DO_SOCIAL_IMAGE_OUTPUT ?? fileURLToPath(new URL("../public/social-card.png",import.meta.url)),png);
