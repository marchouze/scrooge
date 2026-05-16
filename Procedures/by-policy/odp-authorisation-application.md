---
procedureId: PROC-MK-ODP-01
title: ODP authorisation application (FSCA, Index 1 banks-track)
author: Kai (Trading systems engineer, engineering) · Imani (Legal-as-code engineer, engineering)
date: 2026-05-16
owner: Owen (Company Secretary, governance) · Camille (Chief Financial Officer, governance) · Imani (Legal-as-code engineer, engineering) · Saskia (Head of Global Markets, governance)
status: POPULATED
policy-cited: Policies/odp-authorisation-policy-v1.md
system-capability: prototype/platform/regulatory/odp-application-tracker (PLANNED)
---

# Procedure — ODP Authorisation Application (FSCA, Index 1 banks-track)

**Procedure ID:** PROC-MK-ODP-01
**Owner:** Owen (Company Secretary, governance) · Camille (Chief Financial Officer, governance) · Imani (Legal-as-code engineer, engineering) · Saskia (Head of Global Markets, governance)
**Approval:** Board (or Interim Audit Forum until Board sits) — application is a Board-reserved matter under the Governance Framework
**Cadence:** One-shot (lodged at licence-day); packet pre-assembled during build-phase
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

---

## 1. Source policy

- `Policies/odp-authorisation-policy-v1.md` — ODP Authorisation Policy (PLANNED, markets bundle)

The obligation chain is:

```
Regulation (Financial Markets Act s.6A + CS 1/2018)
  → ODP Authorisation Policy
    → PROC-MK-ODP-01 (this procedure)
      → @platform/regulatory/odp-application-tracker (PLANNED)
```

The ODP Authorisation Policy defines the bank's obligation to obtain FSCA authorisation as an Over-the-Counter Derivatives Provider before conducting any live OTC derivative business. The policy designates Saskia (Head of Global Markets, governance) as the named Key Individual (KI) for the ODP authorisation. Owen (Company Secretary, governance) is the authorised signatory for lodgment. External legal counsel (S5 firm) provides pre-lodgment review and soft-franchise boundary advice.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FMA-001` (Financial Markets Act s.6A) | A person must not conduct ODP business unless authorised by the FSCA as an ODP. Authorisation is in addition to the SARB banking licence. |
| `ORG-CS1-001` (CS 1/2018 §3) | Application must demonstrate operational capital meeting the prescribed minimum for the applicable ODP category. |
| `ORG-CS1-002` (CS 1/2018 §4) | Fit-and-proper requirements for each named Key Individual and all members of the controlling body; historical compliance track-record and financial soundness. |
| `ORG-CS1-003` (CS 1/2018 §5) | Documented risk-management framework covering counterparty credit risk, market risk, operational risk, liquidity risk, and legal risk. |
| `ORG-CS1-004` (CS 1/2018 §6) | IT and operational capacity: systems for trade capture, reporting, margin management, and record-keeping; disaster-recovery procedures; business-continuity plan. |
| `ORG-FMA-002` (Financial Markets Act s.8) | Board-approved conditions applicable to the ODP licence; FSCA may impose additional conditions at grant. |

---

## 3. Purpose

The purpose of this procedure is to:

1. Pre-assemble a complete FSCA Application Index 1 (banks-track) packet during the build-phase so that it can be lodged without delay on the day SARB grants the banking licence.
2. Ensure all mandatory FM-form data (Form FM6 B + C), KI fit-and-proper declarations, capital-adequacy evidence, risk-management framework references, and IT-capacity documentation are assembled and Board-approved before lodgment.
3. Engage external counsel (S5 firm) at least 6–9 months before lodgment to review the packet and confirm the bank's intended OTC IRD franchise scope is within the authorisation category sought.
4. Track FSCA correspondence post-lodgment and co-ordinate responses to Requests for Information (RFIs) within FSCA's prescribed timeframes.
5. Enable live OTC IRD business for Saskia's franchise only after the FSCA authorisation letter is received and the pre-licence go-live readiness gate is green.

---

## 4. Trigger

