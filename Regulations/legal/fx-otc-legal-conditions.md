# FX OTC Vanilla — Legal Dimension Conditions

**Product:** `prd:bank:fx:otc-vanilla`  
**Dimension:** legal  
**Result:** design-attested (with four tracked conditions)  
**As of:** 2026-06-15T12:00:00.000Z  
**Author:** Imani (Legal-as-code engineer, engineering)  
**Governance owner:** Devon (COO, interim, pending future GC)

**Authority:**
- `D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL` (CEO 2026-06-15) — product approval withdrawn
- `D-NPA-GATE-POLICY-REDESIGN` — design-attested with tracked conditions is an accepted NPA outcome
- `D-FX-HELD-DIMS-SEAT-SWEEP` (CEO session-delegation 2026-06-11)
- `D-NEW-PRODUCT-APPROVAL-POLICY §5`

---

## Summary

Following the withdrawal of `prd:bank:fx:otc-vanilla`'s product approval
(`D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL`, CEO 2026-06-15), the legal dimension
is formally recorded as **design-attested with conditions** under
`D-NPA-GATE-POLICY-REDESIGN`. This is the correct and honest outcome: the
legal dimension has four open conditions that all require either real
counterparties or external counsel, and therefore cannot be closed in the
build phase.

The typed `ProductDimensionAttested { result: "design-attested", deferredGaps: [...] }`
event is the canonical artefact (Principle 1). This file is a human-readable
render of that event for governance reference.

---

## Condition 1 — FAIS s.45 Counsel Opinion

**Gap ID:** `fx-fais-s45-counsel-opinion`  
**Owner:** Devon (COO, interim, pending future GC) — discharged via external counsel at engagement  
**Target trigger:** licence-application external-counsel engagement (FAIS s.45 opinion delivered)  
**Citations:** `FAIS-ACT-37-2002`, `D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL`

The bank's in-house reading is that the institutional FX desk falls within the
FAIS s.45 institutional/market-counterparty carve-out and therefore does not
require a separate FSP licence for the OTC FX product. That reading is
plausible but un-opined. External counsel must formally opine on this analysis
at the licence-application stage before the FX product can advance beyond
design-attested on this condition.

---

## Condition 2 — Real ISDA 2002 Master Agreement Execution

**Gap ID:** `fx-real-isda-execution`  
**Owner:** Imani (Legal-as-code engineer, engineering)  
**Target trigger:** licence-day — real counterparty ISDA 2002 Master Agreement executed (documentHash mandatory)  
**Citations:** `ISDA-2002-MASTER-AGREEMENT`, `D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL`

All `LegalDocumentationSigned` events currently in the event store are
build-phase fixtures: no agreements have been executed, and no
`documentHash` values exist. At licence-day, real ISDA 2002 Master Agreements
(plus South Africa Schedule) must be executed with each authorised FX
counterparty and ingested into the document store with valid hashes. Until then,
the legal-documentation gate is enforced against fixtures, not real agreements.

---

## Condition 3 — Jurisdictional Opinion Refresh

**Gap ID:** `fx-jurisdictional-opinion-refresh`  
**Owner:** Imani (Legal-as-code engineer, engineering)  
**Target trigger:** first non-ZA counterparty onboarding — first `JurisdictionalOpinionRefreshed` filed with doc-store `opinionDocumentHash`  
**Citations:** `D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL`

No `JurisdictionalOpinionRefreshed` event exists in the store. The ISDA
South Africa netting opinion (confirming enforceability of close-out netting
under the ISDA Master Agreement in South African insolvency proceedings)
requires subscription to the ISDA opinion service — a licence-day engagement.
Until filed, the annual-refresh watchdog emits medium monitoring alerts.
This condition closes when the first real opinion document is filed.

---

## Condition 4 — CSA Margin Mechanics

**Gap ID:** `fx-csa-margin-mechanics`  
**Owner:** Imani (Legal-as-code engineer, engineering)  
**Target trigger:** first live ISDA/CSA execution with real counterparty (margining substrate build precedes forward/IRD margin go-live)  
**Citations:** `D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL`

No Credit Support Annex (CSA) margining substrate exists. Current build-phase
fixture signings carry `csaPresent: false`. Imani G-9 §3 makes a CSA mandatory
once forward/IRD margin requirements bind. The variation-margin mechanics
(initial margin calculation, margin call workflow, collateral posting events)
are deferred until the first live ISDA/CSA execution with a real counterparty.

---

## Machine-trackable record

The canonical artefact is the `ProductDimensionAttested` event in the event
store at `as_of: 2026-06-15T12:00:00.000Z`. The recon gate
`recon:npa-deferred-gap-tracking` inventories these conditions on every CI run
and WARNs on any malformed entry.

Source: `prototype/platform/markets/products/npa-fx-legal-conditions-post-withdrawal.ts`
