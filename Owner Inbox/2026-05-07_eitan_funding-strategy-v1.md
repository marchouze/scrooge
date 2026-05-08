---
title: Funding strategy v1 + ILAAP scaffolding — build-phase against the R300m envelope
author: Eitan
date: 2026-05-07
summary: First-cut funding strategy operationalising the residual liquidity bucket from Camille's capital plan v1 (~R30m balance to liquidity buffer at Treasurer's discretion), the SARB indirect-participant posture (no direct SAMOS / CLS membership), and Saskia's M2 repo-book sizing. Frames the paper ILAAP scaffold for Helena + Camille co-sign. Build-phase paper plan; sequences against Eitan's planned ALCO / ILAAP cadence once those substrates land.
decision-required: false
---

# Funding strategy v1 + ILAAP scaffolding — build-phase against the R300m envelope

**From:** Eitan (Treasurer) — autonomous run per `Team/Eitan.md` § 6 (cadence) and § 9 (ALCO / treasury-limit decisions in scope).
**To:** Marc (CEO) for awareness; Camille (CFO), Helena (CRO), Saskia (Head of Global Markets), Tomas (operations & payments engineering), Ravi (ALM engineering), Anya (data engineering).
**Date:** 2026-05-07
**Authority:**
- `D-MARKETS-CAPITAL-TIME-SHAPE` (CEO approved 2026-05-07T18:19:29.676Z) and Camille capital plan v1 (`Owner Inbox/2026-05-07_camille_capital-plan-v1.md`) — bind the residual ~R30m liquidity bucket to Treasurer discretion.
- `D-FX-AD-STATUS` (CEO approved 2026-05-07) — full SARB Authorised-Dealer status.
- `D-SAMOS-NON-CLEARING` (CEO approved 2026-05-07) — bank does not become a direct SAMOS settlement participant.
- `D-FX-CLS-MEMBERSHIP` (CEO approved 2026-05-07) — bank does not join CLS directly.
- 2026-05-06 RAS Framework + 2026-05-07 Helena RAS recalibration v1 (`Owner Inbox/2026-05-07_helena_ras-recalibration-v1.md`).

**Citations:**
- `BANKS-ACT-94-1990` (Treasurer mandate).
- `BCBS-D295` / `ORG-PR-06` (LCR floor).
- `BCBS-D335` / `ORG-PR-07` (NSFR floor).
- `BCBS-248` / `ORG-PR-08` (intraday liquidity).
- `BCBS-144` / `ORG-PR-15` (Contingency Funding Plan).
- `ORG-PR-11` (IRRBB EVE / NII).
- `ORG-PR-14` (annual ILAAP submission).
- `ORG-MK-13` (ICMA GMRA 2011 SA Schedule — newly registered today).

> v1 is the build-phase paper strategy. No real funding stack today (no real customers, no real deposits, no real wholesale issuance). The R300m envelope is a target for licence-day (per `project_ai_driven_bank` operating-model memory). Numbers are sized as a planning artefact for the paper ILAAP scaffold and as binding inputs to Saskia's M2 repo-book sizing.

---

## 0. Funding-strategy on a page

| Source | Build-phase v1 | At licence-day target | Owner |
|---|---|---|---|
| Shareholder common equity | R300m envelope (full CET1 at outset per Camille capital plan v1) | R300m | Camille (issuance) + Eitan (deployment) |
| Wholesale interbank | Nil at outset | As-needed within institutional-counterparty limits | Eitan |
| Deposits | Nil (institutional bank, no retail) | Wholesale institutional deposits where they appear; not a strategic funding source | Eitan |
| Repo book (operational funding for the cash-bond inventory) | Nil at v1 (M2 activates) | R3–5bn gross (reverse + repo) per Saskia §6.4 sizing at full build-phase | Eitan + Saskia |
| Indirect SAMOS access via sponsor / correspondent bank | Required from licence-day | As-arranged | Eitan + Tomas (operations) |
| Indirect CLS access via sponsor bank | Required from licence-day where FX trades cross-border | As-arranged | Eitan + Tomas |
| FX position (Authorised Dealer) | Build-phase: no live FX trades | Per Saskia franchise + Excon Manual | Eitan (with Mira) |

---

## 1. Liquidity buffer sizing — the ~R30m residual bucket

Camille's capital plan v1 reserves the residual ~R30m of the R300m envelope to "Eitan's discretion within ILAAP envelope". v1 of this strategy splits that bucket:

| Sub-bucket | Indicative allocation | Purpose |
|---|---|---|
| HQLA-Level-1 (cash + SAGB) buffer | ~R20m | LCR floor compliance + intraday liquidity per BCBS 248 |
| Operating-cash float | ~R7m | Day-to-day operating-account run rate; covers payroll-equivalent + vendor settlements + tax-payment buffer |
| Stress reserve (above LCR floor) | ~R3m | Cushion for the Contingency Funding Plan first-action set |

