// scripts/file-scrooge-lra-66-1995-hr-source-map.ts
//
// One-shot RMS Phase 3 filing for Scrooge's Labour Relations Act 66/1995
// HR-family source map. Emits a RecordFiled event so the Documents register
// holds a canonical, readable extract of the LRA sections that back the
// HR-family obligations — prepared so Mira (Compliance / RegTech engineer,
// engineering) can author section-level citations and lift ORG-HR-01/02 off
// the URN_TBD_ALLOWLIST on her next scheduled tick.
//
// Research-only deliverable: it changes no obligation data, no recon allowlist,
// and no decision state. The body is embedded inline (Phase 4 — D-RMS-PHASE-4 —
// made the content-addressed document store the canonical home; no in-tree root
// render is created).
//
// Authority: D-RMS-PHASE-3 (active); D-OBLIGATIONS-REGISTER-CLEANUP.
// Author: Scrooge (Chief of Staff / orchestrator)

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const body = `# Labour Relations Act 66 of 1995 — HR-family source map & proposed section citations

**Author:** Scrooge (Chief of Staff / orchestrator)
**Date:** 2026-06-11
**For:** Mira (Compliance / RegTech engineer, engineering)
**Authority:** D-OBLIGATIONS-REGISTER-CLEANUP; D-RMS-PHASE-3
**Source:** Labour Relations Act 66 of 1995, authoritative gov.za consolidated text
(\`act66-1995labourrelations.pdf\`).

## Purpose

While investigating why \`obligation.html?id=ORG-HR-01\` shows an empty URN/source field,
we confirmed the cause is **by design**: ORG-HR-01's citation is the bare Act name
("Labour Relations Act 66/1995") with no enumerable section, so the deterministic URN
minter (\`urn:reg:za:<instrument>:<section>\`) cannot produce a URN. ORG-HR-01 through
ORG-HR-11 are on the documented \`URN_TBD_ALLOWLIST\` in
\`prototype/platform/recon/obligation-urn-coverage.ts\` (advisory gate, non-blocking).

This record is the readable, verbatim source map of the LRA sections that actually back
the HR-family obligations, prepared so Mira can sharpen the two LRA-sourced citations and
mint their URNs on her next tick. It files research only — no seed edit, no allowlist
change.

## Verbatim section extracts

### Chapter III, Part A — Organisational rights

**s.14(4)(a) — Trade-union representative functions.** "A trade union representative has
the right to perform the following functions— (a) at the request of an employee in the
workplace, to assist and represent the employee in grievance and disciplinary proceedings."

**s.14(5) — Paid time off.** "Subject to reasonable conditions, a trade union
representative is entitled to take reasonable time off with pay during working hours— (a) to
perform the functions of a trade union representative; and (b) to be trained in any subject
relevant to the performance of the functions of a trade union representative."

### Chapter VIII — Unfair dismissal and unfair labour practice

**s.185 — Right not to be unfairly dismissed.** "Every employee has the right not to be (a)
unfairly dismissed; and (b) subjected to unfair labour practice."

**s.186(1) — Meaning of "dismissal".** Paragraphs (a)–(f): termination with or without
notice; failure to renew a fixed-term contract (or renewal on less favourable terms) where
there was a reasonable expectation of renewal; refusal to allow an employee to resume work
after maternity leave; selective re-employment after dismissal of a number of employees for
the same reason; constructive dismissal (employee terminates because the employer made
continued employment intolerable); transfer-related constructive dismissal.

**s.186(2) — Meaning of "unfair labour practice".** Paragraphs (a)–(d): (a) unfair conduct
relating to promotion, demotion, probation, training or the provision of benefits; **(b)
unfair suspension or any other unfair disciplinary action short of dismissal**; (c) failure
or refusal to reinstate or re-employ a former employee in terms of an agreement; (d)
occupational detriment (other than dismissal) for having made a protected disclosure under
the Protected Disclosures Act.

**s.187 — Automatically unfair dismissals.** Reasons (a)–(h): participation in a protected
strike; refusal to do the work of a striking employee; compelling acceptance of a demand in
a matter of mutual interest; exercising LRA rights; pregnancy / intended pregnancy / related
reasons; unfair discrimination on any arbitrary ground (incl. race, gender, sex, ethnic or
social origin, colour, sexual orientation, age, disability, religion, conscience, belief,
political opinion, culture, language, marital status, family responsibility); transfer (or
reason related to a transfer) of a business as a going concern; a protected disclosure.

**s.188 — Other unfair dismissals.** "(1) A dismissal that is not automatically unfair, is
unfair if the employer fails to prove— (a) that the reason for dismissal is a fair reason—
(i) related to the employee's conduct or capacity; or (ii) based on the employer's
operational requirements; and (b) that the dismissal was effected in accordance with a fair
procedure. (2) Any person considering whether or not the reason for dismissal is a fair
reason or whether or not the dismissal was effected in accordance with a fair procedure must
take into account any relevant code of good practice issued in terms of this Act." (The
relevant code = Schedule 8.)

**s.189 / s.189A — Operational-requirements dismissals.** Consultation obligations; written
notice inviting consultation; disclosure in writing of all relevant information (paras
(a)–(j): reasons, alternatives considered, number/categories affected, proposed selection
method, timing, severance, assistance, prospect of re-employment, etc.); right of the other
consulting party to make representations and the employer's duty to respond; fair and
objective selection criteria. s.189A adds the large-scale-retrenchment facilitation regime.

### Schedule 8 — Code of Good Practice: Dismissal

- **Item 1 — Introduction.** Purpose, primacy of collective agreements, and the key
  mutual-respect principle underlying fairness.
- **Item 2 — Fair reasons for dismissal.** Unfair unless a fair reason (conduct, capacity or
  operational requirements) **and** a fair procedure; automatically unfair if it infringes a
  fundamental right or s.187; employer bears the onus.
- **Item 3 — Disciplinary measures short of dismissal.** Employers should adopt clear,
  certain, consistent disciplinary rules; courts endorse corrective / progressive
  discipline; formal procedures need not be invoked for every minor breach; dismissal
  reserved for serious misconduct or repeated offences; first-offence dismissal only for
  misconduct so grave it makes the relationship intolerable (e.g. gross dishonesty, wilful
  damage, endangering safety, assault, gross insubordination); consistency of sanction.
- **Item 4 — Fair procedure (the keystone for ORG-HR-01).** "Normally, the employer should
  conduct an investigation… notify the employee of the allegations using a form and language
  that the employee can reasonably understand… allow… the opportunity to state a case in
  response… a reasonable time to prepare the response and to the assistance of a trade union
  representative or fellow employee. After the enquiry, the employer should communicate the
  decision taken, and preferably furnish the employee with written notification of that
  decision." Plus: consult the union before disciplining a union representative/office-bearer;
  on dismissal give the reason and remind of referral rights; exceptional-circumstances
  dispensation.
- **Item 5 — Disciplinary records.** "Employers should keep records for each employee
  specifying the nature of any disciplinary transgressions, the actions taken by the employer
  and the reasons for the actions."
- **Item 6 — Dismissals and industrial action.** Substantive fairness factors for dismissal
  arising from unprotected strike action; ultimatum requirements; contact with the union.
- **Item 7 — Guidelines for misconduct dismissals.** Valid/reasonable rule; employee aware (or
  reasonably expected to be); consistent application; dismissal an appropriate sanction.
- **Items 8–9 — Incapacity: poor work performance.** Probation regime (subitems (a)–(j)) and
  the post-probation fair-process requirements; guidelines for assessing fairness.
- **Items 10–11 — Incapacity: ill health or injury.** Investigation, alternatives short of
  dismissal, accommodation of disability; guidelines for assessing fairness.

## Proposed citation / URN map (LRA-sourced obligations only)

Only **two** of the eleven HR-family obligations are LRA-sourced:

| ID | Current citation | Sharpened citation | Mintable URN |
|---|---|---|---|
| ORG-HR-01 | "Labour Relations Act 66/1995" | LRA 66/1995 s.185, s.186(2)(b), s.188, Sch 8 Item 4 (+ s.14(4)(a)) | \`urn:reg:za:lra-66-1995:s188\` |
| ORG-HR-02 | "LRA + Codes of Good Practice" | LRA 66/1995 s.188 + Schedule 8 | \`urn:reg:za:lra-66-1995:s188\` / \`:sch8\` |

ORG-HR-01's requirement ("due process to all disciplinary and grievance matters") maps most
precisely to **Schedule 8 Item 4** (fair procedure) anchored on **s.188(1)(b)**, with s.185
as the underlying right and s.186(2)(b) covering disciplinary action short of dismissal.

## Scope note — the other nine HR obligations

ORG-HR-03 through ORG-HR-11 cite different statutes and each needs its own source research
before a URN can be minted:

- ORG-HR-03 — Basic Conditions of Employment Act 75 of 1997
- ORG-HR-04 — Employment Equity Act 55 of 1998 (unfair discrimination + affirmative action)
- ORG-HR-05 — EE Act + Code of Good Practice (equal pay for work of equal value)
- ORG-HR-06 — EE Act (harassment, incl. sexual harassment)
- ORG-HR-07 — Skills Development Act 97 of 1998 + Skills Development Levies Act
- ORG-HR-08 — B-BBEE Act + Financial Sector Code
- ORG-HR-09 — Occupational Health and Safety Act 85 of 1993
- ORG-HR-10 — Banks Act + BCBS compensation principles + King IV (remuneration)
- ORG-HR-11 — Banks Act + PA fit-and-proper standards (designated officers)

These are **not** in scope of this LRA deliverable.

## Downstream authoring steps for Mira (record only — not executed here)

1. Sharpen the ORG-HR-01 and ORG-HR-02 citations in
   \`Regulations/_obligations.seed.json\` to the section references above.
2. Re-run the URN backfill (\`scripts/backfill-obligations.ts\`) so the minter produces
   \`urn:reg:za:lra-66-1995:s188\`.
3. Drop ORG-HR-01 and ORG-HR-02 from \`URN_TBD_ALLOWLIST\` in
   \`platform/recon/obligation-urn-coverage.ts\`.
4. Re-run \`recon:obligation-urn-coverage\` to confirm the two move from allowlisted to
   populated with zero new residuals.
`;

const result = recordFiled(
  {
    recordId: "record:documents:scrooge:lra-66-1995-hr-source-map:2026-06-11",
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-OBLIGATIONS-REGISTER-CLEANUP", "D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:scrooge:chief-of-staff",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Labour Relations Act 66/1995 — HR-family source map & proposed section citations",
      path: "2026-06-11_scrooge_lra-66-1995-hr-source-map.md",
      category: "compliance-research",
      author: "Scrooge (Chief of Staff / orchestrator)",
      date: "2026-06-11",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
