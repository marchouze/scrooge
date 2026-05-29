---
policy-parent: Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md
last-reviewed: 2026-05-15
procedureId: PROC-MK-NPA-DD-01
title: New Product Due Diligence
author: Saskia (Head of Global Markets, governance)
date: 2026-05-15
owner: Saskia (Head of Global Markets, governance) · Devon (COO, governance)
status: POPULATED
policy-cited: Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md
system-capability: "@platform/markets/product-register (PLANNED)"
---

# Procedure — New Product Due Diligence

**Procedure ID:** PROC-MK-NPA-DD-01
**Owner:** Saskia (Head of Global Markets — proposing seat) · Devon (COO — operational-readiness gate)
**Co-actors per dimension:** Helena · Rohan · Eitan · Ravi · Tomas · Atlas · Kai · Bea · Camille · Zara · Mira · Nadia · Imani · Senna · Rashida · Iris · Yael (named in §5)
**Approval:** BRC primary; CEO ratification (interim, until BRC constituted per `D-THIN-HUMAN-LAYER-MINIMUM`); Board where the product crosses a Board-Reserved Matter
**Cadence:** Per-product; fires on `ProductProposed` (stage 3 of the 8-stage NPA lifecycle); re-fires at PIR, annual review, and material change
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- **D-NEW-PRODUCT-APPROVAL-POLICY** — `Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md` § 4 (lifecycle stage 3) and § 5 (the 14 dimensions).
- Decision record: `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md`.
- Companion construction-substrate decision: `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md`.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| BCBS Sound Practices for the Management of Operational Risk (rev. 2021) §27 | Documented new-product-approval process with multi-dimensional gates. | This procedure orchestrates the §5 dimensions of the parent policy. |
| Banks Act 94 of 1990 + Regulations Relating to Banks Reg 39 | Operational risk management — new-product approval. | Covered by the operational-risk and operational-readiness dimensions (§5 dimensions 4 and 5). |
| FSCA Conduct Standard 3 of 2018 §§3–9 | Pre-trade dimensional coverage for OTC Derivative Providers. | Covered by the conduct, AML, and legal-documentation dimensions. |
| `ORG-CS3-001..009` | Conduct Standard 3/2018 obligations register entries. | Cited per dimension where applicable. |
| `ORG-MK-01..08`, `ORG-PR-02..19`, `ORG-AML-*`, `ORG-CD-01..07`, `ORG-CY-*` | Markets / prudential / AML / conduct / cyber obligations. | Per-dimension citations enumerated in policy §5. |
| `ORG-TAX-*` | Tax obligations register entries. | Route to Mira if codes not yet populated. |

## 3. Purpose

Operationalise stage 3 of the New Product Approval lifecycle — the substantive due-diligence cycle in which each of the 14 gates in policy §5 is independently attested by its named owner. This procedure orchestrates the attestations, captures their outcomes as typed events, and produces the consolidated package BRC reads at stage 4.

The procedure is the HOW for policy §5; it does not author dimensional substance (the dimension owners do that under their own sub-policies — Model Risk Policy, Sanctions Policy, Operational Risk Policy, etc.). It is the gate-orchestrator and the evidence-binder.

## 4. Trigger

