---
riskTaxonomy:
  - RT-FC
  - RT-FC.ML
  - RT-FC.SA
  - RT-CD
  - RT-CD.TC
  - RT-LR.DP
---

# Core policies — Compliance, financial crime, and privacy

**Authors:** Zara (CCO — lead, compliance); Iris (IO — lead, privacy); Mira (engineering)
**Reviewed by:** Helena, Owen, Senna, Camille, Niko, Vera
**Date:** 2026-05-06
**For:** Marc (CEO) — for inclusion in the next decision pack as Board-route approvals.

---

## 1. Risk Management & Compliance Programme (RMCP)

**Owner:** Zara · **Approval:** BRC + Board · **Cadence:** Annual · **Citation:** FIC Act 38 of 2001 s.42; FATF Recommendations.

### Purpose
The bank's accountable-institution-level compliance programme under FIC Act s.42, integrating CDD, EDD, monitoring, screening, reporting, and FATCA / CRS into a single named programme with the CCO as signed accountable person.

### Principles
- The RMCP is the **operating contract** between the bank and the FIC; signed annually by Zara.
- Risk-based: CDD intensity dispatches on customer risk-rating typology; high-risk clients carry EDD, ongoing monitoring, and elevated approval levels.
- Beneficial-ownership resolution recursive to natural persons or terminal opaque structures, per the client-master design (D1 approved).
- Sanctions screening true-positive blocks pre-execution; override is a signed event by the MLRO (B4 approved).
- STR / SAR / CTR / TPR filings under FIC ss.28 / 28A / 29 are MLRO judgement; no internal override.
- Tipping-off prevention is enforced cryptographically — STR existence and contents restricted to the named MLRO investigation set.

### Roles
Zara is the FIC-named MLRO and FIC Compliance Officer. Mira engineers the pipelines. Niko hands off onboarded customers. Iris co-governs the POPIA dimension.

### Breach
Failure of the RMCP (false-negative on sanctions, missed STR filing) is a Critical event; immediate Helena, Marc, Vera notification; FIC engagement under guidance.

#### Pre-board review
- **Proposer:** Zara (with Mira).
- **Challenged by:** Helena (appetite consistency); Iris (POPIA seam); Senna (data-integrity attestation); Vera (testability).
- **Iteration:** minor — added cryptographic tipping-off enforcement language.
- **Status:** Ready ✓

---

## 2. AML / CFT Policy

**Owner:** Zara · **Approval:** BRC · **Cadence:** Annual · **Citation:** FIC Act 38 of 2001; FATF 40 Recommendations; FATF SA mutual-evaluation reports.

### Purpose
Sets the bank's anti-money-laundering and counter-terrorist-financing posture, operationalised through the RMCP.

### Principles
- **Zero appetite** for facilitating financial crime (RAS B1).
- Customer typologies maintained per FATF Rec. 1 RBA; risk ratings dispatch CDD intensity.
- Transaction monitoring scenarios cover at least: structuring, rapid movement, atypical for profile, sanctions-adjacent flows, high-risk-jurisdiction touch-points, cash transactions above threshold.
- Alert disposition is a typed event with documented reasoning; no silent closures.
- Annual independent (Vera) effectiveness review.

### Roles
Zara owns; Mira engineers monitoring rules; Vera audits.

### Breach
Repeated false-negatives, missed STRs, or AML-policy non-compliance trigger a Critical event with FIC engagement.

#### Pre-board review
- **Proposer:** Zara (with Mira).
- **Challenged by:** Helena (appetite); Vera (effectiveness-review independence); Devon (case-management workload).
- **Iteration:** none material.
- **Status:** Ready ✓

---

## 3. Sanctions Policy

**Owner:** Zara · **Approval:** BRC + Board · **Cadence:** Annual · **Citation:** UN consolidated; OFAC SDN; EU consolidated; UK HMT; POCDATARA / DTI Targeted Financial Sanctions list. (B4 approved).

### Purpose
The bank screens against and complies with all applicable sanctions regimes; zero-appetite for transacting with sanctioned parties.

### Principles
- **Zero appetite.** All true-positive matches blocked end-to-end pre-execution.
- Any production override requires a Zara-signed event with a register-linked exception.
- Override authority resides with the MLRO seat, not the desk.
- Lists ingested as continuous-KYC signal sources; integrity attested cryptographically.
- Fuzzy-match tuning prioritised on false-positive reduction; effectiveness reviewed quarterly.
- Counterparty onboarding includes screening of UBOs, controlling parties, and named directors.

