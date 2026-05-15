---
title: "Asset and Liability Committee (ALCO) — Charter v1"
author: Eitan (Treasurer, engineering)
date: 2026-05-15
decision-required: false
tags: [alco, treasury, governance, charter, alm]
---

# Asset and Liability Committee (ALCO) — Charter v1

**Version:** 1.0  
**Author:** Eitan (Treasurer, engineering)  
**Date:** 2026-05-15  
**Status:** Draft — pending CEO ratification at first ALCO convening  
**Governing framework:** Banks Act 94 of 1990; Regulations Relating to Banks (Reg 38 — liquidity risk; Reg 39 — interest rate risk); SARB Guidance Note 4 of 2015 (IRRBB); Basel III Liquidity Standards as adopted by SARB

---

## 1. Purpose and Authority

The Asset and Liability Committee (ALCO) is the principal governance forum responsible for oversight of the bank's balance sheet structure, liquidity position, interest rate risk in the banking book (IRRBB), funding strategy, and funds transfer pricing (FTP) methodology.

ALCO's authority derives from a delegation of authority from the Board of Directors. During the build phase and at initial commencement-of-trading, authority is exercised by the CEO (Marc) acting in the interim Board chair capacity. ALCO does not hold credit-approval authority; that sits with the Credit Committee. ALCO operates within the risk appetite approved by the Board and articulated in the Risk Appetite Statement.

**This charter binds at commencement-of-trading.** ALCO is not convened during the build phase (no real balance sheet exists). The charter is the preparatory artefact; its terms take effect on the date the first ALCO session is formally convened.

### 1.1 Mandate — items within ALCO authority

- Liquidity buffer targets (LCR, NSFR thresholds above regulatory minimima)
- FTP curve methodology and curve publication cycle (Ravi (FTP & ALM Engineering, engineering) as curve architect; Eitan as approver)
- IRRBB limits (NII sensitivity, EVE sensitivity, repricing gap limits per maturity bucket)
- Funding concentration limits (counterparty, instrument, currency, tenor)
- Stress-test assumptions for liquidity and IRRBB scenarios
- Intraday liquidity management framework
- Collateral management policy for repo and securities financing
- Currency-specific liquidity management (multi-currency posture per Principle 5)

### 1.2 Items that escalate to Board

The following items exceed ALCO authority and require Board approval:

- Structural changes to the bank's overall funding strategy (e.g. shift from correspondent-only to direct market access)
- Capital allocation decisions that affect the capital adequacy framework
- Approval of new liquidity stress scenarios used for ICAAP/ILAAP submissions
- Changes to the bank's currency franchise or multi-currency balance sheet exposure above Board-set thresholds
- Any limit breach that cannot be resolved within one calendar month

---

## 2. Membership and Governance

### 2.1 Standing membership

| Role | Agent | Capacity |
|---|---|---|
| Chair | CEO (Marc) | Human — voting |
| Treasurer (architect) | Eitan (Treasurer, engineering) | Agent — voting; secretary-architect |
| Chief Risk Officer | Helena (Chief Risk Officer, governance) | Agent — voting; limit oversight |
| Financial Reporting | Camille (Financial Reporting, engineering) | Agent — non-voting secretary; minutes and record-keeping |
| CISO | Rashida (Chief Information Security Officer, governance) | Agent — observer; operational resilience lens |
| FTP & ALM Engineering | Ravi (FTP & ALM Engineering, engineering) | Agent — standing invitee; curve and attribution data |

All standing members except the CEO are autonomous agents operating under their respective agent specs in `/Team/`. Marc (CEO) is the sole human principal on the committee.

### 2.2 Quorum

A quorum for any ALCO session requires the CEO and Eitan at minimum. Decisions taken without quorum are void and must be ratified at the next quorate session.

### 2.3 Voting

Voting members are the Chair and Eitan. Helena holds a veto right on any decision that in her assessment would breach the Risk Appetite Statement or an IRRBB limit — exercise of the veto triggers automatic escalation to the Board. All vetoes are recorded as `AgentEscalation` events citing this charter as the authority source.

### 2.4 Secretariat