**Build-phase assembly trigger:**
- Standing task during build-phase: Owen (Company Secretary, governance) maintains the ODP packet as a living document, updating it as the bank's capital, risk framework, and IT substrate evolve.
- `SARBLicenceApplicationFiled` event (PLANNED) — signals the final pre-lodgment assembly sprint begins. External counsel review and Board approval must complete within 60 days of this event.

**Lodgment trigger:**
- `SARBLicenceGranted` event (PLANNED) — the banking licence is the pre-condition for ODP lodgment. On receipt of this event, the pre-assembled packet is finalised and lodged with the FSCA within 5 business days.

**Post-lodgment triggers:**
- `FSCARFIReceived { rfId, deadline }` — an FSCA request for further information; the response procedure is triggered immediately.
- `FSCAAuthorisationGranted` — enables live OTC IRD business; fires the go-live readiness gate.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Pre-assemble Form FM6 B (applicant entity details) and Form FM6 C (KI declarations); populate all mandatory fields; maintain as a living document throughout build-phase | `agent` (Owen) | `@platform/regulatory/odp-application-tracker` (PLANNED) | Fields: legal-entity name, registration number, registered address, SARB reference, ODP category sought (Index 1 — IRDs). |
| 2 | Compile KI fit-and-proper pack for each named KI: Saskia (Head of Global Markets) as primary KI; include qualifications, regulatory history, criminal record declaration, directorships, and financial soundness declaration | `agent` (Owen) + `human` (Saskia) | `@platform/regulatory/odp-application-tracker` (PLANNED) | CS 1/2018 §4 specifies each KI must have relevant experience, no disqualifying event, and financial soundness. Saskia's declaration requires personal sign-off. |
| 3 | Compile controlling-body (Board) fit-and-proper declarations for each director | `agent` (Owen) + `human` (each director) | `@platform/regulatory/odp-application-tracker` (PLANNED) | Board declarations require personal sign-off by each director. Interim Audit Forum members act as controlling-body members until full Board is constituted. |
| 4 | Prepare capital-adequacy evidence: ICAAP summary, CET1 ratio, minimum operational capital per CS 1/2018 §3; reference the Prudential Authority banking-licence capital conditions | `agent` (Camille) | `@platform/projections/capital-ratio-monitoring` | Capital evidence cross-references the bank's existing PA capital return (BA 100) once that filing has commenced. |
| 5 | Prepare Risk Management Framework reference pack: extract relevant sections of the bank's RMF covering counterparty credit risk (CCR), market risk, operational risk, liquidity risk, and legal risk; include references to PROC-MK-ODP-03 (VM), PROC-MK-ODP-04 (IM), and PROC-MK-ODP-05 (portfolio recon) | `agent` (Owen) + `agent` (Imani) | `@platform/document-store` | CS 1/2018 §5 — the RMF must be Board-approved before lodgment. |
| 6 | Prepare IT and operational capacity evidence: system architecture overview, trade-capture capability, Strate TR reporting pipeline (PROC-MK-ODP-02), margin management (PROC-MK-ODP-03/04), disaster-recovery plan, business-continuity plan | `agent` (Imani) + `agent` (Kai) | `@platform/document-store` | CS 1/2018 §6. Reference the agent-runtime-deploy procedure for DR/BCP evidence. |
| 7 | Engage external counsel (S5 firm) for pre-lodgment review; confirm OTC IRD franchise scope is within Index 1 category; check any additional FSCA conditions likely to be imposed | `human` (Owen) + `human` (Imani) | — | External counsel engagement is a deferred decision per build-phase posture; planned 6–9 months before lodgment. Counsel's written opinion is captured in the document store. |
| 8 | Present completed application packet to Board (or Interim Audit Forum) for approval; record `BoardApprovedODPApplication { packetHash, date, signatories }` event | `human` (Owen) | `@platform/event-store` | Board approval is a mandatory pre-condition for lodgment. `packetHash` is the BLAKE3 hash of the complete packet. |
| 9 | On `SARBLicenceGranted` event: finalise the application packet (update any time-sensitive fields), print two hard copies, write to two memory sticks, prepare application-fee bank transfer | `agent` (Owen) | `@platform/regulatory/odp-application-tracker` (PLANNED) | FSCA requires hard copies + electronic media; application fee per FSCA tariff list. |
| 10 | Lodge with FSCA Financial Services Providers Registry within 5 business days of `SARBLicenceGranted`; obtain FSCA receipt reference | `human` (Owen) + `human` (Imani) | — | Lodgment in person at FSCA Pretoria office or via FSCA's authorised electronic lodgment channel (if available). |
| 11 | Emit `ODPApplicationLodged { fspcRef, lodgedAt, packetHash }` event | `system` | `@platform/event-store` | Canonical proof of lodgment. |
| 12 | Track FSCA correspondence; acknowledge each piece within 5 business days; respond to each RFI before the FSCA deadline; escalate delays to Owen + Imani | `agent` (Owen) | `@platform/regulatory/odp-application-tracker` (PLANNED) | Industry-typical timeline: 12–24 months from lodgment to authorisation grant. |
| 13 | On `FSCAAuthorisationGranted` event: emit `ODPAuthorisationReceived { authorisationRef, grantedAt, conditions }` event; flip the OTC IRD go-live readiness gate; notify Saskia to commence live business | `system` | `@platform/event-store` + `@platform/regulatory/go-live-gate` (PLANNED) | Conditions imposed by FSCA (if any) are recorded and tracked as compliance obligations. |

