---
title: RAS PA look-through framing-refinement — bank-entity RAS, consolidated-basis monitoring (D-REGULATORY-PERIMETER)
author: Helena (Chief Risk Officer, governance) + Rohan (Risk engineer)
date: 2026-05-09
summary: Refinement of the canonical RAS (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`) following CEO decision D-REGULATORY-PERIMETER (PR #85), which codified that Hoz Group Limited is not separately regulated and that SARB Prudential Authority consolidated-supervision under Banks Act § 60+ operates as a look-through via Hoz Bank Limited. New top-of-file framing note + new §A4 (Entity scope of this RAS) + new §B14 (PA look-through framing in RAS / ICAAP / ILAAP) make explicit that the RAS is a Hoz Bank Limited document; the appetite lines are entity-level; consolidated-basis figures are monitored, not separately appetite-bound. The B-cluster appetite lines (L-B8a-1..5) from D-RAS-B-CLUSTER-CONCENTRATION-LINES (PR #67) are unchanged numerically — the only change is making explicit that they are entity-level lines. The obligations-register row ORG-PR-23 is promoted from DRAFTING to corporate-bind (CEO ratified the appetite lines under PR #67) and gains an `applies-at: entity` field per Mira's vocabulary pattern (PR #84). No new policy substance — the change is framing-discipline: clarifying which entity the RAS binds at, and how consolidated-basis figures relate to entity-level appetite lines.
decision-required: false
---

# RAS PA look-through framing-refinement — bank-entity RAS, consolidated-basis monitoring

**Authors:** Helena (Chief Risk Officer, governance) — lead · Rohan (Risk engineer)
**Date:** 2026-05-09
**For:** Marc (CEO) — completion note (no decision required)
**Authority chain:** D-REGULATORY-PERIMETER (CEO-approved 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md` / PR #85) → D-LEGAL-ENTITY-TREE-V0 (CEO-approved 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md` / PR #82) → D-RAS-B-CLUSTER-CONCENTRATION-LINES (CEO-approved 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-ras-b-cluster-concentration-lines.md` / PR #67).

---

## 1. What landed

This is a **framing-refinement** PR, not a policy-content change. The CEO has codified (D-REGULATORY-PERIMETER) that:

- **Hoz Bank Limited** is supervised by the SARB Prudential Authority under the Banks Act prudential regulations.
- **Hoz Securities Limited** is supervised primarily by the JSE (FSCA / FAIS secondarily; counsel ratifies).
- **Hoz Group Limited** is **not separately regulated** as a stand-alone — it sits under Companies Act 71 of 2008 only, with the SARB PA exercising consolidated-supervision powers via **look-through** through the bank under Banks Act § 60+.

This refines (not overturns) the prior framing in PR #82, which had implied a more direct SARB regime over the group than the CEO has now confirmed. The implication for the RAS is small but load-bearing: the RAS binds at the **bank entity**, not at the group, and consolidated-basis metrics are bank-RAS metrics measured on a consolidated basis, not separate group-RAS lines.

### Files touched in this PR

| File | Change |
|---|---|
| `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` | Added top-of-file framing note (anchored to D-REGULATORY-PERIMETER); added §A4 "Entity scope of this RAS"; added §B14 "PA look-through framing in RAS / ICAAP / ILAAP" with per-metric pattern (capital, liquidity, concentration, other consolidated-basis programmes). |
| `Regulations/_obligations-register.md` | One-row edit: ORG-PR-23 status `DRAFTING` → `corporate-bind` (CEO ratified L-B8a appetite lines under D-RAS-B-CLUSTER-CONCENTRATION-LINES / PR #67); added `applies-at: entity`; v1.8 → v1.9 changelog note. No other rows touched. |
| `Owner Inbox/2026-05-09_helena-rohan_ras-pa-lookthrough-reframe.md` | This completion note. |

### What did NOT change

- **No numerical change to any appetite line.** The B-cluster lines (L-B8a-1..5) at §B8a, the LCR / NSFR / capital buffer figures at §B3, the model-risk tier classification at §B7, the cyber severity tiers at §B6 — all unchanged. The change is framing-discipline (which entity the RAS binds at, and how consolidated-basis figures relate to entity-level appetite lines), not numerical recalibration.
- **No edit to `Procedures/by-policy/model-validation.md`** — reviewed; the procedure does not currently reference group vs entity scope in a way that requires clarification under D-REGULATORY-PERIMETER. The procedure-pair partnership with Nadia (Independent-validation engineer, second line) operates at the bank-entity level by default; if a future Hoz Securities Limited-specific model validation cycle is needed (unlikely under the institutional-trading mandate before commencement-of-trading), the procedure is touch-time editable then.
- **No new register rows.** ORG-PR-23 is the single row touched. Mira (Compliance / RegTech engineer)'s parallel Domain Q reclassification work (per the D-REGULATORY-PERIMETER follow-on routes) is the broader register-vocabulary refinement; this PR is the one-row promotion.

## 2. The framing-refinement substantively

### 2.1 Entity-scope of the RAS (§A4)

The RAS is a `Hoz Bank Limited` document. Risk appetite is set, governed, monitored, and breach-reported at the bank-entity level. There is no separate group-level RAS, and no separate group-level appetite line.

This is consistent with the BCBS Corporate Governance Principles for Banks `[citation: TBC — Principle 1 paragraphs on bank-board RAS ownership and Principle 5 paragraphs on parent-board oversight of subsidiaries]` discipline that risk appetite is owned at the regulated-bank level under board accountability — even where a holding company exists, the prudential RAS sits with the bank.

### 2.2 PA look-through pattern (§B14)

For each prudential metric the PA assesses on a consolidated basis under Banks Act § 60+, the bank reports both:

- **Entity-level** (`Hoz Bank Limited` stand-alone) — the appetite line is here.
- **Consolidated-basis** (Hoz Bank + Hoz Securities + future consolidated entities, with IFRS 10 eliminations and IAS 27 minority-interest treatment) — the consolidated view is monitored, not separately appetite-bound.

§B14 documents this for capital (CET1 / Tier 1 / Total / leverage), liquidity (LCR / NSFR / IRRBB), and concentration (single-counterparty large-exposure / top-N / B-cluster). It also lists consolidated-basis programmes the PA assesses that are NOT appetite-line metrics (ICAAP / ILAAP / Recovery Plan / cyber-resilience under JS 1 of 2024 / BCBS Corporate Governance Principle 5 group-structure governance) — these are governance-and-reporting deliverables on a consolidated basis, not separate RAS lines, and they sit on Mira's obligations register under the `applies-at: consolidated` annotation pattern.

### 2.3 ORG-PR-23 register-row promotion

The B-cluster appetite lines (L-B8a-1..5) were `DRAFTING` pending CEO ratification of D-RAS-B-CLUSTER-CONCENTRATION-LINES. The CEO ratified those lines on 2026-05-09 / PR #67. The row therefore promotes:

- Status: `DRAFTING` → `corporate-bind`.
- Added `applies-at: entity` (the named-pair correspondent posture binds at `Hoz Bank Limited`'s SARB Authorised Dealer relationships under the Currency and Exchanges Manual; Hoz Securities Limited does not maintain its own correspondent-bank rails during the build phase, so the consolidated B-cluster view is identical to the entity view).
- Cross-reference to RAS §A4 and §B14.3 added in the row's status field for traceability.

The runtime concentration-recon harness remains a Vera (Internal audit / continuous-assurance engineer) Wave-4 substrate-gap finding — the appetite lines are now in force at the policy layer, but the recon harness that computes single-counterparty / top-2 / backup-readiness over `FxSettlementInstructed` events is still TODO. Pattern lifted from Rohan backtest harness (PR #27) + `dashboard-derivation-recon.ts`.

## 3. Substrate gaps

In the spirit of Principle 7 ("steady-state vs current substrate"), the gaps that prevented a fully-autonomous run are surfaced here as roadmap items:

1. **Consolidated-basis metric computation.** No projection today computes consolidated CET1 / LCR / NSFR / large-exposure / leverage across the three legal entities. v1 substrate task — pairs:
   - Anya (Data / analytics engineer) — projection-runtime extension to support multi-entity aggregation with consolidation eliminations.
   - Bea (Accounting & financial reporting engineer) — IFRS 10 consolidation logic + IAS 27 minority-interest treatment as projection rules.
   - Rohan (Risk engineer) — instrument the consolidated-basis computation against the bank's RAS metrics.
   The trigger for this work is the licence-application gate under Saskia (Head of Global Markets, governance) + Camille (Chief Financial Officer, governance) + Helena, when the consolidated-basis figures need to start being reported to the PA.

2. **PA reporting cadence for consolidated-basis figures.** Once consolidated metrics are computed, the cadence at which the bank reports them to the PA — whether as a BA-returns annex, a separate consolidated-supervision return, a Pillar 3 disclosure, or some combination — is a v1 decision. Likely confirmed at the licence-application gate via Imani (Legal-as-code engineer) + external counsel; the answer drives the projection-cadence the consolidated-basis metric pipeline must hit.

3. **Future group-level recon under PA look-through.** Vera (Internal audit / continuous-assurance engineer) Wave-4 substrate gap — the recon harness must compare entity-reported figures to consolidated-derived figures and surface drift as a continuous-controls finding. Not yet scheduled; planned alongside the consolidated-basis projection work above. Pattern: similar to the existing `dashboard-derivation-recon.ts` discipline, but applied to the entity-vs-consolidated reconciliation.

4. **Securities-entity risk-appetite document.** Hoz Securities Limited has its own risk taxonomy under JSE Membership Rules + FSCA conduct + FMA / Joint Standard 2 of 2020 (ODP). A separate Securities-entity risk-appetite document is a future deliverable, scoped under Saskia (Head of Global Markets, governance) + Kai (Trading systems engineer) when Hoz Securities Limited's M-phase build approaches commencement-of-trading.

5. **`[citation: TBC]` markers.** Banks Act § 60+ exact sub-section index, BCBS 144 / D295 / D335 paragraph indexes, BCBS Basel III/IV consolidated-capital paragraphs, BCBS LCR / NSFR consolidated-treatment paragraphs, BCBS Large Exposures (D283) consolidated-treatment paragraphs, BCBS IRRBB consolidated-banking-book paragraph, BCBS leverage-ratio consolidated paragraph, JS 1 of 2024 group-vs-entity clause distinction. Resolved by Mira (Compliance / RegTech engineer) + Imani (Legal-as-code engineer) + external counsel at the licence-application gate.

6. **`CeoDecision` event substrate.** Recurring substrate gap — the CEO's ratification of D-RAS-B-CLUSTER under PR #67 is a markdown-only record today; the canonical `CeoDecision` event is Atlas (Core banking platform architect) v1 substrate work.

## 4. Provenance

Authored by Helena (Chief Risk Officer, governance) + Rohan (Risk engineer) under Scrooge-coordinated in-session run against their joint operating spec, per Principle 7 "steady-state vs current substrate". Substrate gap: a fully-autonomous run would be triggered by the `CeoDecision { decision-id: D-REGULATORY-PERIMETER }` event landing on the bus, with a Helena-Rohan handler emitting both the RAS-edit and the register-row update under a transactional event-stream. Today the run is markdown-direct.

—Helena (Chief Risk Officer, governance) + Rohan (Risk engineer)
