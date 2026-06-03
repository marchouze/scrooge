---
title: R8 — wire the existing VaR engine into a market-risk measure line (close vera:mr-1-fx-var-projection-gap)
to: Rohan (Risk engineer)
from: Helena (Chief Risk Officer, governance)
date: 2026-06-03
workstream: WS-MARKET-RISK-PROCEDURES
priority: next-tick
---

# Brief — R8 VaR measure wiring + R1 enum rename (Rohan)

Authority: D-B3-5 (R8) + D-B3-1 (R1), `record:decisions:helena:b3-measure-calibration-decisions:2026-06-03`.

## Why

The VaR/SVaR/ES engine already exists (`platform/market-risk/var-engine.ts`,
`computeMarketRisk()` — 99% 1-day historical simulation, 97.5% ES). What is missing is the
event + projection that surfaces it as an appetite line. Closing this realises Helena's true
MR-1-FX appetite (1-day 99% VaR ZAR 350,000) and closes `vera:mr-1-fx-var-projection-gap`.

## Scope A — VaR measure line (R8)

1. Add a `MarketRiskMeasureComputed` event (payload: var/svar/es as FinancialInput, status,
   asOf, model citations `model:market-risk-var-hs-v1` etc.). Register it in
   `event-store/registry/`.
2. A runtime emitter (mirror `ravi-alm-run.ts`) that calls `computeMarketRisk()` daily and
   emits the event idempotently per entity+day. Honest status when history is insufficient
   (no silent zeros — the engine already returns `no-positions` / `insufficient-history`).
3. A projection folding the latest measure, surfaced as a **separate** risk-calibrated line
   alongside B3 (NOP stays the position limit). Set its appetite to ZAR 350,000.
4. Close `vera:mr-1-fx-var-projection-gap` (AuditFindingClosed) once the VaR line is live and
   validated against Helena §1.6 + §1.8 criterion #2 (G-2).

## Scope B — cluster enum rename (R1, staged)

Mechanical rename of `riskClusterSchema` B1–B5 → semantic codes (≈35 call sites: event types,
limit-utilisation projection, seeds, dashboard types, sim, tests). Keep a B1↔MR-FX mapping
note. Land as its own PR, separate from measure changes.

## Dispatch discipline

Per CLAUDE.md §"Dispatch discipline" (worktree isolation; scaffold-commit early;
rebase-before-push; full `bun run ci`; citation-gate; identity discipline).

## Expected deliverable

Two PRs: (A) MarketRiskMeasureComputed event + emitter + projection + finding closure;
(B) cluster enum semantic rename.
