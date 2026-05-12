---
title: FAIS Fit and Proper Requirements 2017 — Analysis
author: Mira (Compliance / RegTech engineer)
date: 2026-05-12
status: PARTIAL — source document not retrieved; analysis based on secondary references and FAIS Act s.8 primary text
decision-required: false
---

# Determination of Fit and Proper Requirements for Financial Services Providers (2017)

**Source document:** `Regulations/FSCA/source-docs/fais-fit-and-proper-2017.txt` (STUB — not retrieved)
**Instrument:** Board Notice 194 of 2017, published Government Gazette 41341, 15 December 2017
**Enabling provision:** FAIS Act 37 of 2002, s.8(1)
**Replaces:** Board Notice 106 of 2008 (Determination of Fit and Proper Requirements 2008)
**Curator:** Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO)
**Status:** PARTIAL — substantive analysis populated from FAIS Act s.8 primary text + cross-references in existing procedure files. Full section-by-section analysis with verbatim text requires manual download of BN 194 of 2017 from FSCA.
**Last reviewed:** 2026-05-12
**Entity scope:** `securities` (Hoz Securities Limited — FSP licensee; Saskia as KI; representatives)

---

## Retrieval action required

The PDF for Board Notice 194 of 2017 could not be retrieved via automated fetch (FSCA website authentication-gated; gov.za gazette search unsuccessful). Manual action required:

1. Visit https://www.fsca.co.za/Legislation/ (FAIS section > Subordinate Legislation)
2. Download Board Notice 194 of 2017 (Determination of Fit and Proper Requirements)
3. Save to `Regulations/FSCA/source-docs/fais-fit-and-proper-2017.pdf`
4. Run: `pdftotext Regulations/FSCA/source-docs/fais-fit-and-proper-2017.pdf Regulations/FSCA/source-docs/fais-fit-and-proper-2017.txt`
5. Update this file with verbatim text from the Schedule

---

## Citation

Board Notice 194 of 2017 — Determination of Fit and Proper Requirements for Financial Services Providers, published under FAIS Act 37 of 2002 s.8(1). Obligations register rows: `ORG-FAIS-KI` (Saskia as steady-state KI); `ORG-HR-11` (fit and proper standards for officers). Procedure: `Procedures/by-policy/fais-ki-fit-and-proper.md`.

---

## Enabling provision — FAIS Act s.8(1)

The fit and proper requirements derive from the primary enabling provision at FAIS Act s.8(1). The verbatim text (from source-docs/fais-act-37-2002.txt):

> An application for an authorisation referred to in section 7(1)... must be submitted to the registrar in the form and manner determined by the registrar by notice in the Gazette, and be accompanied by information to satisfy the registrar that the applicant complies with the requirements for fit and proper financial services providers or categories of providers, determined by the registrar by notice in the Gazette, after consultation with the Advisory Committee, in respect of — **(a) personal character qualities of honesty and integrity; (b) the competence and operational ability of the applicant to fulfil the responsibilities imposed by this Act; and (c) the applicant's financial soundness:** Provided that where the applicant is a partnership, a trust or a corporate or unincorporated body, the applicant must, in addition, so satisfy the registrar that any key individual in respect of the applicant complies with the said requirements in respect of — (i) personal character qualities of honesty and integrity; and (ii) competence and operational ability, to the extent required in order for such key individual to fulfil the responsibilities imposed on the key individual by this Act.

The Determination of Fit and Proper Requirements 2017 (BN 194) operationalises the three FAIS Act s.8(1) dimensions (honesty/integrity; competence/operational ability; financial soundness) into five sub-dimensions with detailed Schedule requirements.

---

## Five dimensions — structure (from secondary references)

The Determination sets requirements across five dimensions. The cross-references below are derived from the existing procedure file `Procedures/by-policy/fais-ki-fit-and-proper.md` and Sade's template at `Owner Inbox/2026-05-09_sade_fais-ki-fit-and-proper-template.md`. Section references are `[citation: TBC — pending manual download of BN 194]` pending the PDF retrieval noted above.

### Dimension 1: Honesty and integrity

Maps to FAIS Act s.8(1)(a). The Determination sets requirements for:
- Criminal-record clearance (no convictions for dishonesty, fraud, theft, forgery, perjury or similar);
- Civil judgments disclosure;
- Regulatory sanctions and enforcement history (FSCA / SARB PA / FIC);
- Ongoing disclosure obligation when personal circumstances change.

