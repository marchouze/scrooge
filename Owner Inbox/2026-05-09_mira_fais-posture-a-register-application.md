---
title: FAIS Posture A — obligations register application (D-FSP-LICENCE-NECESSITY)
author: Mira (Compliance / RegTech engineer)
date: 2026-05-09
summary: Domain P added to `Regulations/_obligations-register.md` (v1.4) under CEO decision D-FSP-LICENCE-NECESSITY (resolved 2026-05-09 as confirm-A-no-research, PR #62). 1 row closes ORG-FAIS-KI (gap → corporate-bind; Saskia steady-state KI; Marc interim until Saskia fit-and-proper file completes). 5 new FAIS-record-keeping URNs landed under `urn:obligation:bank:fais:*:v1`. Citation-TBC items routed to Imani (Legal-as-code engineer) + external counsel for ratification at licence-application gate.
decision-required: false
maps-to-decision-id: D-FSP-LICENCE-NECESSITY
---

# FAIS Posture A — obligations register application

**Author:** Mira (Compliance / RegTech engineer) — obligations-register curator
**Reports through:** Zara (Chief Compliance Officer)
**Date:** 2026-05-09
**Decision authority:** `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md` (PR #62)
**Source proposal:** `Owner Inbox/2026-05-09_zara_fsp-application-path.md` (PR #44)
**Register-format anchors:** PR #42 (Domain O thin-human-layer) + PR #56 (Domain FX FinSurv wave-1)

---

## 1. What landed

CEO decision `D-FSP-LICENCE-NECESSITY` (resolved 2026-05-09 as `confirm-A-no-research`) confirmed Posture A as the steady-state — the bank pursues an FSP licence under FAIS Act 37 of 2002; Saskia (Head of Global Markets, governance) is the steady-state FAIS Key Individual under the Determination of Fit and Proper Requirements 2017; Marc remains FAIS KI interim through licence-day until Saskia's fit-and-proper file completes (Saskia's PR #45 Gate (b)). The FAIS-record-keeping substrate (advice records, suitability assessments, fee disclosures, complaint-handling, General Code of Conduct umbrella) is binding.

This pass is the obligations-register operationalisation of that decision. The new section **Domain P — FAIS Posture A binding (D-FSP-LICENCE-NECESSITY)** has been added to `Regulations/_obligations-register.md` (v1.3 → v1.4) immediately before Domain L. It contains 6 rows: 1 closure (ORG-FAIS-KI) + 5 new FAIS-record-keeping URNs.

The dashboard `prototype/seeds/dashboard-state.json` has been re-derived (not hand-edited) via `prototype/scripts/derive-dashboard-state-2026-05-09-fais-posture-a.ts`. Obligations metric: **181 → 187** (Δ +6). `bun run recon:dashboard` passes after re-derivation.

---

## 2. ORG-FAIS-KI closure outcome

The `ORG-FAIS-KI` URN row was previously read as a `gap` row per Zara's PR #44 reading (the row exists in PR #42's draft Domain O at status `N/A-yet (FSP-licence-conditional)`; Zara's PR #44 narrated it as a gap-of-meaning under the unresolved Posture A/B question). Domain P closes that gap.

| Field | Value |
|---|---|
| URN | `urn:obligation:bank:org:fais:key-individual:v1` |
| Status | `corporate-bind` (was `gap` / `N/A-yet`) |
| Source instrument | FAIS Act 37 of 2002 § 8 + Determination of Fit and Proper Requirements 2017 |
| Plain-English statement | Saskia (Head of Global Markets, governance) is the steady-state Key Individual under FAIS s.8 + Determination of Fit and Proper 2017. Marc remains FAIS KI interim until Saskia's fit-and-proper file completes (Saskia's PR #45 Gate (b)). |
| Cross-references | D-FSP-LICENCE-NECESSITY (PR #62), D-THIN-HUMAN-LAYER-MINIMUM (PR #24, merged), Saskia's FAIS-KI handover note (PR #45) |

The `corporate-bind` status reflects that the obligation binds at corporate formation under the bank's confirmed Posture A, rather than waiting for licence-day. It supersedes the `N/A-yet (FSP-licence-conditional)` reading — Posture A is no longer conditional on the licensing question.

---

## 3. The 5 new FAIS-record-keeping URNs landed

Each carries `[citation: TBC]` against the precise General Code of Conduct sub-section (per Principle 2 — do not invent regulatory section refs). The cluster is anchored under `urn:obligation:bank:fais:*:v1`.

| ID | URN | Substrate / event family |
|---|---|---|
| ORG-FAIS-RK-ADVICE | `urn:obligation:bank:fais:advice-records:v1` | `AdviceRecorded` (Atlas v1) |
| ORG-FAIS-RK-SUITABILITY | `urn:obligation:bank:fais:suitability-assessments:v1` | `SuitabilityAssessed` (Atlas v1) |
| ORG-FAIS-RK-FEE-DISCLOSURE | `urn:obligation:bank:fais:fee-disclosures:v1` | `FeeDisclosed` (Atlas v1) |
| ORG-FAIS-RK-COMPLAINT-HANDLING | `urn:obligation:bank:fais:complaint-handling:v1` | `ComplaintReceived` / `ComplaintInvestigated` / `ComplaintResolved` (Atlas v1) |
| ORG-FAIS-RK-GENERAL-CODE | `urn:obligation:bank:fais:general-code-of-conduct:v1` | (umbrella; anchors the four sub-domain rows + residual General Code obligations) |

All 5 rows status `corporate-bind` per `project_rules_bind_at_commencement.md`.

---

## 4. `[citation: TBC]` items routed

The following citation precision items are routed for ratification at the licence-application gate:

| Row | TBC citation | Route to |
|---|---|---|
| ORG-FAIS-RK-ADVICE | Precise General Code of Conduct sub-section on advice-record retention; FAIS subordinate-legislation on retention period | Imani (Legal-as-code engineer) + external counsel |
| ORG-FAIS-RK-SUITABILITY | Precise General Code sub-section on suitability-assessment record requirements | Imani + external counsel |
| ORG-FAIS-RK-FEE-DISCLOSURE | Precise General Code sub-section on fee / charge disclosure pre-engagement; FAIS Subordinate Legislation on fee-disclosure form | Imani + external counsel |
| ORG-FAIS-RK-COMPLAINT-HANDLING | Precise FAIS subordinate-legislation reference for complaint-management; FSCA Conduct Standards on complaint-handling cross-reference | Imani + external counsel |
| ORG-FAIS-RK-GENERAL-CODE | Full General Code sub-section index | Imani + external counsel |

Imani's external-counsel-licence-application brief (`Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md`) is the carrier for these. Per the CEO decision record §"What this does not resolve", counsel ratifies Posture-A scope at the licence-application gate; the General Code sub-section index is one of the inputs counsel produces during that engagement.

The TBC flags are themselves Principle-2 compliant — the row is registered as having an open citation question, with the substantive content captured. The flag is the honest record, not a guess.

---

## 5. Substrate gaps surfaced

Five substrate gaps are load-bearing for FAIS Posture A operationalisation:

1. **Typed-event family `AdviceRecorded` / `SuitabilityAssessed` / `FeeDisclosed` (and complaint-pipeline events).** Atlas (Core banking platform architect) v1. The four FAIS-record-keeping sub-domain rows reference event families that do not yet exist in `prototype/`. Substrate-gap: typed-event family wiring under `prototype/platform/events/markets/` (or similar — Atlas places).

2. **Customer-categorisation-as-institutional-only screening.** Niko (Sales / CRM engineer) v0 substrate-stub. Per the CEO decision record §"What this does not resolve", every counterparty onboarded must clear an institutional-eligibility test that anchors the FAIS scope-of-services to the institutional product set. The suitability-assessment substrate (`ORG-FAIS-RK-SUITABILITY`) calibrates against the institutional-counterparty assumption-set; absent the screening, the suitability calibration cannot be applied.

3. **Fit-and-proper file template.** Sade (AgentOps engineer) v0 substrate-stub. The template captures the five Determination of Fit and Proper Requirements 2017 dimensions (honesty/integrity, competence, operational ability, financial soundness, oversight) with structured evidence slots. Saskia's transition from interim Marc-as-KI to steady-state Saskia-as-KI gates on Gate (b) of Saskia's PR #45 — completion of the fit-and-proper file. Until Sade's template lands, Gate (b) cannot be evidenced.

4. **Procedure substrate `Procedures/by-policy/complaint-handling.md`.** ORG-FAIS-RK-COMPLAINT-HANDLING references this procedure, which does not yet exist in `/Procedures/by-policy/`. The TCF outcome 6 intersect makes this load-bearing for both Domain P and Domain C `ORG-CD-07`. Owen (Company Secretary, governance) — secondary engineering owner Mira — to author as a follow-on.

5. **Counsel-gate-narrowing substrate-check at licence-application.** Inherited from the CEO decision record §"Substrate gaps surfaced". The FAIS Posture A confirmation closes the binary A/B question but does not eliminate counsel's ratification of Posture-A scope at the licence-application gate. The substrate-side check (does counsel sign off on Posture-A scope?) is unbuilt; load-bearing at licence-application gate.

---

## 6. What does NOT change in this pass

Per the CEO decision's separate follow-on routes (do not duplicate parallel agents' work):

- Saskia is updating her FAIS-KI handover note (PR #45) with confirmation that Gate (a) drops; transitions on Gate (b) alone (separate route).
- Owen is updating the governance framework + composition paper (PR #47) to record FAIS KI as a steady-state seat (separate route).
- Zara is updating `Owner Inbox/2026-05-09_zara_fsp-application-path.md` with the confirm-A header and flipping TCF outcome 4 from gated to binding (separate route).
- Imani is narrowing the external-counsel scope to Posture-A application-bundle (separate route).
- PAX's FSP-licence-necessity research dispatch is withdrawn (separate route).
- Sade authors the FAIS-KI fit-and-proper-file template (separate route).
- Niko wires the customer-categorisation-as-institutional-only screening (separate route).

This pass closes Mira's specific scope: **the obligations-register application of D-FSP-LICENCE-NECESSITY** (1 closure + 5 new URNs + dashboard re-derivation). Nothing more.

---

## 7. Cross-references

- **Decision record:** `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md` (PR #62)
- **Source proposal:** `Owner Inbox/2026-05-09_zara_fsp-application-path.md` (PR #44)
- **Saskia FAIS-KI handover:** PR #45
- **Register-format anchors:** PR #42 (Domain O thin-human-layer; ORG-FAIS-KI initial draft row), PR #56 (Domain FX FinSurv wave-1; URN-cluster format with seven-column schema)
- **Parent decision:** D-THIN-HUMAN-LAYER-MINIMUM (PR #24, merged)
- **Register file:** `Regulations/_obligations-register.md` (Domain P, v1.4)
- **Dashboard re-derivation script:** `prototype/scripts/derive-dashboard-state-2026-05-09-fais-posture-a.ts`
- **Citation types:** `prototype/platform/citation/types.ts` (URN scheme — `urn:obligation:bank:fais:*:v1` extends the canonical pattern)
- **TCF intersect:** `Owner Inbox/2026-05-09_zara_tcf-substrate-plan-v0.md` — TCF outcome 4 (suitability) flips from gated to binding; TCF outcome 6 (post-sale barriers) intersects ORG-FAIS-RK-COMPLAINT-HANDLING

---

—Mira (Compliance / RegTech engineer)
