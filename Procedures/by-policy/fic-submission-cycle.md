# Procedure — FIC submission cycle

**Procedure ID:** PROC-FC-01
**Owner:** Zara (CCO governance line; named MLRO + FIC Compliance Officer at the bank-as-engineer-substrate, ahead of the human licence-day appointment) · Mira (compliance / RegTech engineering line under Zara) · Iris (Information Officer governance line; POPIA dimension of the triple-hat at licence-day)
**Triple-hatted compliance lead at licence-day:** one human seat = MLRO + FIC Compliance Officer + POPIA Information Officer. Until that seat is filled, Zara holds the governance accountability and Mira holds the engineering line. [citation: D-THIN-HUMAN-LAYER-MINIMUM, decision record 2026-05-08]
**Approval:** Board (via Audit Committee — interim Audit Forum chaired by Owen until a Board AC is constituted) [citation: `Owen Inbox/2026-05-06_governance-framework.md`]
**Cadence:** Continuous (event-triggered for STR / suspicious-activity; periodic for CTR aggregation, RMCP review, and FIC annual returns)
**Version:** v0.1 — 2026-05-09
**Status:** Draft (system capabilities `PLANNED`; binds at COMMENCEMENT-OF-TRADING per `project_rules_bind_at_commencement.md`)

## 1. Source policy

