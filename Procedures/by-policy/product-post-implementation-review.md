---
procedureId: PROC-MK-NPA-PIR-01
title: Product Post-Implementation Review
author: Saskia (Head of Global Markets, governance) · Devon (COO, governance)
date: 2026-05-15
owner: Saskia (Head of Global Markets, governance) · Devon (COO, governance)
status: POPULATED
policy-cited: Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md
system-capability: "@platform/markets/product-register (PLANNED)"
---

# Procedure — Product Post-Implementation Review

**Procedure ID:** PROC-MK-NPA-PIR-01
**Owner:** Saskia (Head of Global Markets, governance) · Devon (COO, governance)
**Co-actors:** the 14 dimension owners (Helena · Rohan · Eitan · Ravi · Tomas · Atlas · Kai · Bea · Camille · Zara · Mira · Nadia · Imani · Senna · Iris · Yael) for re-attestations; BRC for verdict
**Approval:** BRC primary; CEO ratification (interim, until BRC constituted)
**Cadence:** Per-product; fires at end of controlled-launch period (default 90 calendar days from `ProductControlledLaunchStarted`; BRC-extendable per policy §7)
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- **D-NEW-PRODUCT-APPROVAL-POLICY** — `Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md` § 4 (lifecycle stage 6) and § 8 (post-implementation review).
- Decision record: `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md`.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| BCBS Sound Practices for the Management of Operational Risk (rev. 2021) §27 | Post-implementation review as part of new-product-approval discipline. | Mandatory PIR at controlled-launch end per parent policy §8. |
| FSCA Conduct Standard 3 of 2018 §12 | Record-keeping ≥ 5 years for OTC-derivative-provider activity. | PIR record retained ≥ 5 years; product remains on register at all status values including `retired`. |
| Banks Act 94 of 1990 + Reg 39 | Operational risk — ongoing review of new products. | Re-attestation of operational-risk and operational-readiness dimensions. |
| `ORG-CS3-001..009`, `ORG-MK-01..08`, `ORG-PR-02..19` | Markets / prudential / conduct obligations. | Re-checked across the 14 dimensions during PIR. |

## 3. Purpose

Operationalise stage 6 of the New Product Approval lifecycle — the mandatory post-implementation review at end of the controlled-launch window. The PIR is the gate that ends controlled launch: no product exits without a tabled PIR. The procedure convenes the review, collects evidence, runs the dimensional re-attestations, and produces the BRC paper that records the verdict.

The PIR verdict drives the next stage transition:
- `continue` → product moves to steady-state (stage 7); limits removed or relaxed.
- `continue-with-amended-conditions` → product moves to steady-state under an amended envelope.
- `retire` → product routed to retirement (stage 8) per [`product-retirement-migration.md`](product-retirement-migration.md).
- `withheld` (PIR itself) → product halts at controlled-launch limits pending BRC re-review.

## 4. Trigger

- Default: 90 calendar days after `ProductControlledLaunchStarted` (configurable per BRC instruction at approval; BRC may set 180 days for higher-complexity products and may shorten the period at any time).
- Early-trigger conditions: BRC instruction; cumulative breaches in controlled-launch window; Severity-1 / Severity-2 incident affecting the product; CEO emergency-retirement direction.
- The substrate scheduler emits `ProductPIRDue { productId, scheduledDate, asOf }` at the trigger; Saskia + Devon convene.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | PIR convening. Saskia + Devon issue the PIR notice; the substrate emits `ProductPIRConvened { productId, period, asOf }` and notifies the 14 dimension owners that re-attestations are due. | Saskia · Devon | `@platform/markets/product-register` (PLANNED) | Per parent policy §8. |
| 2 | Did the gates hold? Each of the 14 dimension owners re-attests whether their original `cleared` / `cleared-with-conditions` verdict still stands. Where it does not, a re-attestation event fires (`ProductDimensionAttested` with the updated result). | 14 dimension owners | `@platform/markets/product-register` (PLANNED) + per-dimension substrates | Same event type as stage 3 due-diligence per [`new-product-due-diligence.md`](new-product-due-diligence.md). |
| 3 | Did operational readiness hold? Devon attests the operational substrate performed as expected over the window; cites incident records. | Devon | `@platform/operations/incident-register` (PLANNED) | Cite Tomas (settlement) + Atlas (substrate) + Kai (markets domain). |
| 4 | Were there incidents? Senna (security) + Tomas (settlement) + relevant first-line each attest the incident record over the controlled-launch window. Severity-1 / Severity-2 incidents must be addressed in the verdict. | Senna · Tomas · first-line | `@platform/operations/incident-register`, `@platform/security/incident-register` (PLANNED) | Cross-cite [`incident-response.md`](incident-response.md). |
| 5 | Are the conditions still right? Saskia tables proposed condition deltas (additions, removals, amendments) on the conditions ledger. | Saskia | `@platform/markets/conditions-ledger` (PLANNED) | Conditions BRC attached at approval; tracked daily during controlled launch. |
| 6 | Did the economic profile match conceptualisation? Camille (with Bea) attests P&L, capital usage, and FTP attribution against conceptualisation expectations. Material divergence is itself a finding. | Camille · Bea | `@platform/accounting/posting-rules`, `@platform/capital/rwa-engine` (PLANNED) | Per parent policy §8 final bullet. |
| 7 | PIR paper and BRC table. Saskia (with Devon) produces the PIR paper summarising the re-attestations, incident record, conditions deltas, and economic-profile review. The paper is tabled at BRC. | Saskia · Devon | Owner Inbox `YYYY-MM-DD_saskia_pir-paper_<productId>.md` | Per Principle 2 — generated query over the projection, not hand-assembled substance. |
| 8 | BRC verdict. BRC votes one of: `continue`, `continue-with-amended-conditions`, `retire`, `withheld`. CEO ratifies (interim until BRC constituted). | BRC chair · CEO | `@platform/governance/brc-vote` (PLANNED) | Verdict recorded with `approvalAuthority` payload. |
| 9 | Emit close event. The substrate emits `ProductPIRCompleted { productId, verdict, amendedConditions, asOf }`. On `continue` / `continue-with-amended-conditions`, controlled launch closes via `ProductControlledLaunchCompleted` and the product transitions to stage 7. On `retire`, route to [`product-retirement-migration.md`](product-retirement-migration.md). On `withheld`, the product halts at controlled-launch limits pending re-review. | Saskia | `@platform/markets/product-register` (PLANNED) | Closes the PIR event series. |

