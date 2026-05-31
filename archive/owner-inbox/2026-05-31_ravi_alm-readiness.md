---
agent: Ravi
trigger: alm-readiness
asOf: 2026-05-31T09:33:29.580Z
decision-required: false
---

# Ravi — ALM readiness, 2026-05-31

Autonomous run of Ravi's daily ALM-readiness attestation per `Team/Ravi.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Seventeenth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Engineer-side counterpart to Eitan's `LiquiditySnapshot` — Eitan reports counts of liquidity / treasury events the ALCO chair would consume; Ravi reports the substrate-readiness state for each ALM pipeline (LCR, NSFR, IRRBB, FX position, FTP, collateral, SAMOS funding) the engineer would build to make those events real.

**Headline:** 9 ALM pipelines tracked · readiness 0 ready / 1 drafting / 8 specified / 0 not-yet-specified · 7 Ravi-owned obligations indexed (0 PARTIAL / drafting) · 188 ALM-domain events (last 7d).

## Eitan's latest snapshot

Latest `LiquiditySnapshot` event: 2026-05-31T06:53:15.241Z

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
| `LCRComputed` | 14 |
| `NSFRComputed` | 14 |
| `IRRBBChecked` | 160 |
| `FXPositionReported` | 0 |
| `CollateralUpdated` | 0 |
| `FundingDrawnDown` | 0 |
| Prior `ALMReadinessSnapshot` (this agent) | 4 |

## Substrate gaps surfaced this run

- **Liquidity / ALM projection runtime (Anya + Ravi)** — pre-condition for `LCRComputed` and `NSFRComputed` events. HQLA inventory + ASF / RSF factor tables specified per Banks Act Reg 26 / Reg 27; not yet wired to the postable-event stream.
- **Repricing-gap engine (Ravi joint with Rohan)** — pre-condition for `IRRBBChecked` events. EVE shocks per BCBS d365 specified; first run blocks on synthetic banking-book positions in the event log.
- **FX position projection (Ravi joint with Mira)** — pre-condition for `FXPositionReported`. Excon position categories per Currency & Exchanges Manual specified; first event fires on first FX-denominated postable.
- **FTP curve sources** — currently the binding gap on the first FTP cycle. Curve registry drafted; market-rate feed integrations (ZARONIA, JIBAR, OIS, FX spot/forward) deferred to vendor-selection phase.
- **Correspondent-bank SAMOS connector (Tomas + Ravi)** — under indirect-participant operating posture (`project_indirect_participant_posture.md`), the bank does **not** join SAMOS directly; it accesses SAMOS via a sponsor / correspondent bank. The connector is therefore an API contract with the correspondent, not direct SAMOS membership. Pre-condition for `FundingDrawnDown` events.
- **Collateral inventory substrate (Ravi + Atlas + Imani)** — mandatory for repo book. Eligibility schedule blocks on ISDA / GMRA collateral annexes (Imani's clause library).
- **Hedge-accounting boundary (Ravi + Bea)** — designation / effectiveness substrate prototyped; Bea's posting boundary not yet wired. Activates with first hedge designation post-licence.

## Ravi's narrative

Headline: the ALM substrate is still in build phase — of nine pipelines, eight are `specified` and one (`alm:ftp-attribution`) is `drafting`, with zero `HQLAObserved`, `FXPositionReported`, `CollateralUpdated` or `FundingDrawnDown` events on the log this week. The load-bearing block on Eitan's first live LCR / NSFR sign-off is `alm:hqla-inventory`: until the Banks Act Reg 26 classification table is specified and the inventory projection emits `HQLAObserved` against the synthetic balance, the 14 `LCRComputed` and 14 `NSFRComputed` events firing this week are degraded-mode scaffolding running on a stub numerator, not sign-off-grade ratios. Degraded mode *is* functioning as the daily-SLA stand-in for the ratio event types in Eitan's snapshot — but his shadow correctly shows `HQLAReported: 0`, meaning the underlying inventory event the LiquiditySnapshot expects is not yet on the wire, and that gap is what ORG-PR-06 / -07 / -14 ultimately gate on.

Three consequential observations. (1) `alm:hqla-inventory` is one engineering ticket from green — Reg 26 Level-1 / 2A / 2B classification table plus haircut application against the synthetic capital line — and lighting it up cascades immediately into a real `LCRComputed` numerator and unblocks the Liquidity Risk Management Policy substrate behind ORG-PR-06 / -07. (2) `alm:ftp-attribution` is the only `drafting` pipeline and its binding gap is not the engine — the curve registry exists — but the deferred ZARONIA / JIBAR / OIS market-rate feed vendor selection; until those land, the per-postable-event attribution that ORG-PR-08 and ORG-PR-15 (Funding Strategy Policy) depend on cannot run a first cycle. (3) `alm:samos-funding` remains zero on `FundingDrawnDown` because the correspondent-bank SAMOS-mediation API contract is not yet drafted; under the indirect-participant posture, direct SAMOS access is explicitly out of scope, so the BCBS 248 intraday observability story and the Excon-adjacent funding-plan logic behind ORG-PR-08 and ORG-MK-08 (Currency & Exchanges Manual section A.4) both terminate at a connector that does not yet exist.

Next engineering move, ranked: specify the Reg 26 HQLA-eligibility table with Atlas this week and wire the inventory projection against the synthetic balance so `HQLAObserved` lands in Eitan's shadow — that single ticket converts the degraded-mode `LCRComputed` stream into a real numerator and is the cheapest unlock on the path to first live sign-off. In parallel, draft the correspondent-bank SAMOS-mediation API contract with Tomas (request / response shape, intraday position event, BCBS 248 timestamp fidelity) so the connector is queueable behind vendor selection; and stand up the ASF / RSF factor tables per Banks Act Reg 27 / BCBS D335 alongside HQLA so `NSFRComputed` follows the same path off scaffolding. The IRRBB repricing-gap work per BCBS d365 (160 `IRRBBChecked` events this week suggests the harness is live but EVE shock scenarios still need specification against ORG-PR-11) and the Currency & Exchanges Manual A.4 FX position categories for ORG-MK-08 are the next tier — neither blocks first LCR / NSFR sign-off, but both block the full ALCO pack Eitan owes Helena against the RAS.

## Provenance

Eitan's latest `LiquiditySnapshot` via `eventStore.replay({type:"LiquiditySnapshot"})` (max as_of). Read `Regulations/_obligations-register.md` for Ravi-owned rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15; ORG-MK-08). Pipeline-readiness map curated by Ravi against `Team/Ravi.md` § 12 and § 16. ALM-domain event counts via `eventStore.replay({type:"HQLAObserved|LCRComputed|NSFRComputed|IRRBBChecked|FXPositionReported|CollateralUpdated|FundingDrawnDown"})` filtered to last 7 days.