**Citation:** FAIS Act s.8(1)(a) + BN 194 of 2017 § `[TBC — Schedule section on honesty and integrity]`

**Application to Hoz — Saskia as KI:**
- Background-check process: `Procedures/by-policy/fais-ki-fit-and-proper.md` §5.1 (steps 1.1–1.5)
- Evidence events: `BackgroundCheckCompleted` (Atlas v1 substrate gap)
- Failure trigger: any background-check hit → immediate escalation to Zara (CCO); KI advancement halted

### Dimension 2: Competence

Maps to FAIS Act s.8(1)(b) (competence element). The Determination sets:

**Qualifications:**
- Schedule 1 of BN 194 specifies minimum qualifications per product sub-category.
- Category I FSPs: minimum NQF 4-equivalent qualification recognised by the South African Qualifications Authority (SAQA) for the specific sub-categories of advice/intermediary services rendered.
- Category II (Discretionary FSPs): higher qualification threshold — NQF 5-equivalent or higher for investment management sub-categories.
- KIs are subject to the qualification requirement for the full scope of the licence categories under which the FSP operates.

**Experience:**
- Minimum 1 year experience per Category I product sub-category before rendering financial services without supervision.
- Minimum 3 years for Category II sub-categories.
- Experience must be demonstrated across the specific financial product sub-categories relevant to the licence (not generic financial services experience).

**Regulatory examinations:**
- RE 1 (Key Individuals): mandatory for all KIs of FSPs in Categories I, II, IIA, III, IV. At least one KI of the FSP must have passed RE 1.
- RE 5 (Representatives): mandatory for all representatives. Tests FAIS Act, General Code, ethics.
- Class of Business (CoB) examinations: additional product-specific examinations may be required per the Determination Schedule for certain product sub-categories.

**CPD (Continuing Professional Development):**
- Minimum annual CPD obligation post-qualification.
- Typically 12–16 CPD points per annual cycle (exact figure by category per BN 194 Schedule `[TBC]`).
- CPD must be in the relevant areas of financial services covered by the FSP's licence.

**Citation:** FAIS Act s.8(1)(b) + BN 194 of 2017 §§ `[TBC — Schedule sections on qualifications, experience, RE, CPD]`

**Application to Hoz — Saskia as KI:**
- RE 1 pass certificate must be held or obtained before FSP-licence application
- Qualifications in the relevant sub-categories (structured products, bonds, equities, money market, forex, derivatives) must be verified
- Experience: minimum 1 year (Category I) or 3 years (Category II) per sub-category — Saskia's global-markets background is the substantive evidence basis
- CPD: ongoing obligation post-licence; Sade's (AgentOps engineer) CPD-provider feed substrate tracks compliance
- Process: `Procedures/by-policy/fais-ki-fit-and-proper.md` §5.2

### Dimension 3: Operational ability

Maps to FAIS Act s.8(1)(b) (operational ability element). The Determination sets:
- Ability to discharge the seat-specific responsibilities of the KI role;
- Capacity assessment — the KI cannot be so over-loaded that oversight is nominal;
- Operational independence — the KI must be able to halt FSP-regulated activities if compliance fails.

**Application to Hoz — Saskia as KI:**
- Specific responsibilities: oversight of representatives; compliance with GCC; maintenance of FAIS records; liaison with FSCA
- Structural conflict: Saskia as Head of Global Markets (revenue accountability) AND FAIS KI (compliance oversight) — mitigation must be documented (see `fais-ki-fit-and-proper.md` §5.3)
- Owen (Company Secretary, governance) ratifies the governance-line and conflict-mitigation arrangement

### Dimension 4: Financial soundness

Maps to FAIS Act s.8(1)(c). The Determination sets:
- Personal solvency — no unrehabilitated insolvency (no sequestration, no final liquidation);
- No court-ordered debt administration, review, or arrangement under the National Credit Act;
- Ongoing financial soundness — must be maintained continuously after appointment.

**Application to Hoz — Saskia as KI:**
- Personal solvency declaration + CIPC + NCR check: `fais-ki-fit-and-proper.md` §5.4
- Ongoing-monitoring trigger: any NCR debt-review notice, sequestration order, or civil judgment fires an immediate re-assessment

### Dimension 5: Continuous compliance (ongoing monitoring)

The Determination imposes an ongoing obligation — fit and proper status is not a once-at-application assessment. KIs and representatives must remain fit and proper continuously:
- Any change in circumstances affecting any of the four dimensions must be disclosed within the period set by the Determination `[citation: TBC — exact disclosure interval]`
- The FSP must monitor compliance and update the representative register accordingly
- Failure to disclose constitutes a violation of the ongoing-compliance obligation

