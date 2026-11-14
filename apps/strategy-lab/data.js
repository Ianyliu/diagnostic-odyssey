/**
 * Strategy Lab uses illustrative examples only. No local outcomes, intervention effects
 * or individual patient data are inferred from these objects.
 * Source counts are taken from the public repository README, not a live API.
 */
export const sourceCounts = Object.freeze({
  nationalEstimates: 21,
  localIndicators: 34,
  typicalRanges: 2
});

export const terrain = Object.freeze([
  {id:"recognition",title:"Recognition friction",subtitle:"Finding a route into care",question:"Where does a patient first lose time?",insight:"Recognition is a planning hypothesis, not a measured local delay.",facts:["Reviewed national estimates describe burden, not county-specific recognition times.","A local intake audit would be needed to quantify delay."],next:"Request aggregate time-from-symptom-to-recognition data."},
  {id:"access",title:"Geographic access",subtitle:"Distance, availability and reach",question:"Where is care feasible to reach?",insight:"HRSA and ACS indicators provide contextual signals, not a measured care-access effect.",facts:["Availability and distance can affect implementation.","A geography-specific referral and travel inventory is still missing."],next:"Map referral destinations and estimated travel bands, with definitions."},
  {id:"capacity",title:"Service capacity",subtitle:"Staffing and follow-up",question:"How much can a pilot realistically absorb?",insight:"Current staffing and throughput are not established by the national burden estimates.",facts:["Any scenario capacity is an explicit user assumption.","No operating throughput is inferred from public context indicators."],next:"Request provider capacity and intake throughput by service setting."},
  {id:"continuity",title:"Continuity of care",subtitle:"Handoffs after recognition",question:"What happens after the first visit?",insight:"Referral completion is an unresolved implementation question.",facts:["Follow-up gaps can be investigated with de-identified operational data.","A planning brief must not convert assumed follow-up into observed success."],next:"Request aggregate referral completion and follow-up counts."}
]);

export const investigations = Object.freeze([
  {id:"recognition",number:"01",title:"Recognition to referral",kicker:"Investigating the first handoff",summary:"Could navigation support help patients and clinicians locate a defined next step?",evidence:"The reviewed national evidence documents burden. It does not identify the causal effect of navigation or a West Virginia diagnostic delay.",assumption:"A navigation pilot would serve a bounded eligible cohort using a defined intake pathway.",gap:"Locally observed recognition delays, referral routes, staffing and eligible volume are not established here.",question:"Would measured local intake patterns still favor navigation over clinician training?",next:"Define referral entry criteria; request aggregated baseline intake-to-referral times.",counter:"A referral bottleneck may occur after recognition, so adding navigation without capacity might merely relocate delays."},
  {id:"capacity",number:"02",title:"Capacity before coverage",kicker:"Stress-test the operating model",summary:"Does the program have enough staffed follow-up slots for the proposed reach?",evidence:"Reviewed WV context indicators describe service environment, not actual pilot-ready appointment slots.",assumption:"Staffed slots, eligible cohort, recognition window and reach can be varied for a transparent arithmetic stress test.",gap:"Actual appointment availability, visit intensity and partner commitments remain unverified.",question:"What measured capacity would make a broader rollout feasible?",next:"Request staffing, service slots and completion records by proposed service.",counter:"High apparent demand should not be interpreted as the number of patients who would enroll."},
  {id:"equity",number:"03",title:"Access without extrapolation",kicker:"Context is not a multiplier",summary:"How can rural context guide site selection without treating it as a causal effect?",evidence:"The 34 reviewed HRSA and ACS state-level indicators are a separate descriptive layer from national estimates.",assumption:"Travel burden and rural access will matter to implementation, but are not quantified as effects in this experiment.",gap:"County-level service footprints, subgroup eligibility and travel-to-site data need separate acquisition and review.",question:"Would a site-level referral inventory overturn our initial prioritization?",next:"Build an explicit data request before recommending a location.",counter:"National burden should not be rescaled by state context and presented as a local prevalence estimate."}
]);

