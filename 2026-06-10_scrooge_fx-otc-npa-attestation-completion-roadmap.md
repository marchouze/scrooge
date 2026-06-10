# FX OTC umbrella NPA — attestation completion roadmap

**Decision:** `D-FX-OTC-NPA-SCOPE-EXPANSION` (CEO session-delegation, 2026-06-10)
**Product:** `prd:bank:fx:otc-vanilla` — OTC Vanilla FX (Spot, Forward, Swap; Option at M5)
**Approved scope (v1.0):** execution venue OTC · instruments [spot, forward, swap] · any currency pair · all counterparty types
**Supersedes:** `prd:bank:fx:fx-swap-usdzar` (retired, migration path → umbrella)
**Living source:** `recon:npa-coverage` (advisory) — the per-axis gap scan that seeds this roadmap.

## Why this roadmap exists

The umbrella product is **approved at design level**: all 14 NPA dimensions attest, but
on design rather than implementation evidence, because the broadened scope outruns the
substrate (spot is live; forward/swap revalue on a static curve with no forward-points
accrual; "any pair" exceeds the seven wired ZAR pairs; "all counterparty types" exceeds
the onboarded set; option is not built). Each item below closes a gap surfaced by the
single-graph coverage scan (Obligation/Objective → Policy → Procedure → Capability →
Outcome → UI) and lifts one or more dimensions to **implementation-attested**.

Current scan headline (clean-seed graph): ~48 FX-scoped obligations, ~45 with no CLOSES
policy edge, 6 objective coverage gaps, 80 orphan procedures, 1 orphan capability, 1 UI
domain dark (BA-RETURN/NOP). Run `bun run recon:npa-coverage` for the live list.

## Workstreams

### 1. Forward & swap completion → accounting, market-risk, model-risk
- Forward-points accrual accounting — IAS 21 §28 time-value vs intrinsic split (new SLA
  rule alongside `pr-fx-001/002`).
- Swap far-leg posting rule + forward-points separation (far leg currently rides the spot rule).
- Replace the static `forward-rate-seed.ts` curve with live/OIS discounting (Ravi's
  ALM/yield-curve substrate) — removes the flat-discount approximation (GAP-FWD-1/2).
- Multi-pair VaR + SA-CCR add-on validation for forward/swap.

### 2. "Any currency pair" → operational-readiness, accounting, market-risk
- Generalise pair support beyond the seven hardcoded ZAR pairs: per-currency
  nostro/receivable/payable accounts + suspense-free resolution (extend
  `recon:fx-supported-currency-no-suspense`), multi-pair spot+forward seeds, multi-pair VaR.

### 3. "All counterparty types" → credit-risk, legal, conduct, capital
- Wire the typed `counterpartyEligibility` scope to party-register `authorisedProducts` /
  relationship edges and SA-CCR `CounterpartyType` weighting across bank/corporate/PSE/fund.
- **Retail/lower-tier conduct gate** — if "all" genuinely includes retail, add the FAIS
  appropriateness/conduct gate before that eligibility is exercised (flagged assumption).
- ISDA/CSA coverage across all counterparty classes (legal-documentation dimension).

### 4. Reg-horizon / policy / procedure / capability closure → all incomplete-chain dimensions
- Close FX/Excon/Domain-M obligations with no CLOSES policy edge (`findUnimplementedObligations`).
- Map the currently-unhinted dimensions (`operational-readiness`, `tax` — no `policyHints`
  in `DIMENSION_METADATA`) so they are graph-traceable.
- Author/extend the OTC-FX NPA procedure; fix orphan `GOVERNS`/`REALISES` edges down to the
  booking/reval/posting/VaR/settlement capabilities.
- Confirm FX policies `ALIGNS_TO` SARB-PA financial-stability + FSCA market-integrity
  objectives (close `findObjectiveCoverageGaps`).

### 5. UI surfacing → the (e) gate
- ✅ FX NPA badge strip re-pointed onto the umbrella product + scope (`markets-fx-npa.ts`).
- Activate BA-RETURN / NOP returns surfacing beyond the demo surface (returns-submission
  layer currently dark).

### 6. Option build — the M5 increment → adds `option` to scope (v1.1)
- Add `FX-option` to `fxProductTaxonomySchema` + booking lifecycle.
- Option pricing: Garman-Kohlhagen / vol-surface market-data substrate + feeder.
- Option accounting (premium/intrinsic/time-value), option market-risk (vega, vol-surface
  VaR), option model-risk validation.
- Amend the umbrella NPA: `fxInstrumentVariants += "option"`; attest the option dimensions;
  publish `prd:bank:fx:otc-vanilla` v1.1.

## Owning seats
Markets/Atlas engineer (schema, booking, pricing) · Bea (accounting/SLA) · Helena & Saskia
(market/credit/model risk) · Owen/Imani (legal, ISDA/CSA) · Mira (obligations/policy
coverage) · CCO (conduct/AML). Each PR cites the dimension and the specific axis
(horizon/policy/procedure/capability/UI) it closes.
