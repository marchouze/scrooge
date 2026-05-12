---
title: "12-Month Risk-Based Audit Plan — Build Phase (v1)"
author: Thandiwe (Chief Audit Executive, governance)
date: 2026-05-12
decision-required: false
status: "Submitted to Interim Audit Forum for approval"
period: "2026-05-12 to 2027-05-11 (agent cadence; wall-clock dates are indicative)"
citations:
  - "[citation: IIA International Standards — Risk-Based Internal Auditing]"
  - "[citation: BCBS 223 — Internal Audit Function in Banks §20–30]"
  - "[citation: D-MARKETS-CAPITAL-TIME-SHAPE]"
---

# 12-Month Risk-Based Audit Plan — Build Phase (v1)

**Author:** Thandiwe (Chief Audit Executive, governance)  
**Period:** 2026-05-12 to 2027-05-11 (agent cadence; wall-clock dates are indicative)  
**Submitted to:** Interim Audit Forum — Owen (Company Secretary, governance), chair  
**Submission date:** 2026-05-12  
**Status:** Submitted for Interim Audit Forum approval  
**Approval event:** `AuditPlanRevisionApproved` (to be emitted on AC approval)  
**Citation chain:** IIA IPPF / Global Internal Audit Standards 2024; BCBS 223 §§20–30; D-MARKETS-CAPITAL-TIME-SHAPE; RAS (Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md); Risk taxonomy (Regulations/_risk-taxonomy.md); Vera recon pipeline inventory (prototype/platform/recon/)

---

## Part 1 — Plan Framing

### 1.1 Strategic and operating context

Hoz Bank Limited is an institutional global-markets trading bank in its build phase. The strategic foundation is:

- **Product scope:** JSE-listed bonds and equities; OTC interest-rate derivatives (IRD). No retail, no credit book, no consumer-facing products.
- **Client base:** institutional counterparties only — asset managers, pension funds, banks, corporates.
- **Structure:** SA single-branch; three legal entities (Hoz Group Limited, Hoz Bank Limited, Hoz Securities Limited).
- **Correspondent posture:** indirect participant in CLS and SAMOS via named-pair correspondents (Standard Bank primary; FirstRand-RMB backup).
- **Capital target:** ~R300m CET1 at licence-day.
- **Current phase:** build phase — no live trading, no customers, no employees beyond the minimum. Licence-day is the go-live gate.

### 1.2 Build-phase audit posture

In the build phase, Internal Audit provides **assurance over build quality and readiness** — not over live transactions. This shapes the plan in three ways:

1. **Substrate assurance, not transaction assurance.** Audit work asserts that the infrastructure being built is fit for purpose: event-store integrity, control design adequacy, regulatory-obligation coverage, agent-operating-discipline, and pre-licence-gate readiness.
2. **Continuous controls as the primary instrument.** Vera's (Internal audit engineer) automated recon pipelines run pre-merge on every PR and nightly. The discrete audit plan supplements pipelines with engagements that require manual walkthrough, document review, or design-adequacy assessment.
3. **AI-agent operating risk as a first-class domain.** The bank's labour force is autonomous AI agents. Novel risks — agent decisions outside mandate, failure of escalation channels, prompt injection, incomplete audit trails for AI decisions — are priority audit domains.

### 1.3 Timing convention

All timing references in this plan are in **agent cadence** — quarter 1 through quarter 4 of the plan period (Q1 = months 1–3, Q2 = months 4–6, Q3 = months 7–9, Q4 = months 10–12 from plan start). Wall-clock dates are indicative. Exact scheduling within each quarter is Vera's operational scheduling decision under the CAE's direction.

---

## Part 2 — Audit Plan Table

### 2.1 Core audit schedule

