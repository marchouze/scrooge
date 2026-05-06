# Role brief — HR systems engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**HR systems engineer** — designs and runs the employee-lifecycle, payroll, and statutory-reporting platform: hire to retire, fully automated, fully compliant with SA labour and tax law.

## 2. Why this role exists

Even a small online bank carries heavy people-related obligations: PAYE, UIF, SDL, EE reporting, B-BBEE, BCEA leave records, fit-and-proper for FAIS roles, and a defensible employment record for every staff member. This role builds the system so that every obligation is met by code, every month, without manual preparation.

## 3. Scope of work (priority order)

1. Employee master and lifecycle — offer, hire, onboarding, role changes, terminations, off-boarding evidence.
2. Payroll — gross-to-net, PAYE, UIF, SDL, retirement, medical, garnishees; EMP201 monthly, EMP501 bi-annual, IRP5/IT3(a) generation.
3. Leave, time, and attendance under BCEA — annual, sick, family responsibility, parental, study; statutory minima as defaults.
4. Benefits administration — retirement fund, group life, medical, gap cover.
5. Performance, objectives, and remuneration — including FSCA/PA expectations on remuneration governance for material risk takers.
6. Skills development — Workplace Skills Plan, Annual Training Report, SETA submissions, SDL claims.
7. Employment Equity reporting — EEA2 and EEA4, with the supporting analytics.
8. B-BBEE — element evidence, scorecard preparation, verification support.
9. Fit-and-proper register for FAIS-affected roles, in lock-step with compliance.
10. Disciplinary and CCMA-evidence record-keeping.

## 4. Required expertise

- South African payroll and labour law in deep detail.
- HRIS / payroll system design (SAGE 300 People, PaySpace, Sage VIP, Workday, BambooHR — patterns, not necessarily the products).
- Statutory reporting toolchains for SARS, UIF, COIDA, Department of Employment and Labour.
- Confidentiality and data-minimisation — POPIA applies hard to HR data.

## 5. Desirable expertise

- Remuneration governance for regulated financial institutions (PA Directive on remuneration).
- Experience with B-BBEE verification preparation.
- Skills-development levy optimisation and SETA discretionary grants.

## 6. Regulatory / certification requirements

- Basic Conditions of Employment Act 75 of 1997.
- Labour Relations Act 66 of 1995.
- Employment Equity Act 55 of 1998.
- Skills Development Act 97 of 1998 and Skills Development Levies Act 9 of 1999.
- Compensation for Occupational Injuries and Diseases Act 130 of 1993 (COIDA).
- Income Tax Act 58 of 1962 — Fourth Schedule (PAYE).
- Unemployment Insurance Act 63 of 2001 and UI Contributions Act 4 of 2002.
- B-BBEE Act 53 of 2003 and the Financial Sector Code.
- POPIA — special-personal-information handling for HR.
- FAIS fit-and-proper requirements.
- SAPA (South African Payroll Association) practitioner status preferred.

## 7. Interfaces

- **Tax engineer** — payroll taxes feed into the SARS submission stack.
- **Compliance engineer** — fit-and-proper, FAIS rep register, conflicts of interest.
- **Legal-as-code engineer** — employment contracts, policies, disciplinary records.
- **Accounting engineer** — payroll journal into the GL; provisions for leave and bonuses.
- **Internal audit engineer** — control evidence over remuneration and access.

## 8. Success criteria — first 90 days

- Employee master and lifecycle live for the founding team.
- A working payroll run for one period, with EMP201 in test mode.
- BCEA-compliant leave engine.
- Fit-and-proper register stub agreed with compliance.
- POPIA-compliant HR data architecture documented and reviewed.

## 9. Principle alignment

**P1 — Events as source of truth.** Headcount, leave balances, payroll obligations, training records, and EE classifications are projections of employee events: hire, role change, pay change, leave taken, training completed, termination. Payroll is continuously computable; the EMP201 submission is a snapshot of a query at month-end, not a batch run.

**P2 — Traceability.** Every payroll deduction, leave rule, statutory return, and EE / B-BBEE entry cites its source: BCEA section, ITA Fourth Schedule, UI Act, SDL Act, EE Act, B-BBEE Act, Financial Sector Code, or internal policy. Fit-and-proper records cite the FAIS Determination provisions they evidence.

**P3 — Cloud-native, no manual.** Digital onboarding, e-signed employment contracts, paperless payroll. SARS, UIF, and SETA submissions via eFiling and APIs. Personnel files exist only as structured records. Disciplinary processes run as in-system workflows with full evidence.

**P4 — Security by design.** HR data is "special personal information" under POPIA: stricter access, encryption at field level, and full read-event auditing. Self-service is bounded by least-privilege scopes. Insider-risk monitoring covers HR systems explicitly.

**P5 — Multi-everything.** Ready for multi-country payroll dispatch on expansion: tax regime, labour law, social security, leave law, and pay-element catalogue per jurisdiction. Entity per employer where required. Currency per pay element where employees are paid cross-border.

## 10. Sources consulted

- Department of Employment and Labour — BCEA, LRA, EEA, SDA acts and regulations.
- South African Revenue Service — PAYE Guide for Employers, EMP201/501 BRS, IRP5/IT3(a) BRS.
- South African Reserve Bank Prudential Authority — Directives on remuneration governance.
- Department of Trade, Industry and Competition — B-BBEE Act and Financial Sector Code.
- Information Regulator — POPIA guidance on employee personal information.
- South African Payroll Association — practitioner standards.
