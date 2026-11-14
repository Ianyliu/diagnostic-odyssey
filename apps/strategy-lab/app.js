import {sourceCounts,terrain,investigations,moves,counselQuestions,calculateCapacity} from "./data.js";
(function strategyLab(){
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const escapeHTML=(s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const W=$("#workspace"), dialog=$("#counselDialog");
  const validPages=["brief","terrain","investigations","moves","war-room","record"];
  const names={"brief":"Brief","terrain":"Terrain","investigations":"Investigations","moves":"Moves","war-room":"War Room","record":"Decision record"};
  const state={page:"brief",terrain:"recognition",investigation:"recognition",selected:new Set(["navigation"]),reach:40,months:6,capacity:80,notes:"",entries:[],recommendation:"Uncommitted — exploratory only",counsel:"opposition"};
  function pageLink(page,label,extra=""){return `<a class="button ${extra}" href="#${page}">${label} <span aria-hidden="true">↗</span></a>`}
  const pill=(title,type="blue")=>`<span class="status-pill ${type}">${escapeHTML(title)}</span>`;
  const counts=()=>`<div class="stat-grid">
    <div class="stat-card"><div class="micro-label">REVIEWED NATIONAL ESTIMATES</div><strong>${sourceCounts.nationalEstimates}</strong><small>MEPS Long COVID · descriptive evidence</small></div>
    <div class="stat-card"><div class="micro-label">REVIEWED WV INDICATORS</div><strong>${sourceCounts.localIndicators}</strong><small>HRSA + ACS · contextual evidence</small></div>
    <div class="stat-card"><div class="micro-label">TYPICAL RANGES</div><strong>${sourceCounts.typicalRanges}</strong><small>Descriptive only · not pilot effects</small></div>
  </div>`;
  function flowDiagram(){
    const ribbons=[
      {d:"M193 66 C272 66 263 90 347 90 L347 114 C266 114 265 93 193 93 Z",c:"#5aa78a",title:"National burden supports a burden-framing question"},
      {d:"M193 92 C266 92 279 242 347 242 L347 262 C275 262 260 113 193 113 Z",c:"#5aa78a",title:"National estimates also inform unanswered eligibility questions"},
      {d:"M193 177 C268 177 269 137 347 137 L347 163 C269 163 264 202 193 202 Z",c:"#5c82aa",title:"Local context informs access investigation, not prevalence scaling"},
      {d:"M193 205 C267 205 271 263 347 263 L347 282 C275 282 269 225 193 225 Z",c:"#5c82aa",title:"Local data also exposes implementation gaps"},
      {d:"M193 287 C269 287 267 164 347 164 L347 183 C271 183 265 312 193 312 Z",c:"#d8a855",title:"Explicit assumptions enter a separate scenario layer"},
      {d:"M527 111 C617 111 620 155 717 155 L717 186 C615 186 619 147 527 147 Z",c:"#5aa78a",title:"Questions lead to a traceable brief"},
      {d:"M527 254 C619 254 625 183 717 183 L717 216 C625 216 615 294 527 294 Z",c:"#d8a855",title:"Bounded scenario choices are represented as assumptions"}
    ];
    const node=(x,y,w,h,title,subtitle,c)=>`<rect class="node-box" x="${x}" y="${y}" rx="12" width="${w}" height="${h}"/><rect x="${x+12}" y="${y+14}" width="4" height="${h-28}" rx="2" fill="${c}"/><text class="node-title" x="${x+24}" y="${y+30}">${title}</text><text class="node-sub" x="${x+24}" y="${y+48}">${subtitle}</text>`;
    return `<div class="flow-scroll"><svg class="flow-svg" viewBox="0 0 920 362" role="img" aria-label="Schematic flow: national evidence, local context and explicit assumptions inform investigations and bounded scenarios, which feed a planning brief. Ribbon widths are illustrative and not numeric quantities.">
      <text class="node-caption" x="16" y="22">INPUTS / DISTINCT ROLES</text><text class="node-caption" x="348" y="22">REASONING / CHECKS</text><text class="node-caption" x="719" y="22">OUTPUT / HANDOFF</text>
      ${ribbons.map(r=>`<path class="flow-band" d="${r.d}" fill="${r.c}"><title>${r.title}</title></path>`).join("")}
      ${node(12,49,181,68,"National evidence","burden · not local rates","#5aa78a")}
      ${node(12,160,181,68,"Local context","HRSA + ACS indicators","#5c82aa")}
      ${node(12,270,181,68,"Assumptions","reach · capacity · time","#d8a855")}
      ${node(347,79,180,108,"Investigations","evidence / gap / counter","#5aa78a")}
      ${node(347,235,180,65,"Scenario tests","transparent arithmetic","#d8a855")}
      ${node(717,146,189,91,"Action-ready brief","with unresolved requests","#5aa78a")}
    </svg></div><p class="fig-note">Conceptual Sankey-style map, <strong>not proportional data</strong>. Ribbon widths do not represent patients, dollars, causal effects, or quantitative transfers. Distinct evidence roles remain separate.</p>`;
  }
  function header(eyebrow,title,lede,actions=""){return `<div class="page-header"><div><div class="page-eyebrow">${eyebrow}</div><h1>${title}</h1><p class="lede">${lede}</p></div>${actions?`<div class="heading-actions">${actions}</div>`:""}</div>`}
  function guidance(){return `<div class="callout"><strong>Scientific boundary</strong><p>The interface is an illustrative design lab. Reviewed national burden, WV context, and planning assumptions are separate. Nothing here predicts clinical effectiveness, cost savings, or local disease prevalence.</p></div>`}
  function renderBrief(){
    W.innerHTML=`<div class="page-eyebrow">STRATEGIC BRIEF / 01 · WEST VIRGINIA CONCEPT</div>
      <section class="hero">
      <div class="hero-left"><div class="hero-index">A question worth answering</div><h1 class="headline">The burden is visible.<br><em>The next move</em> is a choice.</h1>
        <p class="summary">Diagnostic Odyssey brings reviewed evidence into a planning conversation. This concept takes the next step: investigate a bottleneck, compare a bounded pilot, and record what would change the decision.</p>
        <div class="hero-actions">${pageLink("investigations","Begin an investigation","primary")}${pageLink("terrain","Explore the terrain")}</div>
      </div>
      <aside class="counsel-card"><span class="micro-label">✦ COUNSEL'S FIRST QUESTION</span><h2>What would we need to know before recommending a pilot?</h2><p>Do not turn national burden into a local count. Start with capacity, referral routes and missing operational baselines. A defensible question comes before an intervention.</p><div class="counsel-footer"><button data-counsel="reverse" type="button">Ask what could change our mind <span aria-hidden="true">↗</span></button></div></aside></section>
      ${counts()}
      <section class="dashboard-grid">
      <div class="panel"><div class="panel-header"><div><h2>From data to action</h2><p>Follow the reasoning, not just the numbers</p></div>${pill("SCHEMATIC")}</div>${flowDiagram()}</div>
      <div class="panel"><div class="panel-header"><div><h2>The questions on the table</h2><p>Prioritize what could materially change a plan</p></div></div>
        <div class="signal-list">${investigations.map((d,i)=>`<button type="button" class="signal" data-investigation="${d.id}"><span class="signal-number">${d.number}</span><span><strong>${d.title}</strong><p>${d.question}</p></span><span aria-hidden="true">↗</span></button>`).join("")}</div>
        <div class="margin-top">${pageLink("war-room","Open the strategy board","soft")}</div></div></section>
      <div class="margin-top">${guidance()}</div>`;
  }
  function terrainDetail(){
    const item=terrain.find(x=>x.id===state.terrain)||terrain[0];
    return `<div class="terrain-detail"><span class="micro-label">SELECTED PLANNING TERRAIN</span><h2>${item.title}</h2><p>${item.insight}</p><div class="detail-answer"><strong>Key question</strong><div>${item.question}</div></div><ul>${item.facts.map(s=>`<li>${s}</li>`).join("")}</ul><span class="micro-label">NEXT DATA REQUEST</span><p>${item.next}</p><button class="button soft" data-investigation="${item.id==="access"?"equity":item.id==="continuity"?"recognition":item.id}" type="button">Open related investigation ↗</button></div>`;
  }
  function renderTerrain(){
    W.innerHTML=`${header("TERRAIN / 02","See the constraints, not just the magnitude.","Explore where a service-planning hypothesis meets geography, recognition, capacity and continuity. These tiles are conceptual categories, not measured region-level scores.",pageLink("investigations","Investigate a gap","primary"))}
      <section class="terrain-layout"><div class="panel"><div class="panel-header"><div><h2>The planning terrain</h2><p>Select a question to inspect its evidence boundary</p></div>${pill("QUALITATIVE MAP")}</div>
        <div class="terrain-field"><svg class="terrain-contours" viewBox="0 0 630 400" preserveAspectRatio="none" aria-hidden="true"><path d="M-60 212 C70 85 165 360 301 188 S499 -21 671 175" fill="none" stroke="#81ae998a" stroke-width="2"/><path d="M-60 246 C70 119 175 383 319 214 S513 6 671 213" fill="none" stroke="#81ae9966" stroke-width="1.5"/><path d="M-60 182 C70 55 168 334 284 166 S491 -57 671 139" fill="none" stroke="#81ae9955" stroke-width="1.5"/><path d="M-60 277 C74 160 172 406 339 241 S531 32 671 245" fill="none" stroke="#81ae9955" stroke-width="1.5"/></svg>
        <div class="terrain-tiles">${terrain.map((d,i)=>`<button class="terrain-tile ${state.terrain===d.id?"selected":""}" data-terrain="${d.id}" type="button" aria-pressed="${state.terrain===d.id}"><span class="tile-index">0${i+1} / PLANNING QUESTION</span><strong>${d.title}</strong><small>${d.subtitle}</small></button>`).join("")}</div></div><p class="fig-note">The contour field is decorative. No geographic location, density, probability or burden is encoded.</p></div>
      <div class="panel" id="terrainDetail">${terrainDetail()}</div></section>
      <section class="panel margin-top"><div class="panel-header"><div><h2>How evidence becomes a question</h2><p>The distinct streams deliberately do not merge into a numerical local estimate</p></div>${pill("SOURCE ROLES","blue")}</div>${flowDiagram()}</section>
      <section class="panel margin-top"><div class="panel-header"><div><h2>Evidence inventory</h2><p>Counts from the repository README; individual source tables are not reproduced in this design experiment</p></div></div>${counts()}<p class="small muted">Read the actual source definitions and release limitations before making any scientific claim. <a href="https://github.com/Ianyliu/diagnostic-odyssey#scientific-guardrails" target="_blank" rel="noopener noreferrer">Scientific guardrails ↗</a></p></section>`;
  }
  function detailedInvestigation(){
    const d=investigations.find(x=>x.id===state.investigation)||investigations[0];
    return `<section class="panel margin-top"><div class="panel-header"><div><span class="page-eyebrow">${d.kicker.toUpperCase()}</span><h2 class="section-heading">${d.title}</h2><p>${d.summary}</p></div>${pill("OPEN QUESTION","gold")}</div>
      <div class="triad"><div class="triad-item evidence"><div class="micro-label">01 / EVIDENCE</div><p>${d.evidence}</p></div><div class="triad-item assumption"><div class="micro-label">02 / ASSUMPTION</div><p>${d.assumption}</p></div><div class="triad-item gap"><div class="micro-label">03 / DATA GAP</div><p>${d.gap}</p></div></div>
      <div class="split-grid margin-top"><div><span class="micro-label">WHAT COULD CHANGE THE DECISION?</span><div class="quote-panel margin-top">“${d.question}”</div><p class="small muted">Critical challenge: ${d.counter}</p></div>
      <div class="panel tight" style="background:var(--wash)"><span class="micro-label">PROPOSED ANALYST REQUEST</span><h3>${d.next}</h3><p class="small muted">This is a suggested request, not an already acquired or authorized dataset.</p><button class="button primary" type="button" data-record="Request: ${escapeHTML(d.next)}">Add to decision record</button></div></div></section>`;
  }
  function renderInvestigations(){
    W.innerHTML=`${header("INVESTIGATIONS / 03","Open the dossier. Challenge the thesis.","Make every proposed direction explain its evidence, assumptions, unresolved data requests and a plausible counterargument.",pageLink("moves","Compare possible moves","primary"))}
      <div class="dossier-list">${investigations.map(d=>`<article class="dossier ${state.investigation===d.id?"selected":""}"><div class="micro-label">DOSSIER ${d.number} · DEMO</div><h3>${d.title}</h3><p>${d.summary}</p>${pill("NOT YET A FINDING","gold")}<button class="button ${state.investigation===d.id?"soft":""}" type="button" data-investigation="${d.id}">${state.investigation===d.id?"Dossier open":"Examine dossier"} ↗</button></article>`).join("")}</div>${detailedInvestigation()}
      <div class="margin-top">${guidance()}</div>`;
  }
  function renderMoves(){
    W.innerHTML=`${header("MOVES / 04","Three hypotheses. None is a promise.","These are candidate service-planning experiments, not evidence-backed intervention effects. Compare implementation conditions and choose which to examine in the War Room.",pageLink("war-room","Stress-test a plan","primary"))}
      <section class="panel"><div class="panel-header"><div><h2>Possible moves</h2><p>Up to three planning hypotheses can be tested together</p></div>${pill(state.selected.size+" SELECTED")}</div>
      <div class="move-cards">${moves.map(m=>`<article class="move-card ${state.selected.has(m.id)?"selected":""}"><span class="micro-label">${m.eyebrow.toUpperCase()}</span><h3>${m.title}</h3><p>${m.summary}</p><div class="small muted">Proposed scope · ${m.scope}</div><button type="button" class="button ${state.selected.has(m.id)?"soft":""}" data-move="${m.id}" aria-pressed="${state.selected.has(m.id)}">${state.selected.has(m.id)?"✓ In working plan":"+ Add to working plan"}</button></article>`).join("")}</div></section>
      <section class="panel margin-top"><div class="panel-header"><div><h2>Comparison table</h2><p>Qualitative trade-offs · no fabricated ROI or cost-effectiveness rankings</p></div></div>
        <table class="move-table"><thead><tr><th>Hypothesis</th><th>Delivery requirement</th><th>Trade-off</th><th>State</th></tr></thead><tbody>${moves.map(m=>`<tr><td><strong>${m.title}</strong><small>Process measure: ${m.test}</small></td><td>${m.requires}</td><td>${m.tradeoff}</td><td><span class="tag">${m.phase}</span></td></tr>`).join("")}</tbody></table></section>
      <div class="split-grid margin-top"><section class="panel"><div class="panel-header"><div><h2>What would count as success?</h2><p>Agree an observable process endpoint before implementation</p></div></div><div class="compact-list">${moves.map((m,i)=>`<div class="list-item"><span class="round-mark">${i+1}</span><div><h3>${m.title}</h3><p>${m.test}. Requires a baseline, denominator and prespecified measurement window.</p></div></div>`).join("")}</div></section>
      <section class="panel"><div class="panel-header"><div><h2>Counsel's caution</h2><p>Why the first attractive idea may not be the right first move</p></div></div><div class="quote-panel">“Which missing observation could make this plan the wrong plan?”</div><p class="intro-line">Start with auditable data requests. Observe results before attributing any changes to an intervention.</p><button type="button" class="button soft" data-counsel="opposition">Ask for the counterargument ↗</button></section></div>`;
  }
  const boardPositions={navigation:{x:23,y:28},education:{x:56,y:49},followup:{x:75,y:72}};
  function board(){
    return `<div class="board" role="group" aria-label="Select proposed planning moves. The decorative board is not a measured risk-benefit plot."><span class="board-topline">PLANNING BOARD · HYPOTHETICAL PLACEMENTS</span><div class="board-pieces">${moves.map(m=>`<button type="button" class="piece ${state.selected.has(m.id)?"":"off"}" style="left:${boardPositions[m.id].x}%;top:${boardPositions[m.id].y}%" data-move="${m.id}" aria-label="${state.selected.has(m.id)?"Remove":"Include"} ${m.title}" aria-pressed="${state.selected.has(m.id)}"><span class="piece-label">${m.title.replace(" pilot","").replace(" sprint","").replace(" audit","")}</span></button>`).join("")}</div></div><p class="fig-note">A Go-board-inspired selection surface. Positions are illustrative; stone location and size have no numerical or causal interpretation.</p>`;
  }
  function warSummary(){
    const r=calculateCapacity({eligible:120,reach:state.reach,months:state.months,capacity:state.capacity,selected:[...state.selected]});
    const pct=Number.isFinite(r.utilization)?Math.round(r.utilization):null;
    const saturated=r.monthlySlots>r.capacity;
    return `<div class="workbench-output"><span class="micro-label">HYPOTHETICAL LOAD / MONTH</span><div class="big-number">${r.monthlySlots.toLocaleString(undefined,{maximumFractionDigits:1})}</div><p>Illustrative service slots/month required by the currently selected moves. Not an observed measure or forecast of patient outcomes.</p>
      <div class="dark-divider"></div><div class="mini-kv"><span>Eligible example cohort</span><b>${r.eligible} people</b></div><div class="mini-kv"><span>Hypothetical participants</span><b>${r.participants}</b></div><div class="mini-kv"><span>Slots available/month (assumed)</span><b>${r.capacity}</b></div><div class="mini-kv"><span>Total slot-months (${r.months} mo)</span><b>${r.slotMonths}</b></div><div class="mini-kv"><span>Selected move count</span><b>${r.selected.length}</b></div>
      <div class="dark-divider"></div><strong style="font-size:13px">${saturated?"Assumed capacity is exceeded":"Within the assumed capacity"}</strong><p>${saturated?`Approximately ${r.overload.toFixed(1)} additional slots/month would be required under these example parameters.`:"This is only a feasibility arithmetic check; implementation resources and actual eligibility are unverified."}</p>
      <div class="bar-track" aria-label="${pct===null?"Undefined utilization":pct+" percent assumed capacity utilization"}"><div class="bar-fill ${saturated?"warn":""}" style="width:${Math.min(100,pct??100)}%"></div></div><p style="font-size:10px">${pct===null?"No capacity assumed":pct+"% of assumed monthly capacity"}</p></div>`;
  }
  function renderWarRoom(){
    W.innerHTML=`${header("WAR ROOM / 05","Turn possibilities into a bounded test.","Select strategies on the board. Adjust reach and staff capacity to see transparent planning arithmetic; this does not model clinical improvement, savings or observed service utilization.",pageLink("record","Open decision record","primary"))}
      <section class="board-wrap"><div class="panel"><div class="panel-header"><div><h2>The strategy board</h2><p>Tap a stone to include or remove a proposed move</p></div>${pill("INTERACTIVE CONCEPT","blue")}</div>${board()}</div><div class="panel"><div class="panel-header"><div><h2>Selected planning moves</h2><p>Choices apply to the arithmetic model below</p></div></div><div class="compact-list">${moves.map(m=>`<div class="list-item"><span class="round-mark">${state.selected.has(m.id)?"✓":"+"}</span><div><h3>${m.title}</h3><p>${m.test}</p><button class="button ${state.selected.has(m.id)?"soft":""}" data-move="${m.id}" type="button" style="margin-top:8px">${state.selected.has(m.id)?"Remove from plan":"Include in plan"}</button></div></div>`).join("")}</div></div></section>
      <section class="workbench margin-top"><div class="panel"><div class="panel-header"><div><h2>Sand Table · resource assumptions</h2><p>Explicit hypothetical parameters; example cohort fixed at 120 people</p></div>${pill("ASSUMPTIONS","gold")}</div>
      <div class="controls">
      <div class="control-row"><label for="reach">Planning reach <small>Share of the hypothetical eligible cohort</small></label><output id="reachOut">${state.reach}%</output><input id="reach" name="reach" type="range" min="0" max="100" step="5" value="${state.reach}"></div>
      <div class="control-row"><label for="months">Recognition / follow-up window <small>Months of illustrative service support</small></label><output id="monthsOut">${state.months} mo</output><input id="months" name="months" type="range" min="1" max="12" step="1" value="${state.months}"></div>
      <div class="control-row"><label for="capacity">Available service slots <small>Assumed monthly operating capacity</small></label><output id="capacityOut">${state.capacity}</output><input id="capacity" name="capacity" type="range" min="0" max="160" step="10" value="${state.capacity}"></div>
      </div><div class="margin-top">${guidance()}</div>
      <div class="record-actions"><button type="button" class="button primary" data-save-plan="true">Record this working scenario</button><button type="button" class="button" data-reset-plan="true">Reset assumptions</button></div></div>
      <div id="warSummary">${warSummary()}</div></section>`;
  }
  function renderRecord(){
    const r=calculateCapacity({eligible:120,reach:state.reach,months:state.months,capacity:state.capacity,selected:[...state.selected]});
    W.innerHTML=`${header("DECISION RECORD / 06","Keep a record of the reasoning.","A reversible notebook of choices, counterarguments and unresolved questions. Entries stay in this browser tab until refresh; they are not canonical Diagnostic Odyssey exports.",`<button type="button" class="button primary" id="exportDraft">Export demo JSON ↗</button>`)}
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>The deliberation trail</h2><p>Most recent first · non-persistent, client-only</p></div>${pill(state.entries.length+" ENTRIES")}</div>
      <div class="record-timeline">${state.entries.length?state.entries.slice().reverse().map((event)=>`<div class="record-event"><h3>${escapeHTML(event.title)}</h3><p>${escapeHTML(event.time)} · ${escapeHTML(event.detail)}</p></div>`).join(""):`<div class="record-event"><h3>No decisions committed</h3><p>This prototype starts with a default working hypothesis, not an approved plan. Save a scenario or record a data request to begin.</p></div>`}
      <div class="record-event"><h3>Design boundary</h3><p>Observed evidence, explicit planning assumptions, and open questions remain separate throughout this concept.</p></div></div>
      <div class="record-note"><label for="decisionNote">Working note (avoid personal or identifying information)</label><textarea id="decisionNote" maxlength="2000" placeholder="What question, trade-off or assumption should the team examine next?">${escapeHTML(state.notes)}</textarea></div>
      <div class="record-actions"><button class="button primary" type="button" id="saveNote">Add note to record</button><button class="button" type="button" id="clearRecord">Clear draft record</button></div></section>
      <aside class="panel"><div class="panel-header"><div><h2>Current working stance</h2><p>Unapproved exploratory concept</p></div>${pill("DRAFT","gold")}</div><div class="micro-label">PLANNING DIRECTION</div><h3 style="font:500 32px/1.18 var(--serif);margin:10px 0">${escapeHTML(state.recommendation)}</h3>
      <div class="compact-list"><div class="list-item"><span class="round-mark">1</span><div><h3>Selected hypotheses</h3><p>${state.selected.size?moves.filter(m=>state.selected.has(m.id)).map(m=>m.title).join(", "):"None"}</p></div></div>
      <div class="list-item"><span class="round-mark">2</span><div><h3>Hypothetical resource load</h3><p>${r.monthlySlots} slots per month, against assumed capacity of ${r.capacity}. Not an outcome prediction.</p></div></div>
      <div class="list-item"><span class="round-mark">3</span><div><h3>Decision blocker</h3><p>Local intake, partner capacity, measurable process outcome and cohort definition remain unverified.</p></div></div></div>
      <div class="margin-top">${pageLink("investigations","Return to open questions","soft")}</div></aside></div>
      <div class="margin-top">${guidance()}</div>`;
  }
  const pages={brief:renderBrief,terrain:renderTerrain,investigations:renderInvestigations,moves:renderMoves,"war-room":renderWarRoom,record:renderRecord};
  function render(){
    const desired=window.location.hash.slice(1);
    state.page=validPages.includes(desired)?desired:"brief";
    pages[state.page]();
    $("#currentPage").textContent=names[state.page];
    $$("#nav a").forEach(a=>{const active=a.dataset.page===state.page;a.classList.toggle("active",active);if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
    $("#rail").classList.remove("open");$("#menuToggle").setAttribute("aria-expanded","false");
    document.title=names[state.page]+" · Strategy Lab · Diagnostic Odyssey";
    window.scrollTo({top:0,behavior:"instant"});
  }
  function log(title,detail){
    state.entries.push({title,detail,time:new Date().toLocaleString()});
  }
  function toggleMove(id){if(state.selected.has(id))state.selected.delete(id);else state.selected.add(id);render()}
  function openInvestigation(id){state.investigation=investigations.some(d=>d.id===id)?id:"recognition";if(state.page!=="investigations")window.location.hash="investigations";else render()}
  function counsel(question){
    state.counsel=counselQuestions.some(q=>q.id===question)?question:"opposition";
    const content=$("#counselContent");
    content.innerHTML=`<p class="intro-line">An adversarial checklist, not live AI inference. These responses are predetermined design content.</p>
      ${counselQuestions.map(q=>`<button class="counsel-question" type="button" data-counsel="${q.id}" aria-pressed="${state.counsel===q.id}">${q.title} ${state.counsel===q.id?"✓":"↗"}</button>`).join("")}
      <div class="counsel-answer"><strong>${counselQuestions.find(q=>q.id===state.counsel).title}</strong><p>${counselQuestions.find(q=>q.id===state.counsel).answer}</p></div><p class="fig-note">Concept copy only · no API calls or conversational model behind this panel.</p>`;
    if(!dialog.open)dialog.showModal();
  }
  document.addEventListener("click",(ev)=>{
    const target=ev.target.closest("button,[data-investigation],[data-terrain]");
    if(!target)return;
    if(target.dataset.investigation){openInvestigation(target.dataset.investigation);return}
    if(target.dataset.terrain){state.terrain=target.dataset.terrain;render();return}
    if(target.dataset.move){toggleMove(target.dataset.move);return}
    if(target.dataset.counsel){counsel(target.dataset.counsel);return}
    if(target.dataset.record){log("Analyst data request",target.dataset.record);window.location.hash="record";render();return}
    if(target.dataset.savePlan){
      const r=calculateCapacity({eligible:120,reach:state.reach,months:state.months,capacity:state.capacity,selected:[...state.selected]});
      const titles=moves.filter(m=>state.selected.has(m.id)).map(m=>m.title);
      state.recommendation=titles.length?`Examine ${titles.join(" + ")}`:"No move selected";
      log("Hypothetical scenario saved",`${titles.join(", ")||"No moves"}; reach ${state.reach}%, ${state.months} months, capacity ${state.capacity} slots/month, estimated example load ${r.monthlySlots} slots/month.`);
      window.location.hash="record";render();return;
    }
    if(target.dataset.resetPlan){state.reach=40;state.months=6;state.capacity=80;state.selected=new Set(["navigation"]);render();return}
    if(target.id==="saveNote"){
      const note=$("#decisionNote").value.trim();state.notes=note;if(note)log("Working note",note);render();return;
    }
    if(target.id==="clearRecord"){state.entries=[];state.notes="";state.recommendation="Uncommitted — exploratory only";render();return}
    if(target.id==="exportDraft"){
      const r=calculateCapacity({eligible:120,reach:state.reach,months:state.months,capacity:state.capacity,selected:[...state.selected]});
      const payload={kind:"diagnostic-odyssey-strategy-lab-illustrative-draft",status:"not-reviewed-not-canonical",scientificBoundary:"No intervention effects, clinical benefit, patient outcomes, causal effect, cost saving or local prevalence are estimated.",sourceCounts,assumptions:{eligible:120,reachPercent:state.reach,months:state.months,monthlyServiceSlotCapacity:state.capacity,selectedMoveIds:[...state.selected]},illustrativeArithmetic:r,workingStance:state.recommendation,entries:state.entries,unsubmittedNote:$("#decisionNote")?.value??state.notes};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      const href=URL.createObjectURL(blob),a=document.createElement("a");a.href=href;a.download="strategy-lab-illustrative-draft.json";document.body.append(a);a.click();a.remove();URL.revokeObjectURL(href);return;
    }
  });
  W.addEventListener("input",(ev)=>{
    if(["reach","months","capacity"].includes(ev.target.id)){
      const key=ev.target.id;state[key]=Number(ev.target.value);
      const out=$("#"+key+"Out");if(out)out.textContent=state[key]+(key==="reach"?"%":key==="months"?" mo":"");
      const el=$("#warSummary");if(el)el.innerHTML=warSummary();
    }else if(ev.target.id==="decisionNote"){state.notes=ev.target.value}
  });
  $("#counselToggle").addEventListener("click",()=>counsel(state.counsel));
  $("#closeCounsel").addEventListener("click",()=>dialog.close());
  $("#themeToggle").addEventListener("click",()=>{
    document.documentElement.dataset.theme=document.documentElement.dataset.theme==="dark"?"light":"dark";
  });
  $("#menuToggle").addEventListener("click",()=>{
    const open=$("#rail").classList.toggle("open");$("#menuToggle").setAttribute("aria-expanded",String(open));
  });
  window.addEventListener("hashchange",render);
  render();
})();
