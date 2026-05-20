---
procedureId: PROC-OPS-SARB-FIX-IPV-01
title: SARB ZAR Fixing as authorised FX-spot IPV source (controlled-launch)
author: Saskia (Chief Markets Officer, governance) · Atlas (Core banking platform architect, engineering)
date: 2026-05-20
owner: Saskia (Chief Markets Officer, governance)
co-signs: Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance)
status: POPULATED
version: "1.0"
last-updated: "2026-05-20"
policy-cited: "Policies/valuation-policy-v1.md §3.1 (FX spot rate source hierarchy) · Policies/market-risk-policy-v1.md (controlled-launch envelope) · Policies/trading-mandate-v1.md §2.5"
system-capability: "@platform/market-data/sarb-fixing-ingester · @platform/valuation/mark-adoption-engine"
citations:
  - 2026-05-20_helena_fx-spot-only-market-risk-scope-review.md §6 G-1
  - Policies/valuation-policy-v1.md
  - Policies/market-risk-policy-v1.md
  - ORG-MK-08
  - IFRS-13
  - D-EVENT-VIEW-BOUNDARY-WIRE
  - D-MARKETS-SCHEMA-FOUNDATION
  - WS-MARKET-RISK-PROCEDURES
---

# Procedure — SARB ZAR Fixing as authorised FX-spot IPV source (controlled-launch)

**Procedure ID:** PROC-OPS-SARB-FIX-IPV-01
**Owner:** Saskia (Chief Markets Officer, governance) — source authority
**Co-author:** Atlas (Core banking platform architect, engineering) — system implementation
**Co-signs:** Helena (Chief Risk Officer, governance) — daily IPV sign-off; Devon (Chief Operating Officer, governance) — operational continuity
**Approval:** CMO (Saskia) for source-of-authority; CRO (Helena) for IPV sign-off; CEO (Marc) per the controlled-launch envelope decision
**Cadence:** Daily, one fixing per pair per business day
**Version:** v1.0 — 2026-05-20
**Status:** POPULATED — in force during controlled-launch (build-phase fixture variant; live SARB feed post-licence)

## 1. Source policy

This procedure implements:

- `Policies/valuation-policy-v1.md` **§3.1** — FX spot rate source hierarchy. The SARB ZAR Fixing is the **operative source** during controlled-launch.
- `Policies/valuation-policy-v1.md` **§4** — production-only provenance gate (read-side; non-waivable). The SARB fixing is tagged regulator-grade and qualifies as a production read.
- `Policies/valuation-policy-v1.md` **§5** — staleness thresholds. The SARB fixing is published once per business day at nominally 17:00 SAST; the daily mark is staleness-bounded to one business day.
- `Policies/valuation-policy-v1.md` **§7** — IPV process for Level 2 instruments. FX spot is a Level 2 instrument (observable market input, not Level 1 exchange quote — Helena §1.2 correction).
- `Policies/market-risk-policy-v1.md` — controlled-launch envelope. Helena's PR #634 anchors the calibration on USD 1m × 0.85% SARB-fixing realised volatility × 2.326 z-score; this procedure is the source feed that calibration assumes.
- `Policies/trading-mandate-v1.md` **§2.5** — FX desk product scope (USD/ZAR only at v1).

## 2. Source regulation(s)

- **`ORG-MK-08`** — SARB ZAR Fixing Rate observable (Excon / market reference data).
- **IFRS-13 §76–§82** — fair-value hierarchy; Level 2 inputs are observable market data other than quoted prices for identical assets in active markets.
- **BCBS d352 §718(LXXXVII)** — prudent valuation; reliance on a single observable source must be documented and recon-asserted.

## 3. Purpose

To establish the SARB ZAR Fixing as the bank's **single authorised reference rate** for FX-spot independent price verification (IPV), end-of-day mark-to-market, and the controlled-launch market-risk envelope until a production-grade quote feed (Reuters WM/R, Bloomberg BFIX, or successor) is contracted and live.

The SARB fixing is the **compensating control** for gap G-1 ("no live FX feed") per Helena (Chief Risk Officer, governance) FX-spot scope review 2026-05-20 §6. Without it, the internal pre-licence test cannot run IPV or daily P&L attribution against the source referenced by both the valuation policy and the market-risk limit calibration.

## 4. Trigger

