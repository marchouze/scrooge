// prototype/scripts/obligation-summaries/domain-i-summaries.ts
//
// P4-SCALE — Domain I (Labour / HR / employment) reviewed requirement summaries.
// All rows are SA `ORG-HR-*` thin one-liners → `reviewed-modified`; SA source
// text is `missing` in the live drill-down, so each summary is authored from the
// citation + existing prose with the gap noted (not fabricated).
//
// NB (build phase): per CLAUDE.md, Imani's employment-contracts/disciplinary
// slice and Sade's human-HR slice are paused until licence-day; these
// obligations bind at licence-day but the substrate must be production-grade by
// then. The summaries describe the steady-state obligation. Owning seat: coo.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { SummaryModule } from "./summary-types";

const SA_MISSING = "SA source text missing in the drill-down (no extractable graph Provision text for the SA labour statute); summary authored from the citation + existing requirement prose.";

export const DOMAIN_I: SummaryModule = {
  "ORG-HR-01": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Maintain fair labour practices in line with the Labour Relations Act 66 of 1995, applying due process to all disciplinary and grievance matters so that employees are treated procedurally and substantively fairly. Operate documented disciplinary and grievance procedures consistent with the LRA and its Codes of Good Practice, with the right to representation and to be heard before any sanction.",
    rationale: `Thin one-liner expanded from the Labour Relations Act 66/1995 citation. ${SA_MISSING}`,
  },
  "ORG-HR-02": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Ensure every dismissal is both substantively fair (a fair reason related to conduct, capacity or operational requirements) and procedurally fair (a fair process before the decision), as required by the LRA and the Code of Good Practice: Dismissal. Document the reason and the process for each dismissal so the bank can discharge its onus at the CCMA or Labour Court if challenged.",
    rationale: `Thin one-liner expanded from the LRA + Codes of Good Practice citation. ${SA_MISSING}`,
  },
  "ORG-HR-03": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Comply with the minimum conditions of employment set by the Basic Conditions of Employment Act 75 of 1997 — ordinary and maximum working hours, overtime, rest periods, annual, sick and family-responsibility leave, and payslip particulars — for all employees below the earnings threshold and as otherwise applicable. Configure rostering, leave and payroll controls so that no employee is engaged below the BCEA minima.",
    rationale: `Thin one-liner expanded from the BCEA 75/1997 citation. ${SA_MISSING}`,
  },
  "ORG-HR-04": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Eliminate unfair discrimination in employment and, as a designated employer, implement affirmative-action measures under the Employment Equity Act 55 of 1998, supported by a consultative Employment Equity Plan. Prepare and submit the annual EE report (EEA2/EEA4) to the Department of Employment and Labour and retain the supporting workforce-profile analysis.",
    rationale: `Thin one-liner expanded from the Employment Equity Act 55/1998 citation. ${SA_MISSING}`,
  },
  "ORG-HR-05": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Apply the principle of equal pay for work of equal value under the Employment Equity Act and its Code of Good Practice, ensuring pay differentials are justified only by fair, rational and non-discriminatory factors. Conduct and document periodic gender- and equity-pay reviews and remediate unjustified differentials.",
    rationale: `Thin one-liner expanded from the EE Act + Codes of Good Practice (equal-pay) citation. ${SA_MISSING}`,
  },
  "ORG-HR-06": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Prevent and address harassment — including sexual harassment — in the workplace as required by the Employment Equity Act and the Code of Good Practice on the Prevention and Elimination of Harassment in the World of Work. Maintain a harassment policy, confidential reporting and investigation procedures, and protections against victimisation for complainants.",
    rationale: `Thin one-liner expanded from the EE Act harassment-prevention citation. ${SA_MISSING}`,
  },
  "ORG-HR-07": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Pay the Skills Development Levy under the Skills Development Levies Act and submit the Workplace Skills Plan and Annual Training Report to the relevant SETA under the Skills Development Act 97 of 1998 to qualify for mandatory-grant recovery. Maintain the training records and committee consultation the SETA grant process requires.",
    rationale: `Thin one-liner expanded from the Skills Development Act 97/1998 + SDL Act citation. ${SA_MISSING}`,
  },
  "ORG-HR-08": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Measure and report B-BBEE compliance under the B-BBEE Act and the Financial Sector Code, obtaining a verified B-BBEE certificate across the applicable scorecard elements (ownership, management control, skills development, enterprise and supplier development, and socio-economic development). Submit the required B-BBEE reporting and maintain the supporting evidence.",
    rationale: `Thin one-liner expanded from the B-BBEE Act + Financial Sector Code citation. ${SA_MISSING}`,
  },
  "ORG-HR-09": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Maintain an occupational-health-and-safety programme under the Occupational Health and Safety Act 85 of 1993, including appointed health-and-safety responsible persons, periodic risk assessments, and incident recording and reporting. Provide a working environment that is safe and without risk to the health of employees as far as is reasonably practicable.",
    rationale: `Thin one-liner expanded from the OHSA 85/1993 citation. ${SA_MISSING}`,
  },
  "ORG-HR-10": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Operate a risk-aligned remuneration framework for material risk-takers consistent with the Banks Act, the BCBS principles for sound compensation practices and King IV, applying deferral of variable pay, malus and clawback so that pay outcomes reflect realised risk over time. Govern remuneration through an independent Remuneration Committee and align incentives away from excessive risk-taking.",
    rationale: `Thin one-liner expanded from the Banks Act + BCBS Compensation principles + King IV citation. ${SA_MISSING}`,
  },
  "ORG-HR-11": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Ensure every designated officer (the CEO, executive officers and other key persons) meets the Prudential Authority's fit-and-proper standards under the Banks Act on appointment and continuously thereafter, covering honesty and integrity, competence, and financial soundness. Re-assess fit-and-proper status on a periodic basis and on any trigger event, and report changes to the PA as required.",
    rationale: `Thin one-liner expanded from the Banks Act + PA fit-and-proper standards citation. ${SA_MISSING}`,
  },
};
