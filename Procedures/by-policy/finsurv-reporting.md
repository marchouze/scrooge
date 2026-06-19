---
procedureId: PROC-FINSURV-BOP-01
title: SARB FinSurv per-transaction BoP-category reporting (build-phase scaffold)
author: Mira (Compliance / RegTech engineer, engineering)
date: 2026-06-19
owner: Mira (Compliance / RegTech engineer, engineering) · Zara (Chief Compliance Officer, governance)
status: POPULATED
version: "0.1"
last-updated: "2026-06-19"
policy-parent: Excon Compliance Policy (planned, markets bundle)
policy-cited: Excon Compliance Policy (planned, markets bundle)
system-capability: "v2-core/finsurv/bop-category.ts (Live) · platform/markets/regulatory/finsurv-bop-projection.ts (Live) · @regulatory/sarb-finsurv-bopcus (LICENCE-DAY)"
citations:
  - D-FX-OTC-CLOSURE-BACKLOG
  - D-FX-AD-STATUS
  - D-M4-FX-SUB-DECISIONS
  - ORG-FX-FIN-01
  - ORG-FX-FIN-08
---

# Procedure — SARB FinSurv per-transaction BoP-category reporting (build-phase scaffold)

**Procedure ID:** PROC-FINSURV-BOP-01
**Owner:** Mira (Compliance / RegTech engineer, engineering) · Zara (Chief Compliance Officer, governance)
**Approval:** CCO (Zara) — Excon Compliance Policy (planned, markets bundle); SARB FinSurv Reporting System mandate (AD condition)
**Cadence:** Per cross-border FX settlement (tagging at settlement time); per-transaction submission at licence-day
**Version:** v0.1 — 2026-06-19
**Status:** POPULATED (build-phase scaffold; live submission is a tracked licence-day gap — see §10)

## 1. Source policy

- Excon Compliance Policy (planned, markets bundle) — Mira co-authors; CCO (Zara) approval required before the first live cross-border flow at licence-day.
- The Currency and Exchanges Manual for Authorised Dealers (2026-05-15 ed.) — the operative classification framework; each balance-of-payments (BoP) economic class maps to a Manual section (see §2).
- Decision record `D-FX-AD-STATUS` — the bank's Authorised Dealer (AD) status pathway; per-transaction FinSurv reporting is an AD condition.
- Decision record `D-FX-OTC-CLOSURE-BACKLOG` — Phase C10 authorises this build-phase scaffold (procedure + BoP-category tagging hook); the live submission is explicitly licence-day-deferred.
- Decision record `D-M4-FX-SUB-DECISIONS` Sub-2 — Wave-2 deferral for ORG-FX-FIN-10..14 (gold, gift/donation, asset-swap, exempt-flow, no-charge classes).

This procedure is the per-transaction BoP-category counterpart to two existing FinSurv-adjacent procedures, and does NOT duplicate them:

- `PROC-FIN-FXFS-01` (`finsurv-submission-schedule.md`) — same-day FX *trade*-level reporting (`TradeReportSubmitted`). This procedure (PROC-FINSURV-BOP-01) governs the *BoP-category classification* of cross-border cash *flows* at settlement, which the trade-level submission carries as its `finsurvCategory`.
- `PROC-MK-ODP-09` (`excon-otc-derivatives.md`) — pre-trade Excon *scope* screening for non-resident OTC derivative trades. This procedure begins where that one ends: once a flow is in Excon scope, PROC-FINSURV-BOP-01 assigns its BoP economic class.

The obligation chain:

```
Regulation (Currency & Exchanges Act 9 of 1933 + Currency and Exchanges Manual + SARB FinSurv Reporting System B&T Specifications)
  → Excon Compliance Policy (planned)
    → PROC-FINSURV-BOP-01 (this procedure)
      → v2-core/finsurv/bop-category.ts (BoP-category tagging hook, Live)
      → platform/markets/regulatory/finsurv-bop-projection.ts (FinSurv BoP reporting read-side fold, Live)
        → @regulatory/sarb-finsurv-bopcus (per-transaction submission, LICENCE-DAY)
```

**Build-phase posture:** No live cross-border flows. The scaffold tags each FX settlement / NDF-fixing event with its BoP economic CLASS (one of ORG-FX-FIN-01..14) and surfaces the reportable rows via a read-side projection. The precise BOPCUS/BOPDIR numeric code and the live per-transaction submission are licence-day-deferred (§10).

