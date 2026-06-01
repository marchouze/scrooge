---
agent: Ravi
trigger: alm-readiness
asOf: 2026-06-01T05:37:05.400Z
decision-required: false
---

# Ravi — ALM readiness, 2026-06-01

Autonomous run of Ravi's daily ALM-readiness attestation per `Team/Ravi.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Seventeenth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Engineer-side counterpart to Eitan's `LiquiditySnapshot` — Eitan reports counts of liquidity / treasury events the ALCO chair would consume; Ravi reports the substrate-readiness state for each ALM pipeline (LCR, NSFR, IRRBB, FX position, FTP, collateral, SAMOS funding) the engineer would build to make those events real.

**Headline:** 9 ALM pipelines tracked · readiness 0 ready / 1 drafting / 8 specified / 0 not-yet-specified · 7 Ravi-owned obligations indexed (0 PARTIAL / drafting) · 192 ALM-domain events (last 7d).

## Eitan's latest snapshot

Latest `LiquiditySnapshot` event: 2026-05-31T09:43:32.207Z

| Eitan event class (last 24h) | Count |
|---|---|
| `HQLAReported` | 0 |
| `LiquidityReport` | 0 |
| `LCRRatioProjection` | 0 |
| `NSFRRatioProjection` | 0 |
| `IRRBBChecked` | 0 |
| `FXPositionReported` | 0 |
| `SAMOSFundingApproved` | 0 |

Ravi's daily run pairs with Eitan's daily run: Eitan reports the ALCO-chair side; Ravi reports the engineer side. Together they close the read-side ↔ build-side loop on the ALM-projection substrate.

## Ravi-owned obligations slice

| Obligation | Citation | Owner | Status |
|---|---|---|---|
| ORG-PR-06 | [TBD] | Liquidity Risk Management Policy | Helena + Eitan |
| ORG-PR-07 | [TBD] | Liquidity Risk Management Policy | Helena + Eitan |
| ORG-PR-08 | [TBD] | Liquidity Risk Management Policy; Funding Strategy Policy | Eitan |
| ORG-PR-11 | [TBD] | IRRBB Policy (within Risk Management Framework) | Helena + Eitan |
| ORG-PR-14 | [TBD] | Liquidity Risk Management Policy; ILAAP | Eitan + Helena |
| ORG-PR-15 | [TBD] | Liquidity Risk Management Policy; Funding Strategy Policy | Eitan |
| ORG-MK-08 | [TBD] | Excon Compliance Policy (planned); Funding Strategy Policy | Eitan + Zara |

## ALM pipeline readiness