## 6. Reconciliation

- **Events produced:** `ProductPIRDue` (scheduler), `ProductPIRConvened`, 14 × re-attestation `ProductDimensionAttested` (or fewer if any are passed-through unchanged with explicit no-change attestation), `ProductPIRCompleted` (with verdict). Downstream: `ProductControlledLaunchCompleted` (on `continue` / `continue-with-amended-conditions`), or `ProductRetired` (on `retire`).
- **Reconciliation check:** every `ProductControlledLaunchStarted` resolves to exactly one `ProductPIRCompleted`. PIR findings either close clean (verdict `continue`), generate follow-up actions (verdict `continue-with-amended-conditions`), or trigger `ProductWithheld` (verdict `withheld`) / `ProductRetired` (verdict `retire`). Missing or duplicate PIR events are findings.
- **Failure mode:** PIR not convened by `scheduledDate` triggers automatic escalation to BRC chair + CEO; new transactions halt until PIR convenes.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ProductPIRDue` / `ProductPIRConvened` / `ProductPIRCompleted` | Event log (P1) | Indefinite | Internal |
| 14 × re-attestation `ProductDimensionAttested` | Event log | Indefinite | Internal |
| PIR paper | Owner Inbox `YYYY-MM-DD_saskia_pir-paper_<productId>.md` | ≥ 5 years (Conduct Standard 3/2018 §12) | Internal |
| Incident records cited | `@platform/operations/incident-register` (PLANNED) | Per incident-response policy | Confidential — security |
| Conditions-deltas | `@platform/markets/conditions-ledger` (PLANNED) | Indefinite | Internal |

## 8. Manual steps

- BRC verdict (Step 8) is human governance discretion recorded as a typed event.
- Each dimension owner's re-attestation involves substantive sub-policy work; capture per Principle 2 with citation to the sub-policy.
- Build-phase: PIR papers are filed as Owner Inbox deliverables until `@platform/markets/product-register` lands.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| PIR not convened by scheduled date | Step 1 timer | BRC chair + CEO; new transactions halt until convened |
| Dimension re-attestation regresses (`cleared` → `withheld`) | Step 2 | Saskia decides redesign / amend / retire; BRC informed at table |
| Severity-1 / Severity-2 incident in window not addressed in verdict | Step 4 | Senna + Devon — finding routed to BRC; verdict cannot be `continue` without addressing |
| Material economic-profile divergence | Step 6 | Camille + Bea — finding tabled at BRC |
| BRC verdict `withheld` | Step 8 | Product halts at controlled-launch limits; Saskia tables remediation plan within agent-cadence interval set by BRC |

## 10. Related procedures

- [`new-product-due-diligence.md`](new-product-due-diligence.md) — stage 3; provides the dimensional pattern PIR re-uses.
- [`product-controlled-launch.md`](product-controlled-launch.md) — stage 5; PIR is the mandatory closure gate.
- [`product-retirement-migration.md`](product-retirement-migration.md) — stage 8; routed on PIR `retire` verdict.
- [`incident-response.md`](incident-response.md) — incident records consumed at Step 4.
- [`npa-gate.md`](npa-gate.md) — stage 4; the gate paper that set the conditions PIR re-examines.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-10 | Owen (via Scrooge) | Initial draft authored alongside D-NEW-PRODUCT-APPROVAL-POLICY approval. STUB — substrate PLANNED; binds at first PIR. |
| v1.0 | 2026-05-15 | Saskia + Devon (via Scrooge) | Promoted to POPULATED. Added standard 12-section frontmatter and reconciliation; all substantive content carried forward from v0.1. |

## 12. Audit / assurance

- Vera consumes the PIR event series + re-attestation stream + incident-record cross-references as continuous-controls evidence. Findings: PIRs not convened on schedule, missing dimensional re-attestations, verdicts inconsistent with incident record, `continue` verdicts where Severity-1/2 incidents were unaddressed.
- Reportable to Owen + Saskia.
- Annual re-review of this procedure by Saskia and Devon against the NPA policy §8; changes trigger a procedural update through Owen.
- Conduct Standard 3/2018 §12 record-keeping: PIR papers retained ≥ 5 years.
