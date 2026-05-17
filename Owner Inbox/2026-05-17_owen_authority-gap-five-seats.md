---
title: "Authority gap brief — CFO / COO / CISO / CAE / CCO decision authority scoping"
author: Owen (Company Secretary, governance)
date: 2026-05-17
asOf: "2026-05-17T00:00:00Z"
decision-required: false
brief-ref: "brief:owen:authority-gap-cfo-coo-ciso-cae-cco-decision-auth:2026-05-17"
citations:
  - "D-DECISIONS-FRAMEWORK-REDESIGN"
  - "platform/event-store/event-types/decision.ts — DECISION_AUTHORITIES"
---

# Authority Gap Brief — CFO / COO / CISO / CAE / CCO Decision Authority Scoping

**Filed by:** Owen (Company Secretary, governance)
**Date:** 2026-05-17
**Brief ref:** brief:owen:authority-gap-cfo-coo-ciso-cae-cco-decision-auth:2026-05-17
**Authority:** D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16)

---

## 1. Purpose

The D-DECISIONS-FRAMEWORK-REDESIGN (all 4 slices complete) introduced a unified `Decision` event with a `DecisionAuthority` field. This brief maps the five governance seats that hold authority values in the enum but have yet to use them: CFO (Camille), COO (Devon), CISO (Rashida), CAE (Thandiwe), and CCO/Compliance (Mira, under Zara as CCO). It documents:

- The decision categories within each seat's authority surface.
- Historical `Decision` events in the store misattributed to `CEO` that should belong to one of these seats.
- The current state of the `DecisionAuthority` enum (no code change required).
- Open decisions that are blocked because no authority has been explicitly defined in practice.

---

## 2. Current state of the event store

As of 2026-05-17, the event store contains:

| Authority | Distinct Decision IDs | Notes |
|---|---|---|
| CEO | 108 | All CEO-level strategic and engineering decisions |
| CRO | 3 | Risk-appetite-statement calibration decisions |
| CoSec | 1 | Procedures register first batch |
| CFO | 0 | **Gap** |
| COO | 0 | **Gap** |
| CISO | 0 | **Gap** |
| CAE | 0 | **Gap** |
| CCO | 0 | **Gap** |

The `DecisionAuthority` enum in `platform/event-store/event-types/decision.ts` already contains all 5 seat values (`"CFO"`, `"COO"`, `"CISO"`, `"CAE"`, `"CCO"`). **No code change is required.** The gap is purely operational: the seats exist in the type system but no decisions have been attributed to them.

---

## 3. Per-seat authority scoping

### 3.1 CFO — Camille (Chief Financial Officer)

**Source:** `Team/Camille.md` §9 (Decisions in scope).

| Decision category | Authority level | Criteria | Escalation trigger |
|---|---|---|---|
| Approve monthly close | CFO-sole | Sub-ledger to GL recon green; IFRS/Banks Act mappings cited | Escalates to CEO + AC on material restatement |
| Sign quarterly BA returns | CFO-sole | BA-return mapping cited; recon harness green | Escalates to CEO + AC if PA disagrees |
| Sign annual AFS | CFO-sole | IFRS-presentation cited; auditor sign-off received | Escalates to CEO + Board if going-concern in doubt |
| Approve accounting policies (within board-approved framework) | CFO-sole | Within IFRS scope; non-substantive at policy level | Escalates to CEO + Board if going-concern implications |
| Approve material IFRS classifications | CFO-sole | Cited to IFRS standard + paragraph | Escalates to CEO + AC on material restatement risk |
| Approve capital actions in operational scope | CFO-sole | Within Board-approved capital plan; ICAAP-aligned | Escalates to CEO + shareholder on S1 threshold crossing |
| Approve tax submissions (where Yael flags judgement) | CFO-sole | Cited to Income Tax Act / TAA / FATCA / CRS | Escalates to CEO + Imani on material SARS dispute |
| Approve external-auditor interface decisions | CFO-sole | Within AC-mandated scope; AC informed | Escalates to AC chair on independence-affecting matters |
| Approve AC pack for tabling | CFO-sole | Generated downward (P6); citation chain present | — |