| Audit ID | Title | Risk Domain | Scope | Objective | Key Risks Addressed | Primary Instrument | Timing | Owner |
|---|---|---|---|---|---|---|---|---|
| **AU-2026-001** | Market Risk Model Integrity — Standardised Approach | Market risk (`RT-MK`) | Rohan's (Risk engineer) SA RWA calculation engine; rate input feeds; model registry; model cards; Helena's (Chief Risk Officer, governance) model-risk policy | Assure that the Standardised Approach capital calculation is correctly implemented; rate inputs are sourced from authorised feeds; SA output reconciles to the BA returns; no Tier-1 model is in production without pre-deployment validation | SA RWA mis-calculation; incorrect rate inputs; unvalidated model deployed; model-tier misclassification | Manual walkthrough (SA methodology vs code) + Vera pipeline (`ras-b2-calibration-coverage.ts`) + document review (model cards) | Q1 | CAE |
| **AU-2026-002** | AI-Agent Operating Risk — Mandate and Decision Discipline | Operational risk (`RT-OP`), specifically AI agent (`RT-OP.AG` — planned taxonomy node) | All agent operating specs (`/Team/*.md`); `AgentDecision` event stream; `AgentEscalation` event stream; trigger-spec-to-handler symmetry | Assure that: (a) agents operate within their declared mandate surfaces; (b) every agent decision is recorded before the action it authorises; (c) escalation channels function end-to-end; (d) agent-run logs are complete and retrievable | Out-of-mandate agent decisions; silent agent actions (no event); broken escalation channels; incomplete agent audit trails | Vera pipelines (`agent-spec.ts`, `trigger-spec-handler-symmetry.ts`, `mandate-ownership.ts`) + manual review of a sample of `AgentDecision` events | Q1 | CAE + Vera |
| **AU-2026-003** | Event-Store Integrity — Principle 1 Assurance | Operational risk — IT / data (`RT-OP.IT`) | Event store (`prototype/platform/event-store/`); append-only semantics; hash-chain integrity; event-schema registry; schema evolution discipline (Anya (Data / analytics engineer)) | Assure that the event log is the actual and sole source of truth; no side-channel state mutations bypass the store; append-only semantics are enforced; hash-chain integrity is maintained; schema evolution does not break backward compatibility without migration | Side-channel state mutations; hash-chain breaks; schema evolution without migration; silent events (actions without typed events) | Vera pipeline (`harness.ts`) + manual code review of event-store write paths + Atlas (Core banking platform architect, engineering) walkthrough | Q1 | CAE + Vera |
| **AU-2026-004** | Pre-Trade Controls — Gateway Envelope and Dealer Mandate | Market risk (`RT-MK`), Conduct risk (`RT-CD`) | Pre-trade gateway (`prototype/`); dealer-mandate boundary logic; Saskia's (Head of Global Markets, governance) trading mandate (`Policies/trading-mandate-v1.md`); VaR limit checking; position pre-checks | Assure that the pre-trade control gateway enforces the dealer mandate; orders outside the mandate envelope are rejected before execution; VaR limits are checked in real time; no production override exists without a signed exception event | Orders executing outside dealer mandate; VaR limit breach at pre-trade stage; unsanctioned override mechanism; conduct failure via mandate circumvention | Manual walkthrough of gateway logic + document review of trading mandate + Vera pipeline (planned: `pre-trade-controls.ts`) | Q2 | CAE |
| **AU-2026-005** | Counterparty Limit Assurance — RAS B-Cluster Concentration Lines | Credit risk — concentration (`RT-CR.CP`), Operational / settlement (`RT-OP.PA`) | Counterparty-limit projection; B-cluster FX-settlement concentration lines (L-B8a-1 to L-B8a-5); Imani's (Legal-as-code engineer) ISDA/GMRA netting opinions; Tomas's (Operations & payments engineer) switch-test cadence | Assure that RAS B-cluster concentration lines are checked before trades; the single-counterparty intraday FX-settlement concentration is within appetite (≤97% steady-state); the backup-readiness line (L-B8a-4 ≤100 days) is being monitored; switch-test evidence exists | Concentration breach not detected before trade; backup correspondent stale; no switch-test evidence; netting opinion absent for netted counterparty | Vera pipeline (`ras-b2-calibration-coverage.ts`) + manual review of switch-test log + document review of B-cluster concentration projection | Q2 | CAE + Vera |
| **AU-2026-006** | ISDA/GMRA Documentation Integrity | Legal / regulatory risk (`RT-LR`) | Imani's (Legal-as-code engineer) master-agreement inventory; ISDA clause library; GMRA clause library; counterparty coverage for all active trading relationships (current: build-phase counterparty list) | Assure that: (a) master agreements are in place for all counterparties intended to be active at licence-day; (b) netting opinions are current and registered; (c) clause-library versions are correct; (d) legal-entity hierarchy is reflected accurately in the documentation registry | Trading without enforceable ISDA / GMRA; stale netting opinion relied on for netting benefit; incorrect legal-entity mapping; counterparty activated without documentation | Document review (master-agreement registry, clause library, netting opinion register) + Imani walkthrough | Q2 | CAE |
| **AU-2026-007** | POPIA Lawful-Processing Assurance | Legal / regulatory — data protection (`RT-LR.DP`) | Iris's (Information Officer, governance) lawful-processing register; retention-period enforcement; data-subject-access request (DSAR) procedure; data-breach notification procedure; cross-border transfer records | Assure that: (a) every processing activity has a lawful basis recorded in the register; (b) retention periods are enforced at the data-layer; (c) the DSAR procedure is functional; (d) the breach notification procedure meets POPIA s.22 timelines; (e) cross-border transfers are documented | Processing without lawful basis; retention enforcement not coded; DSAR procedure not functional; breach notification process gap | Vera pipeline (`retention-citation-coverage.ts`) + document review (lawful-processing register) + Iris walkthrough | Q2 | CAE + Vera |
| **AU-2026-008** | Information Security and Cyber Control Assurance | Operational risk — cyber (`RT-OP.CY`) | Rashida's (Chief Information Security Officer, governance) Joint Standard 2 of 2024 programme; Senna's (Security engineer) control set (`/prototype/`); access-control configuration; HSM key governance; threat-model gate artefacts; zero-trust implementation | Assure that Senna's control set is actually operating (not just designed); access controls are correct and least-privilege; HSM key governance procedures are functional; the threat-model gate has been applied to material design decisions; the Bank's Joint-Standard 2 of 2024 programme covers required domains | Controls designed but not implemented; excess privilege; HSM key governance gap; threat-model gate bypassed; Joint Standard programme coverage gap | Manual walkthrough of control set + Vera pipeline (`permission-gate-default.ts`) + Senna walkthrough | Q2 | CAE |
| **AU-2026-009** | Recon Pipeline Coverage and Findings-Actioning Discipline | Operational risk — audit infrastructure (`RT-OP`) | All Vera recon pipelines in `prototype/platform/recon/`; CI pipeline integration; cron schedule; findings-actioning log; Wave-4 pipeline completeness | Assure that: (a) all recon pipelines are actually running in CI (not just present in the codebase); (b) pipelines are wired to the nightly cron schedule; (c) findings are being actioned within SLA; (d) Wave-4 pipeline completeness is assessed — planned pipelines have a delivery timeline | Pipelines present but not running; pipeline results not surfacing as findings; findings not actioned; audit infrastructure coverage gaps | Vera self-test (pipelines test their own CI integration) + manual review of `cron-map-drift.ts` output + CAE review of open-findings backlog | Q3 | CAE + Vera |
| **AU-2026-010** | Build-to-Licence-Day Readiness Assurance | Strategic / operational (`RT-ST.GV`) | Pre-licence go-live readiness gate (Saskia (Head of Global Markets, governance), co-owned with Rashida (CISO) and Devon (Chief Operating Officer, governance)); substrate-completeness roadmap; substrate gaps inventory (`Team/Thandiwe.md` §16, `Team/Vera.md` §16, Atlas substrate gaps); regulatory obligations register completeness | Assure that: (a) pre-licence gate items are progressing against a documented plan; (b) substrate gaps are inventoried and owned; (c) the obligations register is complete for LICENCE-BIND obligations; (d) no licence-day obligation is undiscovered | Undiscovered licence-day obligations; substrate gaps without owners or timelines; readiness gate criteria not defined; regulatory obligation coverage gaps | Document review (obligations register, substrate gaps, roadmap) + Vera pipeline (`decision-event-recon.ts`, `decision-required-event-pairing.ts`) + cross-team walkthrough | Q3 | CAE |
| **AU-2026-011** | Capital Adequacy Computation — BA Returns Assurance | Credit risk — capital (`RT-CR.OB`), Regulatory reporting (`RT-LR.RC`) | Bea's (Accounting & financial reporting engineer) BA returns engine; Rohan's RWA projections; CET1 computation; SARB return submission pipeline; reconciliation of RWA to ledger positions | Assure that: (a) the BA returns engine produces a correct and reconcilable CET1 output; (b) RWA projections reconcile to the ledger; (c) the return submission pipeline is functional; (d) the entity-level vs consolidated-basis split per §B14 of the RAS is implemented | Incorrect RWA computation; BA return error; entity vs consolidated mis-split; return submitted without reconciliation | Manual walkthrough of BA returns engine + Bea walkthrough + Vera pipeline (planned: `ba-returns-integrity.ts`) | Q3 | CAE |
| **AU-2026-012** | AML/CFT and Sanctions Controls Assurance | Financial crime (`RT-FC`), Sanctions (`RT-FC.SA`) | Zara's (Chief Compliance Officer, governance) RMCP; Mira's (Compliance / RegTech engineer) transaction-monitoring engine; sanctions-matching pipeline; continuous-KYC defaults (restrict-on-review / restrict-immediately tiers); PEP / EDD onboarding workflow | Assure that: (a) the sanctions-matching pipeline blocks all true-positive matches pre-execution with no production override path except signed Zara event; (b) continuous-KYC defaults are implemented in code (not just policy); (c) PEP / EDD onboarding workflow is functional; (d) STR filing process is documented | Sanction match not blocked; override path without Zara sign; KYC defaults not coded; PEP / EDD gap; STR workflow not functional | Manual walkthrough of sanctions pipeline + Mira walkthrough + document review (RMCP, FIC registration) + Vera pipeline (planned: `aml-controls-integrity.ts`) | Q3 | CAE |
| **AU-2026-013** | Model Risk Governance — Validation Evidence and Registry | Operational risk — model (`RT-OP.MD`) | Rohan's model inventory; Nadia's (Independent-validation engineer, second line) validation evidence for all Tier-1 models; model-registry completeness; segregation of duties (Rohan builds, Nadia validates); model-performance monitoring projections | Assure that: (a) every Tier-1 model in the registry has passed pre-deployment independent validation; (b) Nadia has not also built the models she validates; (c) model-performance monitoring projections exist and are reviewed; (d) Tier-1 annual revalidation cadence is on track | Tier-1 model unvalidated; validator-builder segregation breach; model-performance drift undetected; incomplete model registry | Document review (model registry, validation reports) + Nadia walkthrough + Vera pipeline (planned: `model-validation-coverage.ts`) | Q4 | CAE |
| **AU-2026-014** | Governance Framework and Decision-Record Integrity | Strategic / governance (`RT-ST.GV`) | CEO decision event store; `CeoDecision` event symmetry pipeline; obligations register (Mira); governance framework (`Owner Inbox/2026-05-06_governance-framework.md`); policy register; Principle 2 (single-graph discipline) traceability | Assure that: (a) all CEO decisions are recorded as `CeoDecision` events before downstream action; (b) the decision-record-to-event symmetry is maintained (no ghost-open decisions); (c) every policy has a citation upward to a regulation or bank objective; (d) no orphan policies exist | Decision taken before event emitted; ghost-open decisions (markdown without event); orphan policies (no regulation citation); policy-register incompleteness | Vera pipelines (`decision-event-recon.ts`, `decision-record-event-symmetry.ts`, `decision-required-event-pairing.ts`, `prose-duplication.ts`) + document review (policy register, obligations register) | Q4 | CAE + Vera |
| **AU-2026-015** | Third-Party and Correspondent Bank Concentration Assurance | Operational / settlement (`RT-OP.PA`), Third-party (`RT-OP.TP`) | Named-pair correspondent relationships (Standard Bank primary; FirstRand-RMB backup; Absa, Nedbank reserve); switch-test programme (Tomas (Operations & payments engineer)); third-party vendor contracts; cloud-provider dependency | Assure that: (a) the named-pair correspondent posture is being operated as documented; (b) the switch-test programme has been executed with documented results; (c) the reserve correspondent contracts remain active-but-dormant; (d) no unsanctioned third correspondent has been added; (e) cloud-provider and vendor concentration risk is inventoried | Unsanctioned third correspondent; stale switch-test (L-B8a-4 breach); reserve-correspondent contract lapse; unidentified third-party concentration | Document review (switch-test log, correspondent agreements, vendor contracts) + Tomas walkthrough + Vera pipeline (`ras-b2-calibration-coverage.ts`) | Q4 | CAE |
| **AU-2026-016** | Liquidity Risk Framework and LCR/NSFR Controls Assurance | Liquidity / funding risk (`RT-LQ.FN`) | Eitan's (Treasurer, governance) ALCO pack; Ravi's (Treasury / ALM engineer) LCR/NSFR projection; liquidity limits (RAS §B3: LCR ≥120% PA min; NSFR ≥115%); contingency-funding plan; IRRBB EVE/NII sensitivity | Assure that: (a) the LCR projection is correctly computed; (b) the NSFR projection is correctly computed; (c) the trigger and escalation levels in §B3 are wired into real-time monitoring; (d) the contingency-funding plan is documented and has a test cadence | LCR/NSFR below appetite with no automated detection; trigger levels not wired; contingency plan undocumented; IRRBB sensitivity not computed | Manual walkthrough of LCR/NSFR projection + Ravi walkthrough + Vera pipeline (planned: `liquidity-controls-integrity.ts`) | Q4 | CAE |