Camille (Financial Reporting, engineering) acts as ALCO secretary: records minutes, files decisions to `Owner Inbox/`, and emits `CeoDecision` events for any CEO-level limit approval arising from ALCO deliberation.

---

## 3. Mandate Scope

### 3.1 Liquidity risk

ALCO sets and monitors the bank's internal liquidity buffer targets. Regulatory minima (LCR ≥ 100%, NSFR ≥ 100%) are floors, not targets. ALCO approves internal buffers above these floors and the stress assumptions that underpin the bank's Internal Liquidity Adequacy Assessment Process (ILAAP).

### 3.2 Interest rate risk in the banking book (IRRBB)

ALCO owns the IRRBB framework: repricing gap limits by maturity bucket, NII sensitivity limits (parallel shock ±200 bp), and EVE sensitivity limits (per SARB Guidance Note 4 of 2015 / Basel IRRBB standards). Ravi's ALM engine produces the repricing schedule; Helena validates limit headroom. ALCO approves any limit reset.

### 3.3 Funds transfer pricing

ALCO approves the FTP curve methodology and the publication cadence. Ravi publishes `FtpCurvePublished` events; Eitan reviews and approves. Material changes to the curve (new tenors, currency additions, methodology revision) require ALCO sign-off before the next publication cycle.

### 3.4 Funding strategy

ALCO oversees the funding mix: instrument type, counterparty concentration, tenor ladder, and currency split. The bank's correspondent-bank-only payments posture (CEO-approved, memory item `project_payments_correspondent_model.md`) constrains the funding access model; ALCO manages concentration risk within that constraint.

### 3.5 Stress testing

ALCO approves the liquidity and IRRBB stress scenarios used in ICAAP/ILAAP submissions. Scenarios are proposed by Rohan (Risk Engineering, engineering) in coordination with Helena; ALCO ratifies.

---

## 4. Meeting Cadence and Triggers

### 4.1 Standard cadence

ALCO convenes monthly. The standard session agenda is:

1. Minutes of previous meeting (Camille)
2. Liquidity dashboard review (Eitan)
3. IRRBB repricing gap update (Ravi)
4. FTP curve status (Ravi)
5. Funding mix and concentration report (Eitan)
6. Limit headroom table (Helena)
7. Any escalation items
8. Actions and decisions

### 4.2 Ad-hoc triggers

An extraordinary ALCO session is convened within 48 agent-hours of any of the following:

- LCR falls below the amber threshold (ALCO-set, above regulatory 100% floor)
- IRRBB NII or EVE sensitivity approaches >80% of any approved limit
- Funding concentration in any single counterparty exceeds the concentration limit by >10%
- Material, unplanned change to the FTP curve driven by market dislocation
- Any operational event affecting the bank's access to its correspondent bank

### 4.3 Meeting outputs

Each ALCO session produces:

- **ALCO minutes** — filed to `Owner Inbox/` by Camille (secretary); filename format `YYYY-MM-DD_camille_alco-minutes-<session-number>.md`
- **Limit decisions** — emitted as `CeoDecision` events when CEO approval is required; recorded by Camille
- **Escalations** — emitted as `AgentEscalation` events when items exceed ALCO authority; routed to Board (interim: CEO in Board capacity)
- **FTP curve approvals** — Eitan's approval recorded alongside the `FtpCurvePublished` event chain

---

## 5. Information Pack

Eitan (as secretary-architect) is responsible for preparing and distributing the ALCO information pack no later than 24 agent-hours before each standard session. The pack comprises:

| Artefact | Producer | Source system |
|---|---|---|
| Liquidity dashboard | Eitan | `@platform/treasury` — liquidity snapshot handler |
| IRRBB repricing gap report | Ravi | ALM engine (planned: `@platform/icaap-ilaap-engine`) |
| FTP curve (current published) | Ravi | `FtpCurvePublished` event projection |
| FTP attribution summary | Ravi | `FtpAttributionRecorded` event projection |
| Funding mix report | Eitan | Balance sheet projection (correspondent-bank exposures) |
| Limit headroom table | Helena | Risk limits register |
| Stress scenario outcomes | Rohan (Risk Engineering, engineering) | Risk engine output |

