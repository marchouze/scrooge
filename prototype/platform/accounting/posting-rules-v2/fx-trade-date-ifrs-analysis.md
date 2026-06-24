# FX trade-date recognition — IFRS analysis (PR-FX-001-V2)

**Status:** analysis for review — NO code change made (per CEO direction 2026-06-24).
**Trigger:** CEO observed the GL raised a GBP asset *and* a GBP liability for an FX
trade and questioned the IFRS treatment. Surfaced by the live FX simulator
generating GBP/ZAR trades; the defect itself predates the simulator work.
**Scope:** `v2-core/posting-rules/fx.ts` → `postFxInitialRecognitionLegs`
(`PR-FX-001-V2`), the trade-date recognition rule.

---

## 1. What the rule does today

`postFxInitialRecognitionLegs(payload)` reads a **single-currency** notional
(`economicTerms.notional` in `economicTerms.currency`) plus a `direction`
(`long`/`short`) and posts a balanced pair in **that one currency**:

```
accounts = resolveFxAccountSet(t.currency)          // e.g. GBP → recv ACC-2100-010, pay ACC-2100-011
long  : Dr receivable[ccy] notional ; Cr payable[ccy] notional
short : Dr payable[ccy]    notional ; Cr receivable[ccy] notional
```

Observed for a **sell GBP 3m** trade (live store, +Sim lens):

| Account | Ccy | Amount (minor) | Side |
|---|---|---|---|
| ACC-2100-011 (GBP payable) | GBP | +300,000,000 | Dr |
| ACC-2100-010 (GBP receivable) | GBP | −300,000,000 | Cr |

## 2. Why this is wrong

1. **Self-cancelling same-currency pair.** A GBP asset and a GBP liability of
   identical amount net to zero. The entry records *no* net position and *no* FX
   exposure — it is economically vacuous.
2. **The second currency is dropped.** An FX trade is the exchange of *two*
   currencies. Selling GBP 3m to buy ZAR must raise a **GBP liability** (the GBP we
   will deliver) and a **ZAR asset** (the ZAR we will receive). The rule books both
   legs in the base currency and never touches the counter-currency.
3. **The richer truth already exists and is ignored.** Each instance now carries
   the symmetric `fxAgreement` quad `{ buy: Money, sell: Money }`
   (D-FX-INSTRUMENT-BUYSELL-QUAD) — the two real legs in their two currencies. The
   posting rule still uses only `notional` + `direction`.

The rule maps a **risk-style** representation (one notional + long/short) onto a
GL pair, which is fine for SA-CCR but meaningless as double-entry accounting.

## 3. What IFRS requires (two valid policies)

An FX spot/forward held in the **trading book** is a derivative under IFRS 9.

### Policy A — FVTPL derivative (recommended for a trading desk)
- **Trade date:** recognise the derivative at **fair value**. For an at-market
  trade FV ≈ 0 → effectively **no balance-sheet gross-up**; the notionals are
  off-balance-sheet (disclosure only). (IFRS 9 §3.1.1, §5.1.1; B3.1.2.)
- **Each day:** remeasure to fair value through P&L — Dr/Cr a single FX-derivative
  asset/liability line vs unrealised P&L (IFRS 9 §5.7.1). This is where the
  position and exposure actually appear.
- **Settlement:** derecognise the derivative; the cash legs materialise (already
  correct — see §4).
- Net effect on trade date: gross receivable/payable lines **disappear**; the TB
  balances trivially; the MtM carries the economics.

### Policy B — Gross regular-way (trade-date) presentation
- Recognise the asset receivable in the **bought** currency and the liability
  payable in the **sold** currency, from the `fxAgreement` quad (IFRS 9 §3.1.2,
  B3.1.5–6 regular-way):
  ```
  Dr receivable[buy.currency]  buy.amount      // e.g. ZAR ~69m asset
  Cr payable[sell.currency]    sell.amount     // e.g. GBP 3m liability
  ```
- These balance **only in reporting currency (ZAR) at the trade rate** → requires
  **reporting-currency accounting**: each leg recorded with its ZAR-equivalent so
  the multi-currency TB balances (any residual at an off-market rate is day-1 P&L /
  an FX position account). Heavier, and grosses up the balance sheet.

**Recommendation:** **Policy A (FVTPL).** These are trading-book FX trades (FRTB
desks); FVTPL derivative accounting is the textbook treatment, is simpler, removes
the gross-up entirely, and sidesteps the multi-currency TB-balancing problem.
Policy B is appropriate only if a gross regular-way settlement presentation is
explicitly wanted.

## 4. Blast radius (what a fix touches / does not)

- **NOT market risk.** SA-CCR EAD and BA-320 market RWA read the **FIL instances**
  (`platform/risk/sa-ccr/fil-instance-positions.ts` — notional + direction), not
  the GL legs. FX RWA / EAD are **unaffected** by this defect or its fix.
- **BA-100 balance sheet IS affected.** `platform/reporting/ba-100-balance-sheet.ts`
  consumes the trial balance, so today the same-currency gross-up **inflates gross
  assets and gross liabilities** by the notional (nets to zero, overstates gross).
  Fixing it (Policy A) removes that inflation.
- **Settlement already correct.** `platform/markets/settlement/settle-fx-leg.ts`
  materialises the received + paid cash legs in their **own** currencies. The
  defect is isolated to trade-date recognition; a Policy-A fix must ensure the
  trade-date derivative is derecognised cleanly at settlement (no double count).
- **Revaluation separately suspect.** `PR-FX-REVAL-V2` posts `amount = t.notional`
  (the full notional), not the fair-value **delta**. Latent today (no
  `FilInstrumentAmended`/reval events are emitted), but a Policy-A move makes reval
  the primary carrier of the position, so this rule must be corrected in the same
  change (post the MtM change, not the notional).
- **Recon will not have caught it.** `recon:gl-v2-fold-equivalence-fx` only proves
  the fold reproduces the engine's legs — both use the same rule, so a
  consistent-but-wrong rule passes. A new assertion (e.g. "an FX trade's trade-date
  legs span ≥2 currencies, or net to a single derivative FV line") would catch it.

## 5. Proposed next step

Record a `Decision` (category `engineering`/accounting-policy; CFO seat — Bea)
selecting Policy A vs B, then dispatch the posting-rule change:
- rewrite `postFxInitialRecognitionLegs` to the chosen policy (Policy A: nil/FV at
  inception; Policy B: two-currency from the `fxAgreement` quad + reporting-ccy
  balancing);
- correct `postFxRevaluationLegs` to post the FV delta;
- add the cross-currency / derivative-FV recon assertion;
- re-baseline `recon:gl-v2-fold-equivalence-fx` and the BA-100 expectations.

No code changed pending that decision.
