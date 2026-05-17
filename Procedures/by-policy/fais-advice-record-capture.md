---
status: POPULATED
---
# Procedure — FAIS advice record capture

**Procedure ID:** PROC-CRM-FA-01
**Owner:** Niko · Zara (FAIS conduct oversight) · Sade (FAIS rep-register, post-licence)
**Approval:** BRC (under FAIS Policy v0.1 — STUB, FSP-conditional)
**Cadence:** Per-interaction; runs whenever a regulated advice interaction occurs
**Version:** v0.1 — 2026-05-07
**Status:** **Build-phase: paused (FSP-conditional); substrate live; activates at licence-day** — runs as Scrooge-coordinated table-top exercises against the soft-franchise pipeline today; lights up live at licence-day with FSP authorisation

## 1. Source policy

- `Owner Inbox/2026-05-07_niko_conduct-policies-bundle-v0.md` § FAIS Policy v0.1 §3 (Advice-record discipline); §4 (Suitability discipline); §5 (Rep authorisation).
- `Owner Inbox/2026-05-07_niko_conduct-policies-bundle-v0.md` § Customer Treatment Policy (TCF) v0.1 §2 (Operationalisation — outcome 4 suitable advice).

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-CD-01` | TCF — six outcomes operationalised. | Procedure operationalises outcome 4 (suitable advice) end-to-end. |
| `ORG-CD-02` | FSP licence required for advice / intermediary services. | Procedure is FSP-conditional; cannot activate live without FSP licence. |
| `ORG-CD-03` | Designate Key Individuals and Representatives. | Step 2 (rep authorisation check) reads from FAIS rep-register. |
| `ORG-CD-04` | FAIS advice records demonstrating suitability. | Step 7 (archive `AdviceRecorded`) is the recording event. |
| `ORG-CD-06` | Fee disclosure to customers. | Step 5 (fee disclosure) is gated on disclosed-true. |
| `FAIS General Code §3, §7, §8` (FAIS direct ref) | Advice-records, fee disclosure, suitability. | Steps 3–7 collectively. |

## 3. Purpose

Capture the structured evidence FAIS / FSCA Conduct Standards require for every advice interaction with a regulated client. The procedure produces an immutable `AdviceRecorded` event keyed to a typed advice-record object, anchored to a pre-existing `SuitabilityCompleted`, given by a rep authorised for the product category at the moment of advice. The procedure is the keystone of Niko's substrate at licence-day.

In the build phase the procedure runs as **table-top exercises** against the soft-franchise pipeline (Saskia + Imani — counterparty awareness, MOU-led relationship-building). Table-top runs produce structured negotiations-in-principle artefacts but **do not** emit `AdviceRecorded` events — Niko's seat is paused; FAIS-regulated advice cannot be given without an FSP licence.

## 4. Trigger

- **Build phase (table-top only):** soft-franchise pipeline progresses to a stage where structured negotiations-in-principle would, at licence-day, be FAIS-regulated advice. Niko logs the interaction as a `SoftFranchiseStageRecorded` event (per Niko spec §9) and runs the procedure off-line for substrate validation.
- **Licence-day onwards:** `AdviceRecordRequested` event from FAIS-conduct workflow (per Niko spec §7), itself triggered by completion of `SuitabilityAssessmentRequired` → `SuitabilityCompleted`.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Resolve the suitability outcome. Require a `SuitabilityCompleted` event with `outcome: suitable` for this client + product class within the validity window. If `unsuitable` / `refer-*` / missing — refuse advice; surface `AgentEscalation` to Zara per Niko spec §10. | Niko | `@platform/sales/suitability-engine` (today: design only) | The suitability gate is non-bypassable. |
| 2 | Resolve the rep's authorisation. Require the rep to be `in-good-standing` in the FAIS rep-register and authorised for the `productCategory` at the `interactionAt` timestamp. If not — refuse advice; escalate to Zara + Sade. | Niko | `@platform/sales/fais-rep-register` (paused with Sade's HR slice; activates licence-day) | Rep-register is the canonical authorisation source. |
| 3 | Read needs analysis. Capture client objectives, risk tolerance, investment horizon, liquidity needs, constraints — populates `needsAnalysis` per the advice-record schema. | rep / Niko | `@platform/sales/advice-record` (today: design only; markdown skeleton) | Side-effect of the conversation — not a post-hoc form. |
| 4 | Frame the advice. Structured options + rationale + alternatives + warnings, populating `advice`, `rationale`, `alternatives`, `warnings`. | rep | `@platform/sales/advice-record` | Plain prose with structure tags; LLM-assisted drafting (post-licence) consumes the conversation transcript. |
| 5 | Disclose fees. Total-cost illustration where applicable; fee-disclosure reference (`disclosureRef`) populated. Disclosed-true is a gate — without it, archival fails. | rep | `@platform/sales/advice-record`; `@platform/sales/fee-disclosure` (PLANNED) | TCF outcome 3 + FAIS fee disclosure (`ORG-CD-06`). |
| 6 | Cite. Citations array must include at least one `regulation`, one `fais`, and one `policy` reference; citation-gate runs at archival. | system | `@platform/citation/gate.ts` | Plain prose un-cited references are rejected. |
| 7 | Archive. Emit `AdviceRecorded { adviceId, clientId, repId, productCategory, suitabilityRef, archivedAt, citationChain }` to the event store. The advice-record object becomes immutable. | system | `@platform/event-store` | Subsequent corrections are versioned amendments per the schema. |
| 8 | Audit hand-off. The `AdviceRecorded` event is consumed downstream by Vera (advice-record recon — Wave-4 candidate, gated on licence-day) and by Zara's monthly conduct-review pipeline (per Niko spec §6). | system | `@platform/event-store` (event subscription) | Not a step the rep takes; the subscription is structural. |

## 6. Reconciliation

- **Events produced:** `AdviceRecorded` (post-licence); `SoftFranchiseStageRecorded` (build-phase table-top, instead).
- **Reconciliation check:** every `AdviceRecorded` resolves to a typed advice-record object that validates against [`advice-record.schema.json`](../../prototype/platform/sales/advice-record.schema.json); the `repId` was authorised at `interactionAt`; the `suitabilityRef` resolves; citations resolve.
- **Cross-domain check:** every `OnboardingHandedOff` event has at least one `AdviceRecorded` in its lineage where the advice precipitated the onboarding (covered by Vera's planned recon).
- **Failure mode:** rejected at Step 1, 2, or 5 — no advice given; no `AdviceRecorded` event; the failure surfaces as `AgentEscalation`.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `AdviceRecorded` event | Event log | Indefinite (P1; FAIS retention min 5 years post-licence) | Client-confidential |
| Advice-record object | `@platform/sales/advice-record` (today: markdown skeleton; M2: typed store) | Indefinite | Client-confidential |
| Conversation transcript | Voice / video / chat capture (planned, with Saskia + Senna under Voice & Communications Recording Policy) | FMA / FAIS retention | Client-confidential + employee-confidential |
| Fee-disclosure artefact | `@platform/sales/fee-disclosure` (PLANNED) | Indefinite | Client-confidential |

## 8. Manual steps

- **Steps 1–8 collectively** run as table-top exercises today; the live event-emitting path activates at licence-day. This is a build-phase tracked exception under Principle 3, expiring at licence-day.
- **Conversation capture pipeline** is paused; transcripts during the soft-franchise pipeline are captured as Owner Inbox notes, not as voice / video records.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Rep not authorised | Step 2 gate | Zara + Sade — FAIS rep-register correction; advice not given |
| Suitability missing or unsuitable | Step 1 gate | Zara — suitability dispute; per Niko spec §10 |
| Fee not disclosed | Step 5 gate | Zara + Owen — TCF / FAIS conduct breach risk |
| Citation un-resolvable | Step 6 citation gate | Niko — confirm policy stub / regulation / FAIS reference exist |
| Customer complaint with regulator-notification implication | Post-archival monitoring | Zara + Owen — same business day per Niko spec §10 |

## 10. Related procedures

- `Procedures/by-policy/suitability-assessment.md` — **planned (Niko-owned)** — runs upstream and produces the `SuitabilityCompleted` event Step 1 reads.
- `Procedures/by-policy/lead-to-onboarding.md` — **planned (Niko-owned)** — orchestrates the full lifecycle into Mira's KYC hand-off.
- `Procedures/by-policy/marketing-consent.md` — **planned (Niko + Iris co-owned)** — POPIA Direct Marketing consent precedes lead capture.
- `Procedures/by-policy/kyc-onboarding.md` — **populated (Mira + Niko co-owned)** — Niko's hand-off side activates at licence-day.
- `Procedures/by-policy/client-categorisation.md` — **populated (Mira + Niko co-owned)** — institutional / qualified-investor categorisation precedes suitability.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Niko (via Scrooge) | Initial draft as keystone of Niko's first end-to-end Reg→Policy→Procedure→Capability chain demonstration. Operationally paused (FSP-conditional); activates at licence-day. |

## 12. Audit / assurance

Vera's planned advice-record recon (Wave-4 candidate, gated on licence-day) asserts: (a) every `AdviceRecorded` has a resolvable advice-record; (b) the rep was authorised at `interactionAt`; (c) the `suitabilityRef` resolves; (d) fee-disclosure was true; (e) citations resolve; (f) every `OnboardingHandedOff` has an `AdviceRecorded` in its lineage.