All artefacts are structured outputs derived from the event store (Principle 1 — events are the only source of truth). No manual spreadsheets are admitted as primary ALCO evidence; spreadsheets may be attached as exhibits only, with the event-derived artefact as the authoritative figure.

---

## 6. Relationship to Substrate

### 6.1 Current ALM substrate (live as at 2026-05-15)

The following substrate components directly support ALCO's work:

- **Eitan's liquidity snapshot handler** (`@platform/treasury`) — produces the liquidity dashboard via `LiquiditySnapshotCaptured` events. Operational.
- **Ravi's FTP attribution engine** — emits `FtpCurvePublished` and `FtpAttributionRecorded` events; supports the FTP curve and portfolio projection deliverables. Operational as at PR #395.
- **Rohan's risk engine** — produces risk-run outputs including VaR, sensitivities, and limit consumption metrics. Operational.

### 6.2 Planned substrate (substrate gaps)

The following capabilities are required for full ALCO operational effectiveness and are recorded as roadmap items:

| Gap | Required for | Owner |
|---|---|---|
| `@platform/icaap-ilaap-engine` | Full IRRBB repricing gap and NII/EVE sensitivity engine | Ravi + Eitan |
| ALCO minutes auto-emission handler | Structured `AlcoMinutesRecorded` event type | Camille |
| Limit-headroom projection | Real-time limit consumption against IRRBB/liquidity limits | Ravi + Helena |
| Stress-test scenario runner | ILAAP stress scenario automation | Rohan |
| ALCO information-pack assembly pipeline | Automated pack generation pre-meeting | Eitan |

Until these gaps are closed, ALCO information pack components are assembled manually by the responsible agent at each session run, and the gap is surfaced in the session record.

### 6.3 Dependency on correspondent bank interface

Eitan's funding and liquidity reporting depends on the correspondent bank data interface (Tomas (Payments Engineering, engineering) scope). Until the correspondent bank interface is live, intraday liquidity figures are estimates. This dependency is flagged as a data-quality caveat on the liquidity dashboard.

---

## 7. Build-Phase Status

**ALCO is not yet convened.** As at 2026-05-15, the bank is in the build phase with no real balance sheet, no real capital, and no real customers. ALCO has no operational function until at least one of the following conditions is met:

- **(a) Real capital is raised** — ALCO convenes within one agent cadence cycle of capital being received into custody; or
- **(b) CEO directs a dry-run ALCO session** — for substrate validation, process rehearsal, or regulatory readiness demonstration. A dry-run session is explicitly labelled as such in its minutes and does not constitute binding limit-setting.

The preparatory work in the build phase comprises:

1. This charter (current deliverable)
2. Eitan's liquidity framework and snapshot substrate (live)
3. Ravi's FTP attribution engine (live)
4. IRRBB limit framework (to be authored by Eitan + Helena pre-licence-day)
5. ALCO information-pack assembly substrate (roadmap gap above)

---

## 8. Review and Amendment

### 8.1 Annual review

This charter is subject to annual review initiated by Eitan (Treasurer). The review covers: membership currency, mandate scope against regulatory changes (SARB guidance, Basel updates), substrate gap status, and any lessons from the preceding year's ALCO sessions.

### 8.2 Amendment authority

| Type of change | Authority required |
|---|---|
| Administrative amendment (member name update, cadence clarification) | Eitan approval; Camille records |
| Material scope change (mandate expansion/contraction, quorum rules) | CEO approval; `CeoDecision` event emitted |
| Structural amendment (voting rights, escalation path, Board relationship) | Board approval once Board AC is constituted; CEO approval interim |

### 8.3 Board Audit Committee transition

Once a Board Audit Committee (or equivalent governance body) is constituted at licence-day, this charter transitions to Board AC oversight. The Board AC may delegate ongoing review to the CEO/CFO but retains ultimate approval authority for structural amendments.

---

*Filed by Eitan (Treasurer, engineering) — 2026-05-15. Charter v1.0 is the preparatory governance artefact for ALCO. It takes binding effect at commencement-of-trading.*
