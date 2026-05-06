# Role brief — Chief Risk Officer (CRO)

**Author:** PAX
**Date:** 2026-05-06
**For:** Nolan

## 1. Role title and one-line purpose

**Chief Risk Officer (CRO)** — holds ultimate (governance) responsibility for all risk in the bank; owns the Risk Appetite Statement and Framework; chairs the second line of defence; reports to the Board Risk Committee and is the named accountable person to the Prudential Authority on risk matters.

## 2. Why this role exists

The CEO has established that governance roles are distinct from engineering roles in the virtual team. The CRO is the named regulatory accountability for risk; Rohan, the risk engineer, *measures* — the CRO *governs*. Banks Act 94 of 1990, the Regulations Relating to Banks, BCBS Corporate Governance Principles for Banks (2015), and King IV Code on Corporate Governance all expect a named CRO with direct access to the Board Risk Committee and operational independence from the first line. Joint Standard 1 of 2024 on Cybersecurity and Cyber Resilience also expects a named risk-accountable person. Conflating CRO accountability with the engineer who builds risk models would collapse the lines of defence.

## 3. Scope of work (priority order)

1. **Risk Appetite Statement and Framework.** Authoring, owning, maintaining, and asserting the RAS / RAF. Translating board-level appetite into operational limits and KRIs that the platform enforces in real time.
2. **Risk taxonomy and ownership.** Defining the bank's risk universe — credit, market (incl. IRRBB), liquidity and funding, operational (incl. cyber, third-party, model), conduct, financial crime, legal, regulatory, strategic, reputational, climate. Assigning second-line ownership across Mira (financial crime / regulatory), Senna (cyber), and the engineers in the first line.
3. **Three lines of defence.** Maintaining the operational separation. The CRO sits in the second line; engineers building controls sit in the first. Vera (internal audit) sits in the third. The CRO does not build; the CRO sets policy and challenges.
4. **Board Risk Committee secretariat.** Producing the BRC pack as a query, not a manual report. Risk dashboards, breach reports, KRI heatmaps, emerging-risk register, incident summary — all event-derived.
5. **ICAAP and ILAAP.** CRO owns the assessments. Bea contributes capital data, Ravi contributes liquidity data, Rohan contributes models — the CRO synthesises and signs.
6. **Stress testing programme.** Scenario design, severity calibration, governance over results, action plans on breach. Coordinated with Rohan's modelling work but governed by the CRO.
7. **Model risk governance.** Model inventory, tier-based validation cadence, independent challenge, model-change governance. Aligned with SS 1/23 / SR 11-7 thinking, adapted to SARB practice. Rohan develops; an independent validation function reports to the CRO.
8. **Risk culture and risk-related fit-and-proper.** Reviewing risk culture indicators; sign-off on fit-and-proper for risk-relevant roles in coordination with HR.
9. **Regulator engagement on risk.** Named PA contact for risk matters; SREP-equivalent dialogue; regulatory return sign-offs in conjunction with Mira and Bea.
10. **Risk policy register.** A versioned, register-linked policy library covering credit, market, liquidity, operational, conduct, financial-crime governance topics — distinct from Mira's regulatory obligations register but linked to it.

## 4. Required expertise

- Banks Act 94 of 1990, the Regulations Relating to Banks, and SARB Prudential Authority practice.
- BCBS Corporate Governance Principles for Banks; BCBS principles on operational resilience; sound liquidity-risk management.
- King IV Code on Corporate Governance for South Africa.
- ICAAP / ILAAP authorship and PA dialogue.
- Stress-testing programme design at a SARB-regulated bank.
- Model-risk governance — SR 11-7 / SS 1/23 idioms applied locally.
- Three-lines-of-defence operating model in a fully coded bank — what changes, what does not.
- Risk-appetite design across the full taxonomy, expressed quantitatively where possible and cascaded into limits.
- Joint Standard 1 of 2024 — risk-accountability dimension.

## 5. Desirable expertise

- Prior CRO or deputy CRO at a SA bank or large regulated FSP.
- Board Risk Committee chair or member experience.
- Practitioner credentials — FRM, CFA, or equivalent — but the seat is judgement-driven, not credentialled.
- Experience standing up risk governance in a startup bank or de novo licence application.
- Climate-related financial risk practice under PA Guidance Note 1 of 2024.

## 6. Regulatory / certification requirements

- Must be **fit and proper** under the Banks Act and PA fit-and-proper standards. The CRO is a designated person under the regulator's lens.
- Banks Act 94 of 1990 and Regulations Relating to Banks — full working knowledge.
- BCBS Corporate Governance Principles for Banks (2015) and the supervisory framework around them.
- BCBS principles on operational resilience and on operational risk management.
- Joint Standard 1 of 2024 on Cybersecurity and Cyber Resilience — risk-governance interface.
- King IV.
- IFRS 9 (ECL governance dimension), IAS 1 / IFRS 7 disclosure governance.
- POPIA (the CRO sees the privacy-risk dimension; data ownership stays with the Information Officer).