**Application to Hoz:**
- Ongoing-monitoring covenant signed at appointment: `fais-ki-fit-and-proper.md` §5.5 step 5.3
- Trigger events: court judgment; regulatory action; NCR event; CPD non-compliance; qualification revocation
- Atlas v1 substrate gap: input-event taxonomy for ongoing-monitoring not yet in event-types.ts

---

## Category I and II requirements for Hoz Securities Limited

The FSP licence categories determine which sub-category qualifications and experience requirements apply. The likely categories for Hoz Securities Limited (based on the institutional OTC trading business):

| Category | Description | Applies to Hoz Securities | Rationale |
|---|---|---|---|
| Category I | Advice and intermediary services on financial products generally, including shares, bonds, money market, forex, derivative instruments, structured products | Likely required | The bank's institutional product set (JSE bonds/equities, OTC IRD, FX) falls within Category I sub-categories |
| Category II | Discretionary FSP — manages investments on a discretionary basis (portfolio management) | Potentially required | Depends on whether Hoz Securities Limited manages client portfolios on a discretionary basis vs. executing on client instructions |
| Category IIA | Hedge fund (CISCA) FSP | Not applicable | Hoz is not a hedge fund manager |
| Category III | Administrative FSP | Not applicable | Hoz does not provide administrative/platform services |
| Category IV | Assistance business (insurance) | Not applicable | Hoz is not in the insurance-advice business |

**Counsel ratification gate:** The precise Category I vs Category II determination depends on the specific mandate structure with institutional counterparties. Imani (Legal-as-code engineer) + external counsel ratify the exact categories at the FSP licence-application gate.

---

## Representative requirements

All persons rendering financial services on behalf of Hoz Securities Limited are "representatives" under FAIS Act s.1. The Determination requires:
- Each representative must satisfy the competence dimension (qualifications, experience, RE 5) for the sub-categories in which they render services
- Representatives may serve "under supervision" during the period before they complete their qualification and experience requirements (disclosed to clients under GCC s.5(f))
- The FSP (Hoz Securities Limited / Zara as CCO) must maintain the representative register (FAIS Act s.13(3)) and ensure ongoing compliance

In the build phase, there are no live representatives (Niko's seat is paused; FAIS-regulated advice is FSP-licence-conditional). The representative register activates at FSP licence-day.

---

## Procedure cross-references

| Procedure | Purpose | Owner |
|---|---|---|
| `Procedures/by-policy/fais-ki-fit-and-proper.md` (v0.1) | Assemble, verify, file, and continuously monitor the KI fit-and-proper file across all five dimensions | Sade (AgentOps) + Zara (CCO) + Saskia (KI-elect) |
| `Owner Inbox/2026-05-09_sade_fais-ki-fit-and-proper-template.md` | Template for the KI fit-and-proper evidence file | Sade (AgentOps) |
| `Owner Inbox/2026-05-09_saskia_fais-ki-handover-note.md` | Candidate-side handover: Saskia as KI-elect | Saskia (Head of Global Markets) |

---

## Open citations — `[TBC]` items pending BN 194 retrieval

| Item | Current state | Action needed |
|---|---|---|
| Exact section refs for each of the five dimensions | `[citation: TBC — pending BN 194 download]` throughout this file | Download BN 194 from FSCA; populate section refs from Schedule |
| Minimum qualification levels by sub-category (Schedule 1) | Described generically above | Populate from Schedule 1 of BN 194 |
| CPD minimum hours per annual cycle by category | "Typically 12–16" (secondary-source estimate) | Confirm from BN 194 Schedule |
| Ongoing-disclosure interval (how soon after change of circumstances must KI disclose?) | `[TBC]` | Confirm from BN 194 §[relevant section] |
| Exact RE 1 and RE 5 pass-rate requirements and exemptions | Described conceptually | Confirm from BN 194 Schedule 2 or 3 |

---

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-12 | Mira (Compliance / RegTech engineer) | Initial PARTIAL version. Source PDF BN 194 of 2017 not retrieved (FSCA authentication-gated). Analysis populated from FAIS Act s.8(1) primary text (verbatim) + cross-references in existing procedures. Five-dimension structure described with application to Saskia-as-KI. All section refs marked `[TBC — pending BN 194 retrieval]`. Category I/II analysis populated. Retrieval action documented. |
