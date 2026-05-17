---
title: Regulatory-readiness gate plan — top-3 workstreams for the licence-application package
author: Zara (Chief Compliance Officer, governance) + Helena (Chief Risk Officer, governance)
date: 2026-05-10
summary: Triage of the regulatory-readiness frontier across seven candidate workstreams; recommendation to authorise three top-priority bundles (AML/CFT-RMCP, ICAAP/ILAAP/Recovery, Joint Standard 1 cyber-resilience) with embedded slice plans and Slice 1-3 dispatch-ready briefs for pre-M2 build under the Targeted budget. Two further bundles (Operational Resilience under JS 2 of 2024 + BCBS 2021; Markets Conduct / FAIS / ODP under FMA + CS 1-3 of 2018 + JS 2 of 2020) filed as next-tranche workstreams with named proximate triggers.
decision-required: true
decision-id: D-REGULATORY-READINESS-GATE-PLAN
decision-category: medium-term
decision-owner: Zara (CCO, governance) · Helena (CRO, governance)
decision-for-ceo: Approve the top-3 regulatory-readiness workstreams (AML/CFT-RMCP, ICAAP/ILAAP/Recovery, JS 1 of 2024 cyber-resilience) + Slice 1-3 build authorisation pre-M2.
decision-recommendation: Approve as drafted; routing — each workstream's Slice 1 dispatches immediately on CEO approval per the no-pause rule (CLAUDE.md "Operating procedures").
---

# Regulatory-readiness gate plan — top-3 workstreams for the licence-application package

> **Co-authored:** Zara (Chief Compliance Officer, governance — also acting MLRO + FIC Compliance Officer interim) leads §1 candidates B/C/G + §2 selection-rationale on AML, §3 Workstream W1 (AML/CFT-RMCP), §5 deferral of Markets-Conduct bundle.
> Helena (Chief Risk Officer, governance) leads §1 candidates A/D/E + §2 selection-rationale on capital + risk, §3 Workstreams W2 (ICAAP/ILAAP/Recovery) and W3 (cyber-resilience programme governance), §5 deferral of Operational Resilience bundle.
> §4 (CEO decision lines), §6 (substrate dependencies), and §1 framing are co-authored.

**Date:** 2026-05-10
**For:** Marc (CEO)
**Authority:**
- CLAUDE.md "Operating model — what is real, deferred, paused" (build-phase endpoint = pre-licence go-live readiness gate; co-owned Saskia + Rashida + Devon)
- CLAUDE.md Principles 1, 2, 6, 7 (events as truth; citation discipline; single-graph; autonomous-by-default)
- Memory `project_rules_bind_at_commencement.md` (CORPORATE / LICENCE / COMMENCEMENT / CONDITIONAL bind taxonomy)
- Memory `project_strategic_foundation.md` (institutional global-markets dealer; ~R300m capital target; institutional-only)
- Memory `project_indirect_participant_posture.md` (sponsor-bank access to CMI; B-cluster-FX concentration appetite)
- [Regulations/_obligations-register.md](../Regulations/_obligations-register.md) v1.13 (232 obligations across 23 prefixes; ~70+ instruments)
- Precedent decision packs: [`Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md`](2026-05-10_atlas_event-store-scaling-design.md) (eight-slice precedent for D-EVENT-STORE-SCALING) + [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md) (five-slice precedent for D-RMS-PHASE-1)

**Status.** Plan only. No policies authored, no procedures bound, no register rows added. Authorisation governs which Slice 1 briefs Scrooge dispatches next, and which workstreams the per-slice exit criteria progress against.

> **Derivation note (Principle 6 — downward).** This pack sits at the *standard* layer: it specifies which subsets of the obligations register the bank addresses next (the *standard* form of the *regulation* anchors), without re-stating the underlying obligations themselves. Each candidate cites register row IDs (the canonical handles per v1.13); the pack does not edit the register.

---

## 0. The framing

CEO Marc asked, after the substrate-side D-EVENT-STORE-SCALING + D-RMS-PHASE-1 land, **which obligations to address next** — i.e. which subset of the 232-row obligations register (Regulations/_obligations-register.md v1.13) the bank's policy + procedure + system-capability stack needs to **substantively engineer** before the pre-licence go-live readiness gate fires.

Scrooge (Chief of Staff / Orchestrator) proposed five candidate frontiers as input. We treated those as input, not conclusion. Our triage adds two further candidates worth weighing — a Markets-Conduct / FAIS / ODP bundle anchored on `Hoz Securities Limited`, and a Recovery-and-Resolution preparation pack — to make the trade-off space honest.

**The constraint set.** The build-phase endpoint is the pre-licence go-live readiness gate (Saskia (Head of Global Markets, governance) + Rashida (Chief Information Security Officer, governance) + Devon (Chief Operating Officer, governance) co-owned). Three classes of work bind on that gate:

- **CORPORATE-bind** — already in force at corporate formation (`Hoz Group Limited` / `Hoz Bank Limited` / `Hoz Securities Limited` registered). Companies-Act seats, governance framework, the core policy stack at IN FORCE.
- **LICENCE-bind** — must be substantively built, attested, and demonstrable to the SARB Prudential Authority (PA) at licence-application moment. ICAAP, ILAAP, recovery plan, RMCP, cyber-resilience programme, operational-resilience programme, capital management policy + first BA returns dry-run, fit-and-proper attestations, governance-framework attestations.
- **COMMENCEMENT-bind** — binds at commencement-of-trading (the moment after licence-day when the first paying client transacts). FinSurv per-category reporting, Strate trade-reporting, margin reporting under JS 2 of 2020, FAIS advice records (post-FSP-licence), product-launch under NPA, customer-facing complaints.

**Per `project_rules_bind_at_commencement.md`:** banking-specific obligations bind at commencement-of-trading; build-phase is *preparation for* compliance, not compliance. The pre-licence-gate work is the readiness package the PA reads before issuing the licence — it is the *substantive* form of the LICENCE-bind class.

**Why this needs a CEO decision.** This is a genuinely new policy choice (per CLAUDE.md "Dispatch discipline" — no-pause rule). The CEO is choosing *which subset of the LICENCE-bind class to substantively engineer next*; the alternative orderings have meaningfully different licence-application-package shapes and different downstream-persona-unblocking patterns. Approval routes immediate Slice-1 dispatch via the no-pause rule.

---

## 1. Triage of the candidate frontier

We weigh seven candidates: the five Scrooge proposed (numbered S1-S5) + two we add (Z6 markets-conduct, H7 recovery-and-resolution prep). Each candidate carries: binding-instrument citations + register-row IDs · bind status · current state · lead-time to readiness · why-now · why-wait.

### Candidate S1 — ICAAP / ILAAP / Recovery Plan (consolidated basis under PA look-through)

