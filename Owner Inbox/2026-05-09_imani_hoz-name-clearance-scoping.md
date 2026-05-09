---
title: Hoz — name-clearance scoping (master)
author: Imani (Legal-as-code engineer)
date: 2026-05-09
summary: Master scoping document for the Hoz name-clearance gate work that must close before SARB licence-application lodgment. Indexes four sub-briefs — Trade Marks Act 194 of 1993 (Class 36 + adjacent classes; SA + foreign jurisdictions), Banks Act 94 of 1990 § 22 (deceptive-similarity / unauthorised-implication signals), Companies Act 71 of 2008 + CIPC name reservation (Companies Act s.12 + Reg.8 short-name objection risk), and the SA 11-language sweep (offensive / unintended-meaning surface elevated by the three-letter form). Authors no opinions itself — Imani does not give legal advice; counsel + PAX execute. Sub-briefs scope what counsel + PAX deliver, what Imani has self-administered as preliminary checks (publicly accessible registries / dictionaries), and the precise input set counsel needs. Cross-links the v2 fallback candidates (Lucet · Noeta · Synaps) so counsel runs both sides in one pass.
decision-required: false
feeds: 2026-05-09_imani_external-counsel-licence-application.md
---

# Hoz — name-clearance scoping (master)

**Author:** Imani (Legal-as-code engineer)
**Reports through:** Devon (Chief Operating Officer, governance) on the engineering line; co-curated with Owen (Company Secretary, governance) on the corporate-law surface.
**Contributors / dependencies:**
- PAX (Role researcher) — executes the formal SA 11-language sweep with native-speaker / linguist input (Gate 4).
- Owen (Company Secretary, governance) — owns the planned `Procedures/by-policy/naming-pre-clearance.md` procedure (Atlas (Core banking platform architect) is dispatching the v1 substrate-stub of that procedure in parallel; not authored here).
- Mira (Compliance / RegTech engineer) — adds counsel-deliverables and the SARB Prudential Authority pre-application engagement plan into the obligations register (`/Regulations/_obligations-register.md`) once counsel's outputs land.
- External counsel — executes the actual TM searches, the Banks Act § 22 opinion, the CIPC name-reservation filing, and the foreign-jurisdiction TM clearance opinions; engagement scoped per `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md` (Option C — defer-with-precondition; engagement triggers when SARB engagement date is set, scope-bounded to application-only work).

**Date:** 2026-05-09
**For:** Marc (CEO)
**Cadence:** pre-licence-application gate. **HIGH PRIORITY** because the chosen name is a three-letter mark (Hoz) in Class 36 (banking / financial services), where the cross-mark collision surface and the s.22 deceptive-similarity surface are both elevated relative to longer distinctive marks.