| Pipeline | Engineer-side state | Substrate required | Next engineering step |
|---|---|---|---|
| `alm:hqla-inventory` (HQLA inventory + classification (LCR numerator)) | specified | HQLA inventory projection + Banks Act Reg 26 Level-1 / Level-2A / Level-2B classification + haircut application. Owner: Ravi + Atlas. | Specify HQLA-eligibility table per Banks Act Reg 26; build inventory projection against the synthetic capital line; emit `HQLAObserved`. |
| `alm:lcr-net-outflow` (30-day net cash outflow + LCR ratio) | specified | 30-day stressed cash-outflow model (run-off rates per Banks Act Reg 26 / BCBS D295) + LCR ratio engine consuming HQLA inventory. Owner: Ravi + Anya (projection runtime). | Wait for HQLA inventory projection (above); first `LCRComputed` event fires once inventory + outflow model both wired. |
| `alm:nsfr-asf` (Available stable funding (NSFR numerator)) | specified | ASF factor table per Banks Act Reg 27 / BCBS D335, applied to liabilities by tenor / counterparty type. Owner: Ravi + Anya. | Specify ASF factor table; first ASF projection fires once synthetic liability book exists in the event log. |
| `alm:nsfr-rsf` (Required stable funding (NSFR denominator)) | specified | RSF factor table per Banks Act Reg 27 / BCBS D335, applied to assets by tenor / encumbrance / quality. Owner: Ravi + Anya. | Specify RSF factor table alongside ASF; same projection runtime; first `NSFRComputed` event fires once both wired. |
| `alm:irrbb-repricing-gap` (Repricing-gap engine (IRRBB / EVE / NII)) | specified | Repricing-gap projection per BCBS d365 — bucket banking-book positions by repricing tenor; compute EVE shock and NII sensitivity. Owner: Ravi joint with Rohan (measurement). | Specify EVE shock scenarios per BCBS d365; build first-cut against synthetic banking-book positions; emit `IRRBBChecked`. |
| `alm:fx-position` (FX position projection (Excon)) | specified | FX position projection by currency + entity per Currency & Exchanges Manual. Owner: Ravi (projection); Mira (Excon classification co-owner). | Specify Excon position categories per Currency & Exchanges Manual section A.4; first `FXPositionReported` event fires once first FX-denominated event lands. |
| `alm:ftp-attribution` (FTP attribution engine (transaction-level)) | drafting | FTP-curve register + per-postable-event attribution module subscribing to `TradePosted` / `FundingDrawn` / `DepositReceived`. Owner: Ravi. | Curve registry drafted; market-rate feed integrations (ZARONIA, JIBAR, OIS, FX) deferred to vendor-selection phase — currently the binding gap on first FTP cycle. |
| `alm:collateral-inventory` (Collateral inventory + haircut application) | specified | Collateral-eligibility register + per-counterparty inventory projection + haircut application engine. Owner: Ravi + Atlas. Mandatory pre-condition for repo book. | Specify eligibility schedule alignment with ISDA / GMRA collateral annexes (Imani co-owns); first `CollateralUpdated` event fires once first repo / GMRA contract executed. |
| `alm:samos-funding` (SAMOS funding-window position (correspondent-mediated)) | specified | Correspondent-bank API contract for SAMOS-mediated funding (per indirect-participant posture — `project_indirect_participant_posture.md`). Owner: Tomas (connector); Ravi (funding-plan logic). NOT direct SAMOS membership. | Draft correspondent-bank API contract with Tomas; first `FundingDrawnDown` event fires once correspondent connector lands. Direct SAMOS membership is explicitly out of scope under indirect-participant operating posture. |

## ALM-domain events (last 7 days)

| Event | Count |
|---|---|
| `HQLAObserved` | 0 |
| `LCRComputed` | 16 |
| `NSFRComputed` | 16 |
| `IRRBBChecked` | 160 |
| `FXPositionReported` | 0 |
| `CollateralUpdated` | 0 |
| `FundingDrawnDown` | 0 |
| Prior `ALMReadinessSnapshot` (this agent) | 5 |

## Substrate gaps surfaced this run

