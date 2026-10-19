import assert from "node:assert/strict";
import test from "node:test";
import {formatEstimateValue, formatEstimateInterval, formatIntervalLabel, formatNativeValue} from "../src/data/formatEstimateValue.ts";
import {formatMetricTick} from "../src/data/metricFormatting.ts";
import {loadReviewedMepsArtifact} from "../src/data/reviewedArtifact.ts";
const estimates=loadReviewedMepsArtifact().burden_domains.flatMap(d=>d.measures);
function byId(id:string){const e=estimates.find(item=>item.estimate_id===id);assert.ok(e,id);return e;}
test("sub-unit rates retain discriminating point and confidence precision",()=>{
 const e=byId("meps24-hospital-discharges-mean");
 assert.equal(formatEstimateValue(e),"0.13 discharges/person/year");
 assert.equal(formatEstimateInterval(e),"95% CI 0.07–0.19 discharges/person/year");
 const er=byId("meps24-emergency-room-visits-mean");
 assert.equal(formatEstimateValue(er),"0.37 visits/person/year");
 assert.equal(formatEstimateInterval(er),"95% CI 0.28–0.45 visits/person/year");
 assert.equal(formatNativeValue(.004,"visits/person/year"),"0.004 visits/person/year");
});
test("percent confidence limits retain terminal decimal zeros",()=>{
 assert.equal(formatEstimateInterval(byId("meps24-emergency-room-visits-any")),"95% CI 19.7%–29.0%");
 assert.equal(formatEstimateValue(byId("meps24-office-based-provider-visits-any")),"81.7%");
});
test("unchanged larger point values and named confidence interval metadata",()=>{
 assert.equal(formatEstimateValue(byId("meps24-office-based-provider-visits-mean")),"12.4 visits/person/year");
 assert.equal(formatNativeValue(0,"hours/person/year"),"0 hours/person/year");
 assert.equal(formatIntervalLabel("95% t CI (Taylor linearization; df=159)"),"95% CI");
});
test("mini-charts show compound units once, and keep proportion ticks",()=>{
 assert.equal(formatMetricTick(0,"hours/person/year",false),"0");
 assert.equal(formatMetricTick(26.4,"hours/person/year",true),"26.4 hours/person/year");
 assert.equal(formatMetricTick(1,"proportion",false),"100%");
});