**LCR target floor:** internal floor at PA-min + B3 management buffer (calibration deferred to paper ILAAP run; v1 reserves the +5pp floor anchor pending Helena calibration). At the build-phase R30m bucket, with no real net cash outflows, LCR is structurally above 100% and the constraint is operational not regulatory. The numbers above stand up the *capability* to operate within LCR discipline, which is what the paper ILAAP submission tests.

**NSFR target floor:** internal floor at PA-min + B3 management buffer; same calibration pattern as LCR. With no real wholesale funding stack today, NSFR is structurally clean; the constraint surfaces at M2 (repo book) when the funding profile becomes more complex.

---

## 2. SAMOS access — indirect-participant operating posture

Per `D-SAMOS-NON-CLEARING` (CEO approved 2026-05-07), the bank does not become a direct SAMOS settlement participant. ZAR clearing is via a sponsor bank (correspondent-banking arrangement). v1 of this strategy:
- Names the sponsor-bank shortlist as **DEFERRED to next-cycle ALCO output** (Eitan + Saskia + Owen co-author).
- Identifies the SLA dimensions the sponsor must satisfy: intraday liquidity provisioning, ZAR cut-off times, cost-base, exit clauses.
- Captures the operational gap: until a sponsor bank is engaged (post-licence approach), no live ZAR settlement capability exists. This is acceptable in build-phase.

## 3. CLS access — indirect-participant operating posture

Per `D-FX-CLS-MEMBERSHIP` (CEO approved 2026-05-07), the bank does not join CLS directly. CLS-eligible FX legs run via a Settlement-Member sponsor. v1 of this strategy:
- Treats CLS-via-sponsor as a precondition for any cross-border FX settlement post-licence.
- Names the sponsor shortlist as **DEFERRED**, paired with the SAMOS sponsor selection — likely the same correspondent-bank to maintain a single-sponsor profile, but the decision is for the next-cycle ALCO with Owen secretariat.

## 4. Repo-book sizing — M2 forward-load

