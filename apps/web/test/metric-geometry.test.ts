import assert from "node:assert/strict";
import test from "node:test";
import { metricAriaDescription, metricGeometry } from "../src/data/metricGeometry.ts";

function close(actual: number, expected: number) {
 assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

test("subpixel-width CI is not extended across a forced visual minimum", () => {
 const g=metricGeometry(.4000005,"proportion",.4,.400001);
 close(g.intervalLeftPercent,40);
 close(g.intervalWidthPercent,.0001);
 close(g.intervalMidpointPercent,40.00005);
 assert.equal(g.narrowInterval,true);
 assert.equal(g.hasInterval,true);
 const aria=metricAriaDescription({label:"Synthetic",value:.4000005,unit:"proportion",
 low:.4,high:.400001,intervalLabel:"95% CI",narrowInterval:g.narrowInterval});
 assert.match(aria,/95% CI 40% to 40\.0001%/);
 assert.match(aria,/tick marks its position/);
});

test("ordinary CI uses exact rendered end-to-end width on 0–100% axis", () => {
 const g=metricGeometry(.35,"proportion",.2,.5);
 close(g.min,0); close(g.max,1);
 close(g.pointPercent,35); close(g.intervalLeftPercent,20); close(g.intervalWidthPercent,30);
 assert.equal(g.narrowInterval,false);
 assert.match(metricAriaDescription({label:"Ordinary",value:.35,unit:"proportion",
 low:.2,high:.5,intervalLabel:"95% CI"}),/95% CI 20% to 50%/);
});

test("true zero-length interval becomes a tick, but absent interval is never synthesized",()=>{
 const same=metricGeometry(.4,"proportion",.4,.4);
 assert.equal(same.intervalWidthPercent,0);assert.equal(same.narrowInterval,true);
 const missing=metricGeometry(.4,"proportion");
 assert.equal(missing.hasInterval,false);assert.equal(missing.narrowInterval,false);
 assert.match(metricAriaDescription({label:"No interval",value:.4,unit:"proportion"}),/No uncertainty interval is displayed/);
});

test("descriptive IQR remains separate from statistical confidence interval",()=>{
 const g=metricGeometry(7,"hours/person/year",6.999999,7.000001);
 assert.equal(g.narrowInterval,true);
 const aria=metricAriaDescription({label:"Typical range",value:7,unit:"hours/person/year",
 low:6.999999,high:7.000001,intervalStyle:"range",narrowInterval:true});
 assert.match(aria,/descriptive interquartile range \(not a confidence interval\)/);
 assert.match(aria,/6\.999999 hours\/person\/year to 7\.000001 hours\/person\/year/);
 const precise=metricAriaDescription({label:"Reviewed",value:7,unit:"hours/person/year",
 low:6.9,high:7.1,intervalStyle:"range",intervalLabel:"Interquartile range (25th–75th percentile; not a confidence interval)"});
 assert.match(precise,/25th–75th percentile; not a confidence interval/);
});
