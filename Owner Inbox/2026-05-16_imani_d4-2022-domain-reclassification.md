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
**Register version:** 1.28 (base: v1.27)

## What was corrected and why

PA Directive 4 of 2022 was filed in Domain A (Prudential) as `ORG-PR-41` with a URN slug `prudential:pa-d4-2022-risk-return`. Mira (Compliance / RegTech engineer) confirmed the misclassification during WS-INSTRUMENT-ANALYSES citation-TBC resolution run 1 (PR #449): direct PDF text extraction shows D4/2022 is issued under **FIC Act 38/2001 s.43A(3)** — the enabling authority for PA directives to supervised institutions on AML/CFT matters. The directive requires banks to submit ML/TF/PF (money laundering / terrorist financing / proliferation financing) risk returns quarterly to the PA. This is a Financial crime obligation, not a Prudential one.

The v1.27 register flagged this explicitly: "ORG-PR-41 should be re-evaluated: if the intent is to capture the AML/CFT ML/TF/PF risk-return submission obligation, the instrument is correct but the Requirement and Owner columns need updating. Action routed to Imani + Mira for next run." This PR is that next run.

## Legal basis

- **FIC Act 38/2001 s.43A(3)** — enabling authority under which the SARB Prudential Authority issued D4/2022 directing banks to submit ML/TF/PF risk returns. Confirmed from extracted PDF §1 and cover page (sarb-pdf-extract tool, 2026-05-16 run 1).
- The prior Domain A chain (Banks Act 94/1990 + Reg 46 BA-return reporting umbrella) is wrong for this instrument. Reg 46 governs prudential BA-series returns (BA 100, BA 200, BA 300, etc.); D4/2022 governs AML/CFT risk returns submitted via the PA portal under the FIC Act supervisory regime.

## Before / after comparison

| Field | Before (ORG-PR-41, Domain A) | After (ORG-FC-24, Domain B) |
|---|---|---|
| Row ID | `ORG-PR-41` | `ORG-FC-24` |
| Domain | A — Prudential | B — Financial crime, AML / CFT, sanctions |
| URN slug | `urn:obligation:bank:prudential:pa-d4-2022-risk-return:v1` | `urn:obligation:bank:fc:pa-d4-2022-aml-cft-reporting:v1` |
| Citation enabling authority | Banks Act 94/1990 + Reg 46 | FIC Act 38/2001 s.43A(3) |
| Requirement | "Submit the Risk Return… covering risk-side reporting on operational risk, market risk, credit risk loss events, and large-exposure changes" | "Submit ML/TF/PF risk returns to the SARB Prudential Authority quarterly per the form, frequency, content, and electronic submission channel prescribed by PA Directive 4 of 2022 under FIC Act s.43A(3)" |
| Owner | Helena (CRO) + Camille (CFO) + Bea + Iris | Zara (CCO — MLRO interim) + Mira + Iris |
| Risk taxonomy | RT-LR.RC | RT-FC.ML |
| Activity scope | ACT-REPORT-PRUDENTIAL | ACT-GOVERN-COMPLIANCE, ACT-CLIENT-ONBOARD |

## Key instrument facts from extracted PDF

- Submission frequency: quarterly (Q1: Jan–Mar by 30 Apr; Q2: Apr–Jun by 31 Jul; Q3: Jul–Sep by 31 Oct; Q4: Oct–Dec by 31 Jan)
- Submission channel: https://paportal.resbank.co.za/umojaportal
- Failure to submit: administrative sanctions under FIC Act s.62E
- Scope: banks, branches, cross-border banking operations, mutual banks, life insurers

## Downstream references updated

- **Obligations register rows:** No other data row cross-references `ORG-PR-41` in its cell text. Historical version banners (v1.16 and v1.19) retain ORG-PR-41 — these are immutable historical records and are correctly left unchanged.
- **Prototype TypeScript files:** One narrative reference in `prototype/scripts/record-d-pa-communications-full-historical-sweep.ts` (historical decision record text) — not structural code consuming the ID; no update required.
- **ORG-FC-23 cross-link:** ORG-FC-23 (AML/CFT/CPF Communication 1/2025) §5.2 footnote 4 references D4/2022. That reference is in ORG-FC-23's Citation cell describing the extracted PDF content — it is a citation to the instrument, not to the old row ID. No update required.

Authority: standing register-curator mandate (Mira under Zara) with Imani (Legal-as-code engineer) as legal sourcing co-author. No new CEO decision required — correction of a factual misclassification, not a new obligation or policy change.
