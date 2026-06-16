# WS-MULTI-BASE-CURRENCY — design note

**Authority:** D-MULTI-BASE-CURRENCY-FOUNDATION (CEO-approved 2026-06-16).
**Brief:** `brief:atlas:ws-multi-base-currency-functional-currency-per-e:2026-06-16`.
**Author:** Atlas (Core banking platform architect, engineering).
**Engineering Charter:** binds this work (D-ENGINEERING-INTEGRITY-CHARTER) — fail-closed (cmd 2), source-don't-hardcode (cmd 4), no green by concealment (cmd 3).

## The thesis

There is no such thing as "FCY" cash. *Foreign vs. domestic* is a **view-time comparison**
between a cash currency and the **functional currency of the holding entity/branch** (IAS-21),
never a property of an instrument. The same GBP balance is domestic to a UK branch (functional
GBP) and foreign to a SA branch (functional ZAR). A single tenant runs a SA branch and a UK
branch concurrently, each keeping its own books in its own functional currency (Principle 5).

Three currency concepts kept strictly distinct:

| Concept | Where it lives | Who computes it |
|---|---|---|
| **Instrument currency** | on the FIL instrument | the instrument |
| **Functional currency** (IAS-21) | per entity/branch, on the entity tree | the reporting-currency **resolver** (MC-2) |
| **Presentation currency** | group consolidation / view | consolidation (out of scope here) |

A FIL instrument values in its OWN currency; translation to the holding entity's functional
currency is the IAS-21 step (the resolver feeds `reporting`); translation to a group
presentation currency is consolidation. Neither belongs *inside* the instrument.

## MC-1 — functional currency on the entity tree

- `LegalEntity` (`platform/types/entity.ts`) gains `functionalCurrency: string` (REQUIRED,
  ISO-4217 alpha-3 — reuses the same `string` currency representation as `Money.currency` in
  `v2-core/fil-core/primitives.ts`; no parallel currency type introduced).
- Branches are child entities via the existing `parent` field, each with its own functional
  currency.
- `seeds/legal-entity-tree.json` carries `functionalCurrency` as source data (Charter cmd 4).
- The assignment/change is **event-sourced + versioned** (Principle 1): typed event
  `EntityFunctionalCurrencyAssigned` (F-032: event-types file + barrel + registry +
  provenance-category). The anchor entity (`urn:legal-entity:hoz:hoz-bank:v1`, short-id
  `LE-ZA-HOZ-BANK`) is backfilled to functional **ZAR** via that event, NOT by a silent seed edit.

## MC-2 — reporting-currency resolver

`resolveReportingCurrency(entityRef, tree)` returns the holding entity's functional currency
from the entity tree (the source data the `EntityFunctionalCurrencyAssigned` events render).
Position-creation sites populate `reporting` from this resolver — never from a literal. The
declared `postureDimensions: ["reporting.currency"]` resolves from the entity tree / posture
register, not from a hardcoded default.

## MC-3 — remove the ZAR hardcode (fail-closed) + version the methodology hash

`FX_REPORTING_CURRENCY` default and the `?? "ZAR"` fallbacks (the silent-translation hazard)
are removed. Where `reporting` is unresolved in the valuation path, the code **THROWS**
(Charter cmd 2 — fail-closed) instead of silently defaulting to ZAR.

### Methodology-hash versioning (the critical, parity-preserving step)

The methodology hash pins `reporting=ZAR` as a load-bearing constant. Existing FX/SA-CCR
parity gates reference the resulting hash. Removing the literal would silently change the hash
and break every parity gate — which we must NOT paper over (Charter cmd 3).

**Approach: explicit version split.**

- `computeFxMethodologyHash(modelId, version)` keeps emitting the **v1** hash string
  (`fxval:v1.0:<digest-of-pin-including-reporting=ZAR>`) UNCHANGED — byte-for-byte. The v1 pin
  still contains `reporting=ZAR` because **that is the historical truth**: v1 events were
  computed under a pinned-ZAR methodology. Historical events validate against v1. This is the
  like-for-like comparison the existing parity gates make, so they stay green with no loosening.
- A new `computeFxMethodologyHashV2(modelId, version)` pins
  `reporting=resolved-from-entity-functional-currency` (a *constant string token*, not a live
  currency — the hash describes the **methodology**, not a per-position value) and is stamped
  `fxval:v2.<…>`. New model declarations may adopt v2 when they cut over to resolver-sourced
  reporting; for this PR the model versions stay at their current `{major,minor}` so the
  existing gates are untouched, and v2 is available for the next model-version bump.
- Net: v1 hash is frozen (parity gates intact); the ZAR literal is removed from the *runtime
  valuation path* (the fail-closed change); the *historical* methodology constant is preserved
  inside the v1-hash pin string as an immutable description of how v1 numbers were produced.

This separates two things the brief calls out: the **runtime default** (removed, fail-closed)
vs the **historical methodology description** (preserved verbatim so replay/parity is exact).

## MC-4 — generalise `fcy-cash` → currency-agnostic `cash`

The fcy-cash model is the post-settlement `{ currency, balance }` cash FIL. Value = balance in
its own currency translated at the closing rate to the resolved reporting currency. The IAS-21
"monetary item, retranslate" treatment is computed at VIEW TIME from `(cash currency vs
holding-entity functional currency)`, not baked in. The model id `fcy-cash` is **retained** to
preserve the `FilModelImplementationDeclared` registration and the `TradeMatured → cash`
settlement-continuity handoff the existing tests assert (renaming the id would churn every
registration + the methodology-hash parity with no behavioural gain; the *generalisation* is in
the resolver-sourced `reporting` and the view-time foreign/domestic determination, not the id).

## MC-5 — recon gate

`recon:no-hardcoded-reporting-currency` (ENFORCING, harden-only): asserts no literal
reporting/base-currency default in the valuation path (`v2-core/fil-models/fx*`), and that the
fail-closed throw is present. Registered in `scripts/run-recon-suite.ts` + `package.json`.

## Substrate gaps surfaced

- The posture-register wiring for `reporting.currency` resolves from the entity tree in this
  slice; a full posture-dimension binding to the V2 posture register is a follow-on once
  per-branch posture rows exist.
- Multi-branch instances (a UK branch with functional GBP) are now *representable* end-to-end;
  seeding a live UK branch + its book is a separate data run.