**Recommend-only (CEO or Board decides):** Material AFS restatement; going-concern accounting-policy change; major capital action beyond the Board-approved plan; external-auditor independence failure; material tax dispute exceeding RAS threshold.

**Decision categories applicable:** `finance`, `governance` (AC pack / policy approvals).

---

### 3.2 COO — Devon (Chief Operating Officer)

**Source:** `Team/Devon.md` §9 (Decisions in scope).

| Decision category | Authority level | Criteria | Escalation trigger |
|---|---|---|---|
| Approve a change at CAB | COO-sole | Register-linked impact assessment; rollback plan; SLO impact understood | Escalates to CEO on regulatory-reportable outage |
| Set / adjust SLO targets (within Helena's RAS) | COO-sole | Within operational-resilience RAS line; cited to RAS section | Escalates to Helena + CEO on Tier-1 RAS breach |
| Approve operational-resilience scenario design | COO-sole | Coverage of severe-but-plausible scenarios; BCBS-mapped | — |
| Approve DR / BC plans within governance framework | COO-sole | Tested within window; recovery objectives within appetite | — |
| Approve capacity-spend within CFO-set budget | COO-sole | Within budget envelope; capacity-projection backed | Escalates to Camille + CEO on threshold crossing |
| Engineering hire-prioritisation within bench | COO-sole | Mandate gap or roadmap dependency; Nolan + PAX in loop | Escalates to CEO on governance-adjacent mandate change |
| Triage medium-severity operational incidents | COO-sole | Within RAS; root-cause owner named | Escalates to CEO + Helena on Tier-1 appetite breach |

**Recommend-only (CEO or Board decides):** Material outage with PA / FSCA notification; capital-spend on platform crossing CFO threshold; major engineering hire for a governance-adjacent seat; cloud / offshoring decision under Directive 3 of 2018.

**Decision categories applicable:** `engineering` (CAB, SLO, DR/BC, capacity), `people` (bench hire-prioritisation), `governance` (resilience-scenario design).

---

### 3.3 CISO — Rashida (Chief Information Security Officer)

**Source:** `Team/Rashida.md` §9 (Decisions in scope). Note: Senna (Security engineer, CISO function) is the engineering secondary; Rashida holds the authority surface.

| Decision category | Authority level | Criteria | Escalation trigger |
|---|---|---|---|
| Sign / refuse threat-model-gate exceptions | CISO-sole | STRIDE / LINDDUN coverage; control adequacy; residual-risk within cyber RAS | Escalates to CEO on strategic-deployment refusal |
| Approve / refuse SBOM acceptance | CISO-sole | SLSA level; signature integrity; CVE-clearance threshold | — |
| Approve supply-chain attestations | CISO-sole | sigstore / SLSA verification; provenance | — |
| Approve key-ceremony actor sets and schedules | CISO-sole | M-of-N quorum; segregation; HSM-attestation review | Escalates to CEO + Owen on quorum failure |
| Sign / refuse key-rotation cadence amendments | CISO-sole | FIPS 140-2/3 boundary discipline; risk-rating | — |
| Approve detection-standard, IR-runbook, deception-asset standards | CISO-sole | NIST CSF 2.0 mapping; MITRE ATT&CK coverage | — |
| Sign `SecurityIncident` severity rating | CISO-sole | Joint Standard 2 of 2024 severity matrix | Escalates to CEO on JS-2-of-2024 reportable |
| Approve vendor-security review outcome | CISO-sole | Tier-based assessment; SLSA / SBOM / pentest posture | — |
| Sign second-line cyber opinion to AC / Risk Forum | CISO-sole | Vera's continuous-controls evidence; audit-universe coverage | — |
| Sign POPIA s.19–22 quarterly attestation (joint with Iris) | CISO-sole (jointly) | Section 19 reasonable-measures test; ss.21/22 readiness | Escalates to CEO + Iris on notifiable breach |
| Sign Joint Standard 2 of 2024 programme attestation | CISO-sole | Programme-map coverage; PA / FSCA reporting cadence met | — |

**Recommend-only (CEO decides):** Regulator-reportable cyber incident (PA / FSCA notification); security incident exceeding materiality threshold; strategic deployment refusal; key-ceremony quorum failure; POPIA-notifiable breach.

**Decision categories applicable:** `engineering` (threat-model gate, SBOM, SDLC), `risk` (cyber-RAS metrics, vendor security), `compliance` (POPIA, Joint Standard 2).

**Senna's relationship:** Senna holds engineering-level authority for a narrower set (see `Team/Senna.md` §9). Senna's `ThreatModelGateDecision` events are engineering recommendations; Rashida ratifies exceptions as the CISO authority event.

---

### 3.4 CAE — Thandiwe (Chief Audit Executive)

**Source:** `Team/Thandiwe.md` §9 (Decisions in scope).

| Decision category | Authority level | Criteria | Escalation trigger |
|---|---|---|---|
| Sign quarterly third-line opinion | CAE-sole | Coverage of audit universe; severity-rating consistency; Vera-pipeline integrity | Reports to AC, not CEO, on material control failure |
| Approve audit-plan revisions | CAE-sole | Within AC-approved framework; risk-based justification | Escalates to AC chair on management opposition |
| Approve audit-universe revisions | CAE-sole | New entity / process / risk emerged | — |
| Sign individual audit findings | CAE-sole | Evidence sufficiency; severity rating per IPPF / charter | Escalates to AC chair + CEO on suspected fraud |
| Sign-off external-audit engagement-letter scoping (joint with Camille) | CAE-sole (jointly) | Scope coverage; independence; fee reasonableness | — |
| Approve audit-charter revision | CAE-sole | Within Companies Act / Banks Act / IPPF tests | Reports to AC; CEO informed |
| Approve QAIP-cycle outcome | CAE-sole | IPPF tests; internal QA + external assessment cadence | — |
| Approve investigation scope and conclusions | CAE-sole | Mandate; evidence; legal-privilege posture (with Imani) | Escalates to AC chair (sealing bypass on CEO-adjacent whistleblowing) |

**Recommend-only (AC / Board decides):** Any decision that would compromise third-line independence; audit-charter changes with Companies Act implications.

**Independence note:** The CAE's functional reporting line is to the Audit Committee (interim: Interim Audit Forum chaired by Owen), not the CEO. The `authority: "CAE"` value in the Decision event represents Thandiwe's own-mandate decisions, which are accountable to the AC, not the CEO administrative line. CEO cannot override a CAE decision within the audit mandate.

**Decision categories applicable:** `governance` (charter, plan, opinion, investigation), `risk` (audit-universe, QAIP).

---

### 3.5 CCO / Compliance — Mira (Compliance / RegTech engineer, under Zara as CCO)

**Note on authority:** Mira is the Compliance / RegTech engineer. The CCO authority surface belongs to Zara (Chief Compliance Officer). Mira holds agent-autonomous authority over the engineering decisions below; Zara (CCO) holds authority over the signing / supervisory decisions. The `authority: "CCO"` value in the Decision event maps to Zara's seat. Mira's engineering decisions should use `authority: "Agent"` or wait for a `CCO`-attributed Decision event from Zara.

**Zara's CCO decision surface (for completeness — Zara spec not yet upgraded to 17-section template):**

| Decision category | Authority level | Criteria | Escalation trigger |
|---|---|---|---|
| Sign STR / CTR / TPR filings | CCO-sole (MLRO authority) | Suspicion threshold met (FIC s.29); statutory deadline | Escalates to CEO on sanctions-related filing |
| Sign RMCP attestation | CCO-sole | Quarterly RMCP review; obligations register current | Escalates to CEO on material RMCP breach |
| Approve obligation interpretations (contested) | CCO-sole | Statutory text + FATF / guidance; Imani concurs | Escalates to CEO on material regulatory-exposure determination |
| Sign second-line compliance opinion to AC / Risk Forum | CCO-sole | RMCP coverage; Mira's pipeline integrity | — |
| Approve EDD sign-off on high-risk clients | CCO-sole | PEP / high-risk jurisdiction / complex structure; Mira pipeline | — |
| Sanction-override decision (confirmed match) | CCO-sole (with Imani) | Confirmed true-positive; asset-freeze procedures invoked | Escalates to CEO; PA / FIC notification via Owen |

**Mira's agent-autonomous authority surface (engineering-level decisions):**

| Decision category | Authority level | Notes |
|---|---|---|
| KYC tier assignment, onboarding accept / refer | Agent (Mira) | Engineering pipeline decisions; do not require CCO sign-off individually |
| Sanctions match — true-match / false-positive | Agent (Mira) | Escalates to CCO (Zara) on confirmed true-match |
| Transaction-monitoring alert disposition | Agent (Mira) | Escalates to CCO on STR-threshold alerts |
| Register-entry approval (obligation entries) | Agent (Mira) | Escalates to Zara on contested interpretation |

**Decision categories applicable (CCO / Zara):** `compliance`, `risk` (financial-crime risk decisions).

---

## 4. Historical Decision events — re-attribution candidates

The following table identifies `Decision` events in the store that are currently attributed to `CEO` but which, per the seat mandates above, should have been attributed to the relevant governance seat. These were recorded under the pre-DECISIONS-FRAMEWORK-REDESIGN regime or before the seat authority surfaces were fully defined. Owen does not recommend re-issuing corrected events for these historical records — the rationale was CEO-approved at the time, and re-attribution would misstate the historical authority chain. Instead, this brief establishes the forward-looking standard.

| Decision ID | Current authority | Natural authority | Category | Rationale |
|---|---|---|---|---|
| D-REGULATORY-READINESS-W1-SLICE-1 | CEO | CCO (Zara) | compliance | RMCP attestable specification — a compliance-programme decision that Zara as CCO should own going forward; CEO escalation is appropriate only for the board-approval dimension |
| D-T-01-PERMISSION-GATE-SECURE-DEFAULT | CEO | CISO (Rashida) | engineering | Permission-gate secure-default — a security-architecture standard that falls within Rashida's threat-model-gate authority surface |
| D-AGENT-AUTONOMY-OPERATIONAL | CEO | COO (Devon) + CISO (Rashida) | governance | Operational autonomy parameters — the COO owns operational-resilience scope; CISO owns the security-standard implications |
| D-API-CLOUD-COST-BUDGET | CEO | COO (Devon) | governance | Cloud-cost envelope — within Devon's capacity-spend authority (approved by Camille's budget envelope), not a strategic-level CEO decision |
| D-REPORTING-CAPABILITY-SLICE-3 (BA 325) through SLICE-6 | CEO | CFO (Camille) | engineering | BA return and IFRS-statement slices — these engineering deliverables land reporting substrate that Camille signs off on; the build decision was CEO-level appropriately, but the sign-off on the output (the actual BA-return and AFS artefacts) is CFO authority |