- `Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §2 — RMCP / FIC Act compliance policy (Zara, owner).
- `Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §3 — Sanctions and PEP screening policy.
- `Owner Inbox/2026-05-06_governance-framework.md` — three-lines-of-defence interlock; AC oversight of AML/CFT controls.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-11` (FIC Act s.43A — MLRO designation) [citation: `Regulations/_obligations-register.md`] | Designate an MLRO accountable for STR filings; CEO-MLRO merger structurally barred per FIC published RMCP guidance + supervisory precedent. |
| `ORG-FC-11` gloss — FIC Act s.43B (FIC Compliance Officer designation) [citation: `Regulations/_obligations-register.md`, gloss-hardening row owned by Mira] | Designate a Compliance Officer for FIC-Act compliance; commonly co-located with MLRO. |
| `ORG-FC-MLRO-ALTERNATE` (FIC published guidance on MLRO-alternate designation) [citation: TBC — Mira's parallel obligations-register update] | Recommended-practice expectation that an MLRO-alternate is designated; alternate must independently satisfy fit-and-proper. |
| `ORG-FC-*` (FIC Act ss.21–28A — CDD / EDD; ss.28–29 — CTR / STR; ss.42–42A — RMCP) [citation: `Regulations/_obligations-register.md`] | CTR thresholds, STR triggers, and the RMCP that frames both. |
| `ORG-FC-SANCTIONS-SCREENING` (FIC Public Compliance Communications on sanctions; UNSC sanctions regime) [citation: TBC — Mira's parallel obligations-register update, sanctions-screening row currently a gap] | Sanctions screening is operationalised by the accountable institution; named accountability is the FIC Compliance Officer. |
| `ORG-PR(IV)-13` (POPIA Reg. 4 — deputy-IO designation form) [citation: `Regulations/_obligations-register.md`, deputy-IO sub-gloss to harden] | Deputy-IO is a separate lodgment with the Information Regulator; carried by CoSec per the alternates split. |
| `ORG-CY-04` (Joint Standard 2 of 2024 — incident reporting timelines) [citation: `Regulations/_obligations-register.md`] | Cyber-incident reporting to PA / FSCA per stipulated timelines, where the incident has financial-crime indicators (overlap with STR pathway). |

## 3. Purpose

Operationalise the FIC Act submission obligations the bank carries as an accountable institution: ensure CTRs are filed for cash-threshold transactions, STRs are filed for suspicious or unusual transactions, the RMCP is current and applied, sanctions-screening hits are escalated and resolved, and the FIC's periodic compliance-return obligations are met. The procedure binds at commencement-of-trading; build-phase work is preparation of the substrate, not live filing.

## 4. Trigger

- **STR / suspicious-activity (event-triggered, continuous):** Mira's transaction-monitoring engine raises a typed event (`SuspiciousActivityFlagged`) on rule hit, model anomaly, sanctions-screening hit, or human escalation from front-line.
- **CTR (event-triggered, continuous):** Tomas's payments / settlement substrate emits a `CashThresholdTransaction` event when an in-scope cash transaction (or aggregated set) crosses the FIC threshold.
- **RMCP review (periodic):** annual or on material-change event (new product, new jurisdiction, regulatory amendment); next quarterly run by triple-hatted lead with Mira's substrate refresh.
- **FIC compliance return (periodic):** as published by the FIC; calendarised and emitted by the regulatory-calendar substrate.
- **Sanctions list update (event-triggered):** UNSC / OFAC / EU / domestic sanctions-list update event triggers re-screening of the customer / counterparty book.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Trigger fires (STR / CTR / sanctions hit / RMCP review / FIC return due) | `service` (Mira's substrate, Tomas's payments engine, regulatory-calendar) | `@domains/compliance/trigger-bus` (`PLANNED`) | Each trigger emits a typed event the procedure consumes. |
| 2 | Triage: triple-hatted lead reviews the trigger payload | `agent` (triple-hatted compliance lead) | `@domains/compliance/triage-queue` (`PLANNED`) | Default actor is the agent-spec for the compliance lead; human-in-the-loop only when judgement required (recorded under P2). |
| 3 | Investigation case opened; evidence preserved (event chain, customer record, transaction lineage) | `service` + `agent` | `@platform/case/financial-crime` (`PLANNED`) | Case ID linked to all downstream events; tipping-off rules applied (no disclosure to customer or front-line beyond MLRO investigation set). |
| 4 | Decision: file (STR / CTR), close (no further action), or refer (sanctions resolution; cross-border MLAT) | `agent` (triple-hatted lead); `human` (the appointed lead at licence-day) for STR-file and sanctions-resolve calls | `@domains/compliance/case-decision` (`PLANNED`) | Decision is a typed event with reasoning. CEO is *not* in the decision path for STR filing — the second-line independence from CEO is the structural reason for the CEO-MLRO bar (Q3, Mira-Zara confirmation paper). |
| 5 | If file: generate FIC submission (goAML / FIC portal payload) from event log | `service` | `@domains/compliance/fic-submission-generator` (`PLANNED`) | Payload is *generated* under Principle 6, not assembled. |
| 6 | Submit to FIC via goAML / portal | `agent` (triple-hatted lead's automated submitter); fallback `human` (lead) if portal API unavailable | `@domains/compliance/fic-portal-submission` (`PLANNED`) | Submission timestamp + FIC reference number recorded as event. |
| 7 | Sanctions hit resolution: escalate freezing / asset-immobilisation actions to Tomas's settlement substrate where mandated | `agent` (compliance lead) → `service` (Tomas) | `@domains/compliance/sanctions-action` (`PLANNED`) | Freezing action is a typed event with regulatory citation. |
| 8 | RMCP review run: ingest material-change events, refresh risk-rating thresholds, regenerate the RMCP document | `service` + `agent` review | `@domains/compliance/rmcp-generator` (`PLANNED`) | RMCP is generated from policy + register state; never hand-authored. |
| 9 | FIC compliance return: assemble periodic-return payload from event log; submit | `service` + `agent` | `@domains/compliance/fic-return-generator` (`PLANNED`) | Generated, signed by the named compliance lead, submitted. |
| 10 | Continuous monitoring: dashboard cell tracks open cases, ageing, submission SLAs, sanctions-hit MTTR | `service` | `@domains/compliance/case-dashboard` (`PLANNED`) | Vera consumes for continuous-controls assurance. |
| 11 | Quarterly AC pack: triple-hatted lead presents AML/CFT MI to AC; the AC's MLRO-alternate seat (AC-Chair NED) sees the case-volume + escalations directly | `agent` (compliance lead) → `human` (AC) | `@domains/compliance/ac-pack-generator` (`PLANNED`) | Generated pack; secretariat through Owen. |

## 6. Reconciliation

- **Events produced:**
  - `SuspiciousActivityFlagged`, `CashThresholdTransaction`, `SanctionsHitRaised`, `RmcpReviewDue`, `FicReturnDue`.
  - `CaseOpened { case_id, type, customer_id, trigger_event_id }`.
  - `CaseDecided { case_id, decision: file|close|refer, reasoning, decided_at, decided_by }`.
  - `FicSubmissionGenerated { case_id, payload_hash }`, `FicSubmissionSubmitted { case_id, fic_ref_no, submitted_at }`.
  - `SanctionsActionTaken { customer_id, action: freeze|release|investigate, citation }`.
  - `RmcpRegenerated { version, effective_at }`, `FicReturnSubmitted { period, ref_no }`.
- **Reconciliation checks (testable, bidirectional):**
  - Every `SuspiciousActivityFlagged` has a downstream `CaseDecided` within the FIC SLA; absent decisions are escalation-flagged.
  - Every `CaseDecided { decision: file }` has a matching `FicSubmissionSubmitted` within statutory timing.
  - Every `CashThresholdTransaction` has a matching `FicSubmissionSubmitted` (CTR) within statutory timing.
  - Every `SanctionsHitRaised` has either `SanctionsActionTaken` or a documented disposition within MTTR target.
  - The `RmcpRegenerated` event chain reconciles to the policy-register version in force at `effective_at`.
- **Failure mode:** FIC portal unavailable → fallback channel (registered submission, hand-delivery) tracked as exception under P3; Mira's substrate alerts the lead and the AC.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Case file (events + supporting documents) | Event log + case vault | Permanent (P1; FIC retention min 5 years; bank policy: permanent) | Critical (PII + tipping-off-restricted) |
| FIC submission payload + portal acknowledgement | Document store + event hash | Permanent | Critical |
| RMCP (current + historical versions) | Document store + event log | Permanent | High |
| FIC compliance return + acknowledgement | Document store + event log | Permanent | High |
| AC pack (quarterly AML/CFT MI) | Document store + event log | 10 years | High |
| Sanctions-list snapshots + screening run logs | Event log + screening engine vault | Permanent | High |

## 8. Manual steps

Per Principle 7 (autonomous-by-default), the default actor at every step is an agent. The following human-in-the-loop steps are registered exceptions with their P2 citation:

- **Step 4 (STR file decision)** — human triple-hatted lead at licence-day. Citation: FIC Act s.43A — MLRO is a named accountable human; STR filing is a statutory accountability that cannot be delegated to an unsupervised agent action [citation: `ORG-FC-11`].
- **Step 4 (sanctions-resolve call)** — human triple-hatted lead. Citation: FIC Public Compliance Communications on sanctions — escalation and resolution requires named human accountability [citation: `ORG-FC-SANCTIONS-SCREENING`, gap row owned by Mira].
- **Step 6 (fallback submission)** — human, only when portal API unavailable. Tracked exception under P3.
- **Step 11 (AC presentation)** — human, AC interaction. Citation: Companies Act s.94 (AC composition and oversight).

These are reviewed periodically for whether automation has caught up; agents that satisfy fit-and-proper-analogue under Sade's AgentOps may discharge sub-decisions within scoped authority once the runtime substrate lands.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation channel |
|---|---|---|
| STR SLA missed | Statutory deadline event timer | Triple-hatted lead → CEO (Marc); AC chair NED (MLRO-alternate) [citation: `ORG-FC-MLRO-ALTERNATE`] |
| MLRO unavailable / on leave / incapacitated | Roster check on trigger fire | MLRO-alternate = AC-Chair NED (NOT double-hatted CoSec) [citation: Mira-Zara confirmation paper §4.2; Joint Standard 2 of 2024 reading on second-line independence; Mira's gap-closure URN `ORG-FC-MLRO-ALTERNATE`]. The CoSec carries deputy-IO only, not MLRO-alternate, to avoid single-point-of-failure at the CoSec seat (a JS-2-of-2024-aware framing). |
| FIC portal extended outage | Portal-submission timeout event | Fallback channel + CEO notice + AC notice |
| Sanctions hit unresolved past MTTR | Case-ageing dashboard | Triple-hatted lead → CEO; potential FIC engagement |
| RMCP out of date past annual review | Calendar event | Triple-hatted lead → AC; Helena (CRO) interlock under JS-1-of-2024 read |
| Tipping-off concerns (overlap with POPIA breach) | Zara's case-routing | Tipping-off prevention applied; communications restricted to MLRO investigation set; coordination with Iris on POPIA s.22 if breach concurrent. |

## 10. Escalation channel to the CEO

Per Principle 7, every agent has a typed escalation channel to a named human overseer (today: Marc, via Scrooge). For this procedure:

- **Routine escalations** (MLRO judgement on STR-file vs no-file) stay within the triple-hatted lead's scoped authority — they do *not* escalate to CEO. The structural reason: CEO-MLRO merger is barred per FIC published RMCP guidance + supervisory precedent [citation: `ORG-FC-11`, gloss-hardening row owned by Mira].
- **Operational escalations** (portal outage, MLRO unavailable, sanctions list ambiguity, RMCP material-change requiring policy revision) → Marc as CEO via Scrooge, with the AC-Chair NED copied as MLRO-alternate.
- **Policy / regulator escalations** (FIC engagement, RMCP re-approval, regulator direction) → Marc as CEO, then to the Board (via interim Audit Forum, Owen chair).

## 11. Cross-references

- **Mira's parallel obligations-register update:** the URNs cited above (`ORG-FC-11` gloss, `ORG-FC-MLRO-ALTERNATE`, `ORG-FC-SANCTIONS-SCREENING`, `ORG-PR(IV)-13` deputy-IO gloss) are gap-closure rows Mira is hardening in parallel under the D-THIN-HUMAN-LAYER-MINIMUM follow-on. This procedure cites them by URN; row content lives in `Regulations/_obligations-register.md` and is canonical there [citation: `feedback_canonical_source_registry.md`].
- **Owen's governance framework update:** the AC-Chair NED's MLRO-alternate role and the CoSec's deputy-IO-only role are reflected in Owen's parallel governance-framework revision under the same decision.
- **Imani's legal-as-code reading:** the alternates split (deputy-IO=CoSec; MLRO-alternate=AC-Chair NED) becomes operative legal-as-code; cross-reference to Imani's parallel update.
- **Saskia's FAIS-KI handover note:** the FAIS-KI seat is *separate* from this procedure but feeds the same compliance posture; cross-reference to Saskia's parallel update on FAIS KI succession from Marc-interim to Saskia-steady-state.
- **Related procedures:**
  - `Procedures/by-policy/sanctions-screening.md` — operational sanctions-screening run (Mira's substrate).
  - `Procedures/by-policy/kyc-onboarding.md` — CDD / EDD at onboarding.
  - `Procedures/by-policy/popia-breach-notification.md` — overlap when financial-crime concurrent with POPIA breach.
  - `Procedures/by-policy/fais-advice-record-capture.md` — FAIS dimension; intersects at customer-interaction record-keeping.

## 12. Substrate gaps

Per Principle 7's "steady-state vs current substrate" discipline:

- **Substrate gap S-1:** transaction-monitoring engine (Mira) — currently `PLANNED`. STR triggers are spec-only.
- **Substrate gap S-2:** FIC portal integration / goAML payload generator — currently `PLANNED`.
- **Substrate gap S-3:** triple-hatted lead's agent-spec — depends on Sade's AgentOps fit-and-proper-analogue substrate landing; the human seat at licence-day is the legal-substrate fallback.
- **Substrate gap S-4:** sanctions-screening run-engine — currently `PLANNED`; row `ORG-FC-SANCTIONS-SCREENING` itself a register gap (Mira closing).
- **Substrate gap S-5:** RMCP generator (policy-state → RMCP document) — currently `PLANNED`.

These gaps are roadmap items, not hidden. Vera tests this discipline as part of continuous-controls assurance; orphaned capabilities and orphaned procedures are reportable findings.

## 13. Audit / assurance

- Vera reviews STR / CTR submission timeliness for procedural compliance; deviation reported to AC quarterly.
- Annual rehearsal of the STR pathway end-to-end (table-top exercise); rehearsal events captured.
- Continuous-controls projection: open-case ageing, STR / CTR submission SLAs, sanctions-hit MTTR reported to BRC quarterly and to AC quarterly.
- The CAE (Thandiwe, governance line) reviews the procedure annually; functional line into the interim Audit Forum (Owen chair) preserves third-line independence per `CLAUDE.md` top-of-house structure.

## 14. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Zara (with Mira on engineering-line) | Initial draft post D-THIN-HUMAN-LAYER-MINIMUM. Names triple-hatted compliance lead (MLRO + FIC CO + IO) as procedure owner. Codifies MLRO-alternate = AC-Chair NED (NOT double-hatted CoSec) per Joint Standard 2 of 2024 reading and Mira's gap-closure URN `ORG-FC-MLRO-ALTERNATE`. Cross-references to Mira's parallel obligations-register update and Owen's parallel governance-framework update. |
