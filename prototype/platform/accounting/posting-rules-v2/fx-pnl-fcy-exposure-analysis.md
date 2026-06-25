# FX trading-book P&L — FCY-exposure revaluation correction

**Status:** IMPLEMENTED. Authority: `D-FX-PNL-FCY-EXPOSURE-REVALUATION`
(CEO-approved 2026-06-25). REFINES (does not undo) `D-FX-TRADE-DATE-FVTPL-OBS`.
Author: Bea (Accounting & financial reporting engineer, engineering).

---

## 1. The correct model (ZAR functional currency — IAS 21 §23/§28; IFRS 9 FVTPL)

FX trading-book P&L is the **change in the ZAR value of the foreign-currency
exposure**, carried at a **ZAR cost basis** (the ZAR given up / received to
acquire the FCY). It is **UNREALISED while the exposure is open**, and the
exposure stays open **across settlement** — a forward/spot receivable becoming
cash is a change of FORM (same currency, same amount, same ZAR cost basis), NOT
a change of exposure. **Realised** P&L arises ONLY when the FCY is converted back
to ZAR (the position is squared).

Worked example — buy USD 7m / sell ZAR 129.95m @ 18.565:

- Trade date → USD 7m exposure, ZAR cost basis R129.95m, P&L nil (OBS-only).
- Daily pre-settlement → unrealised = 7m × (spot − 18.565).
- Settlement (T+2) → **P&L-NEUTRAL**: receive USD 7m cash (carried at ZAR cost
  basis R129.95m), pay ZAR 129.95m, release OBS. NO realised P&L.
- Daily post-settlement → unrealised = 7m × (spot − 18.565) — IDENTICAL to the
  open forward; the USD CASH is revalued exactly like the unsettled contract.
- Convert USD→ZAR @ 19.00 → realised = 7m × (19.00 − 18.565) = +R3.05m;
  reclassify cumulative unrealised → realised; USD position → 0.

## 2. What was wrong (after #1536) and what changed

### 2.1 Settlement posted "realised P&L" — REMOVED

`PR-FX-SETTLE-V2` (`postSettlementMovementLegs`) recognised the settled cash and
balanced it against the **realised-P&L account** (`ACC-2100-006`) in the SAME
currency. Settlement is NOT realisation. The correction makes settlement
**P&L-neutral**: each settled cash movement is recognised against the **FX
derivative settlement-clearing account** (`ACC-2100-009`, born-V2) in its own
currency — never realised P&L. The two cash legs of a spot net, per currency, to
`Dr/Cr Nostro vs Dr/Cr clearing`; nothing reaches a P&L account. The OBS release
(`PR-FX-OBS-RELEASE-V2`) is retained.

The settled FCY cash instrument carries its **ZAR cost basis** (`zarCostBasis`,
born-V2 on the cash economic terms) — the booked ZAR value of the FX leg, NOT the
settled-spot value — so revaluation can compute `ZAR market value − ZAR cost
basis`.

### 2.2 Revaluation was too narrow — WIDENED

`computeCohortPnL` / `computeDailyPnLV2` marked only OPEN FX FIL instruments,
which terminate on settlement and drop out — so settled FCY cash stopped being
revalued. The correction WIDENS the revalued set to mark EVERY open FCY monetary
position to ZAR at closing spot: open FX contracts AND settled FCY cash (Nostro)
balances. Unrealised = `signedNotional × (spot − bookedRate)` for both, where the
cash `bookedRate = zarCostBasis / |fcyNotional|`. A settled USD cash position
therefore revalues IDENTICALLY to the open USD forward for the same spot move. A
position is NOT dropped when its originating trade settles.

### 2.3 No realisation event — ADDED

A born-V2 FCY→ZAR **conversion (realisation)** treatment recognises realised P&L
= ZAR proceeds − ZAR cost basis of the FCY sold to `ACC-2100-006`, reclassifies
cumulative unrealised → realised (total P&L unchanged), and reduces the position.
The sim does not yet convert FCY→ZAR, so this is forward-correctness, exercised by
a unit test.

## 3. Accounts

- `ACC-2100-009` — **FX derivative settlement clearing (memorandum)**, born-V2.
  The P&L-neutral settlement-clearing counter to the nostro cash legs. Self-
  balances per currency across a settled trade; carries no P&L.
- `ACC-2100-006` — FX realised P&L — now reached ONLY by the FCY→ZAR conversion
  (realisation) rule, never by settlement.
- `ACC-2100-005` — FX unrealised P&L (FVTPL) — the reval position carrier.

## 4. Recon

- `recon:fx-settlement-fvtpl-integrity` — now requires settlement to be
  P&L-NEUTRAL (no realised-P&L net on `ACC-2100-006` from settlement) + OBS
  released + zero gross receivable/payable.
- `recon:fx-pnl-fcy-exposure-integrity` (born-V2, ENFORCING) — asserts:
  (a) settlement posts no realised P&L; (b) a settled FCY cash position is in the
  revalued set; (c) realised P&L only on a FCY→ZAR conversion.
- `recon:gl-v2-fold-equivalence-fx` — stays byte-equivalent by construction (the
  golden, event fold, state derivation + GL engine all delegate to the same lifted
  pure functions).