**Licence-day posture:** The tagging hook populates the ratified BOPCUS code; the per-transaction submission to the SARB FinSurv Reporting System fires for every cross-border flow.

## 2. Source regulation(s) — the fourteen BoP classes

Each cross-border FX flow reports against exactly one ORG-FX-FIN economic class. The class → Currency & Exchanges Manual section → obligation map is the single source in `v2-core/finsurv/bop-category.ts` (`BOP_CLASS_OBLIGATION`); the table below is its render.

| BoP class (code-free) | Obligation | Currency & Exchanges Manual section | Wave |
|---|---|---|---|
| current-account trade payments | `ORG-FX-FIN-01` | §B.1 (imports) / §B.18 (exports) | 1 |
| current-account services | `ORG-FX-FIN-02` | §B.10 / §B.13 / §B.14 | 1 |
| current-account investment income | `ORG-FX-FIN-03` | §B.3 | 1 |
| current-account transfers | `ORG-FX-FIN-04` | §B.4 / §B.5 / §B.7 | 1 |
| capital-account FDI (≥10%) | `ORG-FX-FIN-05` | §B.2(C)(i) / §B.2(E) / §A.1 | 1 |
| capital-account portfolio investment | `ORG-FX-FIN-06` | §B.2(H) / §G | 1 |
| capital-account other investment | `ORG-FX-FIN-07` | §I / §E | 1 |
| capital-account financial derivatives | `ORG-FX-FIN-08` | §D.1 / §D.2 | 1 |
| capital-account reserve assets (agent/custodian) | `ORG-FX-FIN-09` | (no dedicated chapter — conditional) | 1 |
| gold accounts | `ORG-FX-FIN-10` | §C | 2 |
| gift / donation flows | `ORG-FX-FIN-11` | §B.17 / §B.7 | 2 |
| asset-swap flows | `ORG-FX-FIN-12` | §B.2(H) | 2 |
| exempt-flow attestation | `ORG-FX-FIN-13` | §B.4 / §B.6 | 2 |
| no-charge flows | `ORG-FX-FIN-14` | §B.19 | 2 |

**BOPCUS/BOPDIR code — licence-day-deferred.** The Manual asserts the economic CLASS; the precise FinSurv Reporting System BOPCUS/BOPDIR numeric *code* is **`[citation: TBC — blocked-pending-counsel — Imani (Legal-as-code engineer, engineering) + external counsel at the licence gate]`** for every class. The scaffold therefore tags the class and leaves the code unset (`null`) until counsel ratifies the map (§10).

**Wave-2 classes (`ORG-FX-FIN-10..14`).** Recognised by the scaffold but not in the FX-spot/forward/swap settlement scope wired today (authority `D-M4-FX-SUB-DECISIONS` Sub-2). The tagging hook fails closed on a Wave-2 class (returns a typed skip, never a silent default tag).

## 3. Purpose

1. Assign every cross-border FX settlement / NDF-fixing flow its BoP economic class (ORG-FX-FIN-01..14) at settlement time, sourced from the Currency & Exchanges Manual.
2. Carry the class on the settlement event as an immutable tag (Principle 1) so the FinSurv reporting projection can fold the reportable flows without reaching back into the trade.
3. Surface the reportable rows (cross-border + tagged) for the per-transaction submission, and the build-phase completeness signal (cross-border flows that arrived untagged).
4. Hold the licence-day binding — the live per-transaction BOPCUS submission and the ratified code map — as an explicit tracked gap, never a hidden TODO (§10).

## 4. Trigger

- **Per-settlement (primary):** `FilFxSettlementConfirmed { instance, legRole, boughtBooked, soldBooked, … }` — an FX spot / swap-near / swap-far physical settlement. The markets/payments domain supplies the flow's BoP class (a counterparty-purpose determination made at booking); the settlement read-path calls the tagging hook (`deriveBopCategoryTag`) and the resulting tag is carried on the event's optional `bopCategory` field.
- **Per-fixing (NDF):** `FilNdfFixingObserved { instance, settlementCurrency, netCashDifference, … }` — an NDF cash-settlement (capital-account financial-derivative flow, `ORG-FX-FIN-08`); tagged the same way.
- **Reporting read (build phase):** Mira reads the FinSurv BoP reporting view (`readFinsurvBopReporting`) to enumerate the reportable rows; build-phase has no live submission, so the read is for validation and coverage assertion.

## 5. Steps