---

## Part 3 — Coverage Rationale

### 3.1 Why these 16 audits were selected

**Regulatory expectation for a new-entrant bank.** BCBS 223 §§20–30 requires that the internal audit function of a bank covers the full risk universe; for a new-entrant bank seeking SARB licensing, the PA expects the charter and plan to be in place *before* commencement-of-trading. The plan covers all material risk domains in the RAS taxonomy and maps directly to the obligations the PA will assess at licence-application and at the first supervisory review.

**Build-phase primacy of substrate quality.** In the build phase, the most material risk is not market-loss or credit-loss (no live trading) — it is that the substrate being built is structurally unsound and will fail at licence-day or under first regulatory inspection. AU-2026-003 (event-store integrity), AU-2026-009 (recon pipeline coverage), and AU-2026-010 (build-to-licence-day readiness) are therefore in Q1–Q3 priority, not deferred.

**AI-agent operating risk as a first-class domain.** No conventional bank internal audit framework addresses AI-agent operating risk at this depth. This bank's entire operating model depends on agents operating within their mandates, escalating correctly, and producing complete audit trails. AU-2026-002 addresses this as a Q1 priority; AU-2026-014 addresses governance and decision-record integrity as a Q4 assurance.

**Market risk and pre-trade controls as the primary trading-franchise risk surface.** The bank's income model is institutional market-making. Market risk model integrity (AU-2026-001), pre-trade controls (AU-2026-004), and counterparty limit assurance (AU-2026-005) directly address the risk categories where a failure would be most material at licence-day.

