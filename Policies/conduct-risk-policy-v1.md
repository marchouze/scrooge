---
policy-id: conduct-risk-policy
title: Conduct Risk Policy v1
version: "1"
status: IN FORCE
owner: Helena (Chief Risk Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - FAIS Act 37 of 2002 (fair treatment of clients; FSP obligations)
  - FSCA Conduct Standard for banks (2020 and subsequent amendments)
  - Banks Act 94 of 1990
  - PA/FSCA Joint Standard 2 of 2024 (cybersecurity and conduct overlay)
  - FIC Act 38 of 2001 s.22 (recordkeeping of transactions and communications)
  - Exchange Control Regulations (Excon — conduct in cross-border transactions)
  - JSE Rules (market conduct for JSE member firms)
author: Helena (Chief Risk Officer, governance) + Zara (Chief Compliance Officer, governance) + Saskia (Head of Global Markets, governance)
date: 2026-05-22
summary: Conduct Risk Policy covering conduct risk taxonomy (manipulation, front-running, mis-selling, information barriers, conflicts), communication recording, surveillance alert governance, pre-trade conduct gate, PA dealing pre-clearance, Chinese Wall policy, escalation path, conduct risk appetite metrics, and training cadence. COMMENCEMENT-BIND. Closes obligation ORG-MK-03 (voice and electronic communications recording for trading personnel).
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-CR
  - RT-COND
---

# Conduct Risk Policy v1

> **Authors.** Helena (Chief Risk Officer, governance) — lead; Zara (Chief Compliance Officer, governance) — co-author; Saskia (Head of Global Markets, governance) — co-author.
> **Status.** COMMENCEMENT-BIND. Conduct obligations under FAIS and the FSCA Conduct Standard for banks apply from the date of FSP registration and banking licence grant. The communication recording requirement under FIC Act s.22 applies from the first client interaction.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. Conduct Risk Policy — Overarching

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual policy review; triggered on material regulatory change or conduct incident · **Citation:** FAIS Act 37 of 2002 + FSCA Conduct Standard for banks + Banks Act 94 of 1990 + PA/FSCA Joint Standard 2 of 2024

### Purpose

This policy governs how Hoz Bank Limited identifies, manages, and monitors conduct risk across its trading and client-facing activities. Conduct risk is the risk of financial or reputational harm arising from the Bank's behaviour towards its clients, counterparties, and the market — including market manipulation, front-running, mis-selling, and inadequate management of information barriers and conflicts of interest.

The policy ensures that: (i) the Bank's trading activities comply with JSE Rules and FAIS Act fair treatment obligations; (ii) all voice and electronic communications relating to client transactions and market activities are recorded per FIC Act s.22 and retained; (iii) a surveillance system monitors for conduct breaches and anomalous trading patterns; (iv) pre-trade conduct gates prevent prohibited conduct before execution; (v) information barriers between the advisory function and the trading desk prevent information leakage; and (vi) conduct breaches are escalated from the trading desk to Zara (Chief Compliance Officer, governance) and, where material, to the CEO.

This policy is co-owned by Helena (Chief Risk Officer, governance) and Zara (Chief Compliance Officer, governance) and is operationally embedded in Saskia's trading mandate. The three co-authors are jointly responsible for the policy's effectiveness.

### Principles

- **First-line ownership; second and third-line oversight.** The trading desks under Saskia own day-to-day conduct risk management as the first line of defence. Helena owns the conduct risk framework and limits as the second line. Vera (internal audit engineer — reports to Thandiwe (Chief Audit Executive, governance)) provides third-line assurance.
- **Zero tolerance for market manipulation and front-running.** Market manipulation (per the Financial Markets Act 19 of 2012 and JSE Rules) and front-running (trading ahead of known client orders) are absolute prohibitions. No business justification excuses either behaviour. A confirmed incident triggers immediate CEO notification, regulatory notification (FSCA, JSE), and internal investigation.
- **Communication recording is non-negotiable.** All communications related to trade origination, client instructions, market-making activities, and order management must be recorded. Gaps in recording are not a minor operational issue; they are regulatory breaches under FIC Act s.22 and create material conduct risk by removing the audit trail.
- **Information barriers are structural, not procedural.** The Chinese Wall between any advisory function and the trading desk must be implemented as a structural access control (system-level and physical), not relying solely on individual compliance with a verbal policy. Zara manages the information barrier registry.
- **Conduct risk appetite drives the surveillance framework.** Conduct risk appetite is expressed as a set of metrics (§7) calibrated to the Bank's institutional trading mandate. The surveillance system (§4) monitors against those metrics; threshold breaches generate alerts that are triaged by Zara's compliance team.

### Roles

Helena (Chief Risk Officer, governance) is the policy owner for the risk framework layer; she sets the conduct risk appetite, owns the escalation path above Zara for material incidents, and presents the conduct risk report to the Board. Zara (Chief Compliance Officer, governance) is the policy owner for the compliance layer; she manages surveillance alert triage, PA dealing pre-clearances, FSCA and JSE notifications, and training. Saskia (Head of Global Markets, governance) is the co-owner for the markets operational layer; she owns the first-line pre-trade conduct gate and is responsible for the trading desks' conduct culture. Senna (Security engineer, engineering) implements the communication recording infrastructure and the information barrier access controls. Vera audits the conduct risk framework annually.

---

## 2. Conduct Risk Taxonomy

**Owner:** Helena (Chief Risk Officer, governance) · **Cadence:** Taxonomy reviewed annually; enriched on any new regulatory guidance · **Citation:** FAIS Act 37 of 2002; FSCA Conduct Standard; Financial Markets Act 19 of 2012 (market abuse provisions)

### 2.1 Market Manipulation

Market manipulation is conduct that creates a false or misleading impression of market supply, demand, or price of a financial instrument, or that secures an artificial price. Prohibited forms include: wash trading, spoofing, layering, painting the tape, and ramping. The Bank monitors for manipulation patterns via the surveillance system (§4). Any confirmed manipulation is reported to the FSCA and JSE within 24 hours.

### 2.2 Front-Running

Front-running is trading on information about a pending client order ahead of executing the client's order, to benefit from the price impact of the client trade. Front-running is explicitly prohibited by FAIS Act and the FSCA Conduct Standard for banks. The pre-trade conduct gate (§5) includes an order-sequencing check to detect front-running risk.

### 2.3 Mis-Selling

Mis-selling is the provision of inappropriate financial advice or the execution of trades that do not match the client's risk profile, investment objectives, or sophistication level. Given the Bank's institutional-only client mandate (`Policies/trading-mandate-v1.md`), all counterparties are sophisticated professional investors. However, the duty to present accurate product information and not misrepresent material terms remains, even in institutional contexts.

### 2.4 Information Barriers (Chinese Walls)

Information barriers prevent material non-public information (MNPI) obtained in one capacity (e.g., through a debt origination or advisory mandate) from flowing to the trading desk. Breaching an information barrier and trading on MNPI constitutes insider trading under the Financial Markets Act.

### 2.5 Conflicts of Interest

Conflicts of interest arise when the Bank's interests, or those of an individual trader, conflict with a client's interests. The Bank manages conflicts through: (i) upfront disclosure to clients of potential conflicts; (ii) the information barrier structure; and (iii) PA dealing pre-clearance (§6). The `Policies/conflicts-of-interest-policy-v1.md` is the primary conflicts governance document; this policy governs the conduct dimension specifically.

---

## 3. Communication Recording

**Owner:** Zara (Chief Compliance Officer, governance) + Senna (Security engineer, engineering) · **Approval:** Board (CEO interim) approves recording infrastructure investment · **Cadence:** Continuous; quarterly coverage audit · **Citation:** FIC Act 38 of 2001 s.22 (recordkeeping); FSCA Conduct Standard for banks (communication recording); FAIS Act 37 of 2002 (transaction records)

### Scope of Recording

All of the following communications must be recorded and retained for at least 5 years (per FIC Act s.22 and FAIS recordkeeping requirements):
- Voice calls on the trading floor (all fixed-line and recorded mobile lines used for client or counterparty communication).
- Bloomberg IB messages and similar electronic communication platforms used for client orders and market-making.
- Email communications where trade instructions, price quotations, or client suitability assessments are communicated.
- Instant messaging platforms approved for business use by Senna.

### Recording Infrastructure

Senna implements and maintains the communication recording infrastructure. The recording system must be: (i) tamper-evident; (ii) time-stamped; (iii) accessible for Zara's compliance review within 24 hours of a recording request; and (iv) backed up with records stored separately from the primary recording system. A `CommunicationRecordingSystemAuditPassed { date, coverageRate, findings[] }` event is the canonical record of each quarterly coverage audit.

### Gaps in Recording

Any gap in communication recording (technical failure, unapproved communication channel use) is reported by Senna to Zara within 1 business day of discovery. If the gap coincides with a suspicious transaction or market event, Zara escalates to Helena and the CEO within 4 hours. Persistent recording gaps are a regulatory notification risk under the FSCA Conduct Standard.

---

## 4. Surveillance Alert Governance

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Helena approves alert thresholds; Zara manages triage · **Cadence:** Alerts generated continuously; triage by Zara within 1 business day; weekly surveillance report to Helena · **Citation:** FSCA Conduct Standard; JSE Rules; `Procedures/by-policy/surveillance-alert-triage.md`

The Bank's surveillance system monitors trading activity, order flow, and communication patterns for the following alert categories:

| Alert category | Description | Primary conduct risk |
|---|---|---|
| Large order relative to market (OWR) | Order size > X% of average daily volume | Market manipulation / ramping |
| Order-before-news | Order placed within 30 minutes of material news | Insider trading / information barrier breach |
| Cancellation / modification ratio | High order cancellation rate relative to fills | Spoofing / layering |
| Round-trip | Buy and sell of the same instrument within a short window | Wash trading |
| PA dealing timing | Personal account dealing within proximity of client order | Front-running / PA dealing violation |
| Cross-desk information flow | System access by a trader to information from a separated desk | Information barrier breach |
| Order-ahead-of-client | Bank proprietary order placed before client order execution | Front-running |

Alert thresholds are maintained in `Procedures/by-policy/surveillance-alert-triage.md`. Alerts are triaged by Zara's compliance team: (i) green — false positive (closed with rationale); (ii) amber — potential concern (Zara reviews, requests desk explanation within 2 business days); (iii) red — potential breach (Helena and CEO notified within 4 hours; investigation initiated).

A `SurveillanceAlertTriaged { alertId, alertCategory, outcome, triage Date }` event is the canonical record of each alert disposition. Red-zone alerts that result in a confirmed conduct breach trigger the escalation path in §8.

---

## 5. Pre-Trade Conduct Gate

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Zara approves gate criteria; Saskia implements gate in the order management system · **Cadence:** Per-trade check; gate criteria reviewed quarterly · **Citation:** FSCA Conduct Standard; FAIS Act 37 of 2002; `Procedures/markets/pre-trade-conduct-gate.md`

The pre-trade conduct gate is an automated check embedded in the order management system. It runs before every order is submitted to the market. Gate checks include:

1. **Client suitability check:** Is the product appropriate for the client's stated risk profile and investment mandate? (Relevant only to brokered or facilitated transactions on behalf of institutional clients.)
2. **Conflict of interest check:** Is there an undisclosed conflict between the Bank's proprietary position and the client's order?
3. **Order-sequencing check:** Is there any in-flight client order in the same instrument that would create a front-running risk if the Bank's proprietary order is executed first?
4. **Information barrier check:** Does the executing trader have access to any MNPI regarding the instrument from a separated desk?
5. **Large exposure pre-check:** Does the order, if executed, create a position that exceeds the CCR limit or large exposure limit for the counterparty?

A gate failure on any check produces a `PreTradeConductGateFailed { orderId, checkType, reason }` event and blocks the order pending Zara's review. Zara reviews blocked orders within 2 business hours.

---

## 6. PA Dealing Pre-Clearance

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Zara approves or rejects PA dealing requests · **Cadence:** Per PA dealing request; annual training · **Citation:** FAIS Act 37 of 2002 (representative conduct obligations); `Policies/insider-trading-pa-dealing-policy-v1.md`; Financial Markets Act 19 of 2012

All staff with access to MNPI (all trading floor staff, all relationship managers, all governance seat holders) must obtain Zara's pre-clearance before conducting any personal account (PA) dealing in instruments that are also traded by the Bank or in respect of which the Bank may hold MNPI. The PA dealing pre-clearance process is governed by `Policies/insider-trading-pa-dealing-policy-v1.md`; this section records the conduct risk dimension:
- A PA dealing request without pre-clearance is an immediate conduct red alert; the trader is suspended from PA dealing pending investigation.
- PA deals that occur within the blackout periods defined in `Policies/insider-trading-pa-dealing-policy-v1.md` are automatic conduct red alerts, regardless of whether pre-clearance was sought.
- All PA dealing activity is monitored by the surveillance system (§4) and cross-checked against the PA dealing pre-clearance register maintained by Zara.

---

## 7. Conduct Risk Appetite Metrics

**Owner:** Helena (Chief Risk Officer, governance) · **Approval:** Board (CEO interim) approves conduct risk appetite · **Cadence:** Monthly monitoring; annual appetite recalibration · **Citation:** Helena's Risk Appetite Statement (RAS) conduct risk lines

| Conduct risk metric | Target | Hard limit |
|---|---|---|
| Surveillance amber alerts triaged within SLA (2 business days) | 100% | N/A |
| Confirmed conduct breaches per year | 0 | 0 (zero tolerance for confirmed manipulation/front-running) |
| PA dealing pre-clearance compliance rate | 100% | 100% |
| Communication recording coverage rate | 100% | ≥ 98% (2% tolerance for technical gaps) |
| Information barrier access violations | 0 | 0 |
| Conduct training completion rate | 100% by commencement of trading | 100% |

Breaches of any hard limit are reported to the CEO and FSCA immediately. Conduct risk appetite metrics are reported to ALCO monthly and to the Board quarterly.

---

## 8. Escalation Path

**Owner:** Zara (Chief Compliance Officer, governance) · **Approval:** Helena for escalation above Zara; CEO for regulatory notification · **Cadence:** Incident-triggered; no standing cadence

Escalation tiers for confirmed conduct breaches:

1. **Desk level (Tier 1 — minor):** Surveillance amber alert; desk head self-corrects; Zara notified; documented in conduct log. No regulatory notification required.
2. **Compliance level (Tier 2 — material):** Surveillance red alert; confirmed conduct concern; Zara initiates investigation; Helena and CEO notified within 4 hours; desk head suspended from the relevant activity pending investigation; Zara determines regulatory notification obligation within 5 business days.
3. **Regulatory notification (Tier 3 — serious):** Confirmed market manipulation, front-running, insider trading, or information barrier breach; Zara and Helena co-present to CEO; FSCA notification within 24 hours; JSE notification (if JSE-listed instrument involved) within 24 hours; independent investigation initiated.

A `ConductBreachEscalated { incidentId, tier, description, escalationPath, regulatoryNotificationRequired }` event is the canonical record of each escalation.

---

## 9. Conduct Risk Training

**Owner:** Zara (Chief Compliance Officer, governance) · **Cadence:** Initial training before commencement of trading; annual refresher · **Citation:** FAIS Act 37 of 2002 (competency requirements); FSCA Conduct Standard (training obligations)

All trading floor staff and governance seat holders must complete conduct risk training covering: (i) conduct risk taxonomy (§2); (ii) communication recording obligations; (iii) information barrier policy; (iv) PA dealing pre-clearance; (v) surveillance system and alert process; (vi) FSCA and JSE conduct obligations; and (vii) whistleblowing channel. Training completion is recorded as `ConductTrainingCompleted { staffId, moduleId, completionDate, assessmentScore }` events. Non-completion by commencement of trading is a hard stop on trading floor access.

---

## 10. Substrate Dependencies and Gaps

- **Surveillance system (Senna + Rohan).** Automated surveillance alert generation and triage workflow. Currently in build phase; required before the first client trade.
- **Pre-trade conduct gate (Ravi + Saskia team).** OMS-integrated automated gate checks. Currently in build phase; required before the first client trade.
- **Communication recording infrastructure (Senna).** Voice and electronic recording capture and retention system. Currently in build phase; required before any client communication.

---

## 11. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Helena (Chief Risk Officer, governance) + Zara (Chief Compliance Officer, governance) + Saskia (Head of Global Markets, governance) | Initial policy authored. Nine sections: (1) Overarching — first/second/third line, zero tolerance manipulation/front-running, recording non-negotiable, structural information barriers, conduct risk appetite; (2) Conduct Risk Taxonomy — manipulation, front-running, mis-selling, information barriers, conflicts; (3) Communication Recording — scope (voice, IB, email, IM), recording infrastructure, gap escalation; (4) Surveillance Alert Governance — seven alert categories, green/amber/red triage, SLA; (5) Pre-Trade Conduct Gate — five gate checks, blocked order process; (6) PA Dealing Pre-Clearance — pre-clearance requirement, blackout periods, surveillance cross-check; (7) Conduct Risk Appetite Metrics — six KPIs with targets and hard limits; (8) Escalation Path — three tiers with regulatory notification triggers; (9) Conduct Risk Training — pre-commencement training requirement, annual refresher. COMMENCEMENT-BIND. |
