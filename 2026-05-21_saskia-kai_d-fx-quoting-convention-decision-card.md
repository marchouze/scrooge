---
title: "D-FX-QUOTING-CONVENTION — single codebase-wide FX quoting convention for `fxLegSchema`"
agent: Saskia (Head of Global Markets, governance)
co-author: Kai (Trading-systems engineer)
trigger: ceo-decision-proposal
decisionId: D-FX-QUOTING-CONVENTION
decision-required: true
recommendation: Option A — keep pay/receive framing, fix docstrings, add Zod refinement, repair the calculator bug
record-kind: ceo-decision-proposal
workstream: WS-MARKETS-FX
brief: brief:saskia:author-d-fx-quoting-convention-decision-card-rat:2026-05-21
runId: run:saskia:2026-05-21T07-29-12-891Z
asOf: 2026-05-21T07:30:00Z
date: 2026-05-21
authority:
  - D-MARKETS-SCHEMA-FOUNDATION
  - D-FX-BOOK-BOUNDARY
  - D-FX-SALES-TRADING-FRONTEND
citations:
  - "D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07) — FX trade schema authority"
  - "D-FX-BOOK-BOUNDARY (CEO-approved 2026-05-07) — related FX sub-decision"
  - "D-FX-SALES-TRADING-FRONTEND — sim + counterparty config authority"
  - "PR #654 — FX pair direction canonicalisation (ACI Model Code §2 precedent)"
  - "ACI Model Code §2 — currency-pair quotation hierarchy and convention"
  - "IFRS 9 §5.7.1 — FVTPL recognition (unrealised P&L correctness)"
  - "IAS 21 §28 — settlement-date FX gain/loss recognition"
  - "SWIFT MT300 User Handbook — field 36 (Exchange Rate) semantics [VERIFICATION OPEN]"
  - "Principles/1-events-are-truth.md — schema is the canonical record"
  - "Principles/5-multi-currency-entity-country.md — currency at the type level"
classification: ceo-only
register-key: decisions
status: proposed
---

# D-FX-QUOTING-CONVENTION — single codebase-wide FX quoting convention for `fxLegSchema`

> **Decision asked.** A single, codebase-wide convention for `fxLegSchema` covering (i) rate-direction and (ii) notional-axis, with a Zod refinement asserting the invariants at parse time, and a migration plan for downstream consumers (calculator, revaluation, MT300, posting rules, scenarios, sim generator).
>
> **Authors.** Saskia (Head of Global Markets, governance) — primary; Kai (Trading-systems engineer) — co-author. Consulted: Bea (Accounting & financial reporting engineer, engineering) on posting rules; Tomas (Operations & payments engineer) on MT300; Helena (Chief Risk Officer, governance) on the P&L correctness implication. Helena's prior FX-spot scope review (2026-05-20) flagged that the unrealised-P&L line on the trading book is currently wrong-by-rate on every BUY trade flowing through the calculator — i.e. this is a material accuracy issue on the build-phase substrate, not a cosmetic schema cleanup.
>
> **Recommendation.** **Option A** — keep the existing pay/receive framing; restate `rate.amount` as **`quote per base`** (the convention every consumer already uses); fix the schema docstring; add a Zod cross-field refinement asserting `(payCurrency, receiveCurrency, notional.currency, counterNotional.currency, rate.currency)` coherence against `currencyPair.{base, quote}` and `side`; fix the calculator's notional-axis bug; re-verify MT300 field 36 against the SWIFT User Handbook before changing the emitter. Option A is the smallest change that closes the contradiction, repairs the P&L bug, and lands a tight Zod invariant — without forcing a sim-fixture + scenario-fixture rewrite.

---

## 1. Problem statement — what's wrong, in one screen

`prototype/platform/markets/cdm/fx.ts` defines `fxLegSchema` (the per-leg payload inside `FxTradeExecuted`). Two convention questions are live, and the codebase currently contradicts itself on both. Both errors are silent under happy-path scenarios where the values cancel out, and both bite when the unrealised-P&L calculator runs against a BUY trade.

### 1a. Rate direction — schema docstring vs every consumer

`fx.ts:132` documents `rate.amount` as **`receiveCurrency per pay-unit`** ("CDM-receive convention"). Every consumer reads it as **`quote per base`** (the ACI Model Code §2 desk-side convention):