---

## 6. Reconciliation

### Events produced

| Event | Trigger | Key fields |
|---|---|---|
| `BoardApprovedODPApplication` | Step 8 — Board approval | `packetHash` (BLAKE3), `date`, `signatories` |
| `ODPApplicationLodged` | Step 11 — lodgment with FSCA | `fspcRef`, `lodgedAt`, `packetHash` |
| `FSCARFIReceived` | External — FSCA raises an RFI | `rfId`, `deadline`, `subject` |
| `FSCARFIResponded` | Step 12 — response submitted | `rfId`, `respondedAt`, `responseHash` |
| `ODPAuthorisationReceived` | Step 13 — FSCA authorisation granted | `authorisationRef`, `grantedAt`, `conditions[]` |

### Reconciliation checks

- Vera daily: if `ODPApplicationLodged` exists and `ODPAuthorisationReceived` does not, the application is pending — Vera reports status in the regulatory-pipeline register.
- Vera: for each `FSCARFIReceived`, assert a corresponding `FSCARFIResponded` exists before the FSCA deadline.
- Vera: `ODPAuthorisationReceived` is a pre-condition for any `OtcTradeExecuted` event; if `OtcTradeExecuted` exists without a prior `ODPAuthorisationReceived`, this is a P1 finding.

### Failure mode

If the FSCA rejects the application, Owen and Imani convene within 2 business days to assess grounds for appeal under Financial Markets Act s.10. The event `ODPApplicationRejected { reason, appealDeadline }` is emitted. External counsel is engaged for the appeal. No OTC IRD business may commence until authorisation is obtained.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| FSCA Application Index 1 packet (FM6 B + C, all annexures) | Document store (BLAKE3-addressed) | Indefinite (regulatory licence basis) | Confidential |
| KI fit-and-proper declarations (Saskia + other KIs) | Document store | Indefinite | Confidential |
| Controlling-body declarations (each director) | Document store | Indefinite | Confidential |
| External counsel opinion letter | Document store | Indefinite | Confidential |
| `BoardApprovedODPApplication` event | Event log | Indefinite | Restricted |
| `ODPApplicationLodged` event + FSCA receipt | Event log + document store | Indefinite | Restricted |
| FSCA RFI correspondence and responses | Document store | Indefinite | Restricted |
| `ODPAuthorisationReceived` event + FSCA authorisation letter | Event log + document store | Indefinite | Restricted |

---

## 8. Manual steps

The following steps require human action and cannot be fully automated in the current substrate:

