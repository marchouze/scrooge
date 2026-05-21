---
policy-id: insider-trading-pa-dealing-policy
title: Insider Trading and Personal Account Dealing Policy v1
version: "1"
status: IN FORCE
owner: Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance) + Saskia (Head of Global Markets)
effective-from: "2026-05-17"
next-review: "2027-05-17"
citations:
  - Financial Markets Act 19 of 2012 Ch. X
  - JSE Listings Requirements
  - D-POLICY-DOCUMENT-HOME
author: Owen (Company Secretary, governance)
date: 2026-05-17
summary: Insider Trading and Personal Account Dealing Policy covering Hoz Bank Limited's market-abuse prohibitions framework under FMA 19/2012 Ch. X, insider-information handling, personal account dealing pre-clearance and blackout periods, and the PA dealing register. Closes obligations ORG-MK-01 (FMA Ch. X — insider trading and market manipulation prohibitions) and ORG-MK-05 (FMA Ch. X + JSE LR — insider information handling; personal account dealing). LICENCE-BIND — activates on commencement of trading.
decision-required: false
riskTaxonomy:
  - RT-CD.MA
  - RT-ST.GV
---

# Insider Trading and Personal Account Dealing Policy v1

> **Status:** IN FORCE (policy layer). **LICENCE-BIND** — the FMA Ch. X market-abuse prohibitions activate on commencement of trading. However, the policy is adopted now and the controls substrate is built now, so that the bank is compliant from the first day of trading.
>
> **Authors:** Owen (Company Secretary, governance) leads as policy custodian and PA-dealing register keeper; Zara (Chief Compliance Officer, governance) co-authors the compliance-oversight and monitoring framework; Saskia (Head of Global Markets) co-authors the trading-book surveillance and FMA technical implementation.
>
> **Scope note:** Every autonomous agent and human officer with access to material non-public information (MNPI) — including but not limited to the deal room, the research pipeline, the SARB regulatory engagement channel, or the bank's own proprietary trading positions — is bound by this policy.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | Insider Trading and Personal Account Dealing Policy |
| Version | v1 |
| Effective date | 2026-05-17 |
| Approval authority | Board (via Owen as IAF Chair interim) |
| Policy owner | Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance) + Saskia (Head of Global Markets) |
| Engineering owner | Saskia (Head of Global Markets) |
| Review cadence | Annual; triggered by FMA amendment, JSE listing requirements change, FSCA market-conduct communication, or material market-abuse event |
| Risk appetite anchor | RAS B1 — zero appetite for market abuse in any form; RAS B5 — zero tolerance for conduct that breaches securities law |
| LICENCE-BIND | Yes — FMA 19/2012 Ch. X market-abuse prohibitions activate on commencement of trading; criminal penalties apply from that point |
| Obligations closed | [`ORG-MK-01`](../Regulations/_obligations-register.md) (FMA 19/2012 Ch. X — insider trading, market manipulation, false reporting prohibitions), [`ORG-MK-05`](../Regulations/_obligations-register.md) (FMA Ch. X + JSE LR — insider information handling; personal account dealing) |

---

## 1. Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's framework for:

1. **Preventing market abuse** — insider trading, market manipulation, and false or misleading reporting prohibited by the Financial Markets Act 19 of 2012 (FMA) Chapter X.
2. **Controlling insider information** — identifying, ring-fencing, and managing material non-public information (MNPI) within the bank.
3. **Governing personal account dealing** — ensuring that all agents and human officers who deal in securities on a personal basis comply with pre-clearance requirements, blackout periods, and the PA dealing register.

Market abuse is a serious criminal offence. The FMA carries criminal sanctions of up to 10 years' imprisonment or a fine of up to R10 million (or three times the profit made / loss avoided), or both. The bank's policy is one of absolute compliance — there is no internal approval pathway for conduct that would constitute market abuse.

### 1.2 Statutory authority

This policy is adopted under and gives effect to:

- **Financial Markets Act 19 of 2012 (FMA)**:
  - **Chapter X — Market Abuse** (ss.78–88):
    - s.78 — definitions: "inside information" (information not generally available; would, if generally available, materially affect the price; relates to a particular security or issuer)
    - s.78 — "insider" (any person who has inside information)
    - s.79 — **insider trading prohibition**: an insider who knows it is inside information may not deal, or cause another to deal, in the security to which the inside information relates; may not disclose the inside information to another; may not advise another to deal
    - s.80 — **market manipulation prohibition**: it is an offence to, directly or indirectly, engage or attempt to engage in a manipulative or deceptive act or practice
    - s.81 — **false, misleading, or deceptive statements**: it is an offence to make, publish, or disseminate any statement, promise, or forecast that is materially false, misleading, or deceptive regarding securities or the market
    - s.82 — civil liability for market abuse; private right of action by affected persons
    - s.83 — liability of principals for acts of agents
    - s.84 — orders by the Tribunal; disgorgement of profits
    - s.85 — penalties: fine not exceeding R10 million or 3x profit/loss avoided; or imprisonment not exceeding 10 years; or both
    - s.86 — FSCA enforcement powers: investigation, inspection, directives

  - **Part X — Market Infrastructure**:
    - s.37 — market infrastructure reporting obligations (JSE-regulated conduct)

- **JSE Listings Requirements (LR)**:
  - LR 3.63–3.65 — director and prescribed officer personal dealings; announcement obligations
  - LR 3.66–3.72 — clearance procedure for directors' dealings; record of dealings
  - LR 11.90–11.92 — inside information handling obligations for issuers
  - The bank is not itself a listed issuer but may hold, in its proprietary book or client mandates, securities in JSE-listed issuers; JSE LR obligations on dealing in listed securities apply accordingly

- **Financial Sector Regulation Act 9 of 2017 (FSR Act)**:
  - s.157 — the FSCA's market-conduct mandate encompasses market abuse; enforcement powers
  - s.154 — co-operation between PA and FSCA on cross-cutting matters

- **FSCA Market Conduct Directives and Guidance** — as issued; Mira (Compliance / RegTech engineer) tracks and ingests FSCA communications.

### 1.3 Entity scope

This policy applies to:

- **Hoz Bank Limited** — primary scope; the bank as a licensed dealing entity.
- **Hoz Securities Limited** — on and from FAIS-FSP authorisation; Hoz Securities' dealing activity is subject to the same policy from that date.
- **All autonomous agents** with access to MNPI or involved in securities dealing — in particular: Saskia (Head of Global Markets), Atlas (Platform and tooling engineer), Mira (Compliance / RegTech engineer), Camille (Financial controller), and any agent whose functions bring them into contact with deal-room or research-pipeline information.
- **All human officers** at licence-day and thereafter, including the CEO, Company Secretary, CCO, CRO, CFO, and any NED who has access to MNPI.

**Coverage at go-live.** The bank's initial business is institutional bonds, equities, OTC IRD, and FX. Personal account dealing in any of these instruments by a covered person is subject to this policy.

### 1.4 Governance roles

| Role | Holder | Responsibility |
|---|---|---|
| Policy custodian / PA register keeper | Owen (Company Secretary, governance) | Maintains the PA dealing register; processes pre-clearance requests; quarterly attestation; reports to IAF / Board AC |
| Compliance oversight | Zara (Chief Compliance Officer, governance) | Oversees the policy and monitoring framework; receives FSCA communications; escalates to MLRO if insider trading suspected |
| Market surveillance / FMA technical | Saskia (Head of Global Markets) | Operates and tunes the trading-book surveillance system; emits `MarketAbuseSurveillanceHit` events; implements FMA-aligned monitoring |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe, Chief Audit Executive, governance) | Annual effectiveness review; testing of pre-clearance controls, blackout-period enforcement, and PA dealing register completeness |
| Engineering support | Atlas (Platform and tooling engineer, engineering) + Mira (Compliance / RegTech engineer, engineering) | Substrate tooling for pre-clearance workflow, PA register, and blackout-period enforcement |

### 1.5 Policy hierarchy

