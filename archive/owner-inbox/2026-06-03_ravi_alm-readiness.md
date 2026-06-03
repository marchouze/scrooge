---
agent: Ravi
trigger: alm-readiness
asOf: 2026-06-03T05:45:39.197Z
decision-required: false
---

# Ravi — ALM readiness, 2026-06-03

Autonomous run of Ravi's daily ALM-readiness attestation per `Team/Ravi.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Seventeenth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`. Engineer-side counterpart to Eitan's `LiquiditySnapshot` — Eitan reports counts of liquidity / treasury events the ALCO chair would consume; Ravi reports the substrate-readiness state for each ALM pipeline (LCR, NSFR, IRRBB, FX position, FTP, collateral, SAMOS funding) the engineer would build to make those events real.

**Headline:** 9 ALM pipelines tracked · readiness 0 ready / 2 drafting / 7 specified / 0 not-yet-specified · 7 Ravi-owned obligations indexed (0 PARTIAL / drafting) · 19 ALM-domain events (last 7d).

## Eitan's latest snapshot

Latest `LiquiditySnapshot` event: 2026-06-02T07:13:36.240Z

| Eitan event class (last 24h) | Count |
|---|---|
| `HQLAReported` | 0 |
| `LiquidityReport` | 0 |
| `LCRRatioProjection` | 0 |
| `NSFRRatioProjection` | 0 |
| `IRRBBChecked` | 0 |
| `FXPositionReported` | 0 |
| `NostroFundingApproved` | 0 |

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
| `alm:correspondent-funding` (Correspondent-bank intraday nostro funding position) | drafting | Correspondent-bank SWIFT reporting ingested as the bank's intraday nostro position (per indirect-participant posture — `project_indirect_participant_posture.md`): the correspondent operates a ZAR nostro, makes payments on instruction, receives funds on the bank's behalf, and reports intraday via MT942 interim transaction reports (plus MT940 EOD, MT900/MT910 confirmations). Owner: Tomas (SWIFT connector); Ravi (funding-plan logic). NOT direct SAMOS / CLS membership. | Build-phase substrate WIRED: `CorrespondentNostroSimulator` (platform/simulation/env-sim/correspondent-nostro-sim.ts) is registered in the third-party sim hub and emits MT942 `InboundMessageReceived` per intraday window plus `FundingDrawnDown` on an intraday floor breach; `runIntradayStress(asOf, eventStore)` folds the `FundingDrawnDown` stream into per-window BCBS 248 outflows. Remaining for production: swap the simulator for Tomas's real correspondent SWIFT connector (parses live MT940/MT942/MT900/MT910 → the same `FundingDrawnDown` events) — the downstream pipeline is unchanged (production seam). Then surface the intraday-stress traffic-light on Eitan's ALCO dashboard. |

## ALM-domain events (last 7 days)

| Event | Count |
|---|---|
| `HQLAObserved` | 0 |
| `LCRComputed` | 4 |
| `NSFRComputed` | 4 |
| `IRRBBChecked` | 10 |
| `FXPositionReported` | 0 |
| `CollateralUpdated` | 0 |
| `FundingDrawnDown` | 1 |
| Prior `ALMReadinessSnapshot` (this agent) | 9 |

## Substrate gaps surfaced this run