| # | Action | Actor | System capability | Citation |
|---|---|---|---|---|
| 1 | **Class determination.** At booking, the markets/payments domain determines the flow's BoP economic class (current/capital-account purpose) and whether the flow crosses the SA-resident ↔ non-resident boundary. The class is NOT inferred from the cash legs — it is the underlying economic purpose. | `agent` (markets/payments, system-assisted) | (booking determination) | `ORG-FX-FIN-01`..`ORG-FX-FIN-09`; Currency & Exchanges Manual §2 table |
| 2 | **Tag derivation.** On `FilFxSettlementConfirmed` / `FilNdfFixingObserved`, the settlement read-path calls `deriveBopCategoryTag({ bopClass, crossBorder })`. For an active (Wave-1) class it returns a fully-cited tag with `bopcusCode: null` (build phase); for a Wave-2 class it returns a typed skip (fail-closed, no default). | `agent` (Mira — pipeline owner) | `v2-core/finsurv/bop-category.ts` (Live) | `D-FX-OTC-CLOSURE-BACKLOG`; `D-M4-FX-SUB-DECISIONS` Sub-2 |
| 3 | **Tag carriage.** The derived tag is carried on the settlement event's optional `bopCategory` field (append-only-safe: events without a tag parse unchanged; the FX accounting fold ignores the field — BoP is a regulatory axis, not an accounting one). | `system` | `FilFxSettlementConfirmed` / `FilNdfFixingObserved` (Live) | Principle 1; `D-FX-OTC-CLOSURE-BACKLOG` |
| 4 | **Reporting fold.** The FinSurv BoP reporting projection (`foldFinsurvBopReporting`) folds the settlement events into per-obligation reportable rows: one row per cross-border tagged flow, in deterministic order, each carrying its obligation + Manual citation + (`null`) BOPCUS code. Resident-to-resident flows are out of FinSurv scope (no row). | `agent` (Mira) | `platform/markets/regulatory/finsurv-bop-projection.ts` (Live) | Principle 1; Principle 2 |
| 5 | **Coverage assertion (build phase).** Mira reads the reporting view and asserts that every cross-border settlement carries a tag; an untagged cross-border flow is a coverage gap surfaced for remediation, never silently dropped. | `agent` (Mira) | `platform/markets/regulatory/finsurv-bop-projection.ts` (Live) | Engineering-Charter.md (#5); `D-FX-OTC-CLOSURE-BACKLOG` |
| 6 | **Per-transaction submission (LICENCE-DAY — NOT built here).** At licence-day, the tagging hook populates the counsel-ratified BOPCUS code and the submission capability files each reportable row to the SARB FinSurv Reporting System (BOPCUS / BOPDIR), emitting a per-transaction `TradeReportSubmitted` with the BoP `finsurvCategory`. | `agent` (Mira — automated) | `@regulatory/sarb-finsurv-bopcus` (LICENCE-DAY) | `D-FX-AD-STATUS`; §10 tracked gap |

## 6. Reconciliation

- **Events read:** `FilFxSettlementConfirmed` and `FilNdfFixingObserved` (the settlement carriers; the `bopCategory` tag is an optional field on each).
- **Reporting view (`foldFinsurvBopReporting`):** `rows` (cross-border + tagged reportable flows), `untaggedCrossBorderEventIds` (build-phase coverage signal), `reportableCount`.
- **Reconciliation checks (Vera asserts):**
  - Every cross-border `FilFxSettlementConfirmed` / `FilNdfFixingObserved` carries a `bopCategory` tag (build-phase coverage assertion, step 5).
  - Every reportable row's `obligationId` resolves to one of ORG-FX-FIN-01..09 (Wave-1; Wave-2 classes do not reach the reporting fold — they fail closed at tag derivation).
  - **Build-phase fail-closed:** every reportable row carries `bopcusCode: null` (a non-null code pre-licence is a finding — the code is blocked-pending-counsel).
- **Failure mode:** the tagging hook returns a typed skip (`wave2-not-active`) for a Wave-2 class — the read-path surfaces the skip, never swallows it (Engineering-Charter.md #5).

## 7. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Mira (Compliance / RegTech engineer, engineering) | BoP-tagging scaffold ownership; class→obligation map maintenance; reporting fold; coverage assertion; licence-day submission pipeline build |
| Zara (Chief Compliance Officer, governance) | CCO oversight; Excon Compliance Policy approval; licence-day FinSurv mandate sign-off |
| Imani (Legal-as-code engineer, engineering) | BOPCUS/BOPDIR code-map ratification with external counsel at the licence gate (the blocked-pending-counsel dependency) |
| Vera (internal audit engineer, governance) | Asserts the §6 reconciliation checks: cross-border coverage, Wave-1-only reportable rows, build-phase `bopcusCode: null` |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `v2-core/finsurv/bop-category.ts` | Live | BoP economic-class enum + obligation map + pure `deriveBopCategoryTag` hook (BOPCUS code `null` pending counsel) |
| `platform/markets/regulatory/finsurv-bop-projection.ts` | Live | FinSurv BoP reporting read-side fold (`foldFinsurvBopReporting` / `readFinsurvBopReporting`) |
| `bopCategory` tag on `FilFxSettlementConfirmed` / `FilNdfFixingObserved` | Live | Optional, append-only-safe field carrying the tag |
| `@regulatory/sarb-finsurv-bopcus` | LICENCE-DAY | Per-transaction BOPCUS/BOPDIR submission interface — tracked gap (§10) |

## 9. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `FilFxSettlementConfirmed` / `FilNdfFixingObserved` (with `bopCategory` tag) | Event log (v2 anchor store) | 7 years | The immutable per-flow BoP-class record (Principle 1) |
| FinSurv BoP reporting view | Derived (recomputed read) | n/a (Principle 1 — query, not stored) | `foldFinsurvBopReporting` over the settlement events |
| This procedure | Documents register (`RecordFiled`) + render here | 7 years | Filed events-first (§ change log) |
| Licence-day gap | `SubstrateAlert` (tracked) | 7 years | The live-submission binding gap (§10) |

## 10. Tracked gaps (licence-day binding — explicit, not deferred-in-silence)

Per Engineering-Charter.md #3 (no green by concealment) and #5 (no silent deferral), the following are tracked gaps with named triggers — NOT hidden TODOs. Each is filed as a typed `SubstrateAlert` alongside this procedure (`scripts/file-mira-finsurv-bop-scaffold.ts`).

| Gap | Trigger to close | Owner | Authority |
|---|---|---|---|
| **Live per-transaction FinSurv submission** — `@regulatory/sarb-finsurv-bopcus` files each reportable row to the SARB FinSurv Reporting System (BOPCUS/BOPDIR). | Licence-day (AD activation); SARB FinSurv technical onboarding | Mira | `D-FX-AD-STATUS`; `D-FX-OTC-CLOSURE-BACKLOG` |
| **BOPCUS/BOPDIR code map** — populate the precise numeric code per class (today `null`). | External-counsel ratification at the licence gate | Imani + external counsel | blocked-pending-counsel |
| **Wave-2 classes** (`ORG-FX-FIN-10..14`) — gold, gift/donation, asset-swap, exempt-flow, no-charge. | Wave-2 activation | Mira | `D-M4-FX-SUB-DECISIONS` Sub-2 |
| **Booking-time class determination** — the markets/payments domain stamps the BoP class at booking (step 1). | When per-transaction submission lands (depends on the live submission above) | Mira | `D-FX-OTC-CLOSURE-BACKLOG` |

## 11. Related procedures

- [`finsurv-submission-schedule.md`](../finance/finsurv-submission-schedule.md) (PROC-FIN-FXFS-01) — FX *trade*-level same-day FinSurv reporting; this procedure supplies the BoP-category classification it reports.
- [`excon-otc-derivatives.md`](excon-otc-derivatives.md) (PROC-MK-ODP-09) — pre-trade Excon scope screening; this procedure begins once a flow is in scope.

## 12. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-06-19 | Mira (Compliance / RegTech engineer, engineering) | Initial POPULATED — build-phase BoP-category tagging scaffold: ORG-FX-FIN-01..14 class→obligation→Manual-section map; pure `deriveBopCategoryTag` hook (BOPCUS code `null` pending counsel; Wave-2 fail-closed); optional `bopCategory` tag on `FilFxSettlementConfirmed` / `FilNdfFixingObserved` (append-only-safe); FinSurv BoP reporting read-side fold; live per-transaction submission held as an explicit tracked licence-day gap (§10, `SubstrateAlert`). Filed events-first (`RecordFiled`). Authority `D-FX-OTC-CLOSURE-BACKLOG` (Phase C10), `D-FX-AD-STATUS`, `D-M4-FX-SUB-DECISIONS` Sub-2. |