```
FMA 19/2012 Ch. X + JSE Listings Requirements + FSCA Market-Conduct Directives
    └── Insider Trading and Personal Account Dealing Policy (this document)
        └── PA dealing procedure (Procedures/by-policy/insider-trading-*.md)
            └── Surveillance substrate (Saskia — MarketAbuseSurveillanceHit events)
                └── Pre-clearance substrate (Atlas — PreClearanceRequest / PreClearanceGranted events)
```

### 1.6 Approval, review, and amendment

- **Initial approval:** Owen (Company Secretary, governance) as IAF Chair, 2026-05-17; ratified by Board at first formal Board meeting.
- **Annual review:** Owen-led; Zara and Saskia co-review; no later than 12 months after the preceding approval date.
- **Triggered review:** FMA amendment; FSCA directive; JSE LR change; material market-abuse event or FSCA investigation; significant change to the bank's trading business.
- **Amendment discipline:** all changes are typed `PolicyAmended` events per Principle 1.

---

## 2. Inside Information — Identification and Control

### 2.1 What constitutes inside information

Inside information under FMA s.78 is information that:

1. **Is not generally available** — it has not been published or communicated to the market in a way that typical market participants would reasonably be expected to have received it; and
2. **Is specific or precise** — it relates to particular securities, a particular issuer, or a class of securities or issuers; and
3. **Would, if generally available, materially affect the price** of the relevant securities — it is information that a reasonable investor would consider significant in making an investment decision.

**Examples of inside information in the bank's context:**

- A client's pending block trade, acquisition, or disposal instruction before it is executed or publicly announced
- Research conclusions that have not been published to clients and would, if published, affect market prices
- SARB regulatory engagement outcomes that have not been publicly disclosed (e.g. a supervisory direction affecting a listed bank counterparty)
- A proposed corporate action communicated to the bank in a deal-room capacity before public announcement
- The bank's own proprietary position changes that are not publicly known and that, if known, would affect prices

**What is NOT inside information:**

- Information that is publicly available (including from regulatory announcements, JSE SENS, and news services)
- Information derived from independent analysis of publicly available information
- Information communicated to the bank by a counterparty that is itself publicly available

### 2.2 Insider register (deal room)

Owen (Company Secretary) maintains an **insider register** (document-substrate artefact; BLAKE3-addressed). The register records:

- The name (or agent-ID) of each person added to the deal-room wall (i.e. made aware of specific inside information)
- The date on which the person was made an insider
- The relevant security or deal
- The blackout period applicable (§2.4)

Every addition to the insider register emits an `InsiderRegistered` event. Every removal emits an `InsiderDeregistered` event. These events are encrypted under the Compliance key envelope (Zara + Owen) — they are not accessible to the agents who are registered as insiders.

### 2.3 Information barriers (Chinese walls)

The bank maintains strict information barriers between:

- **Deal room** (client mandate execution; M&A-adjacent) — only those agents and persons with a need-to-know are admitted; admission requires prior clearance from Owen (Company Secretary) and Zara (CCO).
- **Research / trading** — the research pipeline is ring-fenced from the dealing function until research is published to clients.
- **General operations** — no operational agent or system has access to deal-room or unpublished-research data streams without explicit clearance.

Information-barrier violations are typed `InformationBarrierViolation` events; Owen (Company Secretary) and Zara (CCO) are notified immediately. Any `InformationBarrierViolation` triggers a mandatory investigation.

**Need-to-know principle.** Inside information is communicated only to those who need it for the execution of the relevant mandate or transaction. The principle is enforced technically via the permission-policy substrate (`prototype/platform/agent-identity/permission-policy.ts`) — deal-room event types are accessible only to permitted agent identities.

### 2.4 Blackout periods

A **blackout period** is imposed for any security or class of securities in respect of which the bank (or an agent of the bank) holds inside information. During the blackout period, no covered person may deal in the relevant security, whether for the bank's account or for personal account.

