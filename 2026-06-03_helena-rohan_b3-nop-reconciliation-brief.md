---
title: B3 FX measure — NOP-redesign reconciliation + sub-limit substrate
to: Rohan (Risk engineer)
from: Helena (Chief Risk Officer, governance)
date: 2026-06-03
workstream: WS-MARKET-RISK-PROCEDURES
priority: next-tick
---

# Brief — B3 FX measure reconciliation (Rohan)

Source: `record:documents:helena:b3-fx-market-risk-measure-review:2026-06-03`.
Governance owner: Helena (CRO). All limit-value changes remain Helena calibration acts —
this brief is substrate + label reconciliation, not re-calibration.

## Why

The B3 limit-utilisation engine was redesigned to compute **Net Open Position (NOP)**, but
the live MR-1-FX schedule label, its rationale comments, and the open Vera finding
`vera:mr-1-fx-var-projection-gap` all still describe B3 as **"gross notional."** The proxy
calibration (R18.5m) and the "24,660% spurious red" reasoning assume a gross-notional
accumulator that no longer exists.

## Scope (substrate; no limit re-calibration)

1. **R2 — label reconciliation.** Rename the B3 `limitName` in
   `scripts/seed-mr-1-fx-ras-schedule.ts` (and the superseded `scripts/seed-ras-limits.ts`)
   from "FX gross notional" / "FX notional" → "FX **net open position**". Update the file's
   rationale comments to reflect NOP, not gross notional.
2. **R3 follow-through.** Confirm the BA 330 re-citation (landed in the review PR) is the
   only BA-600 mis-reference in the FX market-risk path.
3. **F3 — re-check the proxy magnitude.** Recompute what R18.5m means against the **NOP**
   accumulator (not gross notional). Surface to Helena whether the proxy ceiling still
   reflects the intended USD 1m EOD open-position; flag if NOP makes it materially loose.
4. **Update `vera:mr-1-fx-var-projection-gap`.** Correct the finding text ("folds gross
   notional" → "folds NOP"); the VaR-engine closure criterion is unchanged.
5. **F6 — per-currency sub-limits.** Design per-CCY (and per-pair) B3 sub-lines beneath the
   aggregate, mirroring BA 330's per-currency reporting. Schema + projection only; Helena
   sets the values.
6. **F7 — B4 IR sensitivity.** Propose wiring B4 from "IR notional" to a sensitivity measure
   (PV01/DV01 or the existing BCBS-319 repricing-gap engine).

## Out of scope (Helena calibration — do not change)

F4 (capital-% linkage), F5 (aggregation-method ratification), F8 (RAG bands), F9 (per-entity
schedules), F1 (namespace renumbering decision). Capture as WS-MARKET-RISK-PROCEDURES items.

## Dispatch discipline

Per CLAUDE.md §"Dispatch discipline" (worktree isolation; scaffold-commit early;
rebase-before-push; full `bun run ci` gate; citation-gate before push; identity discipline).

## Expected deliverable

A PR reconciling the B3 labels/comments to NOP + the corrected Vera finding + a per-CCY
sub-limit schema proposal, with the R18.5m-vs-NOP magnitude check reported back to Helena.
