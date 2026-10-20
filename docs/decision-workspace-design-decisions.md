# Decision Workspace Visuals — Accepted Product Decisions

Status: accepted product defaults for PR #11 and follow-up implementation.

## Decisions accepted on 24 September 2026

### County map

When independently reviewed county-level local-context data become available, the first default map layer should be **ACS transportation/access context, starting with households with no vehicle available**, because it is directly interpretable as an implementation constraint.

Map rules:
- show one reviewed contextual layer at a time;
- county selection informs implementation planning only;
- never imply county Long COVID prevalence, county Long COVID cost, or individual vulnerability;
- do not introduce a composite need/risk/vulnerability score;
- keep an accessible table equivalent;
- HRSA shortage layers may be added only with reviewed county aggregation/semantics.

Current dependency: the reviewed West Virginia local-context artifact is state-level only. Do not implement the county map until a county-level candidate clears independent review and promotion.

### Analyst-created data requests

Session-created operational data requests **start included in the Planning Brief** (and can be deselected). Creation is an analyst action; inclusion is a separate reversible checkbox, initially checked for new requests.

Creating a request:
- does not make it observed evidence;
- starts included in the Brief, can be deselected at any time, and stale requests remain excluded from export until refreshed;
- may originate from a sensitivity finding or later from an unsupported claim/gap;
- must preserve target question, pathway step, fields needed, likely owner, granularity/time window, rationale, and feasibility/privacy notes.

The **Include in Planning Brief** checkbox remains visible so the analyst can exclude any request before export.

### Claim Tester

The first Claim Tester release should use **curated claim templates**, not unrestricted free text.

Reason:
- the evidence ledger and deterministic applicability gate should define what dimensions are tested;
- templates make population, outcome, geography, payer, pathway step, mechanism, and intended use explicit;
- free text can be reconsidered after reviewed evidence coverage and evaluation are strong enough.

Current dependency: the reviewed runtime intervention-effect evidence ledger is empty. Do not present a claim as evaluated until reviewed evidence records exist.

### Burden → constraint → mechanism → measurement trace

Only **explicitly selected local-context records** may enter the trace.

The trace should eventually show:
1. released observed burden;
2. analyst-selected reviewed local constraint;
3. target pathway step;
4. planning mechanism;
5. measurement/data request needed;
6. strongest supported claim boundary, when reviewed evidence exists.

Current dependency: PR #10 implements explicit Local Context → Planning Brief selection, but Local Context → Pilot handoff remains a separate product interaction. Do not infer a constraint merely because it is present in the local-context artifact.

### Scenario comparison

Keep this deferred until the application has an explicit scenario save/version/restore contract. Comparison should be limited to 2–3 analyst-saved scenarios and remain descriptive; do not rank or declare a “best” scenario.

## General admission rule

A visualization or interaction should ship only when it can answer:
1. What decision does it change?
2. What reviewed evidence or explicit assumption powers it?
3. What user action follows?
4. Where does the output go next?
5. Would removing it make the planning workflow meaningfully harder?

If those questions cannot be answered, do not add the feature merely for dashboard density.