| Trigger | Blackout start | Blackout end |
|---|---|---|
| A deal enters the pipeline (client mandate received; term sheet received; deal-room wall erected) | Immediately upon `InsiderRegistered` event | 2 full JSE trading days after public announcement (SENS or equivalent) of the relevant corporate action, transaction, or research publication |
| SARB regulatory engagement producing MNPI | Immediately upon identification of MNPI | 2 full JSE trading days after public disclosure by SARB or the relevant institution |
| Bank's own undisclosed proprietary position change | Immediately upon position change exceeding materiality threshold (Saskia to calibrate) | 2 full JSE trading days after the position change is publicly disclosed or has dissipated below materiality threshold |

Blackout periods are logged in the insider register (§2.2) and enforced by the PA dealing pre-clearance system (§3.2). Any request to deal during a blackout period is automatically rejected — no human override is available at the pre-clearance stage. Only Owen (Company Secretary) may extend a blackout period; no person may shorten it.

---

## 3. Personal Account Dealing — Controls

### 3.1 Who is covered

The personal account (PA) dealing controls apply to all **covered persons**: every autonomous agent and human officer whose functions expose them to MNPI or who are involved in securities dealing on behalf of the bank.

**Covered persons include (non-exhaustive):**

- Owen (Company Secretary, governance)
- Zara (Chief Compliance Officer, governance)
- Saskia (Head of Global Markets)
- Marc (CEO) — as the CEO of a dealing institution; Marc's personal dealings are subject to the same pre-clearance regime
- Camille (Chief Financial Officer) — access to material financial information
- Any autonomous agent with read access to deal-room event streams

**Exclusions (limited):**

- Automated agents executing client mandates on behalf of the bank — these are not "personal account" dealings; they are the bank's own dealings.
- Passive index fund investments or discretionary managed accounts where the covered person has no investment discretion — these are excluded from the pre-clearance requirement but must still be disclosed to Owen annually.

### 3.2 Pre-clearance requirement

