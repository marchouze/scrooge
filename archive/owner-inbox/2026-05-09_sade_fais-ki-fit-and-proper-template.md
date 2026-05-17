---
title: FAIS-KI fit-and-proper file template (PROC-FAIS-KI-FAP-01) — STUB scaffold
author: Sade (AgentOps engineer — engineering-substrate seat)
date: 2026-05-09
summary: Procedure scaffolded under D-FSP-LICENCE-NECESSITY (confirm-A-no-research) to make Gate (b) of the Saskia-as-FAIS-KI handover operationally executable. Five-dimension Determination 2017 framework with six typed-event substrate gaps named for Atlas; FSCA section refs [citation: TBC] routed to Imani + counsel.
decision-required: false
---

# FAIS-KI fit-and-proper file template — STUB scaffold

**Author:** Sade (AgentOps engineer — engineering-substrate seat)
**Date:** 2026-05-09
**Procedure ID:** PROC-FAIS-KI-FAP-01
**Procedure file:** [`Procedures/by-policy/fais-ki-fit-and-proper.md`](../Procedures/by-policy/fais-ki-fit-and-proper.md)
**Reporting line:** Sade → Devon (Chief Operating Officer, governance) on the engineering line; co-curated with Zara (Chief Compliance Officer, governance) on the FAIS conduct line.
**Decision triggering this work:** D-FSP-LICENCE-NECESSITY resolved `confirm-A-no-research` (PR #62) — `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md`.
**Procedure-pair partner:** `Owner Inbox/2026-05-09_saskia_fais-ki-handover-note.md` (PR #45) — Saskia (Head of Global Markets, governance) authoring the candidate-side handover in parallel; cross-link occurs at PR-merge time.
**Conduct-side reading:** `Owner Inbox/2026-05-09_mira-zara_concentration-risk-conduct-confirmation.md` (Q4) — Zara + Mira (Compliance / RegTech engineer) ratify the conduct-side framing.

## What landed

**One procedure file, one index update.** The procedure is a STUB scaffold — the file is authored end-to-end with the five-dimension framework, citations, reconciliation, evidence schema, failure modes, and substrate-gap inventory. Live execution requires the typed-event substrate (queued behind Atlas) and the FSCA Determination section-ref ratification (queued behind Imani + counsel).

The procedure is **load-bearing for the Saskia transition** under D-FSP-LICENCE-NECESSITY. Gate (a) (counsel confirmation that the FAIS-KI seat is necessary) closed by the decision; Gate (b) (Saskia's fit-and-proper file completion under FSCA Determination of Fit and Proper Requirements 2017) is now operationally executable as a procedure.

## The five-dimension framework

Per the FSCA Determination of Fit and Proper Requirements 2017, every named officer file is assembled across five dimensions, each producing a typed evidence event that composes into a single approval event:

| Dimension | Evidence focus | Typed event |
|---|---|---|
| 1 — Honesty + integrity | Criminal record, civil judgments, regulator-prior-action, bankruptcy / insolvency | `BackgroundCheckCompleted` |
| 2 — Competence | Qualifications, experience, FAIS RE5 / RE1, CPD log | `CompetenceAttestationFiled` |
| 3 — Operational ability | Seat-specific responsibility map, capacity / time-allocation, operational independence | `OperationalAbilityAssessed` |
| 4 — Financial soundness | Personal solvency, no insolvency in past 10 years, no court-ordered debt arrangement | `FinancialSoundnessAttested` |
| 5 — Oversight | Reporting line, conflict-of-interest disclosure, ongoing-monitoring covenant | `OversightStructureRecorded` |
| **Composite** | All five dimensions present and not retracted | `FaisKiFitAndProperFileApproved` |

The five-dimension framework is **re-usable across every officer seat** (CEO, CRO, CFO, COO, Treasurer, Head of Markets, CCO, CISO, CAE, GC, CHRO, CoSec, IO). FAIS-KI is the first instance the bank exercises against; the broader six-human composition at licence-day re-uses the same substrate.

Per CLAUDE.md operating-model, Sade is reshaped to **AgentOps** during the build phase; the human-HR slice activates at licence-day. This procedure sits at the seam — substrate built now, live execution at FSP-licence-application (Saskia-as-KI) and licence-day (broader composition).

## Substrate gaps named (not built in this PR)

Per Principle 7 substrate-gap-naming discipline:

1. **Six typed events** need adding to `prototype/platform/event-store/event-types.ts` — `BackgroundCheckCompleted`, `CompetenceAttestationFiled`, `OperationalAbilityAssessed`, `FinancialSoundnessAttested`, `OversightStructureRecorded`, `FaisKiFitAndProperFileApproved`. **Owner: Atlas (Core banking platform architect)** — v1 substrate follow-on.
2. **Substrate-side TypeScript module** at `prototype/platform/officers/fais-ki-fit-and-proper.ts` — five-dimension orchestrator that subscribes to input feeds, emits dimension events, computes composite-approval reconciliation. **Owner: Atlas + Sade joint follow-on.**
3. **Vera Wave-4 finding-pipeline for fit-and-proper drift** — recon-harness for orphaned proposals, re-opened dimensions without re-approval, renewal-interval lapses. **Owner: Vera (Internal-audit / continuous-assurance engineer).**
4. **Input-event taxonomy for ongoing-monitoring** (court judgment, regulatory action, NCR debt arrangement, CPD-points feed, qualification-revocation) — spec'd as part of the agent-runtime trigger bus. **Owner: Atlas + Sade.**
5. **FSCA Determination of Fit and Proper Requirements 2017 section refs** — every `[citation: TBC]` in the procedure (per-dimension section anchors, covenant-disclosure interval, renewal interval). **Owner: Imani (Legal-as-code engineer) + external counsel** at licence-application gate.

## What I did not do

- **Did not touch `Owner Inbox/2026-05-09_saskia_fais-ki-handover-note.md`** — Saskia (Head of Global Markets, governance) is updating it in a parallel branch (`claude/saskia-fsp-confirm-a-pax-withdraw`). Cross-link occurs naturally at PR-merge time.
- **Did not author the typed events** — those are Atlas v1 substrate.
- **Did not invent FSCA Determination section numbers** — every section ref is `[citation: TBC]`, routed to Imani + counsel per Principle 2.
- **Did not author the broader Fit-and-Proper Policy** — that lives under the planned `fit-and-proper-attestation.md` row in `Procedures/_index.md`; FAIS-KI is the first instance, the broader policy is queued.

## Files changed

- `Procedures/by-policy/fais-ki-fit-and-proper.md` (new)
- `Procedures/_index.md` (one row added under People & HR)
- `Owner Inbox/2026-05-09_sade_fais-ki-fit-and-proper-template.md` (this file)

## Cross-references

- Decision record: `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md` (PR #62)
- Procedure-pair partner: `Owner Inbox/2026-05-09_saskia_fais-ki-handover-note.md` (PR #45)
- Conduct-side reading: `Owner Inbox/2026-05-09_mira-zara_concentration-risk-conduct-confirmation.md` (Q4)
- Obligations register IDs cited: `ORG-CD-03`, `ORG-GV-11`, `ORG-HR-11`, `ORG-CS1-002`