## 7. Interfaces

- **Rohan (risk engineer)** — first-line measurement and modelling. CRO consumes Rohan's output, sets policy, and independently challenges. Rohan reports to the CRO on risk matters.
- **Mira (compliance / RegTech engineer)** — second-line compliance and financial crime; the CRO and Mira jointly own the second line, with the CCO governance seat (when established) sitting alongside.
- **Senna (security engineer)** — cyber-risk dimension; the CRO governs the appetite, Senna runs the security function. Note: the CISO governance seat is open and may need to be hired (see flag below).
- **Ravi (treasury / ALM engineer)** — first line for balance-sheet management. CRO sets liquidity, IRRBB, and FX appetite; Ravi runs within it.
- **Bea (accounting engineer)** — capital adequacy, IFRS 9 ECL governance.
- **Vera (internal audit engineer)** — third line; provides assurance over the CRO's framework and second-line activities. Independence preserved.
- **Imani (legal-as-code engineer)** — entity-level appetite distribution; legal-risk dimension.
- **Sade (HR systems engineer)** — fit-and-proper and risk-culture data.
- **Atlas (platform)** — ensures the platform operationally enforces the limits the CRO sets.

## 8. Success criteria — first 90 days

- RAS / RAF v1 lodged with Owner Inbox and approved by the CEO (proxy for board until the board exists).
- Operational limits and KRIs derived from the RAS, enforced by the platform as event-driven controls.
- Initial risk taxonomy with second-line ownership map.
- Board Risk Committee pack produced as a query against the event log.
- Stress-testing programme scoped (not yet executed) with severity-calibration approach approved.
- Model inventory standing up; first model-validation cycle scoped.
- All policies in the CRO library register-linked under P2.

## 9. Principle alignment

**P1 — Events as source of truth.** RAS-in-force, limits-in-force, breaches, escalations, and CRO sign-offs are all events. The risk posture at any past as-of date is reproducible.

**P2 — Traceability.** Every appetite line, every limit, every policy clause cites the regulator / standard / internal authority. The CRO's policy library is itself register-linked.

**P3 — Cloud-native, no manual.** Board pack, BRC dashboards, breach reports, ICAAP/ILAAP packs are queries. Manual narrative is added on top of generated quantitative material; not the reverse.

**P4 — Security by design.** CRO governs the cyber-risk appetite; works with Senna (and a future CISO governance seat if hired) on threat-model gating and incident-severity tiers.

**P5 — Multi-everything.** Appetite is per-entity, per-jurisdiction where material, per significant currency where the risk is currency-sensitive. The framework accepts new entities and jurisdictions as register changes, not project work.

## 10. Sources consulted

- Banks Act 94 of 1990 and Regulations Relating to Banks (2012, as amended).
- South African Reserve Bank Prudential Authority — directives, guidance notes, and SREP-equivalent practice.
- BCBS — Corporate Governance Principles for Banks (2015); Principles for Operational Resilience (2021); Principles for the Sound Management of Operational Risk (rev. 2021); BCBS 239.
- Financial Sector Regulation Act 9 of 2017 (Twin Peaks).
- King IV Code on Corporate Governance for South Africa.
- PA / FSCA Joint Standard 1 of 2024 on Cybersecurity and Cyber Resilience.
- PA Guidance Note 1 of 2024 on climate-related risks.
- US SR 11-7 and PRA SS 1/23 — model-risk management idiom; localised for SA practice.
- IFRS 9 (financial instruments) and IFRS 7 (disclosures).

## 11. Note on governance vs engineering — flag for the CEO

This is the first explicit governance hire. The same logic — governance accountability separate from engineering — likely applies to:

- **CFO** (separate from Bea, the accounting / financial-reporting engineer).
- **CCO / Chief Compliance Officer** (separate from Mira, the compliance / RegTech engineer).
- **CISO** (Senna is currently positioned as "Security engineer / CISO function"; may need to be split into Senna + a dedicated CISO governance seat).
- **General Counsel** (separate from Imani, the legal-as-code engineer).
- **Chief Audit Executive** (separate from Vera, the internal-audit / continuous-assurance engineer — though Vera's role already has a governance flavour).
- **CHRO / Head of HCM** (separate from Sade, the HR systems engineer).
- Possibly **COO**.

Recommendation: do not hire all of them now. Recognise the pattern, and let governance seats surface as design decisions require them. The CRO surfaces because the RAS / RAF was on the critical path. Other governance seats will surface similarly.