**Legal documentation as a prerequisite.** ISDA / GMRA documentation (AU-2026-006) is a binary prerequisite for trading — without enforceable master agreements, no netting benefit is available and trading with uncovered counterparties creates unlimited credit exposure. This is a Q2 priority.

**Regulatory obligations not deferred.** POPIA lawful-processing (AU-2026-007), AML/CFT and sanctions (AU-2026-012), and capital adequacy (AU-2026-011) are LICENCE-BIND obligations. Assurance that the substrate for these controls is being built correctly is required before licence-day, not after.

**What was deprioritised and why.** Retail-banking themes (consumer-credit model audit, branch-operations assurance, consumer-conduct monitoring) are out of scope — the Bank has no retail product, no credit book, and no retail customers at licence-day. Climate-risk model audit is deferred to Year 2 — the Bank's climate-risk programme is in the "assess and disclose" phase; there is no appetite-line decisioning model to audit yet. Recovery and resolution plan assurance is deferred to Year 2 — the recovery plan is being authored (Saskia); auditing a plan not yet finalized would produce no useful assurance.

---

## Part 4 — Combined-Assurance Overlay

### 4.1 Purpose

The combined-assurance overlay maps existing second-line assurance activities against each audit engagement, so the plan avoids duplicating second-line work and instead challenges it. Internal Audit's role is to provide independent third-line challenge to the second line's own assurance — not to replicate it.