### Roles
Zara owns; Mira engineers screening; Senna attests list integrity.

### Breach
Any execution against a true-positive sanctioned party is a Critical event; immediate CEO + Helena notification; Regulator engagement via Zara.

#### Pre-board review
- **Proposer:** Zara.
- **Challenged by:** Mira (engineering feasibility); Saskia (markets-counterparty implications); Vera (override discipline testability).
- **Iteration:** none material.
- **Status:** Ready ✓ (B4 approved 2026-05-06).

---

## 4. KYC / CDD / EDD Policy

**Owner:** Zara (with Mira) · **Approval:** BRC · **Cadence:** Annual · **Citation:** FIC Act ss.21–21H; FIC Guidance Note 7 (RBA); FATF Rec. 10.

### Purpose
The bank performs customer due diligence at onboarding (gate), recurring per RBA periodicity, and continuously via signal-driven re-evaluation. The substantive design is in `Owner Inbox/2026-05-06_client-master-and-continuous-kyc.{md,html}` (D1 approved).

### Principles
- No client enters the master without satisfying applicable upfront KYC.
- RBA periodicity: high-risk → annual review; medium → 24 months; low → 36 months.
- Continuous-KYC two-tier restriction default (B3 approved): high-confidence triggers → restrict immediately; medium-confidence → restrict on review.
- Beneficial-ownership recursive resolution to natural persons or terminal opaque structures.
- Multi-jurisdictional clients carry parallel jurisdiction tags; KYC requirements dispatch on those tags.

### Roles
Zara (MLRO) signs the gate; Mira engineers pipelines; Anya owns the client master projection; Imani owns legal-entity-type taxonomy; Iris governs the POPIA dimension.

### Breach
Activation of a client without satisfied upfront KYC, or failure of a recurring-KYC due date past escalation grace, is a Critical event.

#### Pre-board review
- **Proposer:** Zara + Mira.
- **Challenged by:** Iris (privacy on signal ingestion); Senna (threat model); Anya (projection consistency); Vera (as-of replay testability).
- **Iteration:** minor — clarified "control threshold" definition for BO changes (with Imani).
- **Status:** Ready ✓ (D1 approved 2026-05-06).

---

## 5. Conduct of Business / TCF Policy

**Owner:** Zara · **Approval:** BRC · **Cadence:** Annual · **Citation:** FSCA conduct standards; TCF six outcomes; FAIS General Code of Conduct.

### Purpose
The bank treats customers fairly across the customer lifecycle — design, marketing, advice, sale, after-sale, complaints — and demonstrates outcomes.

### Principles
- The six TCF outcomes are operating outcomes, not aspirations: customers can be confident they are dealing with a firm where TCF is central; products meet identified customer needs; customers are informed before, during, after; advice is suitable; products perform as expected; customers do not face unreasonable post-sale barriers.
- Marketing material and customer communications are validated against product policy and pricing data — never authored independently of the data (P6).
- Complaints handling is event-driven; root-cause feeds product / process redesign.
- Suitability records are kept for FAIS-licensed activities (when FSP licence carried).
- Conduct KRIs reported quarterly to BRC.

### Roles
Zara owns; Niko operates the customer lifecycle; Mira engineers complaints case management.

### Breach
Material conduct failure (mis-selling, fee opacity, advice non-suitability) is a Critical event.

#### Pre-board review
- **Proposer:** Zara.
- **Challenged by:** Niko (customer-lifecycle realism); Helena (conduct-risk appetite); Vera (outcome-evidence testability).
- **Iteration:** minor — strengthened root-cause feedback to product redesign.
- **Status:** Ready ✓

---

## 6. POPIA / Privacy Policy

**Owner:** Iris · **Approval:** BRC + S&E · **Cadence:** Annual · **Citation:** POPIA 4 of 2013, especially ss.13–22, 23–24, 55–58, 72.

### Purpose
The bank processes personal information lawfully, transparently, and with safeguards, under the named Information Officer.