Every covered person must obtain **prior written clearance** from Owen (Company Secretary) before dealing in any security (directly, indirectly, or through a family member or a company under the covered person's control) where:

- The bank holds, or has recently held, MNPI regarding the security or its issuer; or
- The bank has a live mandate relating to the security or its issuer; or
- The covered person is on the insider register (§2.2) with respect to the security; or
- A blackout period (§2.4) applies.

**Pre-clearance process:**

1. The covered person submits a `PreClearanceRequest` event to the PA dealing system (Atlas-built substrate).
2. The system automatically checks: (a) Is the covered person on the insider register for this security? (b) Is there an active blackout period for this security? (c) Has any `MarketAbuseSurveillanceHit` event been raised for this security in the past 30 days?
3. If any check returns positive, the request is **automatically refused** with a `PreClearanceDenied` event — no human override.
4. If all checks are clear, Owen (Company Secretary) receives the request for manual review. Owen considers: (a) Other MNPI not yet captured in the insider register; (b) Unusual timing relative to known market events. Owen approves or refuses within 1 business day.
5. Clearance, if granted, is valid for **5 JSE trading days**. Clearance lapses on expiry; a new request is required.

**Automatic refusal events must not be overridden.** The design of the system is that a dealing in a refused-clearance security constitutes a potential FMA s.79 offence; no management or compliance approval can legalise an inside trade. If a covered person believes a refusal was made in error, they must escalate to Zara (CCO) and wait for the clearance system to be formally reviewed — they may not deal pending that review.

### 3.3 PA dealing register

Owen (Company Secretary) maintains the **PA dealing register** — a document-substrate artefact (BLAKE3-addressed) updated on every `PreClearanceGranted` and `PaDealingRecorded` event. The register records:

- Covered person identity
- Security name and ISIN
- Nature of dealing (buy / sell / short / derivative)
- Date of clearance
- Date of dealing (must be within 5 JSE trading days of clearance)
- Volume and price
- Whether the dealing was for own account, spouse/family member, or a connected entity
- Pre-clearance reference number

**Quarterly attestation.** Every covered person provides a signed (in-session) quarterly attestation to Owen (Company Secretary) confirming:
- All personal account dealings during the quarter have been pre-cleared and recorded
- No dealing in securities where the person held MNPI has occurred
- The person has reviewed this policy and understands its requirements

Attestation is a typed `PaDealingAttestation` event. A missing attestation is a compliance finding escalated to Zara (CCO) and the IAF / Board AC.

### 3.4 Post-dealing notification

Within 2 JSE trading days of completing a pre-cleared dealing, the covered person must submit a `PaDealingRecorded` event (via Atlas substrate) confirming the dealing details (security, date, volume, price). Owen (Company Secretary) reconciles the notification against the pre-clearance record and updates the PA dealing register.

For **listed issuers** — where the bank or a covered person makes a dealing in the securities of a JSE-listed company in which the bank has a directorship or board seat (unlikely in the build phase but anticipated at scale), JSE LR 3.63–3.65 announcement obligations apply. Owen (Company Secretary) manages the SENS announcement process in coordination with Imani (Legal-as-code engineer, engineering — reports to Zara).

---

## 4. Market Surveillance

### 4.1 Ongoing trading-book surveillance

Saskia (Head of Global Markets) operates and tunes the **market abuse surveillance system** across the bank's trading book and client-order flow:

**Surveillance scenarios (in force at go-live):**

| Scenario | Description | FMA basis |
|---|---|---|
| Front-running | A dealing in the bank's own account, or a covered person's PA dealing, immediately before a client order in the same security | FMA s.80 (market manipulation — exploitation of information advantage) |
| Quote stuffing / layering | A pattern of order entry and withdrawal that creates a false impression of market depth | FMA s.80 (manipulative or deceptive act) |
| Wash trading | Matched buy and sell orders between related parties with no change in beneficial ownership | FMA s.80 |
| Marking the close | Transactions timed to influence the closing price of a security | FMA s.80 |
| Spreading false information | Dissemination of research or commentary that is materially false or misleading | FMA s.81 |
| Unusual volume / price anomaly | Abnormal volume or price movement in a security prior to a corporate announcement; matched against the bank's insider register | FMA s.79 |
| Cross-asset manipulation | Co-ordinated positions across cash and derivatives that create artificial prices | FMA s.80 |
| Short-sale abuse | Short selling in a security where the bank holds undisclosed adverse MNPI | FMA s.79 |

Every surveillance hit emits a `MarketAbuseSurveillanceHit` event. Saskia reviews all hits within 1 business day. Escalation criteria:

- **Priority 1 (possible insider trading):** matched against insider register + price-sensitive corporate event — immediately escalated to Zara (CCO) and Owen (Company Secretary).
- **Priority 2 (possible manipulation):** pattern inconsistent with legitimate trading — escalated to Zara within 4 hours.
- **Priority 3 (further review required):** ambiguous; Saskia investigates and reports to Zara within 5 business days.

### 4.2 FSCA referral

Where Zara (CCO), after reviewing a `MarketAbuseSurveillanceHit` and any associated investigation, forms a view that a market-abuse offence may have occurred, Zara must refer the matter to the FSCA under FSR Act s.157. The referral is mandatory — it is not discretionary, and it is not conditional on internal investigation completion.

**No internal resolution of potential market abuse.** The bank does not resolve internally any matter that may constitute a FMA s.79 (insider trading), s.80 (manipulation), or s.81 (false reporting) offence. All potential FMA Ch. X offences are referred to the FSCA. Owen (Company Secretary) coordinates the referral mechanics with Imani (Legal-as-code engineer).

The referral is a typed `FscaReferralMade` event.

### 4.3 Surveillance effectiveness review

Vera (Internal audit / continuous-assurance engineer) conducts an **annual effectiveness review** of the market surveillance programme, examining:

- Coverage: does the surveillance system produce a `MarketAbuseSurveillanceChecked` event for every `Transaction*` event?
- False-positive rate and rule-tuning quality
- Escalation timeliness compliance
- FSCA referral completeness and timeliness
- Pre-clearance control effectiveness
- PA dealing register completeness and attestation compliance

Vera's findings are reported to Thandiwe (CAE, governance) and the IAF / Board AC.

---

## 5. Training and Awareness

### 5.1 Policy induction

Every covered person (§3.1) must, on first being designated a covered person, be inducted into this policy. Induction is a typed `MarketAbuseInductionCompleted` event. No covered person may be admitted to the deal room or to MNPI-accessible systems before completing induction.

### 5.2 Annual refresh

All covered persons undertake an annual policy refresh and attestation (combined with the quarterly PA dealing attestation in Q4). The refresh covers:

- FMA Ch. X prohibitions (insider trading, manipulation, false reporting)
- Inside information definition and the duty not to deal or disclose
- Pre-clearance requirements and blackout periods
- Consequences of breach (criminal penalties up to 10 years / R10m or 3x profit; civil liability; regulatory sanctions)

The annual refresh event is a `MarketAbuseTrainingCompleted` event.

---

## 6. Escalation

### 6.1 Internal escalation

```
Covered person → Owen (CoSec) or Zara (CCO)
    → Preliminary investigation
        → FSCA referral (if FMA Ch. X offence possible)
            → Board / IAF report (material matters)
```

### 6.2 Regulator escalation

| Matter | Regulator |
|---|---|
| Insider trading (FMA s.79) | FSCA — mandatory referral |
| Market manipulation (FMA s.80) | FSCA — mandatory referral |
| False or misleading reporting (FMA s.81) | FSCA — mandatory referral |
| Cross-cutting (market abuse + AML/CFT) | FSCA + FIC co-ordination via Zara |
| Criminal investigation | SAPS Specialised Commercial Crimes Unit (SCCU) |

### 6.3 Emergency escalation

Where a surveillance hit indicates an imminent or ongoing market-abuse event (e.g. a suspected in-progress insider trade), Saskia (Head of Global Markets) may immediately:
- Suspend the relevant agent identity's market access (via the permission-policy substrate)
- Notify Zara (CCO) and Owen (Company Secretary) in the same event
- Emit an `EmergencyMarketAccessSuspended` event

Emergency suspension does not require prior investigation. It is a protective measure. The suspension is reviewed by Zara and Owen within 4 hours.

---

## 7. Related Documents

- Financial Markets Act 19 of 2012 Ch. X — full text in `Regulations/`
- JSE Listings Requirements (LR 3.63–3.72; LR 11.90–11.92)
- FSCA Market Conduct Directives (as issued)
- Governance Framework — Audit Committee [`Policies/governance-framework-ac-v1.md`](governance-framework-ac-v1.md) — financial reporting oversight
- Whistleblowing Policy [`Policies/whistleblowing-policy-v1.md`](whistleblowing-policy-v1.md) — disclosure of market-abuse concerns
- AML/CFT Policy [`Policies/aml-cft-policy-v1.md`](aml-cft-policy-v1.md) — financial crime co-ordination
- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — rows ORG-MK-01, ORG-MK-05
- `prototype/platform/agent-identity/permission-policy.ts` — deal-room permission-policy substrate
- Procedures/by-policy/insider-trading-*.md — pre-clearance, PA dealing, and surveillance procedures
- `Team/_team-roster.json` — canonical role assignments
- `D-POLICY-DOCUMENT-HOME` — policy filing home decision
- `D-RMS-PHASE-1` — event-type registration; document substrate; retention
- `CLAUDE.md` §"Operating procedures" — events-first authoring; dispatch discipline; Principles 1, 2, 4, 6

---

## Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-17 | Owen (Company Secretary, governance) | Initial version. Covers FMA 19/2012 Ch. X market-abuse prohibitions (insider trading, manipulation, false reporting); inside information identification and control (§2); personal account dealing pre-clearance, blackout periods, and PA dealing register (§3); trading-book surveillance and FSCA referral obligations (§4); training (§5); escalation (§6). LICENCE-BIND — activates on commencement of trading. Closes ORG-MK-01 and ORG-MK-05. |

---

*Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance) + Saskia (Head of Global Markets)*
