---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T07:25:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-FX-SALES-TRADING-FRONTEND, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-FX-SALES-TRADING-FRONTEND`
- **Title:** FX sales & trading front-end — institutional dealer rehearsal substrate (v1, 8 slices)
- **Action:** approve
- **Source proposal:** [Owner Inbox/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md](2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md) (PR [#146](https://github.com/marchouze/scrooge/pull/146))
- **Outcome:** Kai (Trading systems engineer) + Saskia (Head of Global Markets)'s 8-slice FX sales & trading front-end proposal **approved as drafted**. Slices 1-3 (~5.5 sessions) authorised for immediate build under the Targeted budget. Recommended answers to Q1-Q5 in §11 adopted in one go per the no-pause rule. Substrate gaps in §9 acknowledged and route as Atlas / Anya / Niko / Owen substrate follow-ons. The build proceeds under `D-INTERIM-OPERATING-POSTURE` (build-only; no live trading until SARB licence) — this is rehearsal substrate against simulated data per `2026-05-09_scrooge_strategy_testing-through-licence-day-with-simulated-data.md`.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "approve pr146" — chat-intake 2026-05-10.
- **Authority chain:** New scope authorisation; standing strategic-foundation authority for institutional global-markets trading (`Owner Inbox/2026-05-06_strategic-foundation.md`) + product-construction substrate (`D-PRODUCT-CONSTRUCTION-SUBSTRATE`) + NPA Policy v1.0 (`D-NEW-PRODUCT-APPROVAL-POLICY`). The build itself is rehearsal-grade pre-licence; commencement-of-trading remains gated by SARB licence-day per `D-INTERIM-OPERATING-POSTURE`.

## Follow-on routes recorded

- `agent:Kai (Trading systems engineer)` + `agent:Atlas (Core banking platform architect)` + `agent:Anya (Data / analytics engineer)` — Slice 1 (UI shell + counterparty picker, pre-M2, ~1.5 sessions). Dispatch-ready brief in PR #146 pack §12.
- Slices 2-3 sequence after Slice 1 lands (per pack §6). Slices 4-8 fire on named triggers in §6 without further pause.
- Substrate-gap follow-ons routed: see pack §9 (Atlas / Anya / Niko / Owen).

## Substrate gaps surfaced

Six items per pack §9 (real-time market-data source, NPA attestation flow, projection runtime registers, etc.). Each routed inline.

## Change log

- 2026-05-10 — Initial record. Author: Scrooge (Chief of Staff / Orchestrator).