### Principles
- Every processing activity has a documented **lawful basis** in the lawful-processing register; no purpose without basis.
- **Data minimisation** by design: personal information collected only where necessary; retained only for as long as needed; field-level encrypted at rest.
- **Data-subject rights** are coded workflows: access (s.23), correction (s.24), deletion, objection (s.11(3)), automated-decision rights (s.71). Service-level commitments published.
- **Cross-border transfers** under s.72 governed by the Cross-Border Transfer Policy; SARB Directive 3 of 2018 intersects on cloud / offshoring.
- **Breach notification** under s.22 runs as a coded workflow (Senna's IR pipeline + Iris regulator-facing).
- Read events on PII are themselves audited as events.

### Roles
Iris is the named Information Officer (E1 deferred — designation lodgment pending). Zara co-governs the regulatory-compliance dimension. Senna implements the security safeguards. Anya enforces minimisation and lineage in projections. Owen co-maintains the PAIA Manual.

### Breach
A notifiable breach (s.22) triggers regulator notification within statutory timing; Iris notifies; Zara responds compliance-wise; Senna runs IR.

#### Pre-board review
- **Proposer:** Iris.
- **Challenged by:** Zara (regulatory-compliance dimension); Senna (security-safeguards interface); Anya (minimisation in projections); Owen (PAIA Manual interface); Vera (rights-workflow testability).
- **Iteration:** minor — added consent-withdrawal propagation through Anya's projections.
- **Status:** Ready ✓ (E1 lodgment deferred — operational designation in place).

---

## 7. PAIA Manual

**Owner:** Iris (with Owen) · **Approval:** Information Officer signs · **Cadence:** On change · **Citation:** Promotion of Access to Information Act 2 of 2000.

### Purpose
The PAIA manual under s.51 sets out what records the bank holds, how requests for access are made, and the bank's response process.

### Principles
- The manual is published on the bank's website and lodged per PAIA Regulations.
- Requests are typed cases handled within statutory timeframes.
- Refusals are reasoned and grounded in PAIA exemptions; appeals route per PAIA Reg.

### Roles
Iris owns; Owen co-maintains; case management is event-driven via Mira.

### Breach
Failure to respond within statutory timeframes is a registered event with potential Regulator engagement.

#### Pre-board review
- **Proposer:** Iris (with Owen).
- **Challenged by:** Zara (compliance interface); Vera (timeliness testability).
- **Iteration:** none material.
- **Status:** Ready ✓

---

## 8. Cross-Border Transfer Policy

**Owner:** Iris · **Approval:** BRC · **Cadence:** Annual · **Citation:** POPIA s.72; SARB Directive 3 of 2018.

### Purpose
The bank's discipline on transferring personal information out of South Africa, and on offshoring data under SARB Directive 3.

### Principles
- Transfers under s.72 require one of: comparable law in the destination; binding-corporate-rules / model clauses; data-subject consent; strict necessity for contract or interest of the data subject.
- Cloud-residency assessments per SARB Directive 3 are documented in the Outsourcing register.
- Sub-processor approvals trace upward; data subjects are informed of identifiable categories.
- A standing inventory of cross-border data flows is maintained and reviewed annually.

### Roles
Iris owns; Devon coordinates with Senna on cloud-residency assessment; Imani drafts processor agreements.

### Breach
Unauthorised transfer is a notifiable POPIA breach; immediate IR and regulator engagement.

#### Pre-board review
- **Proposer:** Iris.
- **Challenged by:** Devon (cloud-residency reality); Imani (processor-agreement enforceability); Senna (technical safeguards); Vera (inventory completeness).
- **Iteration:** minor — added annual cross-border inventory review.
- **Status:** Ready ✓

---

## Bundle status

| # | Policy | Status |
|---|---|---|
| 1 | Risk Management & Compliance Programme (RMCP) | **Ready ✓** |
| 2 | AML / CFT Policy | **Ready ✓** |
| 3 | Sanctions Policy | **Ready ✓** (B4 approved) |
| 4 | KYC / CDD / EDD Policy | **Ready ✓** (D1 approved) |
| 5 | Conduct of Business / TCF Policy | **Ready ✓** |
| 6 | POPIA / Privacy Policy | **Ready ✓** (E1 lodgment deferred) |
| 7 | PAIA Manual | **Ready ✓** |
| 8 | Cross-Border Transfer Policy | **Ready ✓** |

All eight pre-board-reviewed and ready for the next decision pack.
