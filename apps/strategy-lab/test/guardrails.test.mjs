import test from "node:test";
import assert from "node:assert/strict";
import {sourceCounts, terrain, investigations, moves, counselQuestions, calculateCapacity} from "../data.js";

test("README evidence layer counts are separate roles, not a local extrapolation", ()=>{
  assert.deepEqual(sourceCounts, {nationalEstimates:21,localIndicators:34,typicalRanges:2});
  assert.equal(terrain.length,4);
  assert.equal(investigations.length,3);
  assert.equal(moves.length,3);
  assert.equal(counselQuestions.length,4);
});
test("default arithmetic is deterministic and never a measured outcome",()=>{
  const r=calculateCapacity();
  assert.equal(r.participants,48);
  assert.equal(r.monthlySlots,48);
  assert.equal(r.slotMonths,288);
  assert.equal(r.availableSlotMonths,480);
  assert.equal(r.utilization,60);
  assert.equal(r.feasible,true);
  for(const claim of ["savings","patientsImproved","clinicalEffect","localPrevalence","costReduction"]){
    assert.equal(Object.hasOwn(r,claim),false);
  }
});
test("zero capacity and nonzero load is explicitly undefined, not a false percentage",()=>{
  const r=calculateCapacity({capacity:0,selected:["navigation"],reach:100});
  assert.equal(r.monthlySlots,120);
  assert.equal(r.utilization,null);
  assert.equal(r.feasible,false);
  assert.equal(r.overload,120);
});
test("no selected moves requires zero service slots",()=>{
  const r=calculateCapacity({capacity:0,selected:[],reach:100});
  assert.equal(r.monthlySlots,0);
  assert.equal(r.utilization,0);
  assert.equal(r.feasible,true);
});
test("invalid selection is ignored and duplicate moves do not double-count",()=>{
  const r=calculateCapacity({selected:["navigation","navigation","fictional"],reach:40});
  assert.deepEqual(r.selected,["navigation"]);
  assert.equal(r.monthlySlots,48);
});
test("scenario controls are bounded and zero reach has zero demand",()=>{
  const r=calculateCapacity({eligible:-5,reach:-10,months:0,capacity:-100,selected:["education"]});
  assert.equal(r.participants,0);
  assert.equal(r.months,1);
  assert.equal(r.capacity,0);
  assert.equal(r.monthlySlots,0);
  assert.equal(r.feasible,true);
  const capped=calculateCapacity({eligible:1e8,reach:1000,months:999,capacity:999999,selected:["navigation"]});
  assert.equal(capped.eligible,10000);
  assert.equal(capped.reach,100);
  assert.equal(capped.months,24);
  assert.equal(capped.capacity,10000);
});
test("explanatory content does not attribute positive clinical or financial effects",()=>{
  for(const item of moves){
    assert.match(item.requires,/./);
    assert.match(item.tradeoff,/./);
    assert.match(item.test,/./);
    assert.ok(item.load>=0);
  }
  for(const item of investigations){
    assert.match(item.evidence,/./);
    assert.match(item.assumption,/./);
    assert.match(item.gap,/./);
    assert.match(item.counter,/./);
  }
});
