---
agent: Imani
trigger: d4-2022-domain-reclassification
asOf: 2026-05-16T00:00:00.000Z
decision-required: false
tags: [obligations-register, domain-reclassification, aml-cft]
---

# D4/2022 domain reclassification — ORG-PR-41 → ORG-FC-24

**Author:** Imani (Legal-as-code engineer, engineering — reports to Devon (Chief Operating Officer, governance))
**Date:** 2026-05-16
**Register version:** 1.28

## What was corrected and why

PA Directive 4 of 2022 was filed in Domain A (Prudential — Regulation 46 reporting) as `ORG-PR-41`. Mira (Compliance / RegTech engineer) surfaced the misclassification during citation-TBC resolution run 1 (PR #449): the PDF text confirms D4/2022 is issued under FIC Act s.43A(3) — the enabling authority for AML/CFT directives to supervised institutions — not under Banks Act s.72 or Regulations Relating to Banks Reg 46.

An AML/CFT-enabling directive belongs in Domain B (Financial crime, AML / CFT, sanctions), not Domain A.

## Legal basis

- **FIC Act 38/2001 s.43A(3)** — enabling authority under which the SARB Prudential Authority issues AML/CFT directives to accountable institutions (banks). This is the correct enabling chain for the obligation.
- The instrument itself (D4/2022) was previously indexed in the wrong chain: Banks Act 94/1990 + Reg 46 (BA-return reporting umbrella) — that chain governs prudential returns, not AML/CFT reporting.

## Before / after comparison

| Field | Before (ORG-PR-41, Domain A) | After (ORG-FC-24, Domain B) |
|---|---|---|
| Row ID | `ORG-PR-41` | `ORG-FC-24` |
| Domain | A — Prudential | B — Financial crime, AML / CFT, sanctions |
| URN slug | `urn:obligation:bank:prudential:pa-d4-2022-risk-return:v1` | `urn:obligation:bank:fc:pa-d4-2022-aml-cft-reporting:v1` |
| Citation enabling authority | Banks Act 94/1990 + Reg 46 | FIC Act 38/2001 s.43A(3) |
| Requirement framing | "Submit the Risk Return… covering risk-side reporting on operational risk, market risk, credit risk loss events, and large-exposure changes" | "Submit AML/CFT-related reporting to the SARB Prudential Authority per the form, frequency, content, and submission-channel prescribed by PA Directive 4 of 2022 under FIC Act s.43A(3)" |
| Owner | Helena (CRO) + Camille (CFO) + Bea + Iris | Zara (CCO) + Mira + Iris |
| Risk taxonomy | RT-LR.RC | RT-FC.ML |
| Activity scope | ACT-REPORT-PRUDENTIAL | ACT-GOVERN-COMPLIANCE, ACT-CLIENT-ONBOARD |

## Downstream references updated

- **Obligations register rows:** No other row cross-references `ORG-PR-41` in its cell text. The v1.16 version banner (historical record) retains `ORG-PR-41` as-is — this is correct; historical banners are immutable records of what that version contained.
- **Prototype TypeScript files:** One reference found in `prototype/scripts/record-d-pa-communications-full-historical-sweep.ts` — this is narrative text inside a historical decision record, not structured code consuming the row ID. No update required; the script records what v1.16 did, not the corrected classification.

## Register version bump

- v1.27 slot: reserved (no intervening structural changes between v1.26 and this reclassification)
- v1.28: this reclassification (D4/2022 domain correction)

Authority: standing register-curator mandate (Mira under Zara) with Imani (Legal-as-code engineer) as legal sourcing co-author. No new CEO decision required — correction of a factual misclassification, not a new obligation or policy change.
