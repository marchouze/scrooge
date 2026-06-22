# Plan — Bond & Money-Market V2 GL pure-fold (subsequent task)

> Status: **PLANNED, not implemented.** Scoped 2026-06-22 after verifying against
> current `origin/main`. Implementation deferred to a follow-on task per CEO
> instruction. Authority to cite when executed: `D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD`
> (CEO-approved 2026-06-17), `D-DERIVED-EVENT-IRREDUCIBILITY-TEST`,
> `D-CAPITAL-ASSET-CLASS-V1`, `D-ENGINEERING-INTEGRITY-CHARTER`. Principle 1; Principle 2.

## Goal

Make the **bond** and **money-market** contributions to the V2 trial balance / GL
entries / GL accounts a **pure fold over their primary FIL lifecycle events through
lifted posting rules**, eliminating the read of stored `GlPostingEmitted` — exactly as
**FX** ([`fx-fold.ts`](fx-fold.ts)) and **capital** ([`capital-fold.ts`](capital-fold.ts))
already are. `GlPostingEmitted` is a *derived* event (reducible to primary event + rule);
storing it and reading it back is the pattern this removes (D-DERIVED-EVENT-IRREDUCIBILITY-TEST).

## The exemplar to copy: the FIL-native fold (FX + capital)

Both existing folds read the FIL instance lifecycle family
(`FilInstrumentCreated` / `FilInstrumentAmended` / `FilInstrumentTerminated`) and apply
**lifted posting rules** in `v2-core/posting-rules/<class>.ts`:

- `fx-fold.ts` → `v2-core/posting-rules/fx.ts` (+ `fx-settlement.ts`), over `fil:type:fx:*`.
- `capital-fold.ts` → `v2-core/posting-rules/capital.ts`, over the `capital` asset class.
  Capital reads `payload.economicTerms.qualifyingCapital` — an **optional, asset-class-
  specific block** added to `filEconomicTermsSchema` by D-CAPITAL-ASSET-CLASS-V1.

`gl-projection-v2.ts` accumulates each fold's legs into the same per-(account,currency)
balance map, and EXCLUDES that class's own `GlPostingEmitted` legs by `postingRuleId`
prefix to avoid double-counting (FX excludes `PR-FX-*`; capital uses the same mechanism).

## Gating verification (against `origin/main`, 2026-06-22)

The task asked to verify the posting rules + seeded FIL instances exist before folding.
They do **not**:

1. **No bond/MM posting rules in `v2-core/posting-rules/`** — that dir holds only
   `capital.ts`, `fx.ts`, `fx-settlement.ts`, `registry.ts`.
2. **No bond/MM FIL instances seeded** — `seed-v2-fil-instances-ir-fx.ts` materialises FX +
   IR-vanilla-swap only; capital is seeded by `emit-capital-injection-v2-sim.ts`. Nothing
   emits bond/MM `FilInstrumentCreated` events.
3. **`filEconomicTermsSchema` carries no bond/MM posting inputs** — it is SA-CCR core
   (`assetClass`, `notional`, `direction`, `counterpartyId`, …) plus the optional
   `qualifyingCapital` block. It has no dirty-price/coupon/EIR (bond) or deposit-
   category/repo-leg/rate (money-market) terms.

What *does* exist (re-usable):
- Bond/MM FIL **type definitions** under the `ir` asset class
  (`v2-core/fil-models/ir/bond/types/…`, `v2-core/fil-models/ir/money-market/types/…`).
- A parallel **accounting-event engine** path (`gl-posting-engine-v2-bond.ts`, `-mm.ts`)
  triggered by `BondTradeExecutedV2` / `DepositTakenV2` families. These are **unwired**
  (`runGlV2BondEngine`/`runGlV2MmEngine` are never called by `ci:migrate` or any seed) and
  **unseeded**, so the current V2 bond/MM GL contribution is **zero**. The lifted posting
  rules below should be the single source of truth — extract the engine's private
  leg-builders into `v2-core/posting-rules/` and re-point the engine at them (no drift).

**Consequence:** like capital before its data landed, the fold is structurally correct but
**vacuous** until bond/MM FIL instances are seeded. That seeding is the remaining gap
(item 6), filed as a typed event, not hidden (Charter cmd 5).

## Work items (FIL-native — mirror capital)