### 4.2 Overlay table

| Audit ID | Audit Title | Second-Line Assurance Already Existing | Third-Line Positioning |
|---|---|---|---|
| AU-2026-001 | Market Risk Model Integrity | Helena (CRO): RAS B7 model-risk tiers; Nadia (independent validation engineer): pre-deployment validation reports for Tier-1 models; Rohan: model-performance monitoring projections | Third-line asserts that the second-line validation programme was actually executed, evidence is retrievable, and segregation of duties (Nadia ≠ Rohan) is maintained. Third-line does not re-run the model validation. |
| AU-2026-002 | AI-Agent Operating Risk | Devon (COO): change-governance review of agent deployments; Vera pipeline: `trigger-spec-handler-symmetry.ts` (continuous, second-line adjacent) | Third-line asserts that the continuous pipelines themselves are running and producing output; samples `AgentDecision` events for mandate conformance. Vera's pipeline is engineered under the third-line function — it is third-line continuous testing, not second-line. |
| AU-2026-003 | Event-Store Integrity | Atlas: event-store design and append-only enforcement built into the platform; Anya: schema-evolution discipline and data-contract review | Third-line asserts that Atlas's controls are actually functioning at runtime — not merely designed. Third-line reads the live event store; does not test in a sandbox. |
| AU-2026-004 | Pre-Trade Controls | Saskia (HGM): first-line trading desk oversight; Helena (CRO): risk-limit monitoring projections; Rohan: VaR limit alerts | Third-line asserts control design adequacy and that the first-line / second-line monitoring loop is end-to-end. Third-line does not set VaR limits. |
| AU-2026-005 | Counterparty Limit Assurance | Helena: RAS B8a concentration monitoring; Eitan (Treasurer): ALCO dashboard; Tomas: switch-test execution and logging | Third-line challenges that the concentration projection actually captures all `FxSettlementInstructed` events and that the switch-test log has timestamps and pass/fail outcomes. |
| AU-2026-006 | ISDA/GMRA Documentation Integrity | Imani: master-agreement registry curation; legal-entity hierarchy maintenance; netting opinion issuance | Third-line challenges that the registry is complete (no undocumented active counterparty); netting opinions are current; clause versions are correct. Third-line does not draft the opinions. |
| AU-2026-007 | POPIA Lawful-Processing Assurance | Iris (IO): lawful-processing register maintenance; DSAR handling; breach-notification procedure; Zara (CCO): compliance monitoring of POPIA obligations; Vera: `retention-citation-coverage.ts` | Third-line challenges that Iris's register is complete (no unregistered processing activity) and that retention enforcement is coded, not procedural only. |
| AU-2026-008 | Information Security and Cyber | Rashida (CISO): Joint Standard 2 of 2024 programme management; Senna: control implementation and monitoring; first-line: access-request and provisioning controls | Third-line challenges that Senna's controls are actually operating (not just designed) and that access-control configurations are least-privilege in practice. Third-line does not set the security policy. |
| AU-2026-009 | Recon Pipeline Coverage | Vera: continuous self-monitoring; `cron-map-drift.ts` detects pipeline scheduling gaps | This is an audit of the audit function's own tooling. The CAE (not Vera) owns this audit; the conflict is registered. External assurance is sought for the pipeline-design layer if Vera's design contribution creates an independence conflict. |
| AU-2026-010 | Build-to-Licence-Day Readiness | Devon (COO): operational-readiness programme; Saskia: pre-licence gate co-ownership; Helena: prudential readiness monitoring; Mira: obligations register completeness | Third-line provides an independent view of readiness — not the readiness gate itself. Third-line challenges that the gate criteria are documented, that obligations have been inventoried, and that no licence-day obligation is hidden in a substrate gap. |
| AU-2026-011 | Capital Adequacy — BA Returns | Bea: BA returns engine build and reconciliation; Camille (CFO): financial oversight; Helena: capital adequacy monitoring (RAS §B3); Rohan: RWA projection | Third-line challenges that the BA returns engine produces a reconcilable output — not merely that it runs. Third-line does not author the BA return. |
| AU-2026-012 | AML/CFT and Sanctions Controls | Zara (CCO / MLRO): RMCP ownership and compliance monitoring; Mira: transaction-monitoring engine and sanctions pipeline; FIC registration and STR process | Third-line challenges that the sanctions pipeline has no unmonitored override path and that the KYC defaults are coded (not just documented). Third-line does not set the AML policy. |
| AU-2026-013 | Model Risk Governance | Helena: model-risk policy ownership; Nadia: independent validation programme; Rohan: model-performance monitoring | Same positioning as AU-2026-001: third-line asserts evidence exists, segregation holds, and cadence is met. Does not re-validate models. |
| AU-2026-014 | Governance and Decision-Record Integrity | Owen (CoSec): governance-framework custodianship; Vera: `decision-event-recon.ts`, `decision-record-event-symmetry.ts` pipelines | Third-line challenges that the pipelines detect *all* ghost-open decisions and that the policy-citation chain is complete. Third-line does not author governance documents. |
| AU-2026-015 | Third-Party and Correspondent Concentration | Eitan (Treasurer): ALCO review of correspondent-bank relationships; Devon: operational-resilience programme; Tomas: switch-test execution | Third-line independently verifies that switch-test evidence exists and is not self-certified. Third-line does not execute switch tests. |
| AU-2026-016 | Liquidity Risk Framework | Eitan: ALCO pack and ILAAP; Ravi: LCR/NSFR projection; Helena: liquidity appetite monitoring (RAS §B3) | Third-line challenges that the liquidity projections reconcile to actual event-log positions and that trigger / escalation levels are wired. Third-line does not set liquidity policy. |