1. **KI and director declarations (Steps 2–3):** Personal declarations of fit-and-proper status, financial soundness, and absence of disqualifying events must be signed by each individual. Saskia's KI declaration is a personal statutory document; it cannot be delegated or auto-generated.
2. **External counsel engagement (Step 7):** Instructing S5 firm, reviewing their opinion, and incorporating advice requires human professional judgement. The decision to accept or contest counsel's advice rests with Owen (Company Secretary, governance) and Imani (Legal-as-code engineer, engineering).
3. **Board approval (Step 8):** Board resolution approving the application is a human-governance act. The Interim Audit Forum chair (Owen) must convene the meeting and record the resolution.
4. **Physical lodgment (Steps 9–10):** Hard copies, memory sticks, and application-fee payment require physical action. Until FSCA implements a fully electronic lodgment channel, this step cannot be automated.
5. **RFI substantive responses (Step 12):** Responses to FSCA Requests for Information often require legal and professional judgement beyond what the tracker can auto-draft. Owen and Imani review every draft response before submission.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Application packet incomplete at `SARBLicenceGranted` | `@platform/regulatory/odp-application-tracker` gap-check | Owen + Imani + Saskia immediately; lodgment delayed; Board notified |
| FSCA rejects the application | `ODPApplicationRejected` event | Owen + Imani + Saskia + CEO within 2 BD; external counsel appeal assessment |
| FSCA RFI response deadline missed | Tracker deadline monitor | Owen + Imani escalate to CEO; FSCA contacted to request extension |
| KI fit-and-proper finding (disqualifying event disclosed) | Declaration review | Owen + Board notified; alternative KI assessed; application paused |
| Authorisation granted with onerous conditions | `ODPAuthorisationReceived.conditions` non-empty | Imani + Saskia + Helena (Chief Risk Officer, governance) assess conditions; board briefed; go-live gate opened only when conditions are met |
| SARBLicenceGranted occurs without completed packet | Build-phase gap tracker | Immediate escalation to CEO; lodgment timeline extended; Board apprised |

---

## 10. Related procedures

- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) — ODP authorisation is a pre-condition for live counterparty onboarding; onboarding gates must check `ODPAuthorisationReceived`.
- [`trade-reporting-strate.md`](trade-reporting-strate.md) — PROC-MK-ODP-02; IT capacity for Strate TR reporting is part of the ODP application evidence pack (Step 6).
- [`margin-vm.md`](margin-vm.md) — PROC-MK-ODP-03; margin management capability is part of the RMF evidence pack (Step 5).
- [`margin-im.md`](margin-im.md) — PROC-MK-ODP-04; IM methodology is part of the RMF evidence pack (Step 5).
- [`portfolio-reconciliation.md`](portfolio-reconciliation.md) — PROC-MK-ODP-05; portfolio reconciliation capability is part of the RMF and IT-capacity evidence packs.
- [`fais-ki-fit-and-proper.md`](fais-ki-fit-and-proper.md) — KI fit-and-proper requirements under FAIS apply alongside the ODP-specific CS 1/2018 requirements; declarations are co-ordinated.
- [`ceo-decision-review.md`](ceo-decision-review.md) — Board approval of the ODP application is a Board-reserved decision tracked through this procedure.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Owen (Company Secretary, governance) | Initial STUB — 7-section skeleton; steps and build-phase posture documented. |
| v0.2 | 2026-05-16 | Kai (Trading systems engineer, engineering) · Imani (Legal-as-code engineer, engineering) | STUB → POPULATED: full 12-section structure; YAML frontmatter added; steps expanded to 13 rows; events, evidence table, manual steps, failure modes, and audit sections added. |

---

## 12. Audit / assurance

- **Vera daily:** assert `OtcTradeExecuted` events cannot precede `ODPAuthorisationReceived`; any violation is a P1 finding escalated immediately to Owen + Zara (Chief Compliance Officer, governance) + CEO.
- **Vera ongoing (post-lodgment):** monitor FSCA correspondence tracker; flag any `FSCARFIReceived` without a corresponding `FSCARFIResponded` within 10 business days; escalate to Owen.
- **Vera annual (build-phase):** check that the ODP application packet (BLAKE3 hash on record) matches the current version of the document store; flag drift as a finding.
- **Thandiwe (Chief Audit Executive, governance) annual audit:** review the adequacy of the build-phase packet pre-assembly process; confirm Board approval is recorded via a valid `BoardApprovedODPApplication` event; confirm all KI and director declarations are current and in the document store.
- **FSCA supervisory examination:** the FSCA may inspect the bank's ODP authorisation packet and all supporting records at any time post-authorisation. The document store and event log support full point-in-time reconstruction.