**Owen's recommendation:** Do not amend historical records. For future similar decisions, route to the seat holder for the `Decision(approved)` event, with CEO as the escalation authority if the decision crosses a policy-level threshold.

---

## 5. Decisions currently stuck — no authority defined in practice

The following open decisions are listed as `authority: "CEO"` in the event store but functionally belong to one of the five seats. They are not progressing because the seat authority surfaces have not been operationalised:

| Decision ID | Assigned authority | Natural authority | Status | Blocker |
|---|---|---|---|---|
| D-RAS-B-CLUSTER-CONCENTRATION-LINES | CRO (Helena) | CRO | In-flight (multiple requested events) | Not a five-seat gap; CRO is already exercising authority |
| D-T-01-PERMISSION-GATE-SECURE-DEFAULT | CEO | CISO (Rashida) | requested | Awaiting Rashida's authority surface to be operationalised |
| D-NPA-APPROVAL-POLICY | CEO | CCO (Zara) + COO (Devon) | requested (in store as ghost-ref) | New Product Approval policy spans compliance + operations; neither seat has issued a `Decision(approved)` in this category |
| D-MARKET-CONDUCT | CEO | CCO (Zara) | requested (in store) | FAIS conduct candidate obligations — compliance-level analysis awaiting Zara's CCO sign-off |

