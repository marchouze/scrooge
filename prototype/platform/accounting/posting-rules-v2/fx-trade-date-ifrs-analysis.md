# FX trade-date recognition — IFRS 9 FVTPL + off-balance-sheet memorandum (PR-FX-001-V2)

**Status:** IMPLEMENTED. Authority: `D-FX-TRADE-DATE-FVTPL-OBS` (CEO-approved
2026-06-24, session-delegation). Supersedes the analysis-only note that preceded
it (`origin/claude/d-fx-trade-date-fvtpl-obs`).
Author: Bea (Accounting & financial reporting engineer, engineering).

---

## 1. The defect (confirmed)

`v2-core/posting-rules/fx.ts` → `postFxInitialRecognitionLegs` (`PR-FX-001-V2`)
booked a **same-currency** receivable/payable pair on trade date: for a GBP trade
it posted Dr GBP-receivable / Cr GBP-payable, both = the base notional. That:

1. nets to zero — records no net position and no FX exposure (economically vacuous);
2. drops the counter-currency — an FX trade is the exchange of *two* currencies;
3. ignores the instrument's `fxAgreement` quad `{ buy: Money, sell: Money }`
   (D-FX-INSTRUMENT-BUYSELL-QUAD), the two real legs in their two currencies;
4. inflates BA-100 gross assets/liabilities by the notional.

It mapped a risk-style single-notional + direction onto a meaningless GL pair.

## 2. The fix — Policy A (IFRS 9 FVTPL) + OBS memorandum

A trading-book FX spot/forward is a derivative under IFRS 9.

- **Trade date, on-balance-sheet:** recognise at FAIR VALUE. At-market FV ≈ 0 → NO
  on-balance-sheet gross-up at inception. The same-currency pair is REMOVED.
  (IFRS 9 §3.1.1, §5.1.1; B3.1.2.)
- **Trade date, off-balance-sheet:** record the contractual buy/sell notionals from
  the `fxAgreement` quad in OFF-BALANCE-SHEET MEMORANDUM accounts, **self-balancing
  per currency** — a commitment leg + a contra leg in EACH of the two currencies, so
  every currency balances and the trial balance stays balanced. These are reflected
  in the trial balance in a clearly-segregated off-balance-sheet section, EXCLUDED
  from on-balance-sheet asset/liability/equity totals, the GL in-balance check, and
  BA-100 on-balance-sheet lines.
- **Revaluation `PR-FX-REVAL-V2`:** posts the fair-value DELTA (`fairValueDeltaMinor`
  / `fairValueDelta` when carried on the amendment terms) to the on-balance-sheet
  FX-derivative position vs P&L (IFRS 9 §5.7.1) — NOT the full notional. This is the
  on-balance-sheet FVTPL position carrier. Reval is dark today (no
  `FilInstrumentAmended` emitted) so this is forward-correctness; the absent-delta
  path degrades to a zero-amount memo (no spurious notional-sized posting).
- **Settlement:** unchanged — `settle-fx-leg.ts` materialises the two cash legs in
  their own currencies; the trade-date treatment is OBS-only so there is no
  double-count.

## 3. The OBS memorandum accounts (chart-of-accounts)

New 9100 block, category `memorandum-off-balance-sheet-fx-commitment` (a fresh
off-balance-sheet category, distinct from the on-BS asset/liability/equity classes
and from the existing `memorandum-regulatory-nop` NOP block):

| id | name | side |
|---|---|---|
| ACC-9100-001 | FX Forward Bought Commitment (memorandum) | debit |
| ACC-9100-002 | FX Forward Sold Commitment (memorandum) | credit |
| ACC-9100-003 | FX Forward Commitment Contra (memorandum) | credit |

Per-currency self-balancing legs from the quad:
- BUY leg (ccy Cb, amount Ab): Dr ACC-9100-001 [Cb] Ab ; Cr ACC-9100-003 [Cb] Ab
- SELL leg (ccy Cs, amount As): Dr ACC-9100-003 [Cs] As ; Cr ACC-9100-002 [Cs] As

Cb balances (Dr Ab = Cr Ab); Cs balances (Dr As = Cr As); the contra carries both.

## 4. On-balance-sheet derivative carrier

The on-balance-sheet FVTPL position appears via revaluation on the existing FX
derivative accounts (`resolveFxAccountSet` receivable / unrealised-P&L). At-market
inception posts nothing on-BS; subsequent MtM deltas accrue the position.

## 5. Classification / exclusion

- `dashboard/v2-finance-gl-view.ts` `glClassOf` maps any `memorandum*` /
  `off-balance-sheet*` category to a new `off-balance-sheet` GlClass, excluded from
  the asset/liability/equity tiles AND from the native in-balance check (the in-
  balance check runs on the on-balance-sheet rows only; the OBS section is shown in
  its own block and balances independently).
- `platform/reporting/ba-100-balance-sheet.ts` excludes OBS memorandum accounts
  (category `memorandum*` / `off-balance-sheet*`, resolved from the COA registry)
  from on-balance-sheet lines and from `classificationGaps`, and fails closed if a
  classification map tries to put an OBS account on an on-BS section.

## 6. Recon / byte-equivalence

- `recon:gl-v2-fold-equivalence-fx` stays byte-equivalent BY CONSTRUCTION: the
  golden, the event fold, the state derivation and the GL engine all delegate to the
  SAME lifted pure functions in `v2-core/posting-rules/fx.ts`. No stored baseline.
- A new assertion proves trade-date FX produces NO same-currency on-balance-sheet
  gross-up and that the contractual notionals land in OBS memorandum accounts
  spanning the two trade currencies (`recon:fx-trade-date-obs-memorandum`).