- **Binding instruments.** Banks Act 94 of 1990 §§ 60-72 (consolidated supervision; recovery framework); *Regulations Relating to Banks 2012 (as amended)* — Reg 38 (capital adequacy), Reg 39 (operational risk + product approval), Reg 26 (large exposures); BCBS *Basel III/IV* (Pillar 2 ICAAP) `[citation: TBC exact §]`; BCBS *Principles for Sound Liquidity Risk Management and Supervision* (BCBS 144) + BCBS D295 (LCR) + BCBS D335 (NSFR) (ILAAP); FSB *Key Attributes of Effective Resolution Regimes for Financial Institutions* (Oct 2014); SARB Directive on Recovery Planning `[citation: TBC]`.
- **Register rows cited.** [`ORG-PR-01`](../Regulations/_obligations-register.md#L111) (capital adequacy), [`ORG-PR-02`](../Regulations/_obligations-register.md#L112) (Pillar 2A), [`ORG-PR-03`](../Regulations/_obligations-register.md#L113) (capital buffers), [`ORG-PR-04`](../Regulations/_obligations-register.md#L114) (CET1 management buffer +1.5pp — RAS B2 deferred), [`ORG-PR-05`](../Regulations/_obligations-register.md#L115) (leverage ratio), [`ORG-PR-06`](../Regulations/_obligations-register.md#L116) (LCR ≥100%), [`ORG-PR-07`](../Regulations/_obligations-register.md#L117) (NSFR ≥100%), [`ORG-PR-08`](../Regulations/_obligations-register.md#L118) (BCBS 248 intraday liquidity), [`ORG-PR-09`](../Regulations/_obligations-register.md#L119) (large exposures), [`ORG-PR-12`](../Regulations/_obligations-register.md#L122) (stress + reverse stress), [`ORG-PR-13`](../Regulations/_obligations-register.md#L123) (annual ICAAP submission), [`ORG-PR-14`](../Regulations/_obligations-register.md#L124) (annual ILAAP submission), [`ORG-PR-15`](../Regulations/_obligations-register.md#L125) (Contingency Funding Plan), [`ORG-BNK-CYBER-CONS`](../Regulations/_obligations-register.md#L515)-equivalent consolidated rows under D-REGULATORY-PERIMETER for ICAAP/ILAAP/Recovery on consolidated basis.
- **Bind status.** **LICENCE-bind** on the ICAAP / ILAAP submissions themselves (PA expects the documents at licence-application + then annually); **CORPORATE-bind** on the underlying capital / liquidity / risk-management policies that feed them (already IN FORCE at the policy layer, per the register).
- **Current state.** Underlying policies IN FORCE (Capital Management; Liquidity Risk Management; Stress Testing; CFP). The *integrated* ICAAP / ILAAP / Recovery documents — consolidated-basis under PA look-through per `D-REGULATORY-PERIMETER` (PR #85, 2026-05-09) — are **NOT** drafted. RAS B2 (CET1 management buffer ≥+1.5pp above PA minima) is `PARTIAL (B2 deferred)` per `ORG-PR-04`.
- **Lead time to readiness.** Substantive multi-tick effort. Each of the three documents is ~3-5 sessions of substantive engineering once the data substrate (Bea's reporting capability) is wired through. External dependencies: PA's published ICAAP-template revision (when SARB issues an updated guidance note); auditor sign-off on the capital walk (no auditor engaged yet — out of scope until licence-application moment per "Operating model" §"Personas paused or reshaped").
- **Why-now.** Gates licence-application directly. The PA does not issue a banking licence without a substantive ICAAP + ILAAP + recovery plan; these are the Pillar-2 / liquidity-adequacy / resolvability submissions that prove the bank can absorb losses, fund itself through stress, and wind down without taxpayer support. Long lead time and substantial multi-document work argue for early start. RAS B2 calibration (the +1.5pp CET1 management buffer) is *also* gated on this work — Helena and Camille (CFO, governance) have a standing ask to ratify B2, and the ICAAP build is the natural moment to land it.
- **Why-wait.** ICAAP/ILAAP narrative-richness depends on having a substrate that can produce the Pillar-1 ratios + stress-projections at scale (Bea's reporting capability + Rohan's backtest harness). Both substrates are pre-M2; the ICAAP narrative quality improves materially after they land. A bias-to-action argues "build the substrate-side and the policy-side in parallel" — which is the slice plan in §3.W2.

### Candidate S2 — Cyber-resilience programme (Joint Standard 1 of 2024 — PA + FSCA)

- **Binding instruments.** **Joint Standard 1 of 2024 on Cybersecurity and Cyber Resilience** issued jointly by the Prudential Authority and the Financial Sector Conduct Authority (full standard) `[citation: TBC — exact clause references on responsible person, threat-modelling, incident reporting, group-vs-entity programme]`; cross-reference **POPIA 4 of 2013 ss.19-22** (security safeguards); SARB **Directive 3 of 2018** (Cloud Computing & Data Offshoring); BCBS *Principles for Operational Resilience* (March 2021); ISO/IEC 27001:2022 (reference); NIST CSF 2.0 (reference); NIST SP 800-218 SSDF v1.1 (reference).
- **Register rows cited.** [`ORG-CY-01`](../Regulations/_obligations-register.md#L206) (cyber framework), [`ORG-CY-02`](../Regulations/_obligations-register.md#L207) (responsible person), [`ORG-CY-03`](../Regulations/_obligations-register.md#L208) (threat modelling), [`ORG-CY-04`](../Regulations/_obligations-register.md#L209) (regulator incident reporting), [`ORG-CY-05`](../Regulations/_obligations-register.md#L210) (rehearsed runbooks), [`ORG-CY-06`](../Regulations/_obligations-register.md#L211) (Directive 3 of 2018 cloud), [`ORG-CY-07`](../Regulations/_obligations-register.md#L212) (material outsourcing notification), [`ORG-CY-09`](../Regulations/_obligations-register.md#L214) (ISO 27001 alignment), [`ORG-CY-10`](../Regulations/_obligations-register.md#L215) (NIST CSF 2.0 alignment), [`ORG-CY-11`](../Regulations/_obligations-register.md#L216) (RAS B6 four-tier severity), [`ORG-CY-12`](../Regulations/_obligations-register.md#L217) (NIST SP 800-218 SSDF), [`ORG-PR(IV)-06`](../Regulations/_obligations-register.md#L189) (POPIA security safeguards), [`ORG-BNK-CYBER-CONS`](../Regulations/_obligations-register.md#L515) (consolidated cyber programme under PA look-through).
- **Bind status.** **CORPORATE-bind** on the framework and the named accountable executive (JS 1 of 2024 binds on financial institutions registered with PA / FSCA — `Hoz Bank Limited` from corporate formation; `Hoz Securities Limited` from FSP-authorisation moment); **LICENCE-bind** on the substantive *programme attestation* the PA expects at licence-application; consolidated-basis dimension under D-REGULATORY-PERIMETER (`ORG-BNK-CYBER-CONS`).
- **Current state.** Cyber Resilience Policy + Information Security Policy + Incident Response Policy exist and are IN FORCE at the policy layer. Underlying *substrate* — runtime threat-modelling, signed event-store with HSM key envelope, incident-event substrate, regulator-notification harness — is partially in place (Senna (Security engineer) under Rashida (CISO, governance) has authored design briefs; the Neon event-store threat-model lives at [`Owner Inbox/2026-05-07_senna_neon-event-store-threat-model.md`](2026-05-07_senna_neon-event-store-threat-model.md)). The full **JS 1 of 2024 attestable programme** — i.e. a single readable artefact the PA can read against the standard's clause-set — is **NOT** drafted.
- **Lead time to readiness.** Medium effort. The policies exist; the gap is the cohesive *programme document* + incident-rehearsal evidence + threat-model artefact register + supplier-cyber-risk attestation pipeline. Five to seven slices of work distributed Senna + Rashida + Devon.
- **Why-now.** JS 1 of 2024 is the most actively-supervised cyber standard in SA at present; PA cyber-incident reporting expectations have hardened post-2024. Threat-modelling discipline is most cheaply integrated *during* substrate build (now), not *after* (post-licence-day). The consolidated reading under D-REGULATORY-PERIMETER means the same programme covers `Hoz Securities Limited` as well, with no additional engineering — a high-leverage two-for-one.
- **Why-wait.** The substrate-side cyber gates (HSM key envelope on the event store; signed-event chain; runtime threat-model gate at the SDLC layer) are work the engineering substrate is doing anyway under the Targeted budget. There is a thin argument for waiting until those substrate exits land before authoring the *attestable programme*; we judge this argument net-loses because the programme document binds the substrate work to the JS 1 clause-set rather than letting it drift.

### Candidate S3 — AML/CFT / RMCP / FIC Act compliance

- **Binding instruments.** **FIC Act 38 of 2001** — ss.21 (CDD), 21A (EDD), 21B (beneficial ownership), 22 (record retention 5 years), 28 (CTR ≥R24,999.99), 28A (PAR), 29 (STR), 29(3) (tipping-off), 42 (RMCP), 43 (training), 43A (accountable institution designation); **FATF Recommendations** 1 (RBA), 10 (CDD), 16 (wire transfers); **FIC General Notice 7** (RBA / EDD periodicity); **POCDATARA** (DTI sanctions); **PRECCA 12 of 2004** (anti-bribery); UN Security Council Sanctions; OFAC SDN; EU consolidated; UK HMT; FATCA IGA + Tax Admin Act 28 of 2011; CRS + Tax Admin Act 28 of 2011; UK Bribery Act 2010 (extra-territorial).
- **Register rows cited.** Domain B en bloc — [`ORG-FC-01`](../Regulations/_obligations-register.md#L142) (RMCP under FIC s.42), [`ORG-FC-02`](../Regulations/_obligations-register.md#L143) (CDD), [`ORG-FC-03`](../Regulations/_obligations-register.md#L144) (EDD / PEPs), [`ORG-FC-04`](../Regulations/_obligations-register.md#L145) (beneficial ownership), [`ORG-FC-05`](../Regulations/_obligations-register.md#L146) (5-year retention), [`ORG-FC-06`](../Regulations/_obligations-register.md#L147) (RBA dispatch), [`ORG-FC-07`](../Regulations/_obligations-register.md#L148) (CTRs), [`ORG-FC-08`](../Regulations/_obligations-register.md#L149) (PARs), [`ORG-FC-09`](../Regulations/_obligations-register.md#L150) (STRs), [`ORG-FC-10`](../Regulations/_obligations-register.md#L151) (tipping-off), [`ORG-FC-11`](../Regulations/_obligations-register.md#L152) (MLRO designation, multi-entity), [`ORG-FC-12`](../Regulations/_obligations-register.md#L153) (training), [`ORG-FC-13`](../Regulations/_obligations-register.md#L154) (sanctions blocking, RAS B4 zero-appetite), [`ORG-FC-14`](../Regulations/_obligations-register.md#L155) (POCDATARA / DTI), [`ORG-FC-15`](../Regulations/_obligations-register.md#L156) (FATCA), [`ORG-FC-16`](../Regulations/_obligations-register.md#L157) (CRS), [`ORG-FC-17`](../Regulations/_obligations-register.md#L158) (FATF R.16 wire transfers), [`ORG-FC-18`](../Regulations/_obligations-register.md#L159) (RAS B3 continuous-KYC two-tier), [`ORG-FC-19`](../Regulations/_obligations-register.md#L160) (RBA periodicity), [`ORG-FC-20`](../Regulations/_obligations-register.md#L161) (PRECCA), [`ORG-FC-21`](../Regulations/_obligations-register.md#L162) (FATF mutual-evaluation grey-listing remediation), [`ORG-FC-22`](../Regulations/_obligations-register.md#L163) (UK Bribery Act).
- **Bind status.** **CORPORATE-bind** on RMCP + MLRO designation + the AML/CFT policy stack (FIC s.43A binds on registration as accountable institution — `Hoz Bank Limited` and `Hoz Securities Limited` separately). **LICENCE-bind** on the substantive RMCP attestation the PA + FIC expect at licence-application + the FIC-specific registrations (MLRO designation lodged with FIC; goAML / RegOnline registration). **COMMENCEMENT-bind** on the live transaction-monitoring / sanctions-screening / CTR-PAR-STR submission pipelines.
- **Current state.** Per the register — RMCP, KYC/CDD/EDD Policy, PEP Policy, AML/CFT Policy, Sanctions Policy, FATCA/CRS Policy, Anti-Bribery & Corruption Policy all show `IN FORCE` at the policy layer. Continuous-KYC two-tier (RAS B3) and sanctions zero-appetite (RAS B4) are CEO-approved per the RAS. **Substrate side: not built.** No transaction-monitoring engine, no live sanctions-screening pipeline, no CTR/PAR/STR file-emit, no FATCA/CRS XML generator, no goAML lodgment harness, no MLRO investigation set with cryptographic-tipping-off enforcement. Mira (Compliance / RegTech engineer under Zara) has authored multiple design briefs; the substantive *engineering* is gap-state.
- **Lead time to readiness.** Substantive multi-tick effort. The substrate is foundational: it is the second-largest engineering build after the markets-foundation substrate. Six to eight slices of work at the Targeted budget, distributed Mira + Atlas (substrate hooks) + Iris (POPIA cross-reference for personal-information handling).
- **Why-now.** **The most regulator-attended frontier in SA at present.** SA is on the FATF grey-list (per `ORG-FC-21` — track-and-respond); SARB / FIC / FSCA are unusually active on AML/CFT supervision; PA is asking sharp licence-application questions on RMCP substance + transaction-monitoring engineering. **Compliance-gap-already-running:** MLRO designation has been a thin-human-layer item since `D-THIN-HUMAN-LAYER-MINIMUM` (Domain O, v1.7); Zara holds the role interim and an event-substrate-side MLRO substrate is overdue. **Unblocks downstream:** Niko (Sales / CRM engineer) — paused per build-phase; activates at licence-day — depends on the CDD/EDD substrate being ready; Imani's clause library + counterparty-onboarding work feeds in; the institutional client-master design ([`Owner Inbox/2026-05-06_client-master-and-continuous-kyc.md`](2026-05-06_client-master-and-continuous-kyc.md)) is upstream of this. **Long lead time.** Sanctions-list ingestion, transaction-monitoring rule-tuning, and a credible RMCP substrate take time the bank does not have if it waits for licence-day.
- **Why-wait.** Live transaction-monitoring requires *clients* to monitor — institutional client onboarding does not start until licence-day. There is a thin argument for sequencing the substrate after the Niko-side onboarding pipeline. We judge this argument net-loses because the RMCP attestation the PA reads at licence-application is *substantive* — the bank must be able to demonstrate the substrate works against simulated transaction flows before a single real transaction lands.

### Candidate S4 — Operational resilience programme (Joint Standard 2 of 2024)

- **Binding instruments.** **Joint Standard 2 of 2024 on Operational Resilience** (PA + FSCA) `[citation: TBC — exact JS 2 of 2024 reference; the standard sits adjacent to JS 1 of 2024 cyber on the Joint-Standards stack and addresses Important Business Service identification, impact tolerances, severe-but-plausible scenario testing, mapping]`; BCBS *Principles for Operational Resilience* (March 2021); BCBS *Sound Practices for the Management of Operational Risk* (rev. 2021) — *Regulations Relating to Banks* Reg 39 incorporates this; SARB **Directive 3 of 2018** (Cloud Computing) `[citation: TBC]`.
- **Register rows cited.** [`ORG-PR-17`](../Regulations/_obligations-register.md#L127) (BCBS Op Risk rev. 2021), [`ORG-PR-18`](../Regulations/_obligations-register.md#L128) (BCBS Op Resilience IBSes + impact tolerances), [`ORG-PR-24`](../Regulations/_obligations-register.md#L133) (Reg 39 op-risk umbrella), [`ORG-CY-08`](../Regulations/_obligations-register.md#L213) (BCBS Op Resilience IBSes — duplicate citation in cyber domain), [`ORG-CY-05`](../Regulations/_obligations-register.md#L210) (rehearsed cyber runbooks — adjacent), [`ORG-CY-06`](../Regulations/_obligations-register.md#L211) (Directive 3 of 2018 cloud), [`ORG-CY-07`](../Regulations/_obligations-register.md#L212) (material outsourcing notification).
- **Bind status.** **CORPORATE-bind** on the operational-resilience policy and BCBS-2021 alignment; **LICENCE-bind** on the JS 2 of 2024 attestable programme + IBS register + impact tolerance set + tested-scenario evidence; consolidated-basis under D-REGULATORY-PERIMETER.
- **Current state.** Operational Resilience Policy + Operational Risk Policy IN FORCE. IBS-identification + impact-tolerance-setting + scenario-testing — partial. The *substrate* — Devon (COO, governance) + Atlas (Core banking platform architect) + Senna (Security engineer) co-owned — overlaps materially with the cyber-resilience substrate (S2): both standards expect tested incident response, mapped third-party dependencies, and demonstrated recovery within tolerance. Standalone JS 2 of 2024 attestation NOT drafted.
- **Lead time to readiness.** Medium-light effort *if* sequenced after S2 (JS 1 cyber) and S5 (capital management) land — the IBS register and impact-tolerance set draw heavily from the data those workstreams produce. ~4-5 slices.
- **Why-now.** JS 2 of 2024 is the youngest of the three Joint Standards; PA expectations on *attestable* operational resilience are still being calibrated. Pre-licence-day demonstration of IBS + impact-tolerance + tested scenarios is a licence-application strengthener.
- **Why-wait.** JS 2 of 2024 substantively depends on the cyber-resilience programme (S2) for incident-response evidence and on the markets-substrate (M-phases) for IBS identification at the Important-Business-Service granularity. Sequencing it *after* S2 and after the markets-substrate is materially cheaper. **We defer it to next-tranche** — see §5.

### Candidate S5 — Capital management policy + ICAAP linkage + first BA returns dry-run

- **Binding instruments.** Banks Act 94 of 1990 + *Regulations Relating to Banks* — Reg 38 (capital adequacy + RWA computation); BCBS *Basel III/IV*; SARB **BA 100-series returns** specification `[citation: TBC — exact BA-form reference]`; BCBS *Basel III leverage ratio framework*; BCBS D295 + D335 (LCR + NSFR) — BA 325 + BA 326.
- **Register rows cited.** Subset of S1 — particularly [`ORG-PR-01`](../Regulations/_obligations-register.md#L111), [`ORG-PR-04`](../Regulations/_obligations-register.md#L114), [`ORG-PR-05`](../Regulations/_obligations-register.md#L115), [`ORG-PR-06`](../Regulations/_obligations-register.md#L116), [`ORG-PR-07`](../Regulations/_obligations-register.md#L117), [`ORG-PR-13`](../Regulations/_obligations-register.md#L123), [`ORG-PR-14`](../Regulations/_obligations-register.md#L124).
- **Bind status.** **CORPORATE-bind** on Capital Management Policy (IN FORCE per `ORG-PR-01`); **LICENCE-bind** on the first ICAAP submission + first BA-returns dry-run; **COMMENCEMENT-bind** on the ongoing monthly BA-100-series + BA-300-series filings.
- **Current state.** Capital Management Policy IN FORCE. Bea (Accounting & financial reporting engineer under Camille (CFO, governance)) has authored the reporting-capability spec at [`Owner Inbox/2026-05-06_reporting-capability-spec.md`](2026-05-06_reporting-capability-spec.md) — substantive work but pre-engineering. **No BA-form generator**, no RWA engine producing actual numbers from the event substrate, no first-dry-run.
- **Lead time to readiness.** Heavy substrate-side work (the BA-form generator pipeline + the RWA engine). Both partially overlap with S1 — a credible ICAAP cites the BA-form numbers and the RWA-engine outputs; an ICAAP without those is narrative-only. We see S5 as a *substrate dependency* of S1 rather than a separate workstream. **Folded into S1** as the data-side slice; not weighed as a separate top-3 candidate.
- **Why-now.** Foldable into S1.
- **Why-wait.** N/A — folded.

### Candidate Z6 (added) — Markets-Conduct / FAIS / ODP bundle on `Hoz Securities Limited`

- **Binding instruments.** **FAIS Act 37 of 2002** + General Code of Conduct + Determination of Fit and Proper Requirements 2017; **Financial Markets Act 19 of 2012** s.6A (ODP authorisation) + s.109 (penalty for unauthorised ODP); **FSCA Conduct Standards 1, 2, 3 of 2018** (ODP capital + risk-management; trade reporting; market conduct); **Joint Standard 2 of 2020** (margin requirements for OTC derivative transactions, as amended 9 June 2023); **Joint Notice 2 of 2024** (margin information reporting); JSE Equities Rules + JSE Listings Requirements + JSE Debt Listing Rules; ISDA Master Agreement + ISDA CSA (NY Law / English Law); ICMA GMRA 2011 SA Schedule.
- **Register rows cited.** Domain M en bloc — [`ORG-FMA-001`](../Regulations/_obligations-register.md#L344) (FMA s.6A ODP authorisation), [`ORG-FMA-002`](../Regulations/_obligations-register.md#L345) (FMA s.109 penalty), [`ORG-FMA-003`](../Regulations/_obligations-register.md#L346) (Strate trade reporting; live by 1 March 2027), [`ORG-CS1-001..004`](../Regulations/_obligations-register.md#L347) (CS 1/2018), [`ORG-CS2-001`](../Regulations/_obligations-register.md#L351) (CS 2/2018 trade reporting), [`ORG-CS3-001..009`](../Regulations/_obligations-register.md#L352) (CS 3/2018), [`ORG-JS2-001..006`](../Regulations/_obligations-register.md#L361) (JS 2/2020 margin), [`ORG-JN2-2024`](../Regulations/_obligations-register.md#L367) (JN 2/2024 Umoja), [`ORG-EXCON-ODP-001`](../Regulations/_obligations-register.md#L368) (Excon-ODP non-resident); plus Domain C — [`ORG-CD-01..10`](../Regulations/_obligations-register.md#L169) (FAIS / TCF), Domain J — [`ORG-MK-01..16`](../Regulations/_obligations-register.md#L302) (markets); plus Domain P — [`ORG-FAIS-*`](../Regulations/_obligations-register.md#L448) (FAIS Posture A FSP licence — D-FSP-LICENCE-NECESSITY 2026-05-09).
- **Bind status.** **LICENCE-bind** on the FSP licence + ODP authorisation packages (separately licensed from the bank); **COMMENCEMENT-bind** on the trade-reporting + margin pipelines. Domain M's ODP-authorisation package is its own readiness gate, distinct from the bank-side prudential package.
- **Current state.** Most Domain M rows are `DRAFTING` or `IN FLIGHT`; Domain P (FAIS) is `corporate-bind` per D-FSP-LICENCE-NECESSITY; Domain J markets foundation is partially built (markets-schema-foundation under D-MARKETS-SCHEMA-FOUNDATION; product-construction substrate slices 1-3 landing per D-PRODUCT-CONSTRUCTION-SUBSTRATE).
- **Lead time to readiness.** Substantive — ten to fifteen slices distributed across Saskia (Head of Global Markets, governance) + Imani (Legal-as-code engineer) + Kai (Trading systems engineer) + Mira + Anya (Data / analytics engineer) + Tomas (Operations & payments engineer) + Ravi (Treasury / ALM engineer).
- **Why-now.** ODP authorisation gates the OTC IRD strand of the strategic foundation (`project_strategic_foundation.md`). 1 March 2027 is the regulator's published live-date for the 169-element trade-reporting schema (`ORG-FMA-003`) — material work to ready a Strate trade-repository submission pipeline.
- **Why-wait.** **Substantive substrate dependency on M-phases.** The FSCA/FMA/JS 2 of 2020 stack lives downstream of the markets-foundation substrate (M1-M5 per the M-phase plan). Authoring the readiness package for `Hoz Securities Limited` *now* re-derives work the M-phase substrate is already doing. The bank-side licence-application package (S1 + S2 + S3) is the more pressing gate; the `Hoz Securities Limited` package can sequence after substantial M-phase substrate lands. **We defer it to next-tranche** — see §5.

### Candidate H7 (added) — Recovery-and-Resolution preparation pack (Banks Act § 60+ + FSB Key Attributes)

- **Binding instruments.** Banks Act 94 of 1990 §§ 60-72 (recovery framework + designated institution + curatorship trigger); **Financial Sector Laws Amendment Act 23 of 2021** (resolution authority — Corporation for Deposit Insurance; resolution planning powers); FSB *Key Attributes of Effective Resolution Regimes for Financial Institutions* (Oct 2014); BCBS *Standards for the supervision of banks Resolvability* `[citation: TBC]`.
- **Register rows cited.** Subset of S1 — particularly [`ORG-PR-12`](../Regulations/_obligations-register.md#L122) (stress + reverse-stress), [`ORG-PR-15`](../Regulations/_obligations-register.md#L125) (CFP); plus the consolidated-basis recovery row reclassified from `ORG-GRP-*` → `ORG-BNK-*-CONS` per D-REGULATORY-PERIMETER (PR #85, 2026-05-09).
- **Bind status.** **LICENCE-bind** on the *recovery plan* (PA expects at licence-application; FSLAA-2021 resolution planning is post-licence-day); resolution planning is a regulator-led exercise post-licence-day with the bank as input.
- **Current state.** No standalone recovery plan drafted. Underlying CFP IN FORCE at the policy layer. Resolution planning out-of-scope until licence-day (regulator-driven).
- **Lead time to readiness.** Folds naturally into S1 (recovery plan is the third document in the ICAAP/ILAAP/Recovery triplet). **Not weighed as separate** — the S1 framing already captures the recovery-plan dimension.

---

### Triage summary table

| # | Candidate | Bind | Current state | Lead time | Net judgement |
|---|---|---|---|---|---|
| S1 | ICAAP / ILAAP / Recovery (consolidated) | LICENCE | Policies IN FORCE; integrated docs not drafted | High (multi-tick) | **TOP-3** — gates licence-application directly |
| S2 | JS 1 of 2024 cyber-resilience programme | CORPORATE + LICENCE | Policies IN FORCE; attestable programme not drafted | Medium (5-7 slices) | **TOP-3** — long-running supervision + consolidated 2-for-1 with `Hoz Securities Limited` |
| S3 | AML/CFT / RMCP / FIC Act | CORPORATE + LICENCE + COMMENCEMENT | Policies IN FORCE; substrate is gap | High (6-8 slices) | **TOP-3** — most regulator-attended; long lead; unblocks Niko + Imani |
| S4 | JS 2 of 2024 operational resilience | CORPORATE + LICENCE | Policies IN FORCE; partial substrate | Medium (4-5 slices) | **DEFER** — depends on S2 + markets substrate |
| S5 | Capital mgmt + BA returns dry-run | CORPORATE + LICENCE + COMMENCEMENT | Policy IN FORCE; substrate is gap | Heavy substrate | **FOLD INTO S1** — substrate dependency of ICAAP |
| Z6 | Markets-Conduct / FAIS / ODP on `Hoz Securities Limited` | LICENCE + COMMENCEMENT | DRAFTING / IN FLIGHT; M-phase substrate work in flight | Substantive (10-15 slices) | **DEFER** — depends on M-phase substrate; separate licensing track |
| H7 | Recovery-and-Resolution prep pack | LICENCE | Not drafted; CFP IN FORCE | Folds into S1 | **FOLD INTO S1** — recovery plan is the third doc |

---

## 2. Recommended top-3

After triage, we recommend **S3 (AML/CFT-RMCP) + S1 (ICAAP/ILAAP/Recovery, with S5 + H7 folded in) + S2 (JS 1 of 2024 cyber-resilience)**.

### Selection rationale

**S3 — AML/CFT / RMCP / FIC Act compliance** is the most pressing. Three reasons. (1) **The longest lead time.** A credible RMCP requires a transaction-monitoring substrate, sanctions-screening pipeline, CDD/EDD substrate, CTR/PAR/STR file-emit, FATCA/CRS XML generator, and the goAML lodgment harness — none of which exist today. Each is engineering-substantive, not narrative. The bank cannot demonstrate the substrate works against simulated transaction flows in a one-tick burst. (2) **The most active regulator front.** SA's FATF grey-list status (`ORG-FC-21`) makes AML/CFT supervision the sharpest end of the licence-application reading; the PA, FIC, and FSCA have all hardened expectations on RMCP substance and engineering. (3) **It unblocks the most other personas.** Niko's lifecycle, Imani's counterparty onboarding, Mira's continuous-curatorship of Domain B, Iris's cross-reference into POPIA — all wait on the same substrate. Building it first removes a downstream bottleneck.

**S1 — ICAAP / ILAAP / Recovery Plan (with S5 + H7 folded in)** is the second priority. Two reasons. (1) **The PA does not issue a banking licence without these documents.** They are the Pillar-2 / liquidity-adequacy / resolvability triplet — non-negotiable. (2) **They unblock the standing RAS B2 calibration.** Helena and Camille hold a CEO ask to ratify the +1.5pp CET1 management buffer; the ICAAP build is the natural moment, and the work is on Helena's deferred-decision desk already. By folding S5 (Capital Mgmt + BA-returns dry-run) and H7 (Recovery prep) into the same workstream, we get a single integrated owner pair (Helena + Camille) rather than three disjoint workstreams competing for the same data substrate.

**S2 — JS 1 of 2024 cyber-resilience programme** is the third priority. Three reasons. (1) **Two-for-one under D-REGULATORY-PERIMETER.** The consolidated reading means the same programme covers `Hoz Bank Limited` *and* `Hoz Securities Limited` — high engineering leverage. (2) **JS 1 of 2024 is the most actively-supervised cyber standard in SA at present.** PA expectations have hardened; this is licence-application table-stakes. (3) **Threat-modelling is most cheaply integrated *during* substrate build.** Senna + Rashida + Devon are already producing substrate-side cyber gates (HSM key envelope on the event store; signed-event chain; runtime threat-model gate at the SDLC layer). Authoring the JS 1 attestable programme *now* binds those substrate-side gates to the standard's clause-set rather than letting them drift into post-hoc reconciliation.

### Sequencing (parallel vs serial)

These three workstreams sequence **largely in parallel**, with cross-dependencies named per slice in §3. Specifically:

- **W1 (S3)** + **W2 (S1)** are independent at Slice-1 level — Mira can author the RMCP-spec slice while Bea + Rohan author the ICAAP-data-substrate slice. They re-converge at Slice-3 (W1's CDD/EDD substrate cites the same client-master substrate W2's RWA engine cites; a thin coordination point).
- **W3 (S2)** runs largely independently — Senna + Rashida + Devon already own the substrate-side cyber work. The W3 attestable-programme document runs alongside without blocking.
- **All three workstreams share a substrate dependency on D-RMS-PHASE-1 Slice 2** (event-type registration — currently in flight by Owen+Atlas). W1 emits AML events; W2 emits stress-test-run events; W3 emits cyber-incident events. None of the Slice-1s blocks on Phase-1 Slice 2; later slices will.

### What the licence-application package looks like with these three substantively built

The licence-application package is the readable bundle the PA reads at licence-application. With the recommended top-3:

- **AML/CFT-RMCP attestation** — RMCP document + transaction-monitoring engineering + sanctions-screening + CDD/EDD substrate + CTR/PAR/STR pipelines + FATCA/CRS generators + MLRO designation + tipping-off-cryptographic-enforcement evidence.
- **Capital + Liquidity + Recovery triplet** — substantive ICAAP (Pillar 2 narrative + RWA computation + stress-projections) + substantive ILAAP (LCR/NSFR + intraday + CFP rehearsal evidence) + substantive Recovery Plan (early-warning indicators + recovery options + governance trigger framework).
- **Cyber-resilience attestable programme** — JS 1 of 2024 programme document + threat-model artefact register + tested-incident-response evidence + supplier-cyber-risk attestation pipeline + HSM key-governance evidence + consolidated-programme reading covering `Hoz Securities Limited`.

What's *not* in the package and is OK to be missing: the FAIS/ODP package for `Hoz Securities Limited` (separately licensed; can sequence after); the JS 2 of 2024 operational-resilience attestable programme (depends on substrate-side IBS-identification — sequence after S2 + markets substrate); commencement-bind items (FinSurv per-category, Strate trade-reporting, customer complaints — these wait for licence-day per `project_rules_bind_at_commencement.md`).

---

## 3. Slice plans — three workstreams

Each workstream's slice plan models the D-EVENT-STORE-SCALING (eight-slice) and D-RMS-PHASE-1 (five-slice) precedents. Each slice carries: name + scope · owner (engineering + governance) · effort estimate (sessions) · exit criterion (the recon test or capability that proves the slice is done) · dependencies. **Slices 1-3 of each workstream are pre-M2 buildable under the Targeted budget** so dispatch can begin immediately on CEO approval per the no-pause rule.

### Workstream W1 — AML/CFT-RMCP (S3)

**Owner pair.** Zara (CCO, governance — also acting MLRO + FIC Compliance Officer interim) governance · Mira (Compliance / RegTech engineer under Zara) engineering. Iris (Information Officer, governance) cross-reference for POPIA-linked CDD personal-information handling. Atlas (Core banking platform architect under Devon) substrate hooks.

#### W1 Slice 1 — RMCP attestable specification (pre-M2)

- **Scope.** A single readable RMCP document mapped to FIC s.42 + FATF Rec. 1 + FIC GN 7, citing the existing policy stack (KYC/CDD/EDD; PEP; AML/CFT; Sanctions; FATCA/CRS) and naming the substrate-side engineering each policy depends on. The document's section-set tracks FIC s.42(2)(a)-(j) one-for-one.
- **Owner.** Mira (engineering — author) · Zara (governance — review + approve). Cross-review by Iris for POPIA cross-references.
- **Effort.** ~1.5 sessions at Targeted budget.
- **Exit criterion.** RMCP document lands at `Owner Inbox/2026-XX-XX_zara-mira_rmcp-attestable-spec.md` with frontmatter + the FIC s.42(2)(a)-(j) section-set + a "substrate dependencies" table naming the Slice-2 + Slice-3 substrates by name. Vera (Internal audit / continuous-assurance engineer) recon `recon:rmcp-section-coverage` (planned) asserts every FIC s.42 sub-clause has a section.
- **Dependencies.** None — pre-M2 buildable on the existing policy stack.

#### W1 Slice 2 — Sanctions-screening pipeline + RAS B4 zero-appetite enforcement (pre-M2)

- **Scope.** Live sanctions-screening engine ingesting UN SC, OFAC SDN, EU consolidated, UK HMT, POCDATARA / DTI lists; emits `SanctionsScreeningCompleted` events per check; enforces RAS B4 (zero-appetite — block all true-positive matches pre-execution); production-override only by signed MLRO event with register-linked exception (per `ORG-FC-13`).
- **Owner.** Mira (engineering) · Zara (governance — MLRO approval pathway).
- **Effort.** ~2 sessions at Targeted budget.
- **Exit criterion.** `SanctionsListIngested` + `SanctionsScreeningCompleted` + `SanctionsTruePositiveBlocked` + `MlroSanctionsOverrideApproved` event types registered in `prototype/platform/event-store/registry.ts` per `D-RMS-PHASE-1` event-registration discipline; recon `recon:sanctions-zero-appetite` (planned) asserts zero `OrderApproved`-after-`SanctionsTruePositiveBlocked` without a paired `MlroSanctionsOverrideApproved`. Synthetic-test fixture covers all five list-sources.
- **Dependencies.** D-RMS-PHASE-1 Slice 2 (event-type registration in flight by Owen+Atlas) — not blocking for the typed-event design but desirable for the registration discipline.

#### W1 Slice 3 — CDD/EDD substrate + continuous-KYC two-tier (pre-M2)

- **Scope.** Client-master substrate for institutional counterparties (per the institutional-client-master design at [`Owner Inbox/2026-05-06_client-master-and-continuous-kyc.md`](2026-05-06_client-master-and-continuous-kyc.md)); CDD-on-onboarding event + EDD-on-trigger event + beneficial-ownership recursive resolution to natural persons (`ORG-FC-04`); RAS B3 continuous-KYC two-tier (`ORG-FC-18` — high-confidence triggers → restrict immediately; medium-confidence → restrict on review); RBA periodicity per `ORG-FC-19` (high-risk → annual; medium → 24mo; low → 36mo).
- **Owner.** Mira (engineering) · Zara (governance) · Imani (Legal-as-code engineer — clause-side for trustee / ben-owner resolution) · Iris (POPIA cross-reference).
- **Effort.** ~3 sessions at Targeted budget.
- **Exit criterion.** `ClientCddCompleted` + `ClientEddTriggered` + `ClientEddCompleted` + `ClientBeneficialOwnerResolved` + `ClientKycRestricted` event types live; client-master projection emits per-client risk-rating; recon `recon:kyc-periodicity-coverage` (planned) asserts every active client has a CDD-completion within the per-rating periodicity window.
- **Dependencies.** Slice 2 (sanctions-screening called inline at CDD-completion); Imani's clause-library work for trustee / beneficial-owner resolution patterns.

#### W1 Slice 4 — Transaction-monitoring engine + STR/CTR/PAR pipeline (M3)

- **Scope.** Live transaction-monitoring against typed `Transaction*` events; rule engine for typology detection; STR generation per `ORG-FC-09`; CTR generation per `ORG-FC-07` (cash transactions ≥R24,999.99); PAR generation per `ORG-FC-08`; tipping-off cryptographic enforcement (`ORG-FC-10` — MLRO-investigation-set encryption boundary).
- **Owner.** Mira (engineering) · Zara (governance — MLRO).
- **Effort.** ~3 sessions at Targeted budget.
- **Exit criterion.** `TransactionMonitored` + `StrFiled` + `CtrFiled` + `ParFiled` + `MlroInvestigationOpened` + `MlroInvestigationDecided` event types live; encryption-boundary recon asserts STR-stream events are MLRO-key-encrypted. Tipping-off recon (planned) asserts no non-MLRO agent reads MLRO-investigation-set events.
- **Dependencies.** Slice 3 (client-master); transaction-substrate (markets M-phase).

#### W1 Slice 5 — FATCA + CRS XML generators + SARS-submission harness (M3)

- **Scope.** FATCA XML + CRS XML generators per `ORG-FC-15` + `ORG-FC-16`; SARS-submission harness; annual-cycle scheduling.
- **Owner.** Mira (engineering) + Yael (Tax engineer under Camille — annual-cycle co-owner) · Zara (governance).
- **Effort.** ~2 sessions at Targeted budget.
- **Exit criterion.** Synthetic-fixture FATCA + CRS XML files schema-validate against IRS / OECD published XSDs; recon `recon:fatca-crs-coverage` (planned) asserts every reportable account in the client-master has a current-year XML row.
- **Dependencies.** Slice 3 (client-master).

#### W1 Slice 6 — MLRO designation lodgment + goAML / RegOnline registration (M3)

- **Scope.** MLRO designation event lodged with FIC; goAML registration; RegOnline integration for STR/CTR/PAR submission.
- **Owner.** Zara (governance — interim MLRO Marc holds the formal designation under `D-THIN-HUMAN-LAYER-MINIMUM`); Mira (engineering harness).
- **Effort.** ~1 session.
- **Exit criterion.** Designation lodgment evidence in document substrate; goAML / RegOnline submission harness lands at least one synthetic-fixture file.
- **Dependencies.** Slice 4 (STR/CTR/PAR pipeline).

#### W1 Slice 7 — Sade AgentOps overlap — agent fit-and-proper analogue for AML controls (post-M3)

- **Scope.** AML-specific agent-fit-and-proper analogue per `D-THIN-HUMAN-LAYER-MINIMUM` and the build-phase reshape of Sade (HR systems engineer under Devon → AgentOps reshape).
- **Owner.** Sade · Zara · Devon.
- **Effort.** ~1 session.
- **Exit criterion.** Agent-FAP attestation ingested into AgentOps register for every AML-touching agent (Mira, Zara, Iris).
- **Dependencies.** Sade's AgentOps reshape lands.

#### W1 Slice 8 — Pre-licence dry-run against simulated transaction set (pre-licence-day)

- **Scope.** End-to-end dry-run of the AML/CFT substrate against a synthetic 1-year transaction fixture; produces a readable demonstration package the PA reads at licence-application.
- **Owner.** Mira + Vera (assurance) · Zara.
- **Effort.** ~2 sessions.
- **Exit criterion.** Dry-run package lands at `Owner Inbox/.../w1-slice-8-aml-pre-licence-dry-run.md`; Vera assurance-recon green.
- **Dependencies.** Slices 1-7 substantively in.

---

### Workstream W2 — ICAAP / ILAAP / Recovery (S1 + S5 folded + H7 folded)

**Owner pair.** Helena (CRO, governance) governance lead on ICAAP narrative + Recovery Plan + RAS B2 calibration · Camille (CFO, governance) governance lead on Capital Management Policy + ILAAP + BA returns. Bea (Accounting & financial reporting engineer under Camille) engineering on the BA-form generator + RWA engine. Rohan (Risk engineer under Helena) engineering on stress-projection engine + Pillar-2 narrative-data. Eitan (Treasurer, governance) on liquidity-side ILAAP + intraday + CFP. Ravi (Treasury / ALM engineer under Eitan) substrate-side liquidity. Nadia (Independent-validation engineer under Helena, peer-in-second-line) for model-risk validation of the stress engine.

#### W2 Slice 1 — ICAAP / ILAAP / Recovery framework spec (pre-M2)

- **Scope.** Single readable framework document specifying: the three-document scope (ICAAP, ILAAP, Recovery); the consolidated-basis reading per D-REGULATORY-PERIMETER; the RAS B2 ratify-pathway (the +1.5pp CET1 management buffer); the data-substrate dependencies (RWA engine, stress-projection engine, BA-form generator, intraday-liquidity feed, CFP rehearsal harness); the governance pathway (Helena chairs ICAAP / ILAAP narrative; Camille chairs Capital + BA returns; Eitan chairs ILAAP liquidity-side; Owen secretarial on Recovery-Plan governance triggers). Cites Banks Act §§ 60-72 + Reg 38 + BCBS Basel III/IV + BCBS 144 + BCBS D295 + BCBS D335 + FSB Key Attributes + Reg 39 op-risk (cross-reference Reg 39 cross-link to NPA per `ORG-PR-25`).
- **Owner.** Helena (author) + Camille (co-author) · Helena governance lead.
- **Effort.** ~1.5 sessions at Targeted budget.
- **Exit criterion.** Framework doc lands at `Owner Inbox/2026-XX-XX_helena-camille_icaap-ilaap-recovery-framework.md`. Recon `recon:icaap-section-coverage` (planned) asserts every Banks Act § 60+ + Reg 38 sub-clause has a section.
- **Dependencies.** None — pre-M2 buildable.

#### W2 Slice 2 — RAS B2 calibration + CET1 management buffer ratification (pre-M2)

- **Scope.** Resolve the deferred RAS B2 (CET1 management buffer ≥ +1.5pp above PA minima + Pillar 2A + capital conservation buffer) per `ORG-PR-04`. Helena + Rohan author the calibration brief; the Targeted-budget engineering work computes the buffer against synthetic Pillar-1 ratios from Bea's reporting-capability-spec + Rohan's stress-projection engine.
- **Owner.** Helena (governance) · Rohan + Bea (engineering).
- **Effort.** ~1.5 sessions.
- **Exit criterion.** RAS B2 lines lifted from `PARTIAL (B2 deferred)` → `IN FORCE` per `ORG-PR-04`; RAS-event `RasLineCalibrated { lineId: "B2", calibrationCitation: "..." }` emitted; recon `recon:ras-b2-calibration-coverage` green.
- **Dependencies.** Slice 1.

#### W2 Slice 3 — RWA engine + BA-form generator (pre-M2)

- **Scope.** Per [`Owner Inbox/2026-05-06_reporting-capability-spec.md`](2026-05-06_reporting-capability-spec.md). RWA engine producing actual numbers from the event substrate (credit, market, operational RWAs); BA-form generator pipeline emitting BA 100-series + BA 300-series + BA 325 + BA 326 forms; first dry-run on synthetic data.
- **Owner.** Bea (engineering) · Camille (governance).
- **Effort.** ~3 sessions.
- **Exit criterion.** RWA engine produces BA-700-equivalent outputs on synthetic fixture; BA-form generator produces XML / CSV in the published SARB schema; recon `recon:ba-form-schema-validation` (planned) green.
- **Dependencies.** Markets-substrate (M-phase) for trading-book RWA inputs.

#### W2 Slice 4 — Stress-projection engine + ICAAP narrative-data (M3)

- **Scope.** Stress-projection engine (CET1, leverage, LCR, NSFR projected over 3-year horizon under base + adverse + severely-adverse + reverse-stress scenarios per `ORG-PR-12`); narrative-data feed for ICAAP authoring; Pillar-2 add-on computation.
- **Owner.** Rohan (engineering) · Helena (governance) · Nadia (independent validation per RAS B7 model-risk discipline).
- **Effort.** ~3 sessions.
- **Exit criterion.** Stress-engine produces 3-year projected ratios under all four scenarios; Nadia's validation report lands; Pillar-2 add-on computed.
- **Dependencies.** Slice 3 (RWA engine inputs).

#### W2 Slice 5 — ILAAP liquidity-side substrate (intraday + CFP rehearsal) (M3)

- **Scope.** Intraday-liquidity feed per `ORG-PR-08` (BCBS 248 monitoring); CFP rehearsal harness per `ORG-PR-15` (annual rehearsal expectation); LCR / NSFR daily computation feed for ILAAP narrative.
- **Owner.** Ravi (engineering) · Eitan (governance) · Helena (review).
- **Effort.** ~2 sessions.
- **Exit criterion.** Intraday-liquidity event stream live; CFP rehearsal event-pattern emits `CfpRehearsalCompleted`; LCR / NSFR daily projection produced.
- **Dependencies.** Markets-substrate + Treasury-substrate.

#### W2 Slice 6 — Recovery Plan authoring (early-warning + options + governance triggers) (M3-M4)

- **Scope.** Recovery plan per Banks Act §§ 60-72 + FSB Key Attributes; early-warning indicators tied to RAS lines; recovery options inventory; governance-trigger framework (BRC chair → CEO escalation → recovery-plan-activation).
- **Owner.** Helena (governance) · Owen (governance — secretarial / governance-trigger framework) · Rohan (engineering for indicator-monitoring).
- **Effort.** ~2 sessions.
- **Exit criterion.** Recovery plan document lands; indicator-monitoring substrate emits `RecoveryEarlyWarningTriggered` events; CFO + CRO + CoSec sign-off.
- **Dependencies.** Slices 4 + 5.

#### W2 Slice 7 — First end-to-end ICAAP / ILAAP / Recovery dry-run (pre-licence-day)

- **Scope.** End-to-end dry-run producing the three documents from synthetic data + the RWA engine + the stress engine + the liquidity substrate; readable submission package.
- **Owner.** Helena + Camille + Eitan + Rohan + Bea + Nadia · Vera assurance.
- **Effort.** ~2 sessions.
- **Exit criterion.** Three-document dry-run package lands; Vera assurance recon green; auditor (when engaged at licence-application moment) sign-off pathway opened.
- **Dependencies.** Slices 1-6.

---

### Workstream W3 — JS 1 of 2024 cyber-resilience programme (S2)

**Owner pair.** Rashida (CISO, governance) governance lead on the attestable programme + named accountable executive (`ORG-CY-02`) · Senna (Security engineer under Rashida) engineering on threat-modelling, runbook rehearsal evidence, supplier-cyber-risk pipeline. Devon (COO, governance) on cloud-residency / outsourcing dimension (Directive 3 of 2018 — `ORG-CY-06` + `ORG-CY-07`). Iris (IO) on POPIA s.19-22 cross-reference + breach-notification pathway (`ORG-PR(IV)-07`). Atlas (Core banking platform architect) for the substrate-side cyber gates (HSM key envelope on event store; signed-event chain).

#### W3 Slice 1 — JS 1 of 2024 attestable programme spec (pre-M2)

- **Scope.** Single readable JS 1 of 2024 attestable programme document mapped to every JS 1 clause `[citation: TBC — exact JS 1 clause numbering on responsible person, threat-modelling, incident reporting, group-vs-entity programme, third-party assurance]`. Cites the existing Cyber Resilience Policy + Information Security Policy + Incident Response Policy stack (all IN FORCE per Domain G); names the substrate-side gates each clause depends on; integrates the consolidated-basis reading per D-REGULATORY-PERIMETER (covers `Hoz Bank Limited` + `Hoz Securities Limited` under one programme — `ORG-BNK-CYBER-CONS`).
- **Owner.** Rashida (author) · Senna (engineering review) · Iris (POPIA cross-reference) · Devon (cloud / outsourcing review).
- **Effort.** ~1.5 sessions at Targeted budget.
- **Exit criterion.** Programme doc lands at `Owner Inbox/2026-XX-XX_rashida_js1-2024-cyber-resilience-attestable-programme.md`. Recon `recon:js1-clause-coverage` (planned) asserts every JS 1 clause has a section.
- **Dependencies.** None — pre-M2 buildable.

#### W3 Slice 2 — Threat-model artefact register (pre-M2)

- **Scope.** Typed event substrate for threat-modelling artefacts per `ORG-CY-03` + `ORG-CY-12` (NIST SP 800-218 SSDF Protect-the-Software practice group); every system-design artefact in the bank's substrate has a paired threat-model artefact (existing example: [`Owner Inbox/2026-05-07_senna_neon-event-store-threat-model.md`](2026-05-07_senna_neon-event-store-threat-model.md)); register projection over the threat-model events.
- **Owner.** Senna (engineering) · Rashida (governance).
- **Effort.** ~2 sessions at Targeted budget.
- **Exit criterion.** `ThreatModelAuthored` + `ThreatModelReviewed` + `ThreatModelMitigated` event types live; threat-model register projection lists all design artefacts paired with their threat-model artefacts; recon `recon:threat-model-coverage` (planned) asserts every spec-level design has a threat-model.
- **Dependencies.** D-RMS-PHASE-1 Slice 2 (event-type registration).

#### W3 Slice 3 — Incident-event substrate + RAS B6 four-tier severity + regulator-notification harness (pre-M2)

- **Scope.** `CyberIncidentDetected` + `CyberIncidentClassified` + `CyberIncidentEscalated` + `CyberIncidentResolved` event substrate; RAS B6 four-tier severity (T1 / T2 / T3 / T4 per `ORG-CY-11`); regulator-notification harness (PA + FSCA per `ORG-CY-04`; Information Regulator per POPIA s.22 / `ORG-PR(IV)-07`); auto-escalation at T3 / T4.
- **Owner.** Senna (engineering) · Rashida (governance) · Iris (Information Regulator pathway).
- **Effort.** ~2 sessions at Targeted budget.
- **Exit criterion.** Event-substrate live; severity-tier dispatch produces correct regulator-notification target by tier; recon `recon:incident-tier-notification-coverage` (planned) asserts every T3 / T4 event has a paired regulator-notification event.
- **Dependencies.** Slice 2 (threat-model register cross-references incident events).

#### W3 Slice 4 — Tested-incident-response evidence + runbook rehearsal harness (M3)

- **Scope.** Runbook rehearsal harness per `ORG-CY-05` (rehearsed incident response); per-runbook synthetic-incident exercise; rehearsal-evidence event-stream; quarterly cadence post-licence-day, monthly pre-licence-day.
- **Owner.** Senna · Devon (operational pathway) · Rashida.
- **Effort.** ~2 sessions.
- **Exit criterion.** `RunbookRehearsed` event-stream populated against per-runbook fixtures; rehearsal-coverage recon green.
- **Dependencies.** Slice 3.

#### W3 Slice 5 — Supplier-cyber-risk attestation pipeline + Directive 3 of 2018 cloud-residency register (M3)

- **Scope.** Per-supplier cyber-risk attestation pipeline; SARB Directive 3 of 2018 cloud-residency register (`ORG-CY-06`); material-outsourcing-notification pipeline (`ORG-CY-07`); third-party-assurance reading required by JS 1 of 2024 `[citation: TBC]`.
- **Owner.** Devon (governance — outsourcing) · Senna (engineering — supplier-cyber-risk).
- **Effort.** ~2 sessions.
- **Exit criterion.** Supplier-cyber-risk register live; cloud-residency register projection emits `CloudResidencyAttested`; material-outsourcing-notification harness lands first synthetic submission.
- **Dependencies.** Slice 1 (programme spec names the supplier dimension).

#### W3 Slice 6 — HSM key-governance integration (M7-M8 cloud-side; substrate-side now)

- **Scope.** HSM key-envelope integration per Principle 4 + Joint Standard 1 of 2024 (group-level cyber programme expects HSM-backed key governance) — local-substrate-side now (envelope spec + key-rotation event-pattern); Azure Managed HSM integration in M7-M8 per the cloud lift.
- **Owner.** Senna (engineering) · Atlas (core platform — event-store HSM envelope hooks; cross-link to D-EVENT-STORE-SCALING Slice 7) · Rashida (governance).
- **Effort.** ~1.5 sessions on the local-substrate side; M7-M8 for the cloud-side.
- **Exit criterion.** Local key-rotation event-pattern emits; encryption-at-rest envelope on event store wired through; the rotation procedure (`Procedures/by-policy/encryption-key-rotation.md` — planned per D-EVENT-STORE-SCALING §8) lands.
- **Dependencies.** D-EVENT-STORE-SCALING Slice 7 (Azure substrate design doc) for the cloud-side; pre-existing for the local-side.

#### W3 Slice 7 — Pre-licence consolidated-programme attestation package (pre-licence-day)

- **Scope.** Readable end-to-end attestation package the PA + FSCA read at licence-application; consolidated-basis reading covers `Hoz Bank Limited` + `Hoz Securities Limited`.
- **Owner.** Rashida + Senna + Devon · Vera assurance.
- **Effort.** ~2 sessions.
- **Exit criterion.** Attestation package lands; Vera assurance recon green.
- **Dependencies.** Slices 1-6.

---

## 4. CEO decision lines (per frontmatter)

Repeated here for explicitness:

- **decision-id.** `D-REGULATORY-READINESS-GATE-PLAN`
- **decision-category.** `medium-term`
- **decision-owner.** Zara (CCO, governance) · Helena (CRO, governance)
- **decision-for-ceo.** Approve the top-3 regulatory-readiness workstreams (W1 AML/CFT-RMCP, W2 ICAAP/ILAAP/Recovery, W3 JS 1 of 2024 cyber-resilience) + Slice 1-3 build authorisation pre-M2.
- **decision-recommendation.** Approve as drafted; routing — each workstream's Slice 1 dispatches immediately on CEO approval per the no-pause rule (CLAUDE.md "Operating procedures").

### Slice-1 dispatch-ready briefs (referenced by approval)

Approval lights three Slice-1 dispatches simultaneously (parallel; no shared-file collision concerns at Slice 1 — separate Owner-Inbox deliverables, separate engineering ownership):

- **W1 Slice 1 brief.** *RMCP attestable specification.* Owner: Mira (engineering, author) · Zara (governance, review). Output: `Owner Inbox/2026-XX-XX_zara-mira_rmcp-attestable-spec.md` per FIC s.42(2)(a)-(j) section-set. Effort: ~1.5 sessions. Exit criterion: §3.W1.Slice 1.
- **W2 Slice 1 brief.** *ICAAP / ILAAP / Recovery framework spec.* Owner: Helena (author) + Camille (co-author). Output: `Owner Inbox/2026-XX-XX_helena-camille_icaap-ilaap-recovery-framework.md`. Effort: ~1.5 sessions. Exit criterion: §3.W2.Slice 1.
- **W3 Slice 1 brief.** *JS 1 of 2024 attestable programme spec.* Owner: Rashida (author) · Senna (engineering review). Output: `Owner Inbox/2026-XX-XX_rashida_js1-2024-cyber-resilience-attestable-programme.md`. Effort: ~1.5 sessions. Exit criterion: §3.W3.Slice 1.

Each brief honours CLAUDE.md "Dispatch discipline": worktree isolation; scaffold-commit at minute 10; push-retry on rejection; citation-gate before push; identity discipline (name + position on first mention).

---

## 5. Out-of-scope items (next-tranche workstreams with named triggers)

The triage in §1 named two further candidates we recommend **deferring**, plus a third we judge **folded** rather than deferred. We file them here as named next-tranche workstreams with proximate triggers per CLAUDE.md "Operating procedures":

### Deferred — W4 Operational Resilience programme (S4 / JS 2 of 2024)

- **Workstream id.** `WS-OPRES-PROGRAMME` (planned).
- **Owner pair.** Devon (COO, governance) · Atlas (engineering) + Senna (engineering — incident-response cross-reference).
- **Trigger.** Fires when **W3 Slice 4 (tested-incident-response evidence)** lands — at that moment the operational-resilience programme can borrow the runbook-rehearsal substrate and the incident-event substrate without re-deriving them. Secondary trigger: the markets-substrate completes M3-M4 (per the M-phase plan), giving Important-Business-Service identification at the markets-product granularity.
- **Sequencing notice.** Sequencing it after W3 + M-phase substrate is materially cheaper. Approving this gate plan implicitly orders it after W3.

### Deferred — W5 Markets-Conduct / FAIS / ODP on `Hoz Securities Limited` (Z6)

- **Workstream id.** `WS-SECURITIES-LICENSING-PACKAGE` (planned).
- **Owner pair.** Saskia (Head of Global Markets, governance) + Imani (Legal-as-code engineer under Devon) · Mira + Anya + Tomas + Ravi engineering.
- **Trigger.** Fires when **the markets-substrate substantially completes M3-M5** (markets-product family + OTC IRD lifecycle + FX product family). Until then, the FSCA / FMA / JS 2 of 2020 stack re-derives in-flight M-phase substrate work.
- **Sequencing notice.** This is a separate licensing track from the bank-side licence-application package. The PA bank licence and the FSCA FSP / FMA ODP authorisations are separate filings; sequencing them serially is consistent with the strategic-foundation reading (`project_strategic_foundation.md`) and the FSP-licence necessity confirmation (`D-FSP-LICENCE-NECESSITY` 2026-05-09).

### Folded — Recovery-and-Resolution prep pack (H7) — already inside W2

The recovery plan is the third document in the W2 ICAAP/ILAAP/Recovery triplet; folded into W2 Slice 6. No separate workstream.

### Folded — Capital management policy + first BA returns dry-run (S5) — already inside W2

The capital management policy is IN FORCE per `ORG-PR-01`; the BA-form generator is W2 Slice 3; the ICAAP linkage is W2 Slice 1 + Slice 4. No separate workstream.

---

## 6. Substrate dependencies per slice

Each workstream has substrate hooks the engineering personas need. We name them here so when the dispatches go out, the engineering personas have clear hooks to use rather than re-discovering them.

### Cross-cutting substrate (all three workstreams)

- **D-RMS-PHASE-1 (Owen + Atlas — co-curators).** Slice 2 (event-type registration; in flight) is the discipline through which W1's AML events, W2's stress-test-run events, and W3's cyber-incident events register. Pre-Slice-2 the design lands; post-Slice-2 the registrations land.
- **D-EVENT-STORE-SCALING (Atlas — substrate).** Slice 1 (retention metadata in `registry.ts`; landed) carries the per-event-type retention horizons the AML / ICAAP / cyber events bind to (e.g. FIC s.22 5-year retention `ORG-FC-05`; Companies-Act 7-year director-decision retention; JSE 7-year trade retention). Slice 2 (snapshot substrate; landed) and Slice 3 (snapshot adoption) accelerate the read-amplification on AML transaction-monitoring + stress-test re-runs.
- **Document substrate (D-RMS-PHASE-1 Slice 1 — landed).** BLAKE3 content-addressed document store at `prototype/data/documents/` is where the W1 RMCP doc, W2 ICAAP / ILAAP / Recovery docs, and W3 JS 1 attestable-programme doc land as document-substrate artefacts referenced by hash from the Decisions register.

### W1 (AML/CFT-RMCP) substrate hooks

- **Slice 1 (RMCP spec).** No substrate hook beyond document-substrate.
- **Slice 2 (sanctions screening).** Atlas — event-store registry registration of the four sanctions event types per Slice 2 above; Anya (semantic-layer entry for sanctions-list provenance per `BCBS-239-2013` cross-reference under `ORG-FC-13`).
- **Slice 3 (CDD/EDD client-master).** Atlas — client-master event-stream foundation; Imani — clause-library hooks for trustee / beneficial-owner resolution patterns; Iris — POPIA s.18 + s.13 cross-references for personal-information in client-master.
- **Slice 4 (transaction monitoring).** Markets-substrate — typed `Transaction*` events from M-phase substrate are the input; tipping-off cryptographic enforcement requires Senna's HSM key envelope from W3 Slice 6.
- **Slice 5 (FATCA/CRS XML).** Yael's tax-event substrate; client-master from Slice 3.
- **Slice 6 (MLRO designation + goAML).** Document-substrate; corporate-action event-stream (Owen).
- **Slice 7 (AgentOps fit-and-proper).** Sade's AgentOps substrate (per `D-THIN-HUMAN-LAYER-MINIMUM` reshape).
- **Slice 8 (pre-licence dry-run).** Vera's continuous-assurance harness; document-substrate.

### W2 (ICAAP / ILAAP / Recovery) substrate hooks

- **Slice 1 (framework spec).** No substrate hook beyond document-substrate.
- **Slice 2 (RAS B2 calibration).** Helena's RAS event-substrate (existing per `ORG-PR-04` row reference); RasLineCalibrated event registration via D-RMS-PHASE-1.
- **Slice 3 (RWA engine + BA-form generator).** Markets-substrate (M-phase) for trading-book RWA; Bea's reporting-capability spec; Anya's semantic layer for BA-form-field provenance.
- **Slice 4 (stress-projection engine).** D-EVENT-STORE-SCALING Slice 2-3 snapshot substrate (read-amplification on stress-projection re-runs); Rohan's backtest-harness foundation per `Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md`; Nadia's model-validation harness.
- **Slice 5 (ILAAP liquidity).** Markets-substrate for trade-side liquidity inputs; Tomas + Ravi's payment / settlement substrate for intraday flows; existing CFP harness per `ORG-PR-15`.
- **Slice 6 (Recovery Plan).** RAS event-substrate for early-warning-indicator binding; Owen's governance-trigger framework substrate.
- **Slice 7 (dry-run).** Vera's assurance harness.

### W3 (JS 1 of 2024 cyber-resilience) substrate hooks

- **Slice 1 (programme spec).** No substrate hook beyond document-substrate.
- **Slice 2 (threat-model register).** D-RMS-PHASE-1 — typed `ThreatModelAuthored` events; existing threat-model artefact at `Owner Inbox/2026-05-07_senna_neon-event-store-threat-model.md` is the seed for the register.
- **Slice 3 (incident substrate + regulator-notification).** D-RMS-PHASE-1 event registration; Iris's POPIA-breach pathway substrate (`ORG-PR(IV)-07`).
- **Slice 4 (runbook rehearsal).** Devon's operational-substrate for runbook execution; Vera assurance for rehearsal-coverage recon.
- **Slice 5 (supplier-cyber-risk + Directive 3 of 2018).** Devon's outsourcing-register substrate; Imani's supplier-contract clause-library.
- **Slice 6 (HSM key envelope).** Atlas's event-store envelope hooks (cross-link to D-EVENT-STORE-SCALING Slice 7 for the Azure Managed HSM integration); Senna's local key-rotation harness.
- **Slice 7 (consolidated attestation).** Vera's assurance harness; document-substrate; cross-entity reading per D-LEGAL-ENTITY-TREE-V0 + D-REGULATORY-PERIMETER.

---

## 7. Input quality — register `[TBD]` and `[citation: TBC]` notes

The obligations register v1.13 carries known input-quality gaps that affect this plan, none of which block the slice-1 dispatches. Surfacing them so engineering personas budget the citation work into their slices:

- **Entity-scope `[TBD]` on most W1, W2, W3 rows.** Domain B (W1) almost entirely `[TBD]`; Domain G + Domain A (W2) mostly `[TBD]`; Domain G cyber rows (W3) `[TBD]` except `ORG-CY-02` (`consolidated-supervision`), `ORG-FC-11` (`multi-entity`). Workstream `WS-ENTITY-SCOPE-CLASSIFICATION` (Mira) resolves the bulk; per-slice authoring should note the per-row entity-scope explicitly where the slice's recon depends on it (e.g. W1 Slice 5 FATCA/CRS — `ORG-FC-15` entity-scope determines whether bank-only or multi-entity reportability).
- **`[citation: TBC]` on JS 1 of 2024 + Reg 39 sub-clauses.** W3 Slice 1 narrative cites JS 1 of 2024 by clause; the precise clauses are `[citation: TBC]` (per `ORG-CY-01..07` and `ORG-BNK-CYBER-CONS`). Imani (Legal-as-code engineer) + external counsel ratify at licence-application moment per Principle 2 (no invented citations). The Slice 1 author marks unknowns explicitly — *don't invent*.
- **`[citation: TBC]` on Banks Act § 60+.** W2 Slice 1 cites Banks Act §§ 60-72 by paragraph; precise paragraph indices are `[citation: TBC]` per the entity-scope vocabulary section + `ORG-BNK-CYBER-CONS`. Same pattern — mark unknowns; external-counsel ratification at licence-application.
- **`[citation: TBC]` on FSB Key Attributes + SARB Recovery directive.** W2 Slice 6 cites the recovery framework by FSB Key Attributes + a SARB directive on recovery planning whose precise title is `[citation: TBC]` (no SARB recovery-planning directive currently appears as a discrete row in the register). Mira's curatorship of Domain A may add a row; Slice 6 authoring should route the question to Mira if unresolved.

None of these gaps blocks Slice 1. They constrain what the Slice 1 author can claim with full citation; per Principle 2, the Slice 1 deliverable cites what is in-register and routes the rest to Mira.

---

## 8. Authority

Citations (no invented references):

- **CLAUDE.md** "Operating procedures" + "Operating model — what is real, deferred, paused" + "Architectural principles" 1, 2, 6, 7.
- **`project_rules_bind_at_commencement.md`** (memory) — CORPORATE / LICENCE / COMMENCEMENT / CONDITIONAL bind taxonomy.
- **`project_strategic_foundation.md`** (memory) — institutional global-markets dealer; ~R300m capital; institutional-only.
- **`project_indirect_participant_posture.md`** (memory) — sponsor-bank access to CMI.
- **`project_ai_driven_bank.md`** (memory) — build-phase posture; pre-licence go-live readiness gate.
- **`feedback_no_pause_rule.md`** (memory) — standing CEO decisions authorise downstream dispatch.
- **`feedback_agent_name_with_position.md`** (memory) — name + position on first mention.
- **[Regulations/_obligations-register.md](../Regulations/_obligations-register.md) v1.13** — 232 obligations across 23 prefixes; rows cited inline by ID per §1.
- **[Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md](2026-05-10_atlas_event-store-scaling-design.md)** — eight-slice precedent for `D-EVENT-STORE-SCALING`.
- **[Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md)** — five-slice precedent for `D-RMS-PHASE-1`.
- **[Owner Inbox/2026-05-06_reporting-capability-spec.md](2026-05-06_reporting-capability-spec.md)** — Bea's reporting-capability spec; substrate of W2 Slice 3.
- **[Owner Inbox/2026-05-06_client-master-and-continuous-kyc.md](2026-05-06_client-master-and-continuous-kyc.md)** — institutional client-master design; substrate of W1 Slice 3.
- **[Owner Inbox/2026-05-07_senna_neon-event-store-threat-model.md](2026-05-07_senna_neon-event-store-threat-model.md)** — threat-model artefact seed for W3 Slice 2.
- **[Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md](2026-05-09_atlas_substrate-completeness-budget.md)** (referenced by Atlas's scaling design) — Targeted budget that paces the slices.

**Statutory instruments named by exact reference (15+ across the pack):** Banks Act 94 of 1990 §§ 60-72; *Regulations Relating to Banks 2012 (as amended)* Reg 38, Reg 39, Reg 26; FIC Act 38 of 2001 ss.21, 21A, 21B, 22, 28, 28A, 29, 29(3), 42, 43, 43A; FATF Recommendations 1, 10, 16; FAIS Act 37 of 2002; Financial Markets Act 19 of 2012 s.6A, s.109; FSCA Conduct Standards 1, 2, 3 of 2018; Joint Standard 1 of 2024 (PA + FSCA cyber); Joint Standard 2 of 2020 §§ 3-8 (margin); Joint Notice 2 of 2024 (margin reporting); POPIA 4 of 2013 ss.11, 13, 14, 15, 18, 19-22, 22 (breach), 23, 24, 55-56, 57, 71, 72; PAIA 2 of 2000 s.51; PRECCA 12 of 2004; FSR Act 9 of 2017; Financial Sector Laws Amendment Act 23 of 2021; SARB Directive 3 of 2018; SARB BA 100 / 300 / 325 / 326 returns; FATCA IGA + Tax Admin Act 28 of 2011; CRS + Tax Admin Act 28 of 2011; FSB Key Attributes (Oct 2014); BCBS Basel III/IV; BCBS 144; BCBS 248; BCBS D295; BCBS D335; BCBS *Principles for Operational Resilience* (March 2021); BCBS *Sound Practices for the Management of Operational Risk* (rev. 2021); ISO/IEC 27001:2022; NIST CSF 2.0; NIST SP 800-218 SSDF v1.1; UN Security Council Sanctions; OFAC SDN; EU consolidated; UK HMT; POCDATARA; UK Bribery Act 2010; ISDA Master Agreement + ISDA CSA (NY Law / English Law); ICMA GMRA 2011 SA Schedule.

---

## 9. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v0.1 | 2026-05-10 | Zara (CCO, governance) + Helena (CRO, governance) | Initial regulatory-readiness gate plan in response to Marc's question after D-EVENT-STORE-SCALING + D-RMS-PHASE-1 substrate-side decisions. Seven-candidate triage; top-3 selection (W1 AML/CFT-RMCP + W2 ICAAP/ILAAP/Recovery + W3 JS 1 of 2024 cyber-resilience); slice plans for each (W1: 8 slices; W2: 7 slices; W3: 7 slices); deferral filings for W4 (Op Res) + W5 (Securities licensing); folding of S5 + H7 into W2; substrate-dependency mapping per slice; input-quality flags on register `[TBD]` / `[citation: TBC]` rows. |

—Zara (Chief Compliance Officer, governance) + Helena (Chief Risk Officer, governance)