- **Daily**, on the publication of the SARB ZAR Fixing rate (nominally 17:00 SAST).
- **On business-day boundary** — South African business calendar; SA public holidays (e.g. 27 April Freedom Day, 1 May Workers' Day) produce no fixing for that date.
- **On-demand** — re-ingestion of a historical fixing window (idempotent; deterministic event ids guarantee no duplicate events).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Retrieve the SARB ZAR Fixing for the as-of business day | `service:atlas:sarb-fixing-ingester` | `@platform/market-data/sarb-fixing-ingester` (`SarbFixingSource`) | Build phase: fixture-backed (`prototype/seeds/sarb-fixing-rates.json`). Post-licence: live SARB website / API (out of scope here). |
| 2 | Append the raw fixing as a `MarketDataTick` (data_type="fx-quote", source="SARB", provenance="production") | `service:atlas:sarb-fixing-ingester` | `@platform/market-data/store::MarketDataStore.append` | Deterministic tick id `SARB:<pair>:<asOfDate>`. Re-ingest is dedup-safe via `INSERT OR IGNORE`. |
| 3 | Resolve the active `PolicyVersionActivated` event for the "valuation" domain (VALUATION-POLICY-V1) | `service:atlas:sarb-fixing-ingester` | `@platform/valuation/mark-adoption-engine::resolveActivePolicyVersionRef` | Returns null only on a fresh store; the founding activation is backfilled by `bun run backfill:policy-activations`. |
| 4 | Emit `OfficialMarkAdopted{type:"fx-rate", source:"SARB", fairValueLevel:"2"}` to the event store | `service:atlas:sarb-fixing-ingester` | `@platform/event-store/event-types/valuation::makeOfficialMarkAdopted` | Deterministic event id; envelope provenance `kind:"simulated"`, `sourceLineage:"sarb-fixing-fixture"` during build phase. Replaced by live-feed lineage at licence-day cutover. |
| 5 | Run the EOD MTM revaluation against the adopted mark | `service:rohan:mark-adoption-engine` | `@platform/valuation/mark-adoption-engine::adoptFxMark` (already wired per Slice B.1) | The adoption event is the single source of truth for the EOD mark. |
| 6 | Daily IPV sign-off — compare the bank's book rate to the SARB fixing; raise `IpvExceptionRaised` if the deviation exceeds the §7 tolerance | `human:helena:cro` | `@platform/markets/ipv-tolerance` (consume `IpvExceptionRaised` — separate brief) | Helena's discretion is the human-in-the-loop control. The sign-off itself is a typed event (`IpvSignOff`, planned). |

Manual step (§5 step 6 sub-action): Helena's daily IPV sign-off carries discretion — the tolerance is a calibrated threshold, but a deviation within tolerance can still be challenged on Helena's judgement (e.g. fixing publication is materially late or the published rate is anomalous against the prior session). Discretion is captured as the `IpvSignOff` typed event (planned in the IPV exception brief).

## 6. Reconciliation

- **Events produced:**
  - `OfficialMarkAdopted{type:"fx-rate", source:"SARB", fairValueLevel:"2"}` — one per (pair, business-day). Schema: `prototype/platform/event-store/event-types/valuation.ts::officialMarkAdoptedPayloadSchema`.
  - `MarketDataTick{source:"SARB", dataType:"fx-quote"}` — one per (pair, business-day). Schema: `prototype/platform/market-data/store.ts`.
- **Reconciliation check (planned recon pipeline `recon:sarb-fixing-daily-coverage`):** for every SA business day in the controlled-launch window, the event store carries exactly one `OfficialMarkAdopted{source:"SARB"}` event per whitelisted pair (USD/ZAR at v1; EUR/ZAR + GBP/ZAR if added). Asserted by Vera (Internal audit / continuous-assurance engineer, engineering) as a soft-fail pipeline; hard-fail after the second consecutive missing day.
- **Failure mode:** if the daily fixing event is missing, IPV cannot run; the FX desk is in a market-data-staleness condition (per `Policies/valuation-policy-v1.md §5`) and Helena's sign-off cannot complete. The procedure escalates to §9.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `OfficialMarkAdopted` event (per pair per day) | event store (`prototype/platform/event-store`) | Indefinite (append-only) | Internal — regulatory-evidence tier |
| `MarketDataTick` (per pair per day) | `MarketDataStore` (`prototype/platform/market-data`) | Per `D-MARKETS-SCHEMA-FOUNDATION` retention rules | Internal — reference data |
| Daily IPV sign-off (`IpvSignOff`, planned) | event store | Indefinite | Internal — Helena signature record |
| `IpvExceptionRaised` (when deviation exceeds tolerance) | event store | Indefinite | Internal — risk event tier |
| SARB fixing fixture (`prototype/seeds/sarb-fixing-rates.json`) | repository | Retained until licence-day cutover; archived thereafter | Internal — build-phase only |

## 8. Manual steps

- **Helena's daily IPV sign-off (§5 step 6).** Automation impossible at v1 because the comparison against the bank's book rate involves human judgement on fixing-publication quality, late-trade flag, and anomaly assessment. Tracked as a typed event (`IpvSignOff`, planned in the IPV exception brief); a missed sign-off triggers escalation per §9.
- **Reactivation gate to post-licence live SARB feed.** At the production SARB feed cutover, an authoring change replaces `makeFixtureSarbFixingSource(...)` with the live implementation; the `BUILD_PHASE_VARIANT_MARKER` constant flips and the provenance tag changes from `kind:"simulated"` to `kind:"production"`. The cutover itself is a manual change-control event approved by Saskia + Helena + Devon, recorded as a `Decision` event under WS-MARKET-RISK-PROCEDURES.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Fixing event missing for a business day | `recon:sarb-fixing-daily-coverage` (Vera, planned) flags absence | Saskia notified within 1 hour of EOD; Helena IPV sign-off paused; FX desk in staleness condition per `Policies/valuation-policy-v1.md §5` |
| Two consecutive business days missing | Recon pipeline hard-fails | Devon (operational continuity) + Helena escalate; FX desk goes flat until source restored; CEO notified |
| Helena's daily IPV sign-off not completed by T+1 09:00 SAST | Absence of `IpvSignOff` event for the prior day | Reminder to Helena at T+1 06:00; escalation to CEO if still absent at 09:00; FX desk activity reviewed |
| Fixing rate materially anomalous (e.g. > 3σ deviation from prior-session moving average) | `IpvExceptionRaised` event emitted by the IPV consumer (separate brief) | Helena's discretion: accept, reject, or hold for further investigation; CEO notified for any rejected fixing |
| Post-licence cutover to live SARB feed disrupted | Cutover change-control checklist | Roll back to fixture variant until live source is restored; Decision event documents the rollback |

## 10. Related procedures

- **Upstream:**
  - `Policies/valuation-policy-v1.md` — the source policy this procedure implements.
  - `Procedures/markets/fx-forwards-trade-lifecycle.md` — defines the FX-spot lifecycle whose marks this feed supports.
- **Downstream:**
  - `Procedures/by-policy/market-risk-limit-monitoring.md` — consumes the adopted mark for limit calculations (controlled-launch envelope per Helena PR #634).
  - `Procedures/finance/fx-period-close-runbook.md` — uses the adopted mark for the IFRS 9 / IAS 21 period-close FX revaluation.
  - `Procedures/operations/settlement-failure-bcp.md` — the Herstatt-risk procedure; settlement valuation references the same adopted mark.
- **Adjacent (planned):**
  - IPV exception consumer brief (`IpvExceptionRaised` consumer, separate brief) — defines the tolerance threshold and the daily IPV sign-off event.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-20 | Saskia (Chief Markets Officer, governance) · Atlas (Core banking platform architect, engineering) | Initial procedure — POPULATED. SARB fixing established as the authorised FX-spot IPV source for the controlled-launch window. Build-phase fixture variant; live SARB feed post-licence. |

## 12. Audit / assurance

Vera (Internal audit / continuous-assurance engineer, engineering) asserts the procedure by:

1. **`recon:sarb-fixing-daily-coverage` (planned).** For every SA business day in the controlled-launch window, the event store carries exactly one `OfficialMarkAdopted{source:"SARB", type:"fx-rate"}` event per whitelisted pair. Soft-fail on a single missing day; hard-fail after the second.
2. **Event-schema integrity.** Existing `recon:event-type-registry-coverage` already asserts every `OfficialMarkAdopted` event validates against `officialMarkAdoptedPayloadSchema`; no addition needed.
3. **Provenance integrity.** Existing `recon:market-data-provenance-gate` continues to govern read-side queries; the ingester's write-side `.query(` callsite uses the dedup-pattern context exemption (write-path source-based lookup, not a valuation read).
4. **Build-phase posture marker.** A future `recon:sarb-fixing-build-phase-marker` asserts the `BUILD_PHASE_VARIANT_MARKER` constant in `platform/market-data/sarb-fixing-ingester.ts` reads `"build-phase-fixture"` until the post-licence cutover Decision is approved.
5. **IPV sign-off integrity (planned).** Vera asserts an `IpvSignOff` event lands within 24 hours of every adopted SARB fixing (consumed from the IPV exception consumer brief).

Vera's findings are written to the standard recon findings register; Helena and Saskia are the named accountable parties for any soft-fail; CEO escalation on hard-fail.