---

## Part 5 — Substrate Gaps Affecting Plan Execution

The following substrate gaps constrain this plan's execution. They are recorded as findings against the build-phase roadmap, not as excuses:

| Gap | Affected Audits | Current Mitigation | Planned Resolution |
|---|---|---|---|
| Issues-and-actions tracker not built | All | Findings tracked in event log; quarterly summary is authored | Pre-licence; Atlas + Vera |
| AC-pack generator not built | All (quarterly opinion output) | Pack authored by CAE; `ThirdLineOpinionSigned` event emitted | Pre-first-Board; Atlas |
| `AgentDecision` event schema not in production | AU-2026-002 | Manual review of agent-run logs; pipeline planned | Runtime substrate phase; Atlas |
| `AgentEscalation` event schema not in production | AU-2026-002 | Escalation channel tested via manual walkthrough | Runtime substrate phase; Atlas |
| Planned pipelines not yet built (`ba-returns-integrity.ts`, `pre-trade-controls.ts`, `aml-controls-integrity.ts`, `model-validation-coverage.ts`, `liquidity-controls-integrity.ts`) | AU-2026-004, AU-2026-011, AU-2026-012, AU-2026-013, AU-2026-016 | Manual walkthroughs supplement until pipelines land | Vera; target Q2–Q3 |
| Consolidated-basis metric computation not built | AU-2026-011 | Entity-level computation only; consolidated view noted as gap | Anya + Bea + Rohan; pre-licence |
| Combined-assurance-map tooling not built | All | Map maintained as authored document; gap surface via in-session reasoning | Pre-licence; Vera + governance seats |

---

## Part 6 — Plan Approval and Amendment

### 6.1 Approval

This plan is submitted to the Interim Audit Forum for approval. Approval is recorded in the Interim Audit Forum minute and emitted as an `AuditPlanRevisionApproved` event.

### 6.2 Material amendments

Material mid-year amendments (removal of a high-risk audit, addition of an unplanned engagement above materiality) require AC approval and re-emission of an `AuditPlanRevisionApproved` event. Minor resequencings within quarters are within the CAE's authority; they are noted in the following quarterly report.

### 6.3 Unplanned engagements

Unplanned engagements are initiated under the Charter's materiality criteria (§6.4 of the Charter submission). Each unplanned engagement is reported to the AC at the next quarterly meeting with rationale.

### 6.4 Year-2 plan refresh

The Year-2 plan will be drafted at Q4 and submitted to the AC at or before the plan-period end. Topics deferred from Year 1 (recovery-plan assurance, climate-risk model audit) will be considered for Year-2 inclusion based on the Bank's readiness at that point.

---

*Submitted by Thandiwe (Chief Audit Executive, governance), 2026-05-12. Questions to Thandiwe or Owen (Company Secretary, governance) as Interim Audit Forum secretariat.*
