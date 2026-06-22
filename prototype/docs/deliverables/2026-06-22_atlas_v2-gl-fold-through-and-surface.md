# V2 General Ledger — fold-through fix + oversight surface

**Author:** Atlas (Core banking platform architect, engineering)
**Date:** 2026-06-22
**Authority:** `D-V2-UI-VISIBILITY-REMEDIATION` (CEO 2026-06-22) under `D-V2-UI-OVERSIGHT-STANDARD`; `D-CAPITAL-ASSET-CLASS-V1`; `D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD`.

## Problem

The CEO opened `/v2/finance/gl.html` and the R300m capital injection was absent.
Two causes:

1. **Unwired skeleton.** `gl.html` rendered empty placeholder tiles/tables with no
   data source.
2. **A real coherence seam.** The R300m capital injection is fold-native — it emits
   NO `GlPostingEmitted`. `computeTrialBalanceV2` read capital only from
   `GlPostingEmitted` (of which there are zero for capital) and folded only FX from
   primary FIL events. So BA-700 showed R300m own funds while a wired GL would show
   R0 Share Capital — two views of the same fact disagreeing.

## Fix

### A. Fold-through (root cause)

New `platform/accounting/posting-rules-v2/capital-fold.ts`
(`foldCapitalContributionLegs`) mirrors the FX fold: it derives the capital GL legs
(Dr settlement-cash nostro / Cr own-funds) as a pure fold over the primary capital
FIL events (`FilInstrumentCreated` / `FilInstrumentTerminated`, asset-class
`capital`) through the lifted capital posting rules
(`v2-core/posting-rules/capital.ts`). `computeTrialBalanceV2` /
`computeGlEntriesV2` / `computeGlAccountsV2` now accumulate the capital legs into
the same per-(accountCode,currency) balances map alongside the GlPostingEmitted and
FX folds. All three folds gained an optional `filter` so the oversight surface gets
exact Prod / +Sim semantics; the operating-book default preserves the existing read
path and the `gl-v2-parity` gate. No double-count: capital emits no
`GlPostingEmitted` (verified 0 in store), and the GlPostingEmitted path now excludes
capital-sourced legs by posting-rule id (belt-and-suspenders, same mechanism as FX).

**Verified (capital-fold.test.ts):**
- Balance test: after the R300m sim, Cr `ACC-5000-001` Share Capital =
  `30,000,000,000` minor (R300,000,000) **and** ΣDr = ΣCr.
- Prod lens: the simulated injection is excluded (honest empty pre-licence).
- GL ⇿ BA-700 coherence: GL Share Capital credit balance **equals** the BA-700
  capital-composition CET1 paid-up-ordinary-shares numerator under the same lens.
- Entry-level: the capital legs surface in `computeGlEntriesV2` with their source
  FIL event + `PR-CAP-ISSUE-001-V2` posting-rule id.

### B. GL V2 surface

- New `dashboard/v2-finance-gl-view.ts` (kept separate from the
  concurrently-edited `v2-finance-view.ts`): `buildGlView` (trial balance + totals
  tiles + in-balance check) and `buildGlAccountLedger` (posting legs behind one
  account). Reads `computeTrialBalanceV2` / `computeGlAccountsV2` /
  `computeGlEntriesV2` directly, honours `?provenance=`, name-free by construction.
- Routes `GET /api/v2/finance/gl` and `GET /api/v2/finance/gl/account/:id`.
- Rebuilt `gl.html` to the oversight standard (provenance badge, Prod/+Sim re-runs
  the loader, drill from every row to the account ledger, honest empty state) + new
  `gl-account.html` showing each posting leg with source event + posting rule.

## In-browser verification (seeded store, headless Chrome)

- `/v2/finance/gl.html` under **+Sim**: Equity (own funds) R300,000,000; Share
  Capital `ACC-5000-001` Cr R300,000,000; trial balance **in balance**
  (ΣDr R309,747,000 = ΣCr R309,747,000); reconciles with the Capital Position page.
- Under **Prod**: capital absent (honest), consistent with BA-700 capital `empty`.
- Account row drills to `gl-account.html` showing the Cr R300,000,000 leg, source
  `fil:inst:LE-ZA-HOZ-BANK:cap-cet1-300m-2026-06-21`, rule `PR-CAP-ISSUE-001-V2`.

## Parity-gate adjustments (same root cause, not concealment)

The capital legs are legitimately V2-only (V1 has no capital posting chain):
- `recon:gl-v2-parity` (advisory) classes capital-fold accounts
  (`ACC-5000-`/`5050-`/`5200-`/`1200-001`) as advisory `warn`, mirroring the
  existing FX-fold treatment.
- `recon:bond-gl-v2-parity` reads the V2 side `production-only` so the simulated
  capital nostro leg does not pollute the bond-only comparison.

## Tracked substrate gaps

1. **GL ⇿ BA-700 coherence recon gate.** A focused unit test asserts the agreement;
   a standing `recon:` gate that asserts GL Share Capital == BA-700 CET1 numerator
   over the live store (both lenses) is not yet built — tracked.
2. **Bond / money-market FIL fold-through.** Bond/MM accounts still come from
   `GlPostingEmitted`. Giving them the same primary-FIL fold-through (as FX and now
   capital) is a follow-on, deferred to when their FIL models/events are populated.
3. **Capital redemption enrichment.** `postCapitalRedemptionLegs` posts a
   zero-amount memo (no proceeds/notional on the bare terminal) — the pre-existing
   tracked gap in `v2-core/posting-rules/capital.ts`, surfaced here for completeness.
