---
procedureId: PROC-MK-ODP-05
title: OTC derivative portfolio reconciliation (per-counterparty, frequency-tiered)
author: Kai (Trading systems engineer, engineering) · Anya (Data engineer, engineering)
date: 2026-05-16
owner: Tomas (Operations engineer, engineering) · Anya (Data engineer, engineering) · Rohan (Market risk quant engineer, engineering)
status: POPULATED
policy-cited: Policies/otc-trading-policy-v1.md · Policies/counterparty-onboarding-policy-v1.md
system-capability: prototype/platform/settlement/recon-diff (DRAFTING)
---

# Procedure — OTC Derivative Portfolio Reconciliation (Frequency-Tiered, Per-Counterparty)

**Procedure ID:** PROC-MK-ODP-05
**Owner:** Tomas (Operations engineer, engineering) · Anya (Data engineer, engineering) · Rohan (Market risk quant engineer, engineering)
**Approval:** BRC (under the Risk Management Framework / OTC Trading Policy)
**Cadence:** Counterparty-tier-based per CS 3/2018: weekly (≥500 trades), monthly (51–499 trades), quarterly (≤50 trades)
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

---

## 1. Source policy

- `Policies/otc-trading-policy-v1.md` — OTC Trading Policy (PLANNED, markets bundle)
- `Policies/counterparty-onboarding-policy-v1.md` — Counterparty Onboarding Policy (PLANNED)

The obligation chain is:

```
Regulation (CS 3/2018 §5 + Financial Markets Act s.67B)
  → OTC Trading Policy + Counterparty Onboarding Policy
    → PROC-MK-ODP-05 (this procedure)
      → @settlement/recon-diff (DRAFTING)
      → @settlement/recon-position (PLANNED)
```