1. **Extend `filEconomicTermsSchema`** (`v2-core/fil-instances/events.ts`) with optional,
   asset-class-specific blocks: a bond block (dirty price / clean price / coupon schedule /
   EIR / portfolio book) and a money-market block (deposit category / rate / repo leg /
   accrual basis), exactly as `qualifyingCapital` was added. Optional ⇒ existing FX/IR/
   capital instances parse unchanged.

2. **Lift bond posting rules → `v2-core/posting-rules/bond.ts`** and **money-market rules →
   `v2-core/posting-rules/money-market.ts`** — pure `FilInstrument*Payload → leg[]`
   functions reading the new economic-terms blocks, returning an in-memory leg
   (`{ accountCode, creditDebit, amount, postingDate, description, postingRuleId,
   sourceEventId }`), mirroring `capital.ts`. Re-point `gl-posting-engine-v2-bond.ts` /
   `-mm.ts` at these lifted functions so engine and fold share one rule source. Preserve the
   fail-closed behaviour (no leg for amount-less / ill-formed terms — surfaced, never a
   hardcoded currency).

3. **`posting-rules-v2/bond-fold.ts`** and **`posting-rules-v2/mm-fold.ts`** — mirror
   `capital-fold.ts`: read the FIL lifecycle family, apply the lifted rules per instance,
   gate on the posting-date window + caller `filter`, return `{ legs, skipped }`. Use
   `isBondPostingInstance` / `isMmPostingInstance` type guards (cf. `isCapitalPostingInstance`)
   so non-bond/non-MM FIL instances are ignored.

4. **Wire into `gl-projection-v2.ts`** (all three: `computeTrialBalanceV2Uncached`,
   `computeGlEntriesV2Uncached`, `computeGlAccountsV2Uncached`): add the bond + MM fold
   accumulation alongside FX + capital; extend the `GlPostingEmitted` exclusion set with
   the bond/MM rule-id prefixes (`PR-BOND-*`, `PR-MMD-*`, `PR-FUNDING-*`, `PR-REPO-*`,
   `PR-IBL-*`) so any legacy engine-emitted leg is never double-counted; update the module
   header (currently "bond / money-market … fold from GlPostingEmitted exactly as before").

5. **Fold-equivalence recons** — add `recon:gl-v2-fold-equivalence-bond` and `-mm`, mirroring
   [`gl-v2-fold-equivalence-fx.ts`](../../recon/gl-v2-fold-equivalence-fx.ts): golden = lifted
   rules over the same FIL events; assert the fold reproduces it byte-for-byte over the bond/MM
   COA account set and that the projection rows match. Clean/vacuous store ⇒ both empty ⇒ passes
   vacuously. Register in `package.json` + the recon suite. Keep `recon:bond-gl-v2-parity` green.

6. **Seed bond/MM FIL instances + file the data-population gap.** Add a seeder (cf.
   `seed-v2-fil-instances-ir-fx.ts` / `emit-capital-injection-v2-sim.ts`) materialising bond/MM
   FIL instances carrying the new economic terms, wired into `ci:migrate`. Until it lands, file
   a typed gap event (`ProductDeferredGap` / `SubstrateGap`) recording that the bond/MM fold is
   vacuous pending seeding — Charter cmd 5, no silent deferral.

7. **Tests** (`bond-fold.test.ts`, `mm-fold.test.ts`) — mirror `fx-fold.test.ts` /
   `capital-fold.test.ts`: seed FIL fixtures, assert legs == lifted-rule golden and balance
   (Σdebit == Σcredit per currency), projection surfaces them, no double-count when a matching
   `GlPostingEmitted` is also present, and a negative fail-closed test.

## Sequencing note

Items 1–2 (schema + lifted rules) are the real design work and gate everything else; 3–5 are
mechanical mirrors of the FX/capital folds; 6 (seeding) makes it non-vacuous. Can land as one PR
or split (schema+rules, then fold+wiring+recon, then seed).

## Definition of done

`bun run ci` from `prototype/` passes in full, relative env paths:
```
mkdir -p .local
export BANK_EVENT_DB=.local/event.db BANK_V2_ANCHOR_DB=.local/anchor.db BANK_V2_CONTROL_PLANE_DB=.local/control-plane.db
bun run ci:migrate
bun run ci
```
New recons registered + green; `recon:bond-gl-v2-parity` still green; the data-population gap
filed (or the seeder landed); Charter Definition-of-Done holds.
