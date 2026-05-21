---
title: MT300 Field 36 (Exchange Rate) direction — verification
author: Tomas (Operations & payments engineer)
date: 2026-05-21
workstream: WS-MARKETS-FX
authority:
  - D-FX-QUOTING-CONVENTION
  - D-MARKETS-SCHEMA-FOUNDATION
  - PR #664 (Slice 1 — schema docstring + Zod refinement + parity recons)
brief: brief:tomas:d-fx-quoting-convention-slice-3a-verify-swift-mt:2026-05-21
classification: engineering-seat
---

# MT300 field 36 — direction verification

## Question

After Slice 1 (`D-FX-QUOTING-CONVENTION`, PR #664) made the canonical rate
semantics on `FxLeg` *quote per base*, `prototype/platform/payments/swift-mt/mt300.ts:106`
emits SWIFT MT300 field 36 as the raw `nearLeg.rate.amount.toFixed(5)` with
the inline comment `// Exchange rate: receiveCurrency per pay-unit (CDM convention)`.
Two issues need verification:

1. Does MT300 field 36 expect *quote per base*, *sold per bought*, or
   something else?
2. Is the existing emission correct, or is it inverted?

## Authoritative spec — SWIFT MT300 field 36

The SWIFT User Handbook itself is paywalled. The most widely-cited
public-domain summaries (iotafinance, Oracle FBTM, SWIFT vendor docs)
agree on the following:

> **Field 32B — Currency, Amount Bought.** Format `3!a15d`. "Specifies
> the currency and amount bought by party A."
> **Field 33B — Currency, Amount Sold.** Format `3!a15d`. "Specifies
> the currency and amount sold by party A."
> **Field 36 — Exchange Rate.** Format `12d`. "Specifies the agreed
> exchange rate of the transaction. It is the rate as the deal was
> struck."

— iotafinance, *SWIFT ISO15022 MT300 Foreign Exchange Confirmation*
(www.iotafinance.com/en/SWIFT-ISO15022-Message-type-MT300.html).
Oracle FBTM 14.7.1 MT 300 reference confirms the formats and bought/sold
sequence assignments
(docs.oracle.com/en/industries/financial-services/banking-treasury-management/14.7.1.0.0/trmsg/mt-300-foreign-exchange-confirmation.html).

**Party A is the sender** — for our bank, the sending institution
(`:82A:`) — so 32B is the amount the **bank** receives (bought) and 33B
is the amount the **bank** delivers (sold).

### Direction

The SWIFT field 36 text definition itself does **not** prescribe a
unique direction; the network-validation rule is symmetric — field 36
must equal `32B / 33B` *or* `33B / 32B` (i.e. it must be
mathematically consistent with the two amounts in either direction).

The **de-facto market convention**, as shown in the worked example in
Eurex Clearing circular 032/21 attachment 1 (a public clearinghouse
MT300 sample), is:

> Bought EUR 10,000,000 / Sold USD 13,100,000 → `:36:1,31`

Rate `1.31` = `13,100,000 / 10,000,000` = **amount(33B sold) divided by
amount(32B bought)** = units of sold-currency per one unit of
bought-currency. This is the orientation every MT300 reference
example I could locate uses (Eurex, ASX Austraclear `asx_041591.pdf`,
the GFMA GFXD FX-confirmation recommendations, SWIFT Accord matching
default).

### Authoritative statement (one sentence)

**MT300 field 36 is conventionally the amount in field 33B (sold)
divided by the amount in field 32B (bought) — i.e. units of
sold-currency per one unit of bought-currency.**

## Cross-check against `mt300.ts:99–140`

The current block is (paraphrased):

```ts
const soldCurrency   = nearLeg.payCurrency;       // bank pays out (delivers)
const boughtCurrency = nearLeg.receiveCurrency;   // bank receives (acquires)
const soldAmountMinor   = BigInt(Math.abs(nearLeg.notional.amountMinor));
const boughtAmountMinor = BigInt(Math.abs(nearLeg.counterNotional.amountMinor));
const rate = nearLeg.rate.amount.toFixed(5);      // Slice-1: quote per base
// ...
{ tag: "32B", value: `${soldCurrency}${...}` },     // ← labels 32B as SOLD
{ tag: "33B", value: `${boughtCurrency}${...}` },   // ← labels 33B as BOUGHT
{ tag: "36", value: rate },                         // = quote per base
```

### Finding A — field 32B / 33B labels are swapped (separate from this slice)

`mt300.ts:137-143` puts `soldCurrency` + `soldAmountMinor` into 32B and
`boughtCurrency` + `boughtAmountMinor` into 33B. The SWIFT spec is
the opposite: 32B = bought, 33B = sold. This is a real wire-format
bug that will cause receiving banks (Accord matching, correspondent
gateways, FIN validator) to reject the message *or* match it to the
inverse trade.

**Scope.** The brief for Slice 3a is explicitly *field 36 only* and
"smallest-correct patch only". The 32B/33B swap is a separate
defect surfaced by this verification — recorded here, deferred to a
follow-on Tomas brief. Not fixed in this PR.

### Finding B — field 36 is conditionally correct (the slice-3a scope)

Field 36 emits `nearLeg.rate.amount` = *quote per base* (Slice 1
canonical). The market convention is *sold per bought*. These two
expressions agree iff `bought-currency == base-currency` — i.e. iff
the bank **buys the base currency** (`side: "buy"` on a
major-first pair).

| Scenario | `side` | bought | sold | quote-per-base | sold-per-bought | MT300 correct? |
|---|---|---|---|---|---|---|
| Bank buys USD vs ZAR (USD/ZAR pair) | `buy`  | USD (base)  | ZAR (quote) | ZAR/USD | ZAR/USD | yes |
| Bank sells USD vs ZAR (USD/ZAR pair)| `sell` | ZAR (quote) | USD (base)  | ZAR/USD | USD/ZAR | **no — inverted** |
| Bank buys EUR vs USD (EUR/USD pair) | `buy`  | EUR (base)  | USD (quote) | USD/EUR | USD/EUR | yes |
| Bank sells EUR vs USD (EUR/USD pair)| `sell` | USD (quote) | EUR (base)  | USD/EUR | EUR/USD | **no — inverted** |

The current fixture in `prototype/tests/payments/swift-mt.test.ts:30-60`
exercises only the first row (bank buys USD, sells ZAR, rate 18.5),
so the unit test passes but the test does not cover the inverted case.

### Smallest-correct patch

Compute field 36 directly from the two leg amounts rather than from
`rate.amount` — this is correct regardless of which currency is the
base. The formula is the same one the SWIFT network validator uses:

```
field 36 = soldAmount / boughtAmount     (decimal, comma separator)
```

In minor units, `soldAmountMinor` and `boughtAmountMinor` belong to
two different currencies with possibly different `decimals`; the ratio
of *display* amounts equals the ratio of minor units **when** both
currencies have the same number of decimals (the FX-spot/forward
universe today: ZAR, USD, EUR, GBP, JPY, etc. all use either 2dp or 0dp;
mixing 2dp with 0dp is the JPY-cross case). For 2dp vs 0dp this matters
— the patch must scale by `10^(soldDecimals − boughtDecimals)`. Slice 3a
keeps the patch minimal: use the canonical decimal amounts (`number`)
already exposed via the existing helpers, computed as
`sold.amount / bought.amount` where `.amount` is decimal-units (not
minor units). The code today does not have a decimal-amount helper
in scope for `Mt300`, so the patch derives it from minor units +
currency decimals inline. This is the smallest correct patch that
covers all 2dp-vs-0dp pairs (e.g. USD/JPY) as well as 2dp-vs-2dp
(USD/ZAR, EUR/USD).

The follow-on (the 32B/33B label swap) MUST land before any live
MT300 traffic — without it, field 36's mathematical relationship to
32B/33B is correct only by coincidence (because they cancel
symmetrically). A SWIFT-certified operator should re-verify both
fixes against the live SWIFT User Handbook at licence-day before any
production MT300 dispatch.

## Patch summary (this PR)

1. `prototype/platform/payments/swift-mt/mt300.ts:99–140` — replace
   `const rate = nearLeg.rate.amount.toFixed(5);` with a derivation
   that computes *sold-per-bought* from the two leg amounts (handles
   2dp-vs-0dp via the currency-decimals lookup).
2. Update the misleading comment at the same line.
3. `prototype/tests/payments/swift-mt.test.ts` — add a `side: "sell"`
   MT300 case so the inverted-direction regression is asserted at
   CI time.
4. This verification note filed as `documents` register entry via
   `dispatch:close-run --register-key documents --classification
   engineering-seat`.

## Citations

- `D-FX-QUOTING-CONVENTION` (CEO-approved 2026-05-21; Decision event
  `12ce024e-163f-46db-808d-48a53246f70f`).
- `D-MARKETS-SCHEMA-FOUNDATION` (M4 FX shape — quote-per-base on
  `FxLeg.rate`).
- `PR #664` — Slice 1 schema docstring + Zod refinement + parity
  recons (merged at `2a639a3`).
- *SWIFT ISO15022 Standard — MT300 Foreign Exchange Confirmation* —
  iotafinance public field reference,
  `https://www.iotafinance.com/en/SWIFT-ISO15022-Message-type-MT300.html`
  (read 2026-05-21; SWIFT User Handbook itself is paywalled).
- *Oracle Banking Treasury Management 14.7.1 — MT 300 Foreign Exchange
  Confirmation*, `docs.oracle.com/en/industries/financial-services/banking-treasury-management/14.7.1.0.0/trmsg/mt-300-foreign-exchange-confirmation.html`.
- *Eurex Clearing circular 032/21 attachment 1* — worked MT300 sample
  with `Bought EUR 10M / Sold USD 13.1M → :36:1,31` (cited from search
  summaries; PDF was not parseable for direct quote).
- *GFMA GFXD Recommendations for FX Confirmations (SWIFT MT300 fields
  17F, 17O, 14S, 57, 58)*, July 2020,
  `gfma.org/wp-content/uploads/2020/07/20200716-gfxd-recommendations-for-fx-confirmations-swift-mt300-fields-17f-17o-14s-57-and-58.pdf`.

## Verification outcome

**Conditionally correct** — field 36 as currently emitted is correct
for `side: "buy"` (bought-currency == base-currency); inverted for
`side: "sell"` (bought-currency == quote-currency). This PR fixes
field 36 to be correct in both cases by deriving it from the leg
amounts directly.

A separate field-32B/33B-swap defect is documented as a follow-on
finding; not fixed in this slice per brief scope.

## Substrate gap

- The SWIFT User Handbook is paywalled; verification relied on
  public vendor documentation (iotafinance, Oracle FBTM) and a
  Eurex worked example. Licence-day requires a SWIFT-certified
  operator to confirm both this field-36 patch and the deferred
  32B/33B-swap fix against the live SWIFT User Handbook before any
  production MT300 dispatch.
