# Community Pulse worker and delivery contract v0.2.1

This contract extends the v0.2 exploratory research envelope. The new `research_report` form supports full internal research reports. The legacy proposal adapter remains an explicit opt-in conversion with trusted caller-provided run metadata. Agent reports contain no approved evidence, publication flags, geographic-code authority, or scenario edits.

| Field | Contract |
|---|---|
| `schema_version` and `kind` | `0.2.1` and `research_report` |
| `run_id` | Stable logical run identifier. Keep it on retry. Use a distinct one for each new native assignment. |
| `report_type` | `hourly_scout`, `daily_synthesis`, `weekly_strategic_review`, or `on_demand` |
| `status` | `completed` requires at least one item. `no_change` and `failed` require empty items. `partial` and `failed` require a reason code. |
| `title`, `items[]`, `reason_codes[]` | Each item has `kind`, `title`, `text` and `sources[]`. A source is an inert HTTPS lead with `url`, `publisher` and optional `locator`. Claims and numeric statements require human verification before any editorial use. |

Item kinds are `source_grounded_development`, `cross_source_synthesis`, `planning_implication`, `open_question`, `verification_needed`, `strategic_hypothesis`, `source_nomination`, and `funding_opportunity`. Source leads on a reported development are a discovery requirement. They do not establish independent support. The Lane A extraction envelope separately carries document-local evidence anchors. The approved snapshot has stable record revisions, evidence IDs, coverage, reviewed interpretations, and tombstones.

## Input forms

The smallest no-change JSON and its plain text equivalent are in [synthetic fixtures](../../packages/community-pulse/test/fixtures/). The [synthetic research example](../../packages/community-pulse/src/fixtures/research-report.json) and [approved snapshot example](../../packages/community-pulse/src/fixtures/approved-snapshot.json) show separate records. For email, choose a single JSON body, a fenced JSON block in text, an inline or attached application/json MIME part, or labeled plain text. HTML alternatives are ignored and unsupported MIME parts are quarantined. Markdown file import supports either the exact fenced JSON or the labeled text form.

```text
Community Pulse Research Report v0.2.1
Run-ID: sample-20261125-hour-12Z
Report-Type: hourly_scout
Status: completed
Title: Illustrative access change
--
Item-Type: source_grounded_development
Title: Planned change to clinic hours
Source: https://example.invalid/notice | Fixture Issuer | Section 2
Text:
The issuer reported planned changes to its hours.
```

Add repeated `Reason-Code: code_here` lines after the report title when the outcome requires them. Use the two-hyphen separator between items and repeat the item block. The intake parser rejects duplicate JSON keys, excessive depth and unknown fields. Email delivery authentication is passed by a verified receiver outside MIME, and the trusted clock creates the intake timestamp. An agent-supplied outcome describes its claimed run result. The receipt disposition describes what the project actually accepted, deduplicated or quarantined.

The prototype is local/offline. It has no vendor integration, live recurring jobs, or candidate publication API. For setup and release boundaries see the [Phase F addendum](PHASE_F.md).

For native Instinct email bodies and legacy conversion behavior, see the [complete v0.2.1 research report contract](INSTINCT_AGENT_CONTRACT_v0.2.1.md). For staging ownership, sender authentication, and deployment qualification, see the [Phase S0 runbook](PHASE_S0.md).