export const moves = Object.freeze([
  {id:"navigation",title:"Navigation intake pilot",eyebrow:"Move 01",summary:"Test a bounded, clearly defined path from first contact to an appropriate service.",scope:"Narrow referral cohort",load:1,phase:"Explore",effort:2,coverage:4,requires:"An agreed eligible cohort, navigator staffing, intake protocol and baseline handoff data.",tradeoff:"Improves process visibility but may increase downstream referral demand.",test:"Time from eligible contact to documented next step"},
  {id:"education",title:"Provider education sprint",eyebrow:"Move 02",summary:"Explore whether a clinician-facing workflow and referral guide can reduce ambiguity.",scope:"Defined clinician network",load:.65,phase:"Explore",effort:2.5,coverage:3,requires:"Training participants, protocol review, a measurable process endpoint and evaluation design.",tradeoff:"Lower direct intake demands, but adoption cannot be assumed.",test:"Documented use of the agreed referral pathway"},
  {id:"followup",title:"Follow-up capacity audit",eyebrow:"Move 03",summary:"Measure service availability and completion before scaling a patient-facing program.",scope:"Partner service sites",load:.35,phase:"Investigate",effort:1,coverage:2,requires:"Partner approval, operational data dictionary and aggregate slot availability.",tradeoff:"Smaller immediate reach, but reduces uncertainty before commitment.",test:"Verified staffed slots and referral completion baseline"}
]);

export const counselQuestions = Object.freeze([
  {id:"opposition",title:"Argue the other side",answer:"The current material supports investigating where friction may occur; it does not support a claim that any proposed pilot reduces costs, improves outcomes, or shortens diagnostic delay. A capacity-first audit may be more defensible than an immediate rollout."},
  {id:"reverse",title:"What would change your mind?",answer:"Locally measured referral bottlenecks, an agreed denominator, verified staffed slots, and a prespecified process outcome could change which pilot is most sensible. An observed shortage of follow-up slots would argue for capacity work first."},
  {id:"sourcing",title:"What evidence is missing?",answer:"The missing inputs are local operational baselines: referrals, appointment capacity, eligible intake, follow-up completion, travel footprint and partner resources. These need independent permission, definitions, review, and uncertainty assessment."},
  {id:"boundaries",title:"Can these scenarios predict health benefit?",answer:"No. The War Room uses hypothetical arithmetic for staff-load feasibility only. Reach and slot calculations are not intervention-effect estimates, patient outcomes, costs saved or projections of clinical benefit."}
]);

const clip = (value, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
};

/**
 * Pure planning arithmetic. NOT an efficacy, cost or risk predictor.
 * All values are explicitly hypothetical and remain in a demo-only namespace.
 */
export function calculateCapacity({eligible=120,reach=40,months=6,capacity=80,selected=["navigation"]}={}){
  const e=clip(eligible,0,10000);
  const r=clip(reach,0,100);
  const m=clip(months,1,24);
  const c=clip(capacity,0,10000);
  const unique=[...new Set(selected)].filter(id=>moves.some(move=>move.id===id));
  const participants=Math.round(e*r/100);
  const loadFactor=unique.reduce((sum,id)=>sum+moves.find(move=>move.id===id).load,0);
  const monthlySlots=Math.round(participants*loadFactor*10)/10;
  const slotMonths=Math.round(monthlySlots*m);
  const availableSlotMonths=Math.round(c*m);
  const overload=Math.max(0,monthlySlots-c);
  const utilization=c===0?(monthlySlots>0?Infinity:0):monthlySlots/c*100;
  return {participants,monthlySlots,slotMonths,availableSlotMonths,overload,utilization,loadFactor,selected:unique,months:m,capacity:c,reach:r,eligible:e,feasible:monthlySlots<=c};
}