**Authority:**
- D-BANK-NAME-SELECTION revised — `Owner Inbox/2026-05-07_scrooge_ceo-decision-record_d-bank-name-selection.md` (PR #57); substrate-application carry-through (PR #61); v3 brand supplement (PR #72).
- D-BANK-NAME-FALLBACK candidates (Lucet · Noeta · Synaps) per the v2 Linnea fallback set — `Owner Inbox/2026-05-07_linnea_inaugural-brand-package.md` (PR #53 fallback section).
- `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md` — engagement model + counsel-scoped surfaces (this document feeds that brief).
- Trade Marks Act 194 of 1993 (Republic of South Africa).
- Banks Act 94 of 1990 § 22 — Use of name "bank" and use of names deceptively similar to existing banks.
- Companies Act 71 of 2008 (s.12 — name reservation; s.11 — name requirements; Reg.8 — name objections under the Companies Regulations 2011).
- Constitution of the Republic of South Africa, 1996 — s.6 (eleven official languages).
- Principle 2 (every action carries a citation; this document marks `[citation: TBC]` rather than inventing).
- Principle 6 (single-graph upward chain — counsel deliverables enter as a *standard* layer that the application's *presentation* derives from).
- Principle 7 (autonomous-by-default — counsel and PAX-with-linguists are the residual humans-required slice on this gate).

**Status:** Scoping document. **Imani does not give legal advice.** The substantive opinions are counsel's. Self-administered preliminary checks (publicly-accessible registries / dictionaries) are flagged `[preliminary: <result>]` rather than authoritative.

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer: it sequences a regulatory / IP clearance against the bank's existing policy posture (no name commitment external until the gates close). It does not author new policy substance.

---

## 1. The four gates — index

Each gate has its own sub-brief. The table below is the navigation index.

| # | Gate | Sub-brief | Authority |
|---|---|---|---|
| 1 | Trade Marks Act 194 of 1993 (Class 36 + adjacent; SA + foreign) | `Owner Inbox/2026-05-09_imani_hoz-tm-act-scoping.md` | Trade Marks Act 194 of 1993; Madrid Protocol (WIPO); EUIPO Reg (EU) 2017/1001; US Lanham Act (US Class 102 = Class 36 international); AU Trade Marks Act 1995 |
| 2 | Banks Act 94 of 1990 § 22 (deceptive-similarity + unauthorised-implication) | `Owner Inbox/2026-05-09_imani_hoz-banks-act-s22-scoping.md` | Banks Act 94 of 1990 § 22 |
| 3 | Companies Act 71 of 2008 + CIPC name reservation | `Owner Inbox/2026-05-09_imani_hoz-cipc-reservation-scoping.md` | Companies Act 71 of 2008 ss.11–12; Companies Regulations 2011 Reg.8 (objections) |
| 4 | SA 11-language sweep (+ institutional-international set) | `Owner Inbox/2026-05-09_imani_hoz-language-sweep-scoping.md` | Constitution of the Republic of South Africa, 1996 s.6 |

---

## 2. Why the three-letter form elevates priority

Hoz is a three-letter distinctive mark. Three-letter marks in Class 36 carry a structural risk pattern that drives this gate's priority:

- **TM collision surface (Gate 1).** A three-letter string is more likely than a longer mark to collide with an existing TM, an acronym mark, or a defensive-portfolio mark. The Class 36 financial-services register internationally is dense with three- and four-letter marks (legacy bank acronyms, fintech ticker-style brands, and defensive registrations). The collision search must therefore cover not just "Hoz" but near-similar marks (Hoz / Hos / Hoz Bank / Hoz Banking / phonetic and visual neighbours).
- **Banks Act § 22 surface (Gate 2).** The s.22 test for deceptive similarity is broader than the TM Office's similarity test and is exercised by SARB Prudential Authority case-by-case. Short distinctive marks have less *inherent* room for confusion with another bank's brand, but the s.22 "implication of unauthorised activity" leg is independent of length and applies regardless. Counsel must opine on both legs.
- **CIPC short-name objection surface (Gate 3).** CIPC has a documented practice of treating very short company names (especially three-letter only) as inviting objection on the basis of insufficient distinctiveness or potential confusion. Mitigation is to file with a longer formal-style suffix — see Gate 3 sub-brief for the suffix options and the CEO judgement deferred there.
- **Language false-positive surface (Gate 4).** A three-letter string is mathematically more likely to collide with a real word in some language than a longer brand. The 11-language sweep is therefore not optional or pro-forma; it is a substantive risk-clearance step. PAX runs it with native speakers / linguists because Imani's dictionary-only check cannot detect register, slang, or offensive connotation.

---

## 3. Counsel + PAX deliverables required (consolidated)

The four sub-briefs each enumerate the full deliverable list. The consolidated table below is for budgeting and engagement-letter purposes:

| Source | Deliverable | Triggers when |
|---|---|---|
| External counsel — SA TM specialist | Written TM-clearance opinion: Hoz, Class 36 + Class 35 + Class 9 + Class 41, Republic of South Africa | Engagement letter signed (per `2026-05-09_imani_external-counsel-licence-application.md` Option C trigger) |
| External counsel — foreign TM (panel or correspondent) | Written TM-clearance opinion: Hoz, Class 36 + adjacents, in UK · EU (EUTM) · US · AU · NG · KE · EG | Same trigger |
| External counsel — SA TM specialist | Fallback-candidate TM-clearance opinion: Lucet · Noeta · Synaps, Class 36, SA + key foreign | Same trigger; **runs in parallel with Hoz pass to compress timeline** |
| External counsel — SA banking-regulatory specialist | Written Banks Act § 22 opinion (deceptive-similarity + unauthorised-implication) | Same trigger |
| External counsel — SA banking-regulatory specialist | SARB Prudential Authority pre-application engagement plan — name-choice notification timing | Same trigger |
| External counsel — SA corporate-law specialist | Filed CIPC name reservation (Companies Act s.12) | After CEO confirms legal-suffix choice (see § 4 below) |
| External counsel — SA corporate-law specialist | CIPC objection-handling plan | At reservation filing; activates if reservation contested under Reg.8 |
| PAX (Role researcher) — orchestrating native-speaker / linguist set | SA 11-language sweep written report | PAX agent's next scheduled run (substrate-coordinated; see Gate 4 sub-brief) |
| PAX (Role researcher) | Institutional-international language sweep (English · French · Spanish · Portuguese · Mandarin · Arabic · Russian) | Same run as the SA sweep |

---

## 4. Open question for Marc — legal suffix for CIPC reservation

The Gate 3 sub-brief surfaces a CEO-judgement-deferred item: the legal suffix to file under at CIPC. The default-recommendation is **"Hoz Bank Limited"** as the trading entity, on the standard Companies Act path for a public company that will hold a banking licence. The two non-default options are:

- **"Hoz Limited"** — minimum-form, plausible if the bank were not styled as a bank in its corporate name, but Banks Act § 22 essentially requires the regulated trading entity to make its bank-status apparent; not recommended.
- **"Hoz Banking Group Limited"** as a holdco, with subsidiary "Hoz Bank Limited" as the licensed entity — appropriate if the licence-application strategy elects a holdco/subsidiary structure for capital, regulatory, or tax reasons. The legal-entity tree today is a single placeholder node (`BANK-ZA-001`, per `Owner Inbox/2026-05-08_imani_legal-readiness.md`); the holdco/subsidiary decision is open.

**`[CEO judgement deferred]`** — Marc to confirm legal-suffix preference. Counsel cannot file the reservation until this is resolved. Default applied if no preference indicated by counsel-engagement trigger: "Hoz Bank Limited" as a single-entity public company; revisit if licence-application strategy elects holdco/subsidiary structure.

---

## 5. Self-administered preliminary findings — disclosure

Per the constraint that Imani does not give legal advice and does not have authoritative access to TM / CIPC / regulator registries from the worktree, the preliminary findings below are flagged `[preliminary: <result>]` and are **not** a substitute for counsel's authoritative opinion. They exist to (a) flag any obvious early collision before counsel is engaged, and (b) seed counsel's search with a known-set rather than a blank page.

### 5.1 Gate 1 — TM Act preliminary

- `[preliminary: not-performed]` — Imani does not have authoritative access to the SA TMK / WIPO Madrid / EUIPO / USPTO / IP Australia / NIPO (Nigeria) / KIPI (Kenya) / EGYPO (Egypt) databases from this worktree. Counsel executes.
- **Public-domain awareness flag (not a legal finding):** the form `Hoz` is short enough to plausibly collide with abbreviations, ticker-style marks, or defensive registrations across Class 36 internationally. Counsel must search both the exact form and near-similar marks (phonetic and visual). Sub-brief Gate 1 enumerates.
- **Lucet Health collision risk (v2 fallback) — flagged.** Public-domain awareness, not a legal finding: a US healthcare entity uses the `Lucet` mark (in healthcare-services classes, not Class 36). Whether that creates a Class 36 collision is a counsel question — concurrent registrability across classes is the substantive issue. Counsel **must check `Lucet` Class 36 in US + EU + SA before the fallback can land**. Surfacing this here so the fallback opinion is scoped from day one of counsel engagement, not raised mid-search.

### 5.2 Gate 2 — Banks Act § 22 preliminary

- `[preliminary: scan-of-publicly-known-SA-bank-names — no "Hoz"-similar mark observed in the publicly-known set]`. Public-domain awareness, not a legal finding: scanning the publicly-known set of SARB-authorised banks (the major commercial banks, the mutual banks, the cooperative banks, the foreign-bank branches and the major DFIs) does not surface a "Hoz"-similar mark. Counsel must perform the authoritative check against the SARB-published list of authorised banks (the BA1 register and the Schedule of foreign-bank branches) and the DFI register. Counsel also opines on the unauthorised-implication leg, which is not a similarity-search question.

### 5.3 Gate 3 — CIPC preliminary

- `[preliminary: not-performed]` — Imani does not have authoritative access to the CIPC name-availability database from this worktree. Counsel (or CIPC self-service) executes.
- **Public-domain awareness flag (not a legal finding):** three-letter company names attract Reg.8 objections at higher base rate than longer names. Mitigation is to file with the formal suffix (see § 4 above), which counsel does as part of the reservation filing.

### 5.4 Gate 4 — 11-language sweep preliminary

- `[preliminary: dictionary-scan-only]` — Imani has run a dictionary-level scan across publicly-accessible language resources for the eleven SA official languages and the institutional-international set. **No common-word collision identified at the dictionary level for "Hoz" in any of the eleven SA languages.** Caveats: (a) this is a dictionary-only scan; it does not detect slang, register, regional usage, or offensive connotation; (b) it does not detect homophones or near-homophones in tonal or click-consonant languages where written form alone misses the spoken form; (c) it does not cover the institutional-international set authoritatively. PAX executes the formal sweep with native speakers / linguists per Gate 4 sub-brief.
- **One observation worth surfacing for PAX's scope:** the form "Hoz" is a recognisable diminutive / surname / placename in several non-SA languages (Spanish, Polish, Hungarian — public-domain awareness only, not authoritative). PAX's institutional-international leg should confirm whether any of these create unintended meaning or association in the bank's institutional-counterparty set.

---

## 6. Procedure binding (Principle 6 upward chain)

This gate work is the first end-to-end activation of the planned `Procedures/by-policy/naming-pre-clearance.md` procedure (Owen — Company Secretary — owns; Atlas — Core banking platform architect — substrate-stub in parallel PR). The procedure will name:

- **Trigger:** new name candidate proposed (whether for the bank itself, a subsidiary, a product, or a dedicated trading entity).
- **Steps:** the four gates enumerated here (TM Act · Banks Act § 22 · Companies Act / CIPC · 11-language sweep), each with the actor (counsel · PAX · Imani · Owen) and the system capability (obligations-register entry · CIPC API submission · TM-watch service · language-clearance evidence pack).
- **Reconciliation:** all four gates closed (counsel opinions filed, reservation accepted, language sweep cleared) before the name is bound externally (regulator filings, customer-facing collateral, public domain registrations).
- **Evidence / artefacts:** counsel opinions in the document store; CIPC certificate of name reservation; PAX language-clearance written report; obligations-register entry citing each artefact.

This document is the v1 dry-run of the procedure for the Hoz case. The procedure stub itself is authored in Atlas's parallel PR; do not author it here.

---

## 7. Provenance + change log

- **2026-05-09 (v1)** — first authored. Imani.

[citation: TBC] markers throughout flag specific clauses where the authoritative citation form (regulation reference, gazette number, URL of register entry) is owed and will be filled in by Mira on the obligations-register entry once counsel's deliverables land.

---

—Imani (Legal-as-code engineer)
