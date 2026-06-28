---
title: BA-return per-cell capability DISCOVERY — ranked cross-cutting backlog
lane: L5-FTR
author: Bea (Accounting & financial reporting engineer, engineering — reports to Camille (CFO))
workstream: L5-FTR-ba-return-capability-sweep
premise: D-BA-RETURN-CAPABILITY-FIRST (#1597)
authority:
  - D-BA-RETURN-CELL-VALUE-ENGINE
  - D-BA-RETURN-CAPABILITY-FIRST
  - D-BA-RETURN-SIMULATOR-FIRST
  - D-CAPITAL-ASSET-CLASS-V1
  - D-ENGINEERING-INTEGRITY-CHARTER
status: scaffold
---

# BA-return per-cell capability DISCOVERY — ranked cross-cutting backlog

## 0. Premise verdict (ADC §20 — confirm or challenge before building)

**Premise (cite `urn:bank:decision:D-BA-RETURN-CAPABILITY-FIRST` #1597):** the per-cell
value programme is capability-first; every cell a BA return requires that the events
cannot source is a *prioritised substrate-capability item*, not a blank to accept or a
number to fabricate/aggregate; success = coverage, never merged-PR count; the BA 100
pilot (#1596) correctly folded a few capital lines and honestly left the rest blank with
a tracked event-schema gap.

**Verdict: CONFIRMED — with one refinement, not a challenge.** The premise is correct
against the SARB BA-return domain authority and Principle 1. The BA-form Excel workbooks
are the definitive line/cell source (per `project_ba_return_numbering_excel_canonical`),
and a return is a *sibling fold* of the event log alongside the CoA trial balance
(neither derives from the other — `feedback_ba_returns_and_coa_are_sibling_event_folds`).
The honest-blank-with-tracked-gap pattern in `ba100-leaf-fold.ts` is the model.

**Refinement (recorded, not a contradiction):** "coverage" must be measured as a
**weighted** share, not a raw cell-count share. A BA return like BA 200 (4,570 cells) or
BA 300 (1,500+ cells) is dominated by granular *presentation-expansion* leaf rows whose
**data already exists in an aggregate fold** — those are mechanical row-enumeration
follow-ons (gated on nothing), categorically different from cells blocked on a **missing
event/instrument dimension** (gated on real substrate). Counting them equally would let a
form look "90% uncovered" when the binding capability is one instrument family away.
This backlog therefore ranks by **gating dimension** (the substrate that unblocks cells),
not by cell tally — which is exactly the cross-cutting-leverage ordering the brief asks
for. The gap register already encodes this distinction (`*-granular-cell-mapping` vs
`*-sim-gl` / `*-leaf-fold-instrument-coverage`); this sweep makes it the ranking axis.

## 1. Method

For each non-FX BA return I ran the events-direct leaf-fold lens: which leaf cells
resolve **today** from rich events (FIL instances / posting legs / projections), and for
each blank, the **exact missing dimension** — event-schema field, instrument family,
product attribute, NPA attribute, or posting completeness. The authoritative gap
inventory is the typed `SUBSTRATE_GAP_REGISTER` (`platform/substrate/gap-register.ts`),
which already enumerates per-form gaps with severity/status; this DISCOVERY adds the
**cross-return leverage ranking** on top of it (no silent deferral — Charter cmd 5; gaps
are typed register entries, not prose).

## 2. Ranked cross-cutting capability backlog (highest leverage first)

> Leverage = number of distinct BA returns whose blocked leaf cells the one capability
> unblocks. A dimension needed by many forms ranks above a form-local one.

| # | Capability (missing dimension) | Unblocks returns | Gating gap id(s) | Rank rationale |
|---|---|---|---|---|
| 1 | **Born-V2 deposit instrument + posting rule** (deposit-type + counterparty-sector dimensions; Dr cash / Cr deposit-liability legs folded from FIL events) | BA 100 (R0550/R0570–R0620 deposit-liability + R1010 sector analysis), BA 300 (LCR run-off buckets, NSFR ASF bands), BA 200 (funding side) | `ba300-deposit-funding-sim-gl`, `ba300-deposit-funding-v1-flip`, `ba100-leaf-fold-instrument-coverage` (dim 2) | **#1 cross-cutting** — one instrument lights up balance-sheet liabilities + the entire liquidity-return funding side simultaneously. Deposit FIL *model* already exists (`mm-deposit-model.ts`); the GAP is the born-V2 event path + posting rule (no `deposit.ts` in `posting-rules/`). |
| 2 | **Born-V2 loan-origination instrument** (SARB loan-product sub-type + IFRS-9 stage; `readDebtExposures` loan fold) | BA 200 (R0130–R0470 loans-and-advances + exposure classes), BA 100 (R0130–R0230 advances), BA 700 (credit-RWA leg — dominant capital denominator) | `ba200-credit-sim-gl`, `ba100-leaf-fold-instrument-coverage` (dim 1) | Second-highest — credit RWA is the dominant BA 700 denominator; blocks the asset side of BA 100 + the whole credit return. |
| 3 | **Securities-holding FIL instrument** (listed/unlisted + issuer-sector + pledge status) | BA 100 (R0270–R0330 investment/trading securities, R0350–R0380 pledged), BA 310 (L1 HQLA breakdown by type), BA 325 (treasury liquid assets) | `ba100-leaf-fold-instrument-coverage` (dim 3), `ba310-l1-breakdown-by-type` | Lights up the securities asset block + the granular HQLA breakdown across balance-sheet + liquidity returns. |
| 4 | **Per-leg banking-vs-trading-book designation** on the posting leg | BA 100 (C0010 Banking / C0020 Trading column split — *every* asset/liability line), BA 320, BA 350 | `ba100-leaf-fold-instrument-coverage` (dim 4) | Breadth play: a single leg-level boolean splits every BA 100 line into its two-column presentation; currently consolidated C0040 only. |
| 5 | **Counterparty-residency tag on FX positions** (residents/non-residents/authorised-dealers/SARB) | BA 325 (R0360–R0790 reg-29(3) FX residency detail, ~430 cells) | `ba325-reg29-fx-residency-detail` | Form-local but large; gated on real counterparties (licence-day data), not engine. |
| 6 | **Aggregate→granular published-cell expansion** (mechanical row-enumeration; data already folded) | BA 200, BA 300, BA 350 detail ladders | `ba200-credit-granular-cell-mapping`, `ba300-lcr-nsfr-granular-cell-mapping`, `ba350-maturity-ladder-cell-mapping` | **Lowest leverage despite largest cell count** — gated on nothing (no missing engine); pure presentation. Deliberately ranked last per the §0 weighting refinement. |

## 3. BUILD selection

The sweep ranks **#1 the born-V2 deposit instrument + posting rule** highest, exactly as
the brief anticipated. It is the single capability whose one build unblocks the most
*dimension-gated* (not presentation-gated) cells across the most returns. BUILD proceeds
on item #1 against a simulated outside world. See the BUILD section appended on completion.

(Sections 2–3 and the BUILD record are filled as the work lands; this is the scaffold.)