---

## 6. Proposed forward-looking decision-routing rules

Based on the per-seat analysis above, Owen proposes the following routing standard for new decisions. This standard should be encoded in the dispatch boilerplate (CLAUDE.md "Dispatch discipline" section) and enforced by a future `recon:decision-authority-routing` pipeline.

| Category | Typical authority | CEO escalation trigger |
|---|---|---|
| Finance close, BA returns, AFS, IFRS accounting policy, tax submissions | CFO | Material restatement; going-concern; capital plan breach |
| CAB sign-off, SLO calibration, DR/BC, capacity-spend, incident triage | COO | Regulatory-reportable outage; RAS Tier-1 breach; major hire |
| Threat-model gate, SBOM, key-ceremony, vendor-security, JS-2 programme | CISO | Regulator-reportable cyber; strategic deployment refusal; quorum failure |
| Audit findings, audit plan, third-line opinion, QAIP, investigations | CAE | Material fraud or misstatement → AC pathway (not CEO) |
| RMCP attestation, STR/CTR/TPR filing, obligation interpretation, EDD sign-off | CCO (Zara) | Sanctions true-positive; material exposure; PA / FIC notification |
| Strategic decisions crossing RAS or Board-set thresholds | CEO | All seats escalate here |
| Engineering build decisions (substrate, platform, schema) | CEO (during build phase) | Build-phase norm until governance-seat authorities are operationally active |
| Risk-appetite calibration | CRO (Helena) | Already active; no gap |
| Governance / procedure register | CoSec (Owen) | Already active; no gap |

