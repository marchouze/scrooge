---
title: CEO decision — D-MARKETS-SCHEMA-FOUNDATION (approved)
author: Marc · Scrooge (record)
date: 2026-05-07
summary: ISDA CDM adopted as the canonical schema foundation for the global-markets trading system. M1–M5 build sequence authorised. M6/M7 deferred to franchise-pull; M8 cloud lift deferred to post-licence.
decision-required: false
superseded-by:
  - reference: Owner Inbox/2026-05-07_scrooge_ceo-decision-record_d-markets-schema-foundation.md
    note: "Old `ceo-decision_<slug>` naming pattern superseded by the canonical `scrooge_ceo-decision-record_d-<id>.md` mirror. The CeoDecision event is canonical (Principle 1)."
superseded-on: 2026-05-11
superseded-by-author: Owen (Company Secretary, governance) — sweep authorised by CEO 2026-05-11
---

# CEO decision — D-MARKETS-SCHEMA-FOUNDATION (approved)

**Decision ID:** `D-MARKETS-SCHEMA-FOUNDATION`
**Authors of the proposal:** Saskia (Head of Global Markets — franchise & governance) · Kai (trading systems engineer — implementation)
**Decided by:** Marc (CEO)
**Date:** 2026-05-07
**Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md`
**Event:** `CeoDecision` appended to the event store with citations `GOV-FRAMEWORK-CEO-RESERVED` and `COMPANIES-ACT-71-2008` (per `Procedures/by-policy/ceo-decision-review.md`).

---

## What was decided

**Approved.** ISDA Common Domain Model (CDM) is adopted as the canonical schema foundation for every tradeable or holdable instrument in the bank's global-markets stack — listed cash, OTC derivative, structured product, repo, securities lending, and any future product family the franchise pulls in.

The M1–M5 build sequence is authorised:

- **M1 — CDM core + listed equities** (~4 weeks after substrate gate)
- **M2 — Listed bonds + repo basics** (~3 weeks)
- **M3 — OTC IRS, vanilla** (~6 weeks; gated on Atlas A0–A2)
- **M4 — FX swaps + HQLA repo financing** (~3 weeks)
- **M5 — Optionality + structured products + FRTB-IMA prep** (~6 weeks)

**Deferred:** M6 (securities lending + multi-CCP) is deferred to franchise-pull; M7 (credit derivatives) is deferred and only revisited if institutional demand surfaces; M8 (Azure cloud lift) is deferred to post-licence per the Principle 3 implementation sequence.

## Why

Per the proposal's recommendation:

- CDM is the only public standard whose decomposition matches the strategic-foundation product mix (JSE bonds + JSE equities + OTC IRD) and the franchise's likely expansion path.
- Open-source, vendor-neutral, regulator-friendly — fits the build-not-buy posture.
- Composable primitives directly answer the architectural requirement: simple or complex products from the same building blocks.
- Aligns with Principle 1 (events-as-truth — CDM is event-native), Principle 5 (multi-X — type-level), Principle 6 (single-graph — one product graph for cash, derivatives, structured).
- The opportunity cost of not adopting CDM is paid forward as integration debt; banks that built custom schemas migrated to CDM later at higher cost.

## What this authorises immediately

- **Kai** to begin M1 engineering work: CDM TypeScript bindings under `@platform/markets/cdm/`; Zod validators at the event-store boundary; primitive registry; equity event types; trade-record + position + sub-ledger projections (with Anya + Bea).
- **Atlas** to register the lifecycle event types from §6 of the proposal at the substrate's A0 schema-freeze (paired with the agent-runtime substrate spec already authorised in `D-AGENT-RUNTIME-AUTHORIZE`).
- **Mira** to begin populating the obligations register with the URN set in §8 of the proposal (JSE Rules, FMA, FSCA Conduct Standards, ISDA Master / CSA, IFRS 9/13/7, BCBS FRTB / SA-CCR / IRRBB, Joint Standard 1 of 2024 on the trading estate, FIC, POPIA s.71 on automated decisioning, STT / FATCA / CRS / IAS 12).
- **Owen** to add `counterparty-onboarding-markets.md`, `npa-gate.md`, and `mandate-attestation.md` to the procedures index ahead of M1.
- **Senna + Rashida** to schedule the threat-model gate on the FIX-gateway perimeter and the OTC trade-confirmation pathway.
- **Bea + Camille** to define IFRS 9 classification rules per product family ahead of M1 sub-ledger projection ship.

## What this does not authorise

- **Live trading.** Build-only operating posture (D1) remains in force; no live counterparties, no real money, no live regulator submissions until SARB licence approval. M1–M5 run on synthetic data per the local-base-infrastructure spec.
- **Vendor-product-model adoption.** The bank does not buy Murex / Calypso / Summit / Adaptiv / Quantifi / similar. The substrate is built; vendor pricing libraries may be consumed via clean interfaces but never as the canonical product model.
- **M6 / M7 work.** Deferred pending franchise-pull or institutional demand evidence.
- **CCP / CSD live integrations.** Synthetic JSE Clear and Strate simulators only until pre-licence go-live readiness.
- **Trading mandate (B5) calibration.** Saskia and Helena run the calibration jointly; finalisation gated to M3 IRS go-live.

## Cross-persona notification

This decision is dispatched to the named owners as input for their next agent runs. Per Principle 7's escalation-channel discipline, the resolution event is the typed channel; each agent picks the decision up from the event log and acts on the §11 dependency map of the proposal.

—Recorded by Scrooge per `Procedures/by-policy/ceo-decision-review.md`
