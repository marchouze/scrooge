---
id: PROC-PR-01
policy-parent: §1 — Capital Management Policy
last-reviewed: 2026-05-06
status: POPULATED
---
# Procedure — Capital and liquidity ratio monitoring (daily)

**Procedure ID:** PROC-PR-01
**Owner:** Camille (CFO) · Helena (Chief Risk Officer) · Eitan (Treasurer) · Bea (engineering)
**Approval:** Board (via BRC)
**Cadence:** Daily 06:00 UTC; intraday on-trigger
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2; system capability `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-finance.md` §1 — Capital Management Policy.
`Owner Inbox/2026-05-06_core-policies-risk.md` §4 — Liquidity Risk Management Policy.
RAS B2 (deferred — pending calibration; policy floors per RAS / RAF §B3).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-01` (Banks Act + Regs) | Maintain capital adequacy at not less than the regulatory minimum. |
| `ORG-PR-02` (BCBS Basel III/IV) | Apply Pillar 2A add-ons. |
| `ORG-PR-03` (BCBS) | Hold capital conservation buffer + countercyclical buffer where required. |
| `ORG-PR-04` (RAS B2) | Maintain CET1 management buffer ≥ +1.5pp above PA minima + Pillar 2A + capital conservation buffer. |
| `ORG-PR-06` (BCBS D295 / BA 325) | LCR ≥ 100% (PA min) with internal buffer. |
| `ORG-PR-07` (BCBS D335 / BA 326) | NSFR ≥ 100% (PA min) with internal buffer. |
| `ORG-PR-08` (BCBS 248) | Monitor intraday liquidity. |

## 3. Purpose

Compute the bank's capital and liquidity ratios daily as projections over the event log; trigger management action and BRC escalation on threshold breach; produce regulator-ready BA returns from the same projection (P6).

## 4. Trigger

- **Scheduled:** Daily 06:00 UTC scheduler.
- **On-trigger:** Material event (large exposure approval, capital-instrument issuance, FX market move, intraday liquidity outlook change) emits a `RatioRecomputeRequested` event.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Determine as-of date / time for the computation | `system` (scheduler) | `@platform/scheduler` (`PLANNED`) | Daily run targets prior business-day close per ZA-CAL. |
| 2 | Compute CET1 / AT1 / T2 ratio as projection | `system` | `@domains/capital/projection` (`PLANNED`) | Reads event log; applies CRR-equivalent risk-weights from BCBS framework. Emits `RatioComputed`. |
| 3 | Compute LCR projection (HQLA / 30d net cash outflow) | `system` | `@domains/liquidity/lcr-projection` (`PLANNED`) | Per BCBS D295. Emits `RatioComputed`. HQLA stock (LCR numerator) is sourced from the **instrument-level position register**. For each instrument held by the bank, the SecurityMaster classification (`FinancialInstrumentClassified.hqlaLevel`) determines the HQLA tier. The mark-to-market value of each eligible position is multiplied by the applicable BCBS D295 haircut (Level 1: 0%; Level 2A: 15%; Level 2B: 25% default). GL account balances are not used as a proxy for HQLA stock. Account-level `hqlaLevel` tags on the Chart of Accounts were a Phase-0 shortcut and are deprecated (`D-FINANCIAL-INSTRUMENT-ENTITY`, 2026-05-22; corrected 2026-05-29). |
| 4 | Compute NSFR projection (ASF / RSF) | `system` | `@domains/liquidity/nsfr-projection` (`PLANNED`) | Per BCBS D335. Emits `RatioComputed`. |
| 5 | Compute by-significant-currency LCR | `system` | `@domains/liquidity/lcr-projection` (`PLANNED`) | Per RAS / Liquidity Policy. |
| 6 | Compare against thresholds (regulatory min, internal trigger, internal escalation) | `system` | `@domains/capital/threshold-engine` (`PLANNED`) | Soft / Hard / Critical severity per breach taxonomy. |
| 7 | Soft threshold breach → notification to ALCO secretariat (Eitan) and BRC dashboard | `system` | `@domains/notification` (`PLANNED`) | Event: `LimitBreach { severity: 'Soft' }`. |
| 8 | Hard threshold breach → mandatory action; escalate to ALCO + BRC chair | `system` + `human` | `@domains/notification` + ALCO workflow | Event: `LimitBreach { severity: 'Hard' }`. |
| 9 | Critical threshold breach → CEO + CRO + Board (interim Risk Forum) immediate notification; recovery plan triggered | `system` + `human` | Multi-channel notification | Event: `LimitBreach { severity: 'Critical' }`. |
| 10 | Generate BA 100 / BA 325 / BA 326 return content | `system` | `@domains/capital/ba-returns` + `@domains/liquidity/ba-returns` (`PLANNED`) | Generated per P6 — never assembled. Camille signs the generated content. |
| 11 | Persist daily snapshot to BRC daily pack | `system` | `@domains/reporting/brc-pack` (`PLANNED`) | Pack is a query, generated daily. |

## 6. Reconciliation

- **Events produced:**
  - `RatioComputed { ratio: 'CET1' | 'LCR' | 'NSFR' | ... , value, as_of, components }`.
  - `LimitBreach { ratio, threshold_value, observed_value, severity, owner, citation }` — when applicable.
  - `BAReturnGenerated { return: 'BA-100' | 'BA-325' | 'BA-326', as_of, content_hash }`.
- **Reconciliation check:**
  - **CI gate:** GL trial balance ↔ event-derived balance ↔ sub-ledger projection reconcile to zero (per Accounting Policies). If recon fails, ratio computation aborts and Bea + Camille are paged.
  - Daily `RatioComputed` events for CET1, LCR, NSFR, leverage exist for every business day; gap detection alerts immediately.
  - Computed values must agree with the BA-return content hash: any divergence indicates the return was assembled, not generated — this is a P6 violation reportable to AC.
- **Failure mode:** computation fails → fall back to last-known-good ratio with an explicit `RatioComputationFailed` event; ALCO and BRC notified within minutes.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Daily `RatioComputed` events | Event log | Permanent (P1) | High |
| `LimitBreach` events | Event log | Permanent | Critical |
| BA returns (generated) | Document store + event log hash | 5 years; longer per Records Management | Regulatory |
| Reconciliation harness output | CI artefacts + event log | Permanent | High |

## 8. Manual steps

- Camille's **sign-off** on the generated BA return is human (legal accountability). Sign-off is a typed event referencing the content hash.
- Recovery-plan trigger decisions (under Critical severity) involve human discretion (Helena, Camille, CEO).

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Reconciliation fails | CI gate | Bea immediately; Camille + Helena within 15 min |
| Ratio below internal trigger | Threshold engine | ALCO + BRC chair immediate |
| Ratio below internal escalation | Threshold engine | CEO + CRO + Board (interim Risk Forum) immediate |
| Ratio below regulatory minimum | Threshold engine | All of above + PA engagement workflow |
| Computation fails | Synthetic monitoring | Bea + Atlas within 15 min |
| BA return content-hash divergence | Hash check | Camille + Vera; AC notification (P6 violation) |

## 10. Related procedures

- `change-management.md` (`PLANNED`) — for changes to the ratio-computation logic.
- `model-validation.md` (`PLANNED`) — Tier 1 model validation cycle (LCR / NSFR / RWA models).
- `icaap-cycle.md` (`PLANNED`) — annual ICAAP / ILAAP integration.
- `recovery-plan.md` (`PLANNED`) — Critical-severity recovery-plan execution.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Bea + Camille | Initial draft. B2 calibration deferred — placeholder thresholds use RAS / RAF §B3 floors. |
| v1.1 | 2026-05-29 | Ravi | Step 3 corrected: HQLA stock sourced from instrument-level position register (SecurityMaster × unified-position), not GL account balances. Account-level COA hqlaLevel tags deprecated. Authority: `D-FINANCIAL-INSTRUMENT-ENTITY`; `brief:ravi:fix-ba-325-hqla-stock-instrument-level-positions:2026-05-29`. |

## 12. Audit / assurance

- Vera samples daily `RatioComputed` events monthly; cross-checks against independent re-computation; deviation reported to AC.
- External Auditor's annual review of the ratio-computation method (when appointed).
- Continuous-controls projection: gap-detection metric on daily computation completeness reported to BRC monthly.
