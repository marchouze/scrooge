---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T08:30:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-FIRST-DRY-RUN-SCENARIO, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-FIRST-DRY-RUN-SCENARIO`
- **Title:** First Dry-Run Scenario — end-to-end rehearsal (open accounts → FX trade → IFRS statements → BA returns → risk reports)
- **Action:** approve
- **Source proposal:** [Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md](2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md) (PR [#160](https://github.com/marchouze/scrooge/pull/160))
- **Outcome:** Saskia (Head of Global Markets, governance) + Bea (Accounting & financial reporting engineer, engineering) + Mira (Compliance / RegTech engineer, engineering) + Helena (Chief Risk Officer, governance)'s scenario design **approved as drafted**. Hoz Bank solo · one ZAR/USD spot trade · synthetic counterparty · one-month period · phases A→E. Every event tagged `scenario: 'first-dry-run-2026-Q1'`. Phase A dispatch set (4 parallel briefs) authorised to fire as soon as `D-DATA-PROVENANCE-SUBSTRATE` Slice 1 lands. Two net-new sub-decisions adopted under this parent: **D-BANK-ACCOUNT-SUBSTRATE** (Tomas + Atlas + Bea) and **D-SCENARIO-CLOCK** (Atlas). Five other net-new gaps fold into existing standing-approved slice families. Recommended Q1-Q5 answers adopted in one go per no-pause rule.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "approve" — chat-intake 2026-05-10.
- **Authority chain:** Scenario authorisation downstream of standing strategic-foundation (`Owner Inbox/actioned/2026-05-06_strategic-foundation.md`) + interim-operating-posture (`D-INTERIM-OPERATING-POSTURE`, build-only) + testing-with-simulated-data strategy (`Owner Inbox/actioned/2026-05-09_scrooge_strategy_testing-through-licence-day-with-simulated-data.md`). Provenance substrate (`D-DATA-PROVENANCE-SUBSTRATE`) provides the tagging substrate that makes the dry-run replayable + auditable.

## Follow-on routes recorded — Phase A dispatch set

Each fires as soon as `D-DATA-PROVENANCE-SUBSTRATE` Slice 6+1 (in flight) lands:

- `agent:Tomas (Operations & payments engineer)` + `agent:Atlas (Core banking platform architect)` + `agent:Bea (Accounting & financial reporting engineer)` — **#A1 D-BANK-ACCOUNT-SUBSTRATE** (bank-account event family + master/balance projections).
- `agent:Atlas (Core banking platform architect)` — **#A2 D-SCENARIO-CLOCK** (controlled-time substrate).
- `agent:Kai (Trading systems engineer)` + `agent:Saskia (Head of Global Markets, governance)` + `agent:Anya (Data / analytics engineer)` — **#A3 D-FX-SALES-TRADING-FRONTEND Slice 2** (RFQ form + trade-emit).
- `agent:Saskia (Head of Global Markets, governance)` + `agent:Kai (Trading systems engineer)` + `agent:Bea (Accounting & financial reporting engineer)` — **#A4 Phase-A scenario script** (`prototype/scenarios/03-fx-end-to-end-rehearsal.ts`).

Phases B-E sequence behind Phase A per pack §5; their slice dependencies cite standing-approved plans (Reporting M2-M3, W2 Slices 2-7, Provenance Slices 2-3, FX Slices 3-8).

## Substrate gaps surfaced

Per pack §3 + §10 — 9 net-new gaps disposed: 5 fold-in to existing slice families · 2 new sub-decisions (D-BANK-ACCOUNT-SUBSTRATE, D-SCENARIO-CLOCK) · 1 deferred (regulator-portal simulator) · 1 engineering-only (scenario script). Each routed inline.

## Change log

- 2026-05-10 — Initial record. Author: Scrooge (Chief of Staff / Orchestrator).