| Site | What the value is used as | Implied convention |
|---|---|---|
| `scenarios/03-fx-end-to-end-rehearsal.ts:274` (`PricingModelEvaluated.midRate = 18.5`) | `ZAR per USD` for the USD/ZAR pair | `quote per base` |
| `scenarios/03-fx-end-to-end-rehearsal.ts:480` (BUY USD/ZAR; `rate.amount: 18.5`, `rate.currency: "ZAR"`) | `ZAR per USD` even though the bank pays ZAR | `quote per base` |
| `scenarios/fx-spot-internal-pre-licence-test.ts:302` (BUY USD/ZAR; `rate.amount: 18.524`, `rate.currency: "ZAR"`) | `ZAR per USD` | `quote per base` |
| `platform/accounting/fx-calculators.ts:178–192` (`unrealisedPnlCalculator`) | `currentRate − bookRate` against `notionalBaseMinor` | `quote per base` |
| `platform/markets/eod/fx-revaluation.ts:226–244` | Compared to seed `revalRate` keyed `quote per base × 10^6` (with explicit side-dependent inversion at line 233–237) | `quote per base` (after invert on BUY) |
| `platform/markets/eod/fx-forward-revaluation.ts:368, 415, 461` | Same shape as spot revaluation | `quote per base` |
| `platform/payments/swift-mt/mt300.ts:106` (field 36) | `nearLeg.rate.amount.toFixed(5)` with comment **"receiveCurrency per pay-unit (CDM convention)"** | Comment says CDM-receive; value flowing in is `quote per base` |
| `platform/simulation/fx-sim-generator.ts:90` | BUY side: `legRate = 1 / mid` to honour the docstring | **Inverted from every other consumer** — the contradiction |

For a BUY USD/ZAR trade (pair `{base: "USD", quote: "ZAR"}`, side `buy`, bank receives USD pays ZAR) the two readings differ by an order of magnitude:

- Docstring reading (`receiveCurrency per pay-unit`): `rate = USD per ZAR ≈ 0.054`.
- Consumer reading (`quote per base`): `rate = ZAR per USD = 18.5`.

The sim generator honours the docstring; everything else assumes the consumer reading. Today this is masked because:

- Revaluation does an explicit side-dependent invert (`legRate` if rate currency = quote; `1 / legRate` if rate currency = base) — see `fx-revaluation.ts:233–237`. That logic happens to neutralise the divergence for revaluation, but it is *load-bearing on a contradiction*: if the sim generator is fixed, revaluation breaks; if the docstring is fixed, the sim generator breaks. The two are tied at the hip via a 2-line invert that no test asserts.
- Scenario fixtures (which dominate the test surface) follow the consumer convention (`rate.amount = 18.5`, `rate.currency = quote`). Sim-generated trades follow the docstring (`rate.amount = 1/mid`, `rate.currency = base on BUY`). The two trade streams are mutually incompatible under any single posting / accounting / MT300 path.

### 1b. Notional axis — schema docstring vs unrealised-P&L calculator

`fx.ts:128` documents `notional` as the **pay-currency** amount on the leg ("notional traded in the pay currency"). Every BUY USD/ZAR scenario stores `notional.currency = "ZAR"` (the pay leg).

But `fx-calculators.ts:178` reads `nearLeg.notional.amountMinor` into a variable explicitly named `notionalBaseMinor` and applies a `(currentRate − bookRate)` quote-per-base rate-delta against it (line 192). For a BUY USD/ZAR trade where notional is stored in ZAR (~ZAR 92.5m) but the calculator interprets it as USD (~USD 5m), the unrealised P&L is **wrong by a factor of `rate` (~18.5×)** on every BUY trade.

Cross-check: `fx-revaluation.ts:238` does the same thing (`const notionalBaseMinor = nearLeg.notional.amountMinor`) and so does `fx-forward-revaluation.ts:369, 416, 462`. The forward-revaluation engine has the same axis mismatch as the spot calculator. All three engines treat the per-leg `notional` as the base-currency amount; the schema declares it as the pay-currency amount; the BUY-side scenario fixtures store it as the pay-currency amount (which on BUY = quote currency on a major-first pair, i.e. ZAR).

### 1c. Why neither error has yet surfaced as a production defect

- Scenarios 03 and `fx-spot-internal-pre-licence-test` exercise the booking + settlement chain end-to-end but **do not assert the magnitude of the unrealised-P&L line**. The PR-FX-002 revaluation rule posts whatever the calculator returns; the test asserts that *something* posts, not what number it is.
- Sim trades are filtered out of the FX-spot pre-licence test (only the curated scenario fixture flows the full posting chain).
- Helena's FX-spot-only market-risk scope review (2026-05-20) called out RAS-coverage gaps but did not yet drill into the P&L calibration — the assumption was that the calculator was right. It is not.

In substance: the bank's substrate currently produces **off-by-rate unrealised P&L on every open BUY trade** the moment it flows through the calculator. That is not blocking pre-licence rehearsal but it is blocking a clean licence-day MR-1 sign-off, and it is a Principle 1 smell: the *event* says one thing (notional in pay currency), the *projection* (calculator) reads another (notional in base currency), and the two are reconciled only by the absence of an assertion.

---

## 2. The three options

The brief sketched three; we keep all three (renumbered for clarity), with Option A pulled forward as the recommendation. Each option must answer two questions independently:

- **Q-rate.** What does `rate.amount` mean? (`quote per base` vs `receive per pay-unit`)
- **Q-notional.** What does `notional` mean? (pay currency vs base currency)

The Zod refinement is the *invariant assertion* for whichever pair is chosen; the migration plan is the work-out across consumers.

### Option A — keep pay/receive framing; fix docstrings + Zod refinement + calculator bug (RECOMMENDED)