- **Liquidity / ALM projection runtime (Anya + Ravi)** — pre-condition for `LCRComputed` and `NSFRComputed` events. HQLA inventory + ASF / RSF factor tables specified per Banks Act Reg 26 / Reg 27; not yet wired to the postable-event stream.
- **Repricing-gap engine (Ravi joint with Rohan)** — pre-condition for `IRRBBChecked` events. EVE shocks per BCBS d365 specified; first run blocks on synthetic banking-book positions in the event log.
- **FX position projection (Ravi joint with Mira)** — pre-condition for `FXPositionReported`. Excon position categories per Currency & Exchanges Manual specified; first event fires on first FX-denominated postable.
- **FTP curve sources** — currently the binding gap on the first FTP cycle. Curve registry drafted; market-rate feed integrations (ZARONIA, JIBAR, OIS, FX spot/forward) deferred to vendor-selection phase.
- **Correspondent-bank SAMOS connector (Tomas + Ravi)** — under indirect-participant operating posture (`project_indirect_participant_posture.md`), the bank does **not** join SAMOS directly; it accesses SAMOS via a sponsor / correspondent bank. The connector is therefore an API contract with the correspondent, not direct SAMOS membership. Pre-condition for `FundingDrawnDown` events.
- **Collateral inventory substrate (Ravi + Atlas + Imani)** — mandatory for repo book. Eligibility schedule blocks on ISDA / GMRA collateral annexes (Imani's clause library).
- **Hedge-accounting boundary (Ravi + Bea)** — designation / effectiveness substrate prototyped; Bea's posting boundary not yet wired. Activates with first hedge designation post-licence.

## Ravi's narrative

ALM-projection substrate is roughly half-wired and entirely synthetic: of the nine pipelines, six are specified-but-unbuilt, two are drafting, and one (correspondent-funding) is wired in simulator form. Eitan's 24h shadow is zero across every event type his snapshot consumes, which is correct for build phase — there is no postable balance-sheet event stream yet to project against. The load-bearing block on first end-to-end live LCR / NSFR sign-off is `alm:hqla-inventory`: until the HQLA inventory projection emits `HQLAObserved` against a synthetic capital line with Banks Act Reg 26 Level-1 / 2A / 2B classification and haircuts applied, the LCR numerator is empty, the 30-day outflow engine has nothing to divide into, and ORG-PR-06 / ORG-PR-07 / ORG-PR-14 (Liquidity Risk Management Policy / ILAAP obligations) stay PARTIAL. Degraded-mode is functioning as the daily-funding-event SLA stand-in on the intraday axis only — the `CorrespondentNostroSimulator` is emitting MT942-shaped `InboundMessageReceived` plus one `FundingDrawnDown` over the last 7d, and `runIntradayStress` is folding that into per-window BCBS 248 outflows, which is the right shape for an indirect-participant posture but is explicitly simulator, not Tomas's live SWIFT connector.

Three observations rank above the others. (1) `alm:hqla-inventory` is one engineering ticket — the Reg 26 eligibility table plus haircut schedule against the synthetic balance — from unblocking both LCR and (via the same synthetic book) the ASF / RSF specifications behind ORG-PR-08 / ORG-PR-15. The 4 `LCRComputed` and 4 `NSFRComputed` events in the last 7d are running off scaffold inputs, not an HQLA projection, so they should not be read as substrate-green. (2) `alm:ftp-attribution` is the obligation-binding gap on ORG-PR-08 (Funding Strategy Policy / FTP) and indirectly ORG-MK-08: the curve registry is drafted, but the ZARONIA / JIBAR / OIS / FX market-rate feeds are deferred to vendor selection, so no FTP cycle can run end-to-end and no transaction-level attribution can be emitted on `TradePosted` / `FundingDrawn` / `DepositReceived`. (3) `alm:irrbb-repricing-gap` is showing 10 `IRRBBChecked` events in 7d against zero synthetic banking-book positions — meaning the engine is firing on scaffold, not on BCBS d365 EVE shock scenarios applied to real repricing buckets; ORG-PR-11 (IRRBB Policy) cannot move off PARTIAL until the shock scenario table is specified and the gap projection runs against postable positions. Separately, `alm:fx-position` and `alm:collateral-inventory` are both zero-event and correctly so — they wait on the first FX-denominated event and the first GMRA / repo execution respectively, which is upstream of me.

Next engineering move, ordered: (i) specify the Banks Act Reg 26 HQLA-eligibility table (Level-1 / Level-2A / Level-2B with haircuts and the 40% / 15% caps) and wire the inventory projection against the synthetic capital line so `HQLAObserved` fires — this single ticket unblocks `LCRComputed` becoming meaningful and lets me re-attest ORG-PR-06 / -07 / -14 with substrate evidence; (ii) in the same sprint, specify the Banks Act Reg 27 / BCBS D335 ASF and RSF factor tables so `NSFRComputed` rides the same projection runtime (ORG-PR-15); (iii) draft the BCBS d365 EVE shock scenario set (±200bp parallel plus the six prescribed shocks) for the repricing-gap engine to move `IRRBBChecked` off scaffold (ORG-PR-11); (iv) open the correspondent-bank SAMOS-mediation connector contract with Tomas — the production seam is defined (MT940 / MT942 / MT900 / MT910 → `FundingDrawnDown`), so the contract is parser fidelity and intraday-window cadence per BCBS 248, not pipeline redesign; (v) escalate to Eitan and Zara that the ZARONIA / JIBAR / OIS market-rate feed vendor decision is the binding gap on the first FTP cycle and on ORG-PR-08 / ORG-MK-08 (the latter also touching the Currency & Exchanges Manual for the FX leg). Everything downstream of those five is either waiting on an upstream business event or already wired in simulator form.

## Provenance

Eitan's latest `LiquiditySnapshot` via `eventStore.replay({type:"LiquiditySnapshot"})` (max as_of). Read `Regulations/_obligations-register.md` for Ravi-owned rows (ORG-PR-06 / -07 / -08 / -11 / -14 / -15; ORG-MK-08). Pipeline-readiness map curated by Ravi against `Team/Ravi.md` § 12 and § 16. ALM-domain event counts via `eventStore.replay({type:"HQLAObserved|LCRComputed|NSFRComputed|IRRBBChecked|FXPositionReported|CollateralUpdated|FundingDrawnDown"})` filtered to last 7 days.