- **Liquidity / ALM projection runtime (Anya + Ravi)** — pre-condition for `LCRComputed` and `NSFRComputed` events. HQLA inventory + ASF / RSF factor tables specified per Banks Act Reg 26 / Reg 27; not yet wired to the postable-event stream.
- **Repricing-gap engine (Ravi joint with Rohan)** — pre-condition for `IRRBBChecked` events. EVE shocks per BCBS d365 specified; first run blocks on synthetic banking-book positions in the event log.
- **FX position projection (Ravi joint with Mira)** — pre-condition for `FXPositionReported`. Excon position categories per Currency & Exchanges Manual specified; first event fires on first FX-denominated postable.
- **FTP curve sources** — currently the binding gap on the first FTP cycle. Curve registry drafted; market-rate feed integrations (ZARONIA, JIBAR, OIS, FX spot/forward) deferred to vendor-selection phase.
- **Correspondent-bank SAMOS connector (Tomas + Ravi)** — under indirect-participant operating posture (`project_indirect_participant_posture.md`), the bank does **not** join SAMOS directly; it accesses SAMOS via a sponsor / correspondent bank. The connector is therefore an API contract with the correspondent, not direct SAMOS membership. Pre-condition for `FundingDrawnDown` events.
- **Collateral inventory substrate (Ravi + Atlas + Imani)** — mandatory for repo book. Eligibility schedule blocks on ISDA / GMRA collateral annexes (Imani's clause library).
- **Hedge-accounting boundary (Ravi + Bea)** — designation / effectiveness substrate prototyped; Bea's posting boundary not yet wired. Activates with first hedge designation post-licence.

## Ravi's narrative

ALM-projection substrate is in pre-first-event state across the board: zero `HQLAObserved`, `FXPositionReported`, `CollateralUpdated`, `FundingDrawnDown` in the last seven days, and Eitan's 24h shadow shows zero of every consumed event. The 16 `LCRComputed` / 16 `NSFRComputed` / 160 `IRRBBChecked` in the 7-day window are engine self-test traffic against synthetic books, not postable measurements — they do not retire the Reg 26 / Reg 27 / BCBS d365 obligations. The load-bearing block on Eitan's first end-to-end live LCR / NSFR sign-off is `alm:hqla-inventory`: until the HQLA inventory projection with Banks Act Reg 26 Level-1 / 2A / 2B classification and haircuts emits a real `HQLAObserved`, the LCR numerator is unfounded and `alm:lcr-net-outflow` cannot produce a signable `LCRComputed`. Degraded-mode is operating cleanly as the daily-funding-event SLA stand-in — Eitan's snapshot is consuming Ravi-side "no postable events, substrate state X" attestations in lieu of `HQLAReported` / `LiquidityReport` / `SAMOSFundingApproved`, which is the correct posture in build phase but is not a substitute for the Reg 26 / Reg 27 sign-off path.

Three observations rank above the rest. (1) `alm:hqla-inventory` is one engineering ticket from green: the Reg 26 eligibility table is specifiable today against the synthetic capital line, and emitting first `HQLAObserved` unblocks `alm:lcr-net-outflow` and the `ORG-PR-06` / `ORG-PR-14` (ILAAP) projection chain in a single step. (2) `alm:ftp-attribution` is the only pipeline in `drafting` rather than `specified` — the curve registry is drafted but ZARONIA / JIBAR / OIS / FX market-rate feed ingestion is deferred to vendor selection, which is the binding gap on the first FTP cycle and on `ORG-PR-08` / `ORG-PR-15` (Funding Strategy attribution). (3) `alm:samos-funding` cannot emit `FundingDrawnDown` until the correspondent-bank-mediated SAMOS connector contract with Tomas exists; per the indirect-participant posture this is *not* direct SAMOS membership, and `ORG-MK-08` (Excon / Funding Strategy) plus the BCBS 248 intraday-monitoring expectation both ride on that connector. `ORG-PR-11` (IRRBB) is the easier of the policy-owner obligations to retire next, since the 160 self-test `IRRBBChecked` events mean the BCBS d365 EVE / NII engine is closest to postable-event readiness once shock scenarios are specified.

Next engineering moves, in dependency order: (a) ticket the Banks Act Reg 26 HQLA-eligibility table (Level-1, Level-2A 15%, Level-2B 25/50% haircuts) and wire the HQLA inventory projection against the synthetic capital line to emit `HQLAObserved` — this is the single highest-leverage move and unblocks `LCRComputed` for Eitan's first live sign-off under Banks Act 94 of 1990 s 72; (b) co-specify the Reg 27 ASF / RSF factor tables in the same sprint so `NSFRComputed` follows from the same synthetic liability / asset book; (c) draft the correspondent-bank SAMOS-mediation API contract with Tomas (request / settlement-confirmation / intraday-position semantics per BCBS 248) so `FundingDrawnDown` has a real source; (d) open the ZARONIA / JIBAR / OIS / FX market-data vendor decision with Eitan — until that is closed, FTP attribution stays in drafting and `ORG-PR-08` / `ORG-PR-15` cannot move off PARTIAL; (e) specify the BCBS d365 EVE shock scenarios against the synthetic banking book to convert the 160 self-test `IRRBBChecked` events into a defensible first measurement for `ORG-PR-11`. Currency & Exchanges Manual A.4 position categories for `alm:fx-position` can wait until the first FX-denominated event lands — not on today's critical path.

## Provenance

Eitan's latest `LiquiditySnapshot` via `eventStore.replay({type:"LiquiditySnapshot"})` (max as_of). Read `Regulations/_obligations-register.md` for Ravi-owned rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15; ORG-MK-08). Pipeline-readiness map curated by Ravi against `Team/Ravi.md` § 12 and § 16. ALM-domain event counts via `eventStore.replay({type:"HQLAObserved|LCRComputed|NSFRComputed|IRRBBChecked|FXPositionReported|CollateralUpdated|FundingDrawnDown"})` filtered to last 7 days.