- **Rate semantics.** `rate.amount = quote per base` (matches every consumer except the sim generator's BUY branch). `rate.currency` MUST equal `currencyPair.quote`. Schema docstring updated; the existing comment at `fx.ts:132` ("receiveCurrency per pay-unit") becomes "quote per base; the quote leg of the trade's `currencyPair`".
- **Notional axis.** Notional remains in **pay currency** (matches what every scenario stores today). `notional.currency` MUST equal `payCurrency`; `counterNotional.currency` MUST equal `receiveCurrency`. The calculator + revaluation engines are repaired to resolve the *base leg* explicitly:
  - Either by `const baseLeg = trade.legs.find(l => l.notional.currency === currencyPair.base) ?? trade.legs[0]; const baseAmt = baseLeg.notional.amountMinor` (works when the leg storing the base-currency notional is reachable),
  - Or by reading `counterNotional` when `payCurrency === currencyPair.quote` (i.e. on BUY).
  - Simpler form per Kai's analysis: introduce a `baseAmountMinor(leg, pair)` helper:
    ```ts
    function baseAmountMinor(leg: FxLeg, pair: CurrencyPair): number {
      return leg.notional.currency === pair.base
        ? leg.notional.amountMinor
        : leg.counterNotional.amountMinor;
    }
    ```
- **MT300 field 36.** Re-verified against the SWIFT MT300 User Handbook before changing the emitter. *Open sub-question* — see §6. If the SWIFT spec says field 36 is `currency-of-sold per unit-of-bought` (a credible reading: it's the exchange rate the *sold* side sees), then the current emission with the comment "receiveCurrency per pay-unit" is wrong both ways and needs a one-line fix; if it's quote-per-base, the value is right and only the comment is wrong. Either way the Tomas dispatch is small.
- **Zod refinement** (added to `fxTradeExecutedPayloadSchema.superRefine` at `fx.ts:243`):
  ```ts
  // Quoting-convention invariants (D-FX-QUOTING-CONVENTION, Option A).
  for (const [i, leg] of data.legs.entries()) {
    // (i) Notional is in pay currency; counter-notional in receive currency.
    if (leg.notional.currency !== leg.payCurrency) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: `leg ${i}: notional.currency must equal payCurrency (pay-currency notional axis)`,
        path: ["legs", i, "notional", "currency"] });
    }
    if (leg.counterNotional.currency !== leg.receiveCurrency) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: `leg ${i}: counterNotional.currency must equal receiveCurrency`,
        path: ["legs", i, "counterNotional", "currency"] });
    }
    // (ii) Rate is expressed as quote per base.
    if (leg.rate.currency !== data.currencyPair.quote) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: `leg ${i}: rate.currency must equal currencyPair.quote (quote-per-base rate convention)`,
        path: ["legs", i, "rate", "currency"] });
    }
    // (iii) Side coherence: on BUY, bank receives base; on SELL, bank pays base.
    const wantsReceiveBase = data.side === "buy";
    const legReceivesBase = leg.receiveCurrency === data.currencyPair.base;
    if (wantsReceiveBase !== legReceivesBase) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: `leg ${i}: side=${data.side} requires receiveCurrency=${wantsReceiveBase ? "base" : "quote"}`,
        path: ["legs", i, "receiveCurrency"] });
    }
    // (iv) Magnitude sanity (advisory; helps catch inverted rates):
    //      counterNotional ≈ notional × rate (within 1bp). Skipped in the
    //      hard refinement; lands in the new `recon:fx-rate-magnitude`
    //      advisory gate (P2 warn) per Vera's preferred recon split.
  }
  ```

### Option B — switch to symmetric two-leg framing (CDM-aligned)

- **Rate semantics.** `quote per base` (same as A).
- **Notional axis.** Drop the privileged-axis framing; rename `notional` / `counterNotional` to `leg1Amount` / `leg2Amount` (or to the CDM names `exchangedCurrency1Amount` / `exchangedCurrency2Amount`). Each amount carries its own currency; there is no "pay" or "receive" axis at the data level. A helper `baseLeg(trade)` is added for desk-facing renders.
- **Trade-direction (buy/sell) becomes auxiliary** — the same trade can be rendered "BUY USD/ZAR" or "SELL ZAR/USD"; the data is identical.
- **Zod refinement.** `leg.{leg1, leg2}.currency` must come from the pair; `leg1.currency !== leg2.currency`; that's it. Looser than A or C.
- **Cost.** Bigger schema refactor. Every consumer touches the field names. Bea's posting-rule helpers (`_legBy(currency)`) are renamed / re-keyed; MT300 field 32B/33B/36 selection logic is rewritten in terms of sold-vs-bought derived from `side` rather than read from `payCurrency`.
- **Benefit.** Symmetry with FpML / ISO 20022 / CDM trade-event representation. Future-proofs the schema for cross-currency swaps (where "pay" / "receive" is genuinely ambiguous on the swap initialisation).
- **Carve risk.** Migration is high-touch but bounded: every existing scenario fixture is rewritten exactly once, and the new pattern stays stable. Bea flags this is the option that forces a posting-rule refactor on `_legBy(currency)` helpers (currently `payAccountFor` / `receiveAccountFor`); not hard but it churns PR-FX-001 / PR-FX-PRIN.

### Option C — trader-desk framing (base-axis everywhere)

- **Rate semantics.** `quote per base` (same as A and B).
- **Notional axis.** `notional` MUST be **base** currency (matches desk-talk: "5m USD/ZAR" means USD 5m). `counterNotional` MUST be quote. `notional.currency === currencyPair.base`; `counterNotional.currency === currencyPair.quote`.
- **Zod refinement.** Tightest of the three — the invariant is a literal equality against `currencyPair.base` / `quote`. `payCurrency` / `receiveCurrency` still derivable from `side` (BUY: pay = quote, receive = base; SELL: pay = base, receive = quote).
- **Cost.** Every BUY-side scenario fixture currently storing `notional.currency = ZAR` (pay = quote on BUY) is rewritten to store `notional.currency = USD` (base). `scenarios/03-fx-end-to-end-rehearsal.ts:478–479` flips; `scenarios/fx-spot-internal-pre-licence-test.ts:300–301` flips; the sim generator's BUY branch flips its notional emission. The MT300 emitter becomes cleaner (32B/33B selection from `payCurrency` / `receiveCurrency` derived from `side`, not read off the leg).
- **Benefit.** Aligns with `fx-calculators.ts` as-written — the calculator's `notionalBaseMinor` reading is correct by construction; the bug at `fx-calculators.ts:178–192` self-resolves. Loudest invariant; most static-discoverable.
- **Cost (specific).** Largest test-fixture churn of the three. Every BUY scenario in `scenarios/`, every BUY trade in M4 substrate tests, every sim-generated BUY trade in the persisted event store (if any have been emitted in CI runs — Vera's recon would have to walk and confirm).

---

## 3. Recommendation: Option A

**Adopt Option A.** Reasoning:

1. **Smallest reachable correctness gain.** The unrealised-P&L bug at `fx-calculators.ts:178–192` is the load-bearing economic defect today. Option A fixes it by adding a 4-line `baseAmountMinor()` helper and switching the calculator + the three revaluation engines to use it. The schema change is a docstring + a refinement; the call-site change is a one-line resolution at three sites.
2. **Tight Zod refinement covers the contradiction.** The four-clause refinement in §2A makes the previously-implicit invariant explicit at parse time. Every scenario fixture, every sim-generated trade, every backfill, every API ingestion has to satisfy it. The codebase becomes monoglot on the convention; the docstring + the refinement + the calculator + the comment-fix on MT300 carry one story.
3. **Bea + Tomas impact assessment is the smallest of the three.** Bea (engineering): no posting-rule code changes — PR-FX-001 reads off `leg.notional.amountMinor` / `leg.counterNotional.amountMinor` by currency, and those values are correct under Option A; the helpers `receivableAccountFor(currency)` / `payableAccountFor(currency)` are currency-keyed not axis-keyed, so they don't care about the framing. Bea flags that Option B would force a `_legBy(currency)` rewrite; Option C breaks Bea's existing scenario fixtures (the BUY-side `payCurrency: "ZAR"` posting test cases). Option A preserves both. Tomas (engineering): MT300 field 36 needs spec re-verification (open sub-question, §6); field 32B/33B selection logic is untouched (it reads `payCurrency` / `receiveCurrency` directly, which are stable across A).
4. **Sim generator becomes simpler, not more complex.** The sim generator's BUY branch at `fx-sim-generator.ts:85–97` currently inverts (`legRate = 1 / rate.mid`) to honour the docstring. Under Option A both BUY and SELL emit `legRate = rate.mid` (quote per base); the invert disappears. Net code reduction: ~6 lines.
5. **No scenario-fixture rewrite.** All five existing scenarios already store notional as pay-currency and rate.amount as quote-per-base. Option A makes them legal; Option C makes them illegal. The pre-licence test (`fx-spot-internal-pre-licence-test.ts`) — which Helena, Bea, Rashida, Imani, and Devon all have load-bearing assertions against — is preserved exactly.
6. **PR #654 precedent.** PR #654 chose a single ACI-aligned convention (major-first pair direction) and added a P2-warn recon (`recon:fx-pair-direction`) to catch drift. Option A follows the same pattern: choose `quote per base` (ACI-aligned), add a hard refinement at the type level + an advisory `recon:fx-rate-magnitude` to catch sign / magnitude errors. PR #654 explicitly left the rate-direction debate out of scope; this card closes it.

The case **against** Option A is the case for B: Option A preserves the privileged pay/receive axis, which is mildly non-CDM and which will mildly bite us again when we add Cross-Currency Swaps (M3) — where pay/receive is initial-direction-only and flips at every interest-period reset. We accept that cost. M3 CCS will get its own schema (different event type, different lifecycle); the FX `legs` array shape under Option A does not need to carry CCS's resets. We can revisit B at M3 entry if CCS authoring surfaces a contradiction.

The case **against** Option C is the test-fixture rewrite. Every BUY-side scenario in `scenarios/` would flip; Bea's posting-rule tests assume the existing pay/receive labelling; Helena's FX-spot scope review references the existing `payCurrency: "ZAR"` shape. The churn risk is real and the upside (cleaner calculator math) is also achievable under Option A by going through `baseAmountMinor()`. Option C is the cleanest invariant but the loudest migration.

---

## 4. Consequence matrix

One row per file / family. Three columns — Option A (recommended), Option B (symmetric), Option C (base-axis).

| File / family | Option A (recommended) | Option B (symmetric) | Option C (base-axis) |
|---|---|---|---|
| `platform/markets/cdm/fx.ts` — `fxLegSchema` docstring at L132 | Docstring change: `rate.amount = quote per base`. | Same docstring change + field rename (`notional` → `leg1Amount`, `counterNotional` → `leg2Amount`). | Docstring change: `notional.currency = base`; `rate.amount = quote per base`. |
| `platform/markets/cdm/fx.ts` — `fxLegSchema` field shape | Unchanged. | Field rename. | Unchanged. |
| `platform/markets/cdm/fx.ts` — `fxTradeExecutedPayloadSchema.superRefine` | +4 invariant clauses (notional-axis, rate-currency, side-coherence). | +2 clauses (currencies-from-pair, distinct legs). | +3 invariant clauses (notional=base, counterNotional=quote, rate=quote-per-base). |
| `platform/accounting/fx-calculators.ts:178–192` — `unrealisedPnlCalculator` | Replace `notionalBaseMinor = nearLeg.notional.amountMinor` with `baseAmountMinor(nearLeg, currencyPair)` helper call. | Replace with `leg.find` over `leg1Amount` / `leg2Amount` by base-currency match. | No code change — `nearLeg.notional.amountMinor` is base by invariant. |
| `platform/markets/eod/fx-revaluation.ts:233–244` | Drop the side-dependent invert at L233–237 (rate is always quote-per-base). Replace `notionalBaseMinor` resolution with `baseAmountMinor()`. | Drop invert; resolve base leg by `currencyPair.base` lookup. | Drop invert; `nearLeg.notional.amountMinor` is base by invariant. |
| `platform/markets/eod/fx-forward-revaluation.ts:368, 415, 461` | Same shape as spot revaluation — three call sites switch to `baseAmountMinor()`. | Same — three call sites switch to base-leg lookup. | Same — no code change. |
| `platform/payments/swift-mt/mt300.ts:106` — field 36 | Re-verify against SWIFT MT300 spec (§6 open). Comment fixed regardless. Value emission may need a `1/rate` flip OR no change, conditional on spec. | Same SWIFT re-verification. Field 32B/33B/36 selection logic rewritten in terms of sold/bought derived from side. | Same SWIFT re-verification. Field 32B/33B selection cleaner — direct from `payCurrency` / `receiveCurrency` (derived from side under invariant). |
| `platform/accounting/posting-rules/fx-spot.ts` — PR-FX-001 booking | No change. Per-currency double-entry is currency-keyed; both pay and receive currency sub-entries are debit-receivable / credit-payable in their own currency. | Helpers `_legBy(currency)` renamed / re-keyed; PR-FX-001 reads `leg1Amount` / `leg2Amount` by currency match. | No change — pay/receive still inferable; calculation reads `currency` field. |
| `platform/accounting/posting-rules/fx-spot.ts` — PR-FX-002 revaluation | No change — receives ZAR P&L delta only. | No change. | No change. |
| `platform/accounting/posting-rules/fx-spot.ts` — PR-FX-PRIN principal payment | No change — keyed on `PrincipalPayment.currency` not on leg axis. | No change — same. | No change — same. |
| `platform/accounting/posting-rules/fx-spot.ts` — PR-FX-LIFECYCLE-CLOSE | No change. | No change. | No change. |
| `platform/accounting/posting-rules/fx-spot.ts` — PR-FX-CANCEL / PR-FX-AMD / PR-FX-005 | No change. | No change (renames propagate via helper). | No change. |
| `scenarios/03-fx-end-to-end-rehearsal.ts:472–500` (BUY USD/ZAR) | Legal as-written. | Rewrite field names (`leg1Amount`, `leg2Amount`). | Rewrite: swap notional / counterNotional payloads (so `notional.currency = "USD"`). |
| `scenarios/fx-spot-internal-pre-licence-test.ts:294–322` (BUY USD/ZAR) | Legal as-written. | Rewrite field names. | Rewrite: swap notional / counterNotional. |
| `scenarios/06-fx-messaging-layer.ts` and `scenarios/07-fx-internal-trade-cycle.ts` (if BUY-side trades) | Legal as-written. | Rewrite field names. | Rewrite BUY trades. |
| `platform/simulation/fx-sim-generator.ts:85–97` | Simplify: drop the `legRate = 1/rate.mid` invert on BUY; both BUY and SELL emit `legRate = rate.mid` (quote per base). | Rewrite: emit `leg1Amount` / `leg2Amount` instead of `notional` / `counterNotional`. | Rewrite: BUY-side stores `notional.currency = base = USD`, not ZAR. |
| `platform/simulation/post-trade-lifecycle.ts` | No change. | Minor rename only. | No change. |
| `platform/recon/fx-pair-direction.ts` (existing, PR #654) | No change. | No change. | No change. |
| `platform/recon/fx-rate-magnitude.ts` (NEW — P2 warn) | NEW: walk every `FxTradeExecuted`; assert `|counterNotional / notional − rate.amount| / rate.amount < 1bp`; surface drift as advisory finding. | Same — keyed off leg1/leg2. | Same — keyed off base/quote labels. |
| `platform/recon/fx-quoting-convention.ts` (NEW — P1 hard, repeats the Zod refinement) | NEW: re-asserts the four invariants over the persisted event store (catches any pre-refinement events; CI gate). | NEW: re-asserts the two invariants. | NEW: re-asserts the three invariants. |
| Existing FX tests under `prototype/tests/` and `platform/**/*.test.ts` | Compile cleanly; some assertions on `notionalBaseMinor` change in magnitude (the bug fix moves the BUY-side P&L from "wrong by 18.5×" to "correct"). Expect ~5–15 test deltas (rounding & magnitude assertions). | ~30–50 deltas (field renames + magnitudes). | ~50–80 deltas (BUY-side trade fixture rewrites + magnitudes). |
| Dashboard renderers (markets-fx page) | Read `payCurrency` / `receiveCurrency` directly — no change. | Renderers switch to `baseLeg(trade)` helper for "X buys Y at rate" copy. | No change — desk reading matches storage. |
| BA-325 LCR / FX risk weighting | Already keyed on currency, not axis — no change. | No change. | No change. |
| FinSurv / Mira FX-AD reporting | Reads currency pair + side; no change. | No change. | No change. |
| Vera recon panel | +2 new recons (`fx-rate-magnitude` advisory, `fx-quoting-convention` hard). | +2 same. | +2 same. |

**Summary.** Option A's footprint is: docstring + Zod refinement + 4 calculator/revaluation call-site fixes + sim-generator simplification + MT300 comment (and possibly emission) fix + 2 new recons. No scenario rewrite. No posting-rule rewrite. ~10 test deltas (mostly magnitude assertions getting the right answer).

---

## 5. Migration plan

**Phased — three slices, each its own PR. Sequential, not parallel (they touch overlapping files).**

### Slice 1 — schema + refinement + recons (one PR)
- `platform/markets/cdm/fx.ts` — docstring fix at L128 + L132; +4-clause Zod refinement at the existing `superRefine` block.
- `platform/recon/fx-quoting-convention.ts` + `.test.ts` — new hard P1 recon that re-asserts the four invariants over the persisted event store. Catches any historical event predating the refinement (likely zero events in production today; the recon is a defence-in-depth gate, not a backfill).
- `platform/recon/fx-rate-magnitude.ts` + `.test.ts` — new advisory P2 recon that asserts `|counterNotional / notional − rate.amount| / rate.amount < 1bp` per BUY-side leg (sign-flipped on SELL).
- `prototype/package.json` — wire both new recons into the `recon:*` chain.
- **CI gate.** `bun run ci` from `prototype/` passes; the new recons emit zero findings against the current event store.
- **Risk.** If any persisted FxTradeExecuted in the local / CI event store fails the refinement at parse time, that event becomes unreplayable. Mitigation: walk `prototype/seeds/` and `.local/` event stores in a dry-run script before Slice 1 lands; any failing event is either deleted (if it's sim noise) or migrated (if it's a fixture).

### Slice 2 — calculator + revaluation engines (one PR)
- `platform/accounting/fx-calculators.ts` — add `baseAmountMinor()` helper; switch `unrealisedPnlCalculator` to use it.
- `platform/markets/eod/fx-revaluation.ts` — drop side-dependent invert at L233–237; switch to `baseAmountMinor()`.
- `platform/markets/eod/fx-forward-revaluation.ts` — switch all three call sites (L368, L415, L461) to `baseAmountMinor()`.
- Test deltas: ~10 magnitude assertions move from "wrong" to "right" on BUY trades. Bea + Camille (CFO) review the new numbers before merge; Helena reviews the new revaluation outputs against RAS-MR-1.
- **CI gate.** `bun run ci` passes; `recon:fx-quoting-convention` + `recon:fx-rate-magnitude` continue to pass.
- **Risk.** The unrealised P&L line in any persisted historical revaluation series jumps in magnitude on BUY trades. Mitigation: this is the *fix*, and it should land before the licence-day MR-1 sign-off. Document the magnitude delta in the PR description.

### Slice 3 — sim generator + MT300 spec re-verification (one PR)
- `platform/simulation/fx-sim-generator.ts` — drop the BUY-side `legRate = 1 / rate.mid` branch; both BUY and SELL emit `legRate = rate.mid`. Comment block refreshed.
- `platform/payments/swift-mt/mt300.ts:106` — comment fixed regardless ("Exchange rate — quote-per-base per ACI Model Code §2; field 36 emission per SWIFT MT300 UH"). Value emission: conditional on §6 sub-question resolution — either left as-is (if SWIFT field 36 is quote-per-base) or `1 / rate` flip (if SWIFT field 36 is sold-per-bought).
- Test deltas: sim trades start to be legal under the refinement; previously they would have failed it.
- **CI gate.** As above; sim trades replay through the full FX lifecycle without violating any invariant.
- **Risk.** None material. The MT300 value emission is the only open question and it's confined to one line.

**No single-PR option.** Doing all three slices in one PR is technically possible but loses the ability to isolate the calculator-fix from the schema-refinement at review time. The 3-slice phasing maps cleanly onto the three follow-on dispatches in §7.

---

## 6. Open sub-question — SWIFT MT300 field 36 semantics

The brief explicitly flagged this: do not assume field 36's direction without the spec.

**Best reading from current code + standard interbank practice.** SWIFT MT300 field 36 (`Exchange Rate`) is documented in the SWIFT User Handbook as the rate "at which the amount in field 32B equals the amount in field 33B". Field 32B is the *amount sold* by the sender; field 33B is the *amount bought*. The mathematical direction is therefore `Amount Bought / Amount Sold` — i.e. the units of the bought currency per one unit of the sold currency.

- For a BUY USD/ZAR trade where the bank sends MT300: bank sells ZAR (32B = ZAR 92.5m) and buys USD (33B = USD 5m). Field 36 = 5m / 92.5m ≈ 0.054 USD per ZAR — i.e. `bought per sold` = `USD per ZAR`. This is **not** quote-per-base for the canonical major-first pair (USD/ZAR), it's the inverse.
- Today the emitter (`mt300.ts:106`) writes `nearLeg.rate.amount.toFixed(5) = "18.50000"` and labels the field as "receiveCurrency per pay-unit (CDM convention)". The value (18.5) is `quote per base` = `ZAR per USD`, which equals `sold per bought` (not `bought per sold`) on a BUY MT300. That is **the wrong direction for field 36** under our reading of the SWIFT spec.

If this reading is correct under the actual SWIFT MT300 User Handbook (which Saskia + Tomas will verify before Slice 3 lands), then:
- **MT300 emission change required** under Option A: field 36 value becomes `1 / nearLeg.rate.amount` (or `nearLeg.notional.amountMinor / nearLeg.counterNotional.amountMinor` to avoid double-rounding).
- The same change is required under Options B and C (they all settle on `rate.amount = quote per base`); the SWIFT direction question is orthogonal to the schema-convention question.

**Resolution route.** Tomas (Operations & payments engineer) verifies against the SWIFT MT300 User Handbook + the MT300 SR2024 message specification before Slice 3 PR is opened. If verified as `bought per sold`, the Slice 3 PR carries the one-line value flip. If verified as something else (e.g. quote-per-base across the board — unlikely but possible), the Slice 3 PR carries only the comment fix. The card's recommendation does not depend on the answer; only the Slice 3 PR shape does.

---

## 7. Follow-on dispatches if CEO approves

Per the no-pause rule, the moment Marc approves this card with "y", Scrooge dispatches the following slices in sequence (each must complete and merge before the next opens):

1. **Slice 1 dispatch.** Kai (Trading-systems engineer) — *Author the schema docstring fix + 4-clause Zod refinement + `recon:fx-quoting-convention` + `recon:fx-rate-magnitude` advisory recon + dry-run event-store walk to confirm no persisted event fails the new refinement.* Workstream `WS-MARKETS-FX`; cite `D-FX-QUOTING-CONVENTION` + `D-MARKETS-SCHEMA-FOUNDATION` + `PR #654` precedent. Priority `now`.
2. **Slice 2 dispatch.** Bea (Accounting & financial reporting engineer, engineering) — *Repair the calculator + the two revaluation engines via the `baseAmountMinor()` helper; align Helena's RAS-MR-1 calibration assertions to the now-correct unrealised P&L magnitudes.* Workstream `WS-MARKETS-FX`. Priority `now` (gated on Slice 1 merge).
3. **Slice 3a dispatch.** Tomas (Operations & payments engineer) — *Verify SWIFT MT300 field 36 direction against the User Handbook; produce a short brief recording the verification; if value flip is needed, prepare the one-line patch.* Priority `now` (parallel with Slice 2; independent file scope).
4. **Slice 3b dispatch.** Devon (Customer & client lifecycle engineer / sim engineer) — *Simplify the sim generator's BUY branch; remove the `1/rate` invert; confirm sim trades replay through `recon:fx-quoting-convention` clean.* Priority `next-tick` (gated on Slice 1 merge; coordinates with Slice 3a on the MT300 path).
5. **Vera (Internal audit engineer)** — *Add `recon:fx-quoting-convention` and `recon:fx-rate-magnitude` to the standard Vera recon panel; confirm the parity recons show zero findings post-merge.* Priority `next-tick` (gated on all Slices merging).
6. **Saskia (this card's author)** — *Update trader-facing renders (dashboard "buys X at rate Y" copy) to use a `baseLeg(trade)` helper so the same trade reads the same way under any future schema migration; file a short note when done.* Priority `scheduled` (post-Slice 2; non-blocking).

If Marc rejects the card or asks for Option B / C instead, the dispatch graph is re-issued with the corresponding consequence-matrix rows attached.

---

## 8. Authority chain

- **`D-MARKETS-SCHEMA-FOUNDATION`** (CEO-approved 2026-05-07) — authority for the FX trade schema and the M4 event-family substrate this card modifies.
- **`D-FX-BOOK-BOUNDARY`** (CEO-approved 2026-05-07) — related FX sub-decision; introduced the `bookType` discriminator on every FX `TradeExecuted` and established the pattern of refining the FX payload at the type level (rather than runtime).
- **`D-FX-SALES-TRADING-FRONTEND`** — sim + counterparty config authority; the sim generator change in Slice 3 sits under this decision.
- **PR #654** — the just-landed FX pair direction canonicalisation; convention precedent (ACI Model Code §2 hierarchy). PR #654's "Out of scope" list explicitly defers the rate-direction and notional-axis debates to this card.
- **ACI Model Code §2** — currency-pair quotation hierarchy; canonical authority for "rate is expressed as quote per base".
- **IFRS 9 §5.7.1** — FVTPL recognition; the unrealised P&L line correctness is the load-bearing IFRS reason for fixing the calculator bug.
- **IAS 21 §28** — settlement-date FX gain/loss recognition; the realised P&L closure under PR-FX-LIFECYCLE-CLOSE is unaffected by this card but the consistency is preserved.
- **Principle 1** (`Principles/1-events-are-truth.md`) — schema is the canonical record; calculators are queries; the contradiction between the two is a Principle 1 smell.
- **Principle 5** (`Principles/5-multi-currency-entity-country.md`) — currency at the type level; the refinement enforces it.

---

## 9. Substrate gaps surfaced while drafting (NOT blocking this card)

These are roadmap items, captured for a separate brief.

1. **G-QUO-1 — Vera "schema-refinement-coverage" recon missing.** Today there is no recon that walks every event-type schema and asserts that its cross-field invariants are coded as a Zod refinement (rather than encoded only in prose docstrings or in downstream consumer logic). This card adds one such refinement; over time many more will accrue. A meta-recon would catch undeclared invariants. Brief route: Vera.
2. **G-QUO-2 — No magnitude-sanity advisory across the wider event store.** `recon:fx-rate-magnitude` is FX-specific. The same magnitude-sanity check (computed-rate ≈ counter / notional within 1bp) applies to every priced instrument. Generalising it to a `recon:priced-instrument-magnitude` advisory would catch this class of off-by-rate bug across IRD / repo / bond products as they land. Brief route: Vera.
3. **G-QUO-3 — Calculator-test coverage gap on magnitudes.** No test asserts the *magnitude* of `unrealisedPnlCalculator`'s output for a specific BUY trade — the existing tests assert shape, signs, and that revaluation events get emitted. A small fixture test that asserts `pnl ≈ notional × (currentRate − bookRate)` against a hand-computed value would have caught the off-by-rate bug at PR time. Brief route: Bea / Kai.
4. **G-QUO-4 — MT300 emission tests assert structure, not field 36 magnitude.** Existing MT300 tests check that field 36 is present and well-formed; they do not assert the value direction. Add a fixture test once Slice 3a resolves the SWIFT-spec question. Brief route: Tomas.
5. **G-QUO-5 — Sim generator + scenarios are diverging substrate cohorts.** The sim generator + the scenario fixtures have drifted into mutually-incompatible quoting conventions. Today this is a defect; tomorrow (as the sim generator grows to cover Forward / Swap / NDF + more counterparties + more pairs) it will become a structural risk if the two paths are not converged. Slice 3b closes the immediate gap; a periodic Vera recon that asserts sim-trade-stream ≡ scenario-trade-stream under all four discriminators (taxonomy, side, base/quote ccy, settlement-form) would prevent regression. Brief route: Vera + Devon.

---

## 10. TLDR (for Marc)

- **The bank's unrealised-P&L line on every open BUY FX trade is wrong by a factor of ~18.5× today** because `fx-calculators.ts:178` reads the pay-currency notional as if it were the base-currency notional. The bug is masked in scenario fixtures only because no test asserts magnitudes; it will bite the moment Helena's RAS-MR-1 calibration goes live.
- **The schema docstring at `fx.ts:132` says `rate.amount = receiveCurrency per pay-unit`, but every consumer except the sim generator reads it as `quote per base`.** The sim generator inverts on BUY (`legRate = 1/mid`) to honour the docstring; everything else doesn't. The contradiction is held together by a 2-line side-dependent invert in the revaluation engine that no test asserts.
- **Recommendation: Option A.** Keep pay/receive framing; restate `rate.amount = quote per base`; add a 4-clause Zod refinement; fix the calculator + revaluation engines with a 4-line `baseAmountMinor()` helper; simplify the sim generator (remove the invert); re-verify MT300 field 36 against the SWIFT spec (one open sub-question; Tomas owns). Three sequential slices; ~10 test deltas; no scenario rewrite. Smallest reachable fix that closes the contradiction and repairs the P&L bug.

---

*Filed under RMS Phase 3 — register-key `decisions`, classification `ceo-only`. The `RecordFiled` event is the canonical record; this markdown is its derived render. Awaiting CEO approval.*