- A `ProductProposed` event arrives on the Product Register stream (i.e. stage 1 has registered the proposal and stage 2 conceptualisation is complete).
- Saskia (or franchise lead) opens the dimension cycle by emitting `ProductDueDiligenceCycleStarted`.
- Re-trigger conditions: PIR (`ProductPostImplementationReviewCompleted` with `verdict: continue-with-amended-conditions` or PIR re-attestation request); annual review (steady-state stage 7); material change to a dimension's underlying citation, model, or operational substrate.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Open the dimension cycle. Saskia confirms the conceptualisation memo (per policy §4 stage 2) and emits `ProductDueDiligenceCycleStarted { productId, dimensionsRequired: [...14], asOf }`. | Saskia | `@platform/markets/product-register` (PLANNED) | Dimensions enumerated per policy §5; "material extension" cycles per policy §2 may use a short-form subset cleared by Zara + Imani. |
| 2 | Dimension 1 — Market risk attestation. Helena (Rohan) produces the sensitivity profile and RAS § B-market envelope check; emits `ProductDimensionAttested { productId, dimension: "market-risk", result, citationChain, evidenceUri, asOf }`. | Helena · Rohan | `@platform/risk/market-engine` (PLANNED) | Fail rule per policy §5 row 1; cite `ORG-PR-19`. |
| 3 | Dimension 2 — Credit risk attestation. Helena (Rohan) runs SA-CCR + concentration check at expected book size. | Helena · Rohan | `@platform/risk/credit-engine` (PLANNED) | Cite `ORG-PR-09`, `ORG-PR-16`. |
| 4 | Dimension 3 — Liquidity / funding attestation. Eitan (Ravi) computes LCR / NSFR contribution + FTP attribution. | Eitan · Ravi | `@platform/treasury/lcr-nsfr` (PLANNED) | Cite `ORG-PR-06..08`. |
| 5 | Dimension 4 — Operational risk attestation. Devon (with Helena) attests process-readiness, severe-but-plausible scenarios, vendor-concentration. | Devon · Helena | `@platform/operations/rcsa` (PLANNED) | Cite `ORG-PR-17`, `ORG-PR-18`. |
| 6 | Dimension 5 — Operational readiness (substrate) attestation. Tomas (settlement) + Atlas (substrate) + Kai (markets domain) attest substrate-completeness: event types registered, settlement path live (or simulator in build phase), reconciliation harness covers the product's lifecycle. | Tomas · Atlas · Kai | `@platform/event-store/event-types`, `@platform/recon/*`, settlement substrate (PLANNED for live products) | Citation: CLAUDE.md Principles 1, 3; cross-cite `event-schema-evolution.md` if new event types required. |
| 7 | Dimension 6 — Accounting classification attestation. Bea (with Camille) produces IFRS 9 SPPI + business-model + IFRS 13 fair-value-hierarchy + IAS 21 + sub-ledger posting map + BA-return cell mapping. | Bea · Camille | `@platform/accounting/posting-rules` (PLANNED) | Cite `ORG-AC-15`. |
| 8 | Dimension 7 — Capital impact attestation. Camille (with Helena) computes pre-deal RWA delta + capital-headroom + Pillar 2A consideration. | Camille · Helena | `@platform/capital/rwa-engine` (PLANNED) | Cite `ORG-PR-02`, `ORG-PR-03`, `ORG-PR-05`. |
| 9 | Dimension 8 — Conduct / suitability attestation. Zara (with Saskia) produces FAIS conduct treatment, FSCA Conduct Standard 1–3 of 2018 mapping, TCF posture. | Zara · Saskia | `@platform/conduct/fais-treatment` (PLANNED) | Cite `ORG-CD-01..07`, `ORG-CS1-001..ORG-CS3-009`. |
| 10 | Dimension 9 — AML / sanctions / PEP attestation. Mira (with Zara) extends the CDD pathway, sanctions service coverage, PEP-detection gate, STR/CTR pathway. | Mira · Zara | `@platform/compliance/sanctions-screening`, `@platform/compliance/transaction-monitoring` | Cite `ORG-AML-*`, `ORG-SAN-*`. |
| 11 | Dimension 10 — Model risk attestation. Nadia produces Tier-classification of every new pricing / risk / classification model. | Nadia | `@platform/model-risk/registry` (PLANNED) | Cite RAS § B7; SR 11-7 / SS 1/23 idiom. |
| 12 | Dimension 11 — Legal documentation attestation. Imani produces master-agreement coverage attestation, ECTA execution path, dispute-resolution procedure, jurisdiction matrix. | Imani | `@platform/legal/clause-library` (PLANNED) | Cite `ORG-MK-06`, `ORG-CS3-001`, `ORG-CS3-004`. |
| 13 | Dimension 12 — Information security attestation. Senna (with Rashida) produces threat model covering wire path, HSM key custody where signing introduced, zero-trust posture for new external integrations. | Senna · Rashida | `@platform/security/threat-model`, `@platform/secure-sdlc` | Cite `ORG-CY-*`; Joint Standard 2 of 2024. |
| 14 | Dimension 13 — Privacy attestation. Iris produces POPIA classification, cross-border transfer determination, retention-schedule mapping. | Iris | `@platform/privacy/popia-register` (PLANNED) | Cite `ORG-PR-PRIV-*`. |
| 15 | Dimension 14 — Tax attestation. Yael produces VAT / STT / FATCA / CRS / transfer-pricing / s.24J classification. | Yael | `@platform/tax/classification` (PLANNED) | Cite `ORG-TAX-*`. |
| 16 | Aggregation. The substrate aggregates the 14 attestations. Any `withheld` halts the cycle; Saskia decides redesign-and-re-enter at stage 2 or abandon. Where all dimensions are `cleared` or `cleared-with-conditions`, the cycle closes. | system | `@platform/markets/product-register` (PLANNED) | Per policy §4 stage 3. |
| 17 | Close. On clean aggregation, emit `ProductDueDiligenceCompleted { productId, dimensionResults, conditions, asOf }`. On withheld, emit `ProductDueDiligenceWithheld { productId, failedDimension, reason, asOf }`. | Saskia | `@platform/markets/product-register` (PLANNED) | Triggers stage 4 (BRC paper) or stage-2 re-entry. |

## 6. Reconciliation