---

## 7. Enum status — no code change required

`DecisionAuthority` in `prototype/platform/event-store/event-types/decision.ts` already contains:

```ts
export const DECISION_AUTHORITIES = [
  "CEO", "Board", "AC", "BRC", "ALCO",
  "CRO", "CCO", "CFO", "COO", "CISO", "CAE",
  "IO", "CoSec", "Agent",
] as const;
```

All five seats are enumerated. The gap is purely operational — no seat has issued a `Decision(approved)` event using their own authority value. The fix is process, not code.

---

## 8. Recommended next steps

1. **CFO (Camille):** Owen to brief Camille's next run to issue `Decision(approved, authority: "CFO")` for any close-cycle, BA-return, or accounting-policy decisions from this point forward. First expected instance: next quarterly BA-return sign-off.

2. **COO (Devon):** Owen to brief Devon's CAB cadence to issue `Decision(approved, authority: "COO")` for all CAB approvals and SLO calibration decisions. First expected instance: next weekly CAB run.

3. **CISO (Rashida):** Owen to brief Rashida to issue `Decision(approved, authority: "CISO")` for threat-model-gate exceptions and vendor-security reviews. Immediate candidate: D-T-01-PERMISSION-GATE-SECURE-DEFAULT should be closed by Rashida's authority, not CEO.

4. **CAE (Thandiwe):** Owen to brief Thandiwe to issue `Decision(approved, authority: "CAE")` for audit-finding sign-offs and audit-plan revisions. These decisions are functionally hers; CEO attribution was a substrate gap.

5. **CCO (Zara):** Owen to note that Mira's engineering decisions should carry `authority: "Agent"` or `"CCO"` where Zara signs. D-MARKET-CONDUCT and D-NPA-APPROVAL-POLICY should route to `"CCO"` once Zara is operationally running.

6. **Recon pipeline:** Owen + Vera to add `recon:decision-authority-routing` as a Wave-4 planned item — asserts that decisions in specific categories are attributed to the expected seat, with violations as findings.

---

*Owen (Company Secretary, governance) — 2026-05-17*