Per Saskia §6.4 (`Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md`), the working view is a repo book of **R3–5bn gross (reverse + repo) at full build-phase operation**, sized against the cash-bond inventory the market-making mandate produces. v1 of this strategy:
- Acknowledges this is M2 / forward-load; v1 is build-phase and the repo book is nil today.
- Anchors the GMRA structure on **ICMA GMRA 2011 + SA Schedule** (`ORG-MK-13`, newly registered today by Mira's M1 URN tranche). Imani's clause library follow-on covers the SA Schedule terms.
- Identifies the funding-mix concern: repo cash funds bond inventory, but at R3–5bn gross the bank's funding becomes meaningfully repo-dependent. NSFR profile shifts; ILAAP must reflect.
- Frames the haircut grid as Helena's responsibility per the RAS B3 liquidity / B8 markets-concentration appetites.

## 5. Collateral inventory — design-time anchor

Saskia §6.5 working view: ZAR cash CSAs (daily VM, threshold = 0, MTA = R5m) at outset. v1 of this strategy:
- Confirms ZAR cash as the v1 collateral standard for OTC IRD CSAs (forward-load M3) and the repo book (forward-load M2).
- Identifies the substrate gap: collateral inventory substrate not yet built (Tomas + Atlas, per Eitan § 16). v1 strategy bound by hand-tracked inventory until the substrate lands.
- Anchors expansion: once SARB approval is in hand, certain SA central-government bonds become eligible per the Joint Standard 2/2020 §6 (as amended Sept 2022) — `ORG-JS2-003`. v1 reserves cash-only as the conservative posture; expansion through Helena RAS update at v2 of this strategy.

## 6. FTP curve

Funds-Transfer-Pricing curve refresh runs on Eitan's quarterly cadence (§ 6) once the substrate engine lands (Ravi + Anya, per § 16). v1 of this strategy:
- Defers the FTP curve to v2 (paper ILAAP run anchor).
- Identifies the methodology: cost-of-funds laddered against the wholesale curve + Helena's IRRBB appetite + Camille's capital-cost overlay. Standard ALCO methodology; nothing exotic.
- Names the substrate gap: FTP curve generator (Ravi + Anya) — Eitan § 16.

## 7. ILAAP scaffolding (paper)

The paper ILAAP submission is an annual cycle obligation per `ORG-PR-14`. v1 of this strategy scaffolds the ILAAP shell that the paper-engine substrate (Helena + Eitan + Anya + Atlas, per Eitan § 16) will populate:

| ILAAP section | v1 status | Owner |
|---|---|---|
| Liquidity-risk identification + measurement | scaffolded; binds to Anya's projection set | Eitan + Helena |
| Funding strategy (this document) | v1 published | Eitan |
| Stress testing | scaffolded; consumes Helena's stress-testing framework (`ORG-PR-12`) | Helena (Eitan consumer) |
| Contingency Funding Plan (CFP) | scaffolded; rehearsed annually per `ORG-PR-15` | Eitan |
| Intraday liquidity management | scaffolded; consumes BCBS 248 metric set | Eitan + Tomas |
| ILAAP capital-allocation interface | scaffolded; consumes Camille capital plan v1 | Eitan + Camille |
| Governance + sign-off | Helena + Camille co-sign; CEO approves; PA-facing per `ORG-PR-14` | Owen secretariat |

**Substrate gap:** ILAAP capital engine is not built (Helena + Eitan + Anya + Atlas, per Helena § 16 and Eitan § 16). v1 is hand-authored against the scaffold; v2 lands alongside paper ICAAP v1 once the engine ships.

## 8. ALCO operating cadence (planned)

Eitan + Camille co-chair ALCO; Owen secretariat. v1 of this strategy initiates ALCO as a standing cycle:
- **Frequency:** monthly minimum, anchored on Camille's monthly close cadence.
- **Substrate gap:** auto-generated ALCO pack not yet built (Atlas + Anya + Eitan, per Eitan § 16). Cycle templates exist; pack is hand-authored at v1.
- **First ALCO (paper):** schedule alongside the paper ICAAP / ILAAP run anchor.

## 9. Cadence

- **Refresh cadence:** quarterly minimum, anchored on the ALCO cycle. Triggered refresh on capital-plan refresh events from Camille; on RAS recalibration events from Helena; on substantive `AgentEscalation` patterns from Tomas (settlement) or Ravi (ALM).
- **v2:** lands with paper ILAAP v1 (Helena + Eitan + Anya + Atlas), expected on the next-cycle anchor. v2 reshape is numerical; v1 is structural.

---

## 10. Substrate gaps surfaced by this strategy

1. **Auto-generated ALCO pack** — not built. Required for ALCO cycle to be presentation-derived (Principle 6). Atlas + Anya + Eitan.
2. **Intraday liquidity watch (live)** — partial. Settlement-account watch exists; intraday HQLA-stress projection is not live. Ravi + Tomas + Anya.
3. **ALM engine** — under build by Ravi. Until live, daily ALM run is manually-orchestrated.
4. **Liquidity projection engine** — under build by Anya.
5. **Collateral inventory substrate** — not built. Tomas + Atlas.
6. **FTP curve generator** — not built. Ravi + Anya.
7. **ILAAP engine** — not built. Helena + Eitan + Anya + Atlas.
8. **No Eitan scheduled handler in `runtime/handlers-metadata.ts`** — Treasurer's autonomous cadence is not yet substrate-supported. Mirrors the gap Camille's seat had until 2026-05-07; resolution: register `eitan:treasury-substrate-state` on the same pattern as Camille's `cfo-substrate-state` (next-cycle Atlas substrate work).

## 11. Decision provenance (audit trail)

- **Source decisions:** `D-MARKETS-CAPITAL-TIME-SHAPE`, `D-FX-AD-STATUS`, `D-SAMOS-NON-CLEARING`, `D-FX-CLS-MEMBERSHIP` (all CEO approved 2026-05-07).
- **Source proposals:** Camille capital plan v1; Saskia franchise design §6.1, §6.4, §6.5; Helena RAS recalibration v1.
- **Source register entries:** `ORG-MK-13` (GMRA SA Schedule); `ORG-MK-08` (Excon); `ORG-JS2-003` (margin eligible collateral); `ORG-PR-06`/`07`/`08`/`11`/`14`/`15`.
- **Strategy event:** `AgentDecision` with `decisionId: decision:eitan:funding-strategy-v1`, `decidedBy: Eitan`, `chosen: "Publish funding strategy v1 + ILAAP scaffolding"`.

## 12. Provenance

Read Camille capital plan v1 § 0–§ 4 for the binding capital input; cross-walked Saskia §6.1 / §6.4 / §6.5 for the markets-side funding posture; cross-referenced Helena RAS recalibration v1 §B3 / §B14 / §B15 for the appetite envelopes; confirmed indirect-participant posture against `D-SAMOS-NON-CLEARING` and `D-FX-CLS-MEMBERSHIP`; aligned to Eitan spec § 6 (cadence), § 9 (decisions in scope: ALCO / treasury limits / repo / FTP / collateral / hedge / FX), § 13 (procedures owned), § 16 (substrate gaps).