- **Events produced:** 14 × `ProductDimensionAttested` (one per dimension); plus `ProductDueDiligenceCycleStarted`; plus exactly one of `ProductDueDiligenceCompleted` or `ProductDueDiligenceWithheld` per cycle.
- **Reconciliation check:** for every `ProductDueDiligenceCycleStarted`, the substrate observes either (a) 14 distinct `ProductDimensionAttested` events (one per `dimension` enum) followed by `ProductDueDiligenceCompleted`, or (b) at least one `ProductDimensionAttested` with `result: withheld` followed by `ProductDueDiligenceWithheld`. Missing dimensions or duplicate attestations on the same dimension are findings.
- **Failure mode:** an open cycle with no closing event after a configurable SLA (default 90 calendar days from `ProductDueDiligenceCycleStarted`) escalates to Saskia + BRC chair.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| 14 × `ProductDimensionAttested` events | Event log (P1) | Indefinite | Internal — citation chains may carry counterparty references |
| `ProductDueDiligenceCycleStarted` / `ProductDueDiligenceCompleted` / `ProductDueDiligenceWithheld` | Event log | Indefinite | Internal |
| Dimension-evidence URIs (referenced by `evidenceUri` payload) | Per-dimension owner's substrate | Per sub-policy | Per sub-policy (often confidential — risk methodology, security threat models) |
| Consolidated due-diligence package (BRC paper input) | Owner Inbox `YYYY-MM-DD_saskia_npa-dd-package_<productId>.md` | ≥ 5 years (Conduct Standard 3/2018 §12) | Internal |

## 8. Manual steps

- Each dimension's substantive analysis is performed by the dimension owner under their own sub-policy. Where the sub-policy's analysis is human-led (e.g. Senna's threat-model gate, Imani's master-agreement review), the human-led step is captured per Principle 2 with citation to the sub-policy.
- Saskia's decision to redesign-and-re-enter or abandon on a `withheld` dimension is human discretion captured as `ProductWithheld { reason: "proposal-withdrawn:<rationale>" }` (canonical typed family per D-PRODUCT-CONSTRUCTION-SUBSTRATE) or a stage-2 re-entry handled by re-firing `PROC-MK-NPA-DD-01`.
- Build-phase: dimensional substrates marked PLANNED in §5 are not yet built; attestations are produced from spec and recorded by Scrooge-coordinated runs until the substrate lands. This is the substrate gap tracked as a roadmap item.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Dimension owner fails to attest within SLA | Step 16 aggregation timeout | Saskia → BRC chair → CEO |
| `withheld` on any dimension | Step 16 aggregation | Saskia decides redesign / abandon; BRC informed |
| Citation chain incomplete on any attestation | Mira citation gate (`@platform/citation/gate.ts`) | Mira → dimension owner; cycle does not close until cured |
| Material change to a sub-policy mid-cycle | Mira regulatory-change feed | Saskia restarts the affected dimension; BRC notified |
| Build-phase substrate gap blocks a dimension's attestation | Step 6 (operational readiness) | Atlas + Saskia — the gap is captured as a roadmap item; CEO ratifies a substrate-deferred attestation only on emergency basis |

## 10. Related procedures

- [`product-controlled-launch.md`](product-controlled-launch.md) — stage 5; consumes `ProductApproved` produced downstream of this procedure's close event.
- [`product-post-implementation-review.md`](product-post-implementation-review.md) — stage 6; re-fires the dimensional attestations.
- [`product-retirement-migration.md`](product-retirement-migration.md) — stage 8.
- [`npa-gate.md`](npa-gate.md) — stage 4 BRC paper and gate; upstream close of this procedure triggers BRC review.
- [`event-schema-evolution.md`](event-schema-evolution.md) — invoked when dimension 5 (operational readiness) requires new event types.
- [`model-validation.md`](model-validation.md) — Nadia's procedure consumed by dimension 10.
- [`sanctions-screening.md`](sanctions-screening.md) — Mira's procedure consumed by dimension 9.
- [`secure-sdlc.md`](secure-sdlc.md) + threat-model-review sub-procedure — Senna's procedure consumed by dimension 12.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-10 | Owen (via Scrooge) | Initial draft authored alongside D-NEW-PRODUCT-APPROVAL-POLICY approval. STUB — substrate components mostly PLANNED; binds at next `ProductProposed`. |
| v1.0 | 2026-05-15 | Saskia + Devon (via Scrooge) | Promoted to POPULATED. Added standard 12-section frontmatter and reconciliation; all substantive content carried forward from v0.1. |

## 12. Audit / assurance

- Vera consumes the 14 × `ProductDimensionAttested` stream + the cycle open / close events as continuous-controls evidence. Findings: missing dimensions, duplicate attestations on the same dimension, citation-chain gaps, SLA breaches.
- Reportable to Owen + Saskia; structural findings (substrate-gap-induced) flow to Atlas + Devon.
- Annual review of this procedure against the NPA policy to confirm the 14 dimensions remain current.
- Any change to the parent policy §5 dimension list triggers a procedural update through Owen (procedural-discipline custodian).
