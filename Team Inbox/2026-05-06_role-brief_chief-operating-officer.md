# Role brief — Chief Operating Officer (COO)

**Author:** PAX
**Date:** 2026-05-06
**For:** Nolan

## 1. Role title and one-line purpose

**Chief Operating Officer (COO)** — runs the bank operationally; governance owner of all operations and engineering; accountable for delivery, operational resilience, and the platform that the rest of the bank stands on.

## 2. Why this role exists

The CEO has confirmed (2026-05-06) that the COO holds **all operations and engineering** and reports directly to the CEO. In a bank that is built — not bought — the COO seat is unusually weighty: the platform, the customer-facing channels, the payments and settlement rails, the data engine, and the security and identity substrate are not vendor outputs but products of the engineering team. The COO is the executive accountable for them functioning. BCBS Principles for Operational Resilience (2021) and the FSB / SARB operational-resilience expectations all assume a named accountable executive at this seniority.

This is a governance seat. Devon does not personally write code, build pipelines, or run a control. Devon governs the people who do, sets the operational priorities, and answers to the CEO and the board for delivery and resilience.

## 3. Scope of work (priority order)

1. **Operating model.** Owns the bank's operating model end-to-end. Sets priorities across engineering, sequences delivery, and arbitrates trade-offs between domains.
2. **Operational resilience.** Named accountable executive for operational-resilience under BCBS principles — important business services identified, impact tolerances set, scenarios tested, severe-but-plausible disruption rehearsed.
3. **Technology and platform.** Governance over Atlas's platform agenda — the event log, projection runtime, identity, IaC. Sets architectural priorities; signs platform roadmap.
4. **Customer-facing channels and operations.** Owns the customer-experience layer (Niko's outputs to clients), the payments and settlement spine (Tomas), the data engine (Anya), and the trading systems (Kai). Sets SLOs and incident-response posture for each.
5. **Third-party and outsourcing risk (operational dimension).** SARB Directive 3 of 2018 on cloud / offshoring; vendor governance, sub-processor approvals, exit planning. Coordinated with Iris (privacy) and Senna (security).
6. **Cyber and information security (interim oversight).** Until a CISO governance seat is hired, Senna reports to the COO. The COO holds operational accountability for cyber resilience under Joint Standard 1 of 2024; the CRO holds risk-governance accountability.
7. **Legal-engineering interim oversight.** Until a General Counsel governance seat is hired, Imani reports to the COO with a dotted line to Owen (CoSec) for governance-pathway matters.
8. **HR-engineering interim oversight.** Until a CHRO governance seat is hired, Sade reports to the COO.
9. **Change governance.** Release governance, change-advisory discipline, post-incident review pathway. Outputs are events under P1 and queries under P3.
10. **Capacity and capability.** Headcount planning, skills mix, sequencing of governance hires from an operational-resilience perspective.

## 4. Direct and matrix reporting (subject to CEO confirmation)

**Direct reports (engineering seats with no other governance home today):**
- Atlas — core banking platform architect.
- Kai — trading systems engineer.
- Tomas — operations & payments engineer.
- Niko — sales / CRM engineer.
- Anya — data / analytics engineer.
- Senna — security engineer (interim, until CISO hired).
- Imani — legal-as-code engineer (interim, until GC hired).
- Sade — HR systems engineer (interim, until CHRO hired).

**Not under the COO** (governance-vs-engineering principle):
- Rohan — risk engineer; reports to Helena (CRO).
- Mira — compliance / RegTech engineer; reports to Zara (CCO).
- Bea — accounting engineer; reports to the new CFO.
- Yael — tax engineer; reports to the new CFO.
- Ravi — treasury / ALM engineer; reports to the new CFO. (Treasury is a finance function; the CRO sets risk appetite over it, but operational management of the balance sheet sits under the CFO.)
- Vera — internal audit engineer; functionally independent, reports administratively through the CEO with a dotted line to Owen and a future CAE; *third-line independence is non-negotiable*.

## 5. Required expertise

- Senior operating leadership at a regulated SA financial-services institution — bank, large insurer, or large fintech.
- Operational resilience under BCBS principles; FMI-grade reliability disciplines.
- Governance over technology delivery in a build-not-buy context — coded controls, event-sourced architectures, projection-based reporting.
- Cyber-resilience operational accountability under Joint Standard 1 of 2024.
- Third-party and cloud-outsourcing governance under SARB Directive 3 of 2018.
- Incident command at executive level — payments, settlement, customer outage, security event.
- Capacity for arbitration — making the call when domain leads disagree, and being right often enough.

## 6. Desirable expertise

- Prior COO or deputy COO at a SA bank or settlement institution.
- Track record of standing up de novo banking operations, ideally including SARB licence application.
- Engineering leadership credibility — has been close enough to the build to govern it without being captured by it.
- Familiarity with BankservAfrica, SAMOS, SWIFT, ISO 20022 operational realities.

## 7. Regulatory / certification requirements

- **Fit and proper** under PA / FSCA standards. The COO is a designated executive under regulator engagement.
- BCBS Principles for Operational Resilience (2021); BCBS Principles for the Sound Management of Operational Risk (rev. 2021).
- Joint Standard 1 of 2024 on Cybersecurity and Cyber Resilience — operational-accountability dimension.
- SARB Directive 3 of 2018 on cloud computing and offshoring of data.
- Working knowledge of King IV operational-governance expectations.

## 8. Interfaces

- **CEO (Marc)** — reports to.
- **Helena (CRO)** — risk peer; the CRO sets appetite, the COO operates within it. ALCO and BRC interaction.
- **CFO (Camille)** — finance peer; the CFO owns capital, financial reporting, and treasury; the COO owns the platform that produces the data the CFO reports.
- **Owen (CoSec)** — board pathway, delegation of authority, change governance.
- **Zara (CCO)** — compliance interfaces; conduct, sanctions, and AML/CFT operational integration.
- **Iris (IO)** — privacy-by-design gate; operational privacy compliance.
- **Vera (audit engineer)** — third-line independence; the COO cooperates with audit but does not control it.

## 9. Success criteria — first 90 days

- Operating model documented and approved — domains, SLOs, escalation, change governance, incident response.
- Important business services identified per BCBS Operational Resilience principles, with impact tolerances drafted (final approval at BRC level).
- Severe-but-plausible scenario test scheduled and scoped.
- Cyber-resilience operational accountability under Joint Standard 1 of 2024 documented; interim CISO arrangement clear; threat-model gate operating across engineering.
- SARB Directive 3 of 2018 cloud-and-offshoring assessment for the platform footprint completed.
- Engineering capacity plan and sequencing aligned with governance hires the framework will recommend.
- Direct-reports rhythm established — weekly with each engineer, monthly operating reviews, quarterly resilience reviews.

## 10. Principle alignment

**P1 — Events as source of truth.** Operational decisions, change approvals, incident events, SLO breaches, delegation actions are all events. The operating posture at any past as-of date is reproducible.

**P2 — Traceability.** Every operational policy and SLO cites the regulator / standard / internal authority that justifies it. The COO's policy library is register-linked.

**P3 — Cloud-native, no manual.** Operating reviews, change boards, incident reports, resilience-test outputs — all queries. Manual reporting is a tracked exception.

**P4 — Security by design.** The COO holds operational accountability for cyber resilience until a CISO is hired; threat-model gating is enforced at engineering-direct-reports level.

**P5 — Multi-everything.** The operating model is per-entity, per-jurisdiction ready. Adding a subsidiary or branch adds register entries; the operating model does not change.

## 11. Sources consulted

- BCBS — Principles for Operational Resilience (2021); Principles for the Sound Management of Operational Risk (rev. 2021); BCBS 239.
- SARB Prudential Authority — Directive 3 of 2018 on cloud computing and offshoring of data; operational-risk guidance.
- PA / FSCA — Joint Standard 1 of 2024 on Cybersecurity and Cyber Resilience.
- FSB — operational-resilience policy work.
- King IV — operational governance dimension.
- Banks Act 94 of 1990 and Regulations Relating to Banks.
- ITIL 4, SRE practice (Google) — used as references for operating discipline, not prescriptions.

## 12. Note on COO scope

CEO directive is "all operations, engineering". Read literally, this would include every role with "engineer" in the title; but several engineers report properly to other governance seats (Rohan → CRO, Mira → CCO, Bea / Yael / Ravi → CFO, Vera independent). The natural reading — and the one applied in this brief — is that the COO governs all *operational and platform* engineering and that domain-specific engineers report through their governance home. PAX flags this for CEO confirmation; default proceeds on the natural reading unless redirected.
