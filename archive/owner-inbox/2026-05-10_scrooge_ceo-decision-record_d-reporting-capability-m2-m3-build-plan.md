---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T07:35:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN`
- **Title:** Reporting Capability M2-M3 build plan — 8-slice decomposition
- **Action:** approve
- **Source proposal:** [Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md](2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md) (PR [#149](https://github.com/marchouze/scrooge/pull/149))
- **Outcome:** Bea (Accounting & financial reporting engineer, engineering) + Atlas (Core banking platform architect, engineering)'s 8-slice Reporting Capability M2-M3 build plan **approved as drafted**. Slices 1-3 (~6 sessions) authorised for immediate build under the Targeted budget. Recommended answers to Q1-Q5 adopted in one go per the no-pause rule (Q1 rehearsal-grade with placeholders · Q2 per-entity sub-ledgers · Q3 close at M2 acceptance · Q4 climate-risk future-tranche · Q5 JSON-first). Substrate gaps in §9 acknowledged (Atlas / Anya / regulator-portal simulator / Tier-1 model-validation pipeline routes).
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "approve" — chat-intake 2026-05-10.
- **Authority chain:** Slice plan approval downstream of standing 2026-05-06 reporting-capability build authorisation (`Owner Inbox/2026-05-06_ceo-decision_reporting-capability-build-authorisation.md`). Implements obligations under Banks Act 94 of 1990 + Regulations Relating to Banks (BA 100/110/120/200/210/300/325/326/330/350/410/600/700/900-series); IFRS suite per IAS 1 / IFRS 7 / 9 / 13 / 10 / IAS 12 / IAS 21.

## Follow-on routes recorded

- `agent:Anya (Data / analytics engineer)` — Slice 1 (semantic-layer registry, pre-M2). Brief in PR #149 pack §6 Slice 1.
- `agent:Bea (Accounting & financial reporting engineer)` + `agent:Atlas (Core banking platform architect)` — Slice 2 (period-close event family) — sequence after Slice 1.
- `agent:Bea (Accounting & financial reporting engineer)` + `agent:Eitan (Treasurer)` + `agent:Anya (Data / analytics engineer)` — Slice 3 (single-return harness with BA 325 LCR end-to-end) — sequence after Slices 1+2.
- Slices 4-8 fire on named M-phase triggers per pack §6 without further pause.

## Substrate gaps surfaced

Per pack §9: `@platform/semantic`, `@domains/reporting`, regulator-portal simulator, Tier-1 model-validation pipeline. Routed to Atlas / Anya / Helena (Chief Risk Officer) as appropriate.

## Change log

- 2026-05-10 — Initial record. Author: Scrooge (Chief of Staff / Orchestrator).