The OTC Trading Policy mandates portfolio reconciliation with each non-centrally cleared OTC derivative counterparty at a frequency determined by the size of the open-trades population (CS 3/2018 §5 frequency bands). Reconciliation covers both material terms (notional, dates, currency, product type, fixed/float) and valuations (MTM). Tomas (Operations engineer, engineering) owns the reconciliation process; Anya (Data engineer, engineering) owns the reconciliation engine; Rohan (Market risk quant engineer, engineering) owns the valuation inputs. Material breaks escalate to Imani (Legal-as-code engineer, engineering) for CSA implications and to Rohan for risk assessment.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CS3-003` (CS 3/2018 §5) | Portfolio reconciliation must be conducted at specified frequency bands: weekly (≥500 open trades per counterparty), monthly (51–499), quarterly (≤50). Identify discrepancies in material terms and valuation (MTM). |
| `ORG-CS3-005` (CS 3/2018 §5(3)) | Material discrepancies must be escalated and resolved in a timely manner; unresolved disputes must be reported to the FSCA if they remain outstanding for more than 15 business days. |
| `ORG-FMA-003` (Financial Markets Act s.67B) | Records of portfolio reconciliations, including all breaks and their resolution, must be retained for 7 years. |
| `ORG-CS3-004` (CS 3/2018 §7(4)) | Counterparty LEIs and UTIs recorded in the bank's trade records must match those reported to STRATE TR; reconciliation is a downstream check on STRATE TR data quality. |

---

## 3. Purpose

The purpose of this procedure is to:

1. Detect and resolve discrepancies between the bank's internal trade records and each counterparty's trade records for open non-centrally cleared OTC derivative positions, covering both material terms and MTM valuations.
2. Operate at the CS 3/2018 prescribed frequency for each counterparty, tiered by portfolio size: weekly (≥500 trades), monthly (51–499), quarterly (≤50).
3. Triage reconciliation breaks by severity: minor term discrepancies (corrected operationally) vs. material breaks (MTM difference > 1% or > ZAR 500k, or missing trade) that escalate to Rohan (Market risk quant engineer, engineering) and Imani (Legal-as-code engineer, engineering).
4. Ensure that each reconciliation cycle produces a `ReconciliationCompleted` event, enabling Vera to assert periodic coverage for every active counterparty.
5. Route unresolved material breaks to the OTC dispute-resolution procedure and, where required, report to the FSCA under CS 3/2018 §5(3).

---

## 4. Trigger

- **Weekly reconciliation counterparties:** Scheduler tick every Monday (or first market day of the week); one reconciliation cycle per active counterparty with ≥500 open trades.
- **Monthly reconciliation counterparties:** Scheduler tick on first business day of each month; one cycle per counterparty with 51–499 open trades.
- **Quarterly reconciliation counterparties:** Scheduler tick on first business day of each quarter (`QuarterEndCloseCompleted` event); one cycle per counterparty with ≤50 open trades.
- **Ad-hoc trigger:** `OtcTradeAmended` or `OtcTradeNovated` events for a counterparty whose trade now differs from the last-agreed position file may trigger an off-cycle reconciliation at Tomas's discretion.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Determine each counterparty's reconciliation tier at the start of the period: count open trades per counterparty LEI in the trade ledger; assign to weekly / monthly / quarterly tier | `system` | `@settlement/recon-position` (PLANNED) | Tier assignment is per-counterparty and may change each quarter as the portfolio grows. New counterparties are assigned quarterly until trade count is established. |
| 2 | Emit `ReconciliationStarted { counterpartyLei, tier, asOfDate, openTradeCount }` | `system` | `@platform/event-store` | Canonical start of each reconciliation cycle. Vera uses this event to assert cycle completion. |
| 3 | Generate the bank's position file for the counterparty: export all open trades with the counterparty as of the `asOfDate`, including material terms (UTI, trade date, product type, notional, currency, maturity, fixed rate/spread, floating rate index, payment frequency) and MTM valuation | `agent` (Tomas) | `@settlement/recon-position` (PLANNED) | MTM is sourced from Rohan's risk engine (OIS-discounted, ZARONIA-based). Position file format: ISDA Reconciliation Communications standard (XML or CSV). |
| 4 | Transmit the bank's position file to the counterparty via ISDA Reconciliation Communications protocol (AcadiaSoft MarkitSERV or bilateral SFTP); receive the counterparty's position file | `agent` (Tomas) | `@settlement/recon-comms` (PLANNED) | Position-file exchange must be completed within 2 business days of the `asOfDate`. If the counterparty does not respond within 3 BDs, Tomas escalates to the counterparty's operations contact and notifies Imani (Legal-as-code engineer, engineering). |
| 5 | Run the reconciliation diff engine: compare the bank's position file against the counterparty's file trade-by-trade; identify: (a) matched trades, (b) term discrepancies, (c) MTM discrepancies, (d) trades present in bank records but absent from counterparty file (and vice versa) | `agent` (Anya) | `@settlement/recon-diff` (DRAFTING) | Tolerance: term discrepancies are flagged if any material term differs. MTM: minor (< 1% AND < ZAR 500k) vs. material (≥ 1% OR ≥ ZAR 500k). Missing trades are always material. |
| 6 | For each minor term discrepancy: Tomas contacts counterparty Ops to agree the correction; update trade records if bank error; counterparty updates if their error; document resolution | `agent` (Tomas) | `@settlement/recon-comms` (PLANNED) | Minor discrepancies must be resolved within 5 BDs of detection. Resolution captured via `ReconciliationBreakResolved { tradeId, field, resolution, resolvedAt }` event. |
| 7 | For each material break (MTM difference ≥ 1% or ≥ ZAR 500k, or missing trade): emit `ReconciliationBreakFound { counterpartyLei, tradeId, field, bankValue, counterpartyValue, breakType: material\|minor, breakAbs, asOfDate }` | `system` | `@platform/event-store` | Material breaks are escalated immediately to Rohan (Market risk quant engineer, engineering) for valuation review and Imani (Legal-as-code engineer, engineering) for legal assessment. |
| 8 | Rohan reviews the MTM discrepancy: verify the bank's pricing curve inputs (ZARONIA OIS, credit spreads); if the bank's price is correct, Tomas challenges the counterparty with supporting calculation; if the bank's price is wrong, Rohan corrects and revalues | `agent` (Rohan) | `@risk/mtm` | If the MTM discrepancy leads to a different VM calculation under PROC-MK-ODP-03, Ravi (ALM quant engineer, engineering) is notified to adjust the VM call. |
| 9 | Imani assesses whether any material term discrepancy (e.g. missing trade, novation not reflected) has legal or credit-risk implications under the CSA / ISDA Master Agreement | `agent` (Imani) | — | If a trade is missing from the counterparty's records, it may indicate a booking error or confirmation lapse; Imani reviews the trade confirmation history in the confirmation-matching system. |
| 10 | For material breaks unresolved after 15 BDs: emit `ReconciliationBreakEscalated { counterpartyLei, tradeId, ageInBDs, breakType, resolution: pending }` and route to `otc-dispute-resolution.md`; if unresolved after 15 BDs, Zara (Chief Compliance Officer, governance) assesses FSCA reporting obligation | `system` + `agent` (Imani) | `@platform/escalation` (PLANNED) | CS 3/2018 §5(3) — unresolved disputes > 15 BDs require FSCA reporting. Zara decides whether reporting is required; report is filed with FSCA via the ODP regulatory portal. |
| 11 | On completion of all trade comparisons and resolution of all breaks (or escalation of unresolvable breaks): emit `ReconciliationCompleted { counterpartyLei, tier, asOfDate, totalTrades, matchedTrades, minorBreaks, materialBreaks, unresolvedBreaks, completedAt }` | `system` | `@platform/event-store` | Vera asserts this event exists for each counterparty in each scheduled period. Missing events are P1 findings. |
| 12 | Produce a quarterly reconciliation summary for BRC: counterparty-by-counterparty break counts, resolution times, material-break trends, FSCA-reported disputes | `agent` (Tomas) | `@platform/recon` | BRC oversight of portfolio-reconciliation completeness and timeliness. |

---

## 6. Reconciliation

### Events produced

| Event | Trigger | Key fields |
|---|---|---|
| `ReconciliationStarted` | Step 2 — cycle start | `counterpartyLei`, `tier`, `asOfDate`, `openTradeCount` |
| `ReconciliationBreakFound` | Step 7 — per material or minor break | `counterpartyLei`, `tradeId`, `field`, `bankValue`, `counterpartyValue`, `breakType`, `breakAbs`, `asOfDate` |
| `ReconciliationBreakResolved` | Step 6 — minor break resolved | `tradeId`, `field`, `resolution`, `resolvedAt` |
| `ReconciliationBreakEscalated` | Step 10 — break > 15 BDs | `counterpartyLei`, `tradeId`, `ageInBDs`, `breakType` |
| `ReconciliationCompleted` | Step 11 — cycle end | `counterpartyLei`, `tier`, `asOfDate`, `totalTrades`, `matchedTrades`, `minorBreaks`, `materialBreaks`, `unresolvedBreaks`, `completedAt` |

### Invariants (CI-tested)

1. **Cycle completeness:** Vera asserts that for every active counterparty LEI in each required period (weekly / monthly / quarterly), a `ReconciliationCompleted` event exists with `asOfDate` within the required window. Missing events are P1 findings.
2. **Break resolution tracking:** `∀ ReconciliationBreakFound(tradeId, minor) → ∃ ReconciliationBreakResolved(tradeId)` within 5 BDs. Unresolved minor breaks at 5 BDs are escalated.
3. **Material break escalation:** `∀ ReconciliationBreakFound(tradeId, material, age > 15 BDs) → ∃ ReconciliationBreakEscalated(tradeId)`. Vera asserts the escalation event exists.
4. **No orphan breaks:** every `ReconciliationBreakFound` must have either a `ReconciliationBreakResolved` or a `ReconciliationBreakEscalated` event within 20 BDs.

### Failure mode

If the reconciliation diff engine fails for a counterparty, Anya (Data engineer, engineering) runs the diff manually using the position files in the document store. A `ReconciliationDiffFailed { counterpartyLei, asOfDate, reason }` event is emitted and the cycle is paused until the engine is restored or the manual diff is complete. The `ReconciliationCompleted` event is emitted once the manual diff produces a result, with `methodology: manual` noted in the event payload.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Bank position files (per counterparty, per cycle) | Document store (BLAKE3-addressed) | 7 years (Financial Markets Act) | Restricted |
| Counterparty position files received | Document store | 7 years | Restricted |
| `ReconciliationStarted` events | Event log | 7 years | Restricted |
| `ReconciliationBreakFound` events | Event log | 7 years | Restricted |
| `ReconciliationBreakResolved` events + correspondence | Event log + document store | 7 years | Restricted |
| `ReconciliationBreakEscalated` events + FSCA reports (if any) | Event log + document store | 7 years | Confidential |
| `ReconciliationCompleted` events | Event log | 7 years | Restricted |
| Quarterly BRC reconciliation summary | Document store | 5 years | Internal |

---

## 8. Manual steps

The following steps require human action or professional judgement in the current substrate:

1. **Position-file exchange with counterparty (Step 4):** Until AcadiaSoft / bilateral SFTP integration is live, Tomas (Operations engineer, engineering) manually prepares and transmits position files and receives counterparty files. Automated position-file exchange is a PLANNED substrate gap.
2. **Minor break resolution via counterparty communication (Step 6):** Operational resolution of term discrepancies requires Tomas to communicate with the counterparty's operations desk. Automated resolution messaging is a PLANNED substrate gap.
3. **Valuation dispute review (Step 8):** Rohan's (Market risk quant engineer, engineering) review of MTM discrepancies requires professional judgement on pricing methodology, curve selection, and credit-adjustment inputs. This cannot be automated without model-risk implications.
4. **Legal assessment of material breaks (Step 9):** Imani's (Legal-as-code engineer, engineering) assessment of whether a term discrepancy has legal implications (confirmation lapse, booking error, novation failure) requires legal expertise.
5. **FSCA reporting decision (Step 10):** Zara's (Chief Compliance Officer, governance) decision on whether an unresolved break requires FSCA reporting under CS 3/2018 §5(3) involves regulatory judgement.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Counterparty does not provide position file within 3 BDs | Cycle-status monitor; no counterparty file received | Tomas contacts counterparty OPS immediately; Imani notified if no response within 5 BDs; Helena informed if no file within 10 BDs |
| Reconciliation diff engine fails | `ReconciliationDiffFailed` event | Anya + Tomas immediately; manual diff initiated; cycle flagged as manual |
| Material break unresolved at 15 BDs | `ReconciliationBreakFound` age monitor | Imani + Rohan + Zara; `ReconciliationBreakEscalated` emitted; `otc-dispute-resolution.md` invoked; Zara assesses FSCA reporting |
| Missing `ReconciliationCompleted` event for scheduled cycle | Vera P1 monitor | Tomas + Anya immediately; root cause investigated; BRC notified same day |
| Systematic MTM discrepancy pattern across multiple counterparties | Material-break trend in quarterly BRC summary | Rohan reviews pricing methodology; Helena consulted; if systemic pricing error, all VM calculations may need correction |
| Counterparty refuses to exchange position files | No file received for 3+ consecutive cycles | Imani + Zara + Helena; contractual remedies under ISDA Master Agreement; FSCA notification assessed |

---

## 10. Related procedures

- [`trade-reporting-strate.md`](trade-reporting-strate.md) — PROC-MK-ODP-02; UTIs and counterparty LEIs in the bank's trade records are used in both STRATE TR reporting and portfolio reconciliation; reconciliation is a downstream data-quality check on TR submissions.
- [`margin-vm.md`](margin-vm.md) — PROC-MK-ODP-03; MTM discrepancies discovered in portfolio reconciliation may require VM adjustments; Ravi (ALM quant engineer, engineering) is notified for any material valuation break.
- [`margin-im.md`](margin-im.md) — PROC-MK-ODP-04; SIMM sensitivity inputs are validated against counterparty sensitivities in the reconciliation cycle.
- `otc-dispute-resolution.md` — invoked at Step 10 for material breaks unresolved after 15 BDs.
- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) — counterparty reconciliation frequency tier and position-file exchange protocol are agreed at onboarding; the reconciliation procedure reads these parameters per-counterparty.
- [`event-schema-evolution.md`](event-schema-evolution.md) — changes to the `OtcTradeExecuted` event schema require corresponding updates to the position-file generator in `@settlement/recon-position`.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Tomas (Operations engineer, engineering) | Initial STUB — 7-section skeleton; steps and build-phase posture documented. |
| v0.2 | 2026-05-16 | Kai (Trading systems engineer, engineering) · Anya (Data engineer, engineering) | STUB → POPULATED: full 12-section structure; YAML frontmatter added; steps expanded to 12 rows; events, invariants, evidence table, manual steps, failure modes, and audit sections added. |

---

## 12. Audit / assurance

- **Vera daily:** assert no scheduled reconciliation cycle is overdue (weekly, monthly, or quarterly); flag missing `ReconciliationCompleted` events as P1 findings.
- **Vera weekly:** check that all weekly-tier counterparties have a `ReconciliationCompleted` event for the current week; report count of material breaks and average resolution time.
- **Vera quarterly:** produce a reconciliation coverage report for BRC: all active counterparties listed with their tier, last reconciliation date, open breaks, and escalated disputes.
- **Vera ongoing:** assert `∀ ReconciliationBreakFound(material, age > 15 BDs) → ∃ ReconciliationBreakEscalated`; report any gap as a P2 finding to Zara (Chief Compliance Officer, governance).
- **Thandiwe (Chief Audit Executive, governance) annual audit:** sample reconciliation cycles across all counterparty tiers; verify position files are retained in the document store; inspect break-resolution log for timeliness; review any FSCA reports filed under CS 3/2018 §5(3).
- **FSCA supervisory examination:** FSCA may request the full reconciliation history (position files, break logs, resolution correspondence) for any counterparty and any period. The event log + document store (BLAKE3-addressed position files) support full point-in-time reconstruction.
