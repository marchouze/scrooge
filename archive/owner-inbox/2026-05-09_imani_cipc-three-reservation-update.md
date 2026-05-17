---
title: CIPC three-reservation update — Hoz Group + Hoz Bank + Hoz Securities (post D-LEGAL-ENTITY-TREE-V0)
author: Imani (Legal-as-code engineer)
date: 2026-05-09
summary: Completion note recording the Gate-3 CIPC scoping update against D-LEGAL-ENTITY-TREE-V0 (CEO-approved 2026-05-09; PR #82, merged). The original single-entity `Hoz Bank Limited` reservation default is superseded; counsel now files three CIPC name reservations — `Hoz Group Limited` (parent / holdco) + `Hoz Bank Limited` (SARB-licensed subsidiary) + `Hoz Securities Limited` (FSCA + JSE-membership subsidiary) — in a single batch at the SARB / FSCA pre-application engagement window. Per-entity citation surface added to the sub-brief covering Companies Act 71 of 2008 + Banks Act §§ 22 / 37 / 60 + FAIS s.13 + FSCA conduct-standards + JSE Listings Requirements + JSE Membership Rules. Master four-gate scoping index updated to point Gate 3 at the three-reservation expansion. Sub-brand domain question (`securities.hoz.<tld>` vs `hozsecurities.<tld>`) folded into the `D-HOZ-DOMAIN-REGISTRATION-SET` decision-card adjudication owned by Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer). Counsel-engagement still pending the CRO seat + SARB pre-application engagement window per Option C deferred-with-precondition; this update is build-phase preparation, not counsel-execution.
decision-required: false
---

# CIPC three-reservation update — Hoz Group + Hoz Bank + Hoz Securities

**Author:** Imani (Legal-as-code engineer)
**Reports through:** Devon (Chief Operating Officer, governance) on the engineering line; co-curated with Owen (Company Secretary, governance) on the corporate-law surface.
**Date:** 2026-05-09
**For:** Marc (CEO), Owen (Company Secretary, governance), Devon (Chief Operating Officer, governance).

---

## 1. What landed

Two files updated and this completion note authored, all on branch `claude/imani-cipc-three-reservation-update`.

### 1.1 `Owner Inbox/2026-05-09_imani_hoz-cipc-reservation-scoping.md` — Gate-3 CIPC scoping (primary update)

- **Supersession header** (above § 1) — flags D-LEGAL-ENTITY-TREE-V0 (PR #82, merged) as the trigger; states that the original single-entity `Hoz Bank Limited` default in §§ 1–4 is superseded by § 5.
- **Frontmatter `summary`** — refreshed to describe the three-reservation scope.
- **§ 2 Option A** — flagged `[superseded by § 5]` with a retained-for-provenance note. The "Default applied if no preference indicated" line in § 2 is struck through and replaced with the three-reservation default.
- **§ 5 — Three-reservation list (post D-LEGAL-ENTITY-TREE-V0)** — new top-level section. Per-entity sub-section (§ 5.1, § 5.2, § 5.3) for each of:
  - Reservation 1: `Hoz Group Limited` — public Limited; Companies Act 71 of 2008 s.11 + s.12; Reg.8 short-name objection regime; Banks Act 94 of 1990 § 60 parent-of-bank consolidated-supervision designation; brand-justification rider against Linnea PR #72 v3 supplement.
  - Reservation 2: `Hoz Bank Limited` — public Limited; Companies Act + Banks Act § 22 dual clearance (the bank-specific use-of-name signal applies); Banks Act § 37 parent-of-bank shareholding clearance for the 100% subsidiary relationship.
  - Reservation 3: `Hoz Securities Limited` — public Limited; FAIS s.13 + Subordinate Legislation conduct-of-business naming surface; FSCA conduct-standard naming guidance; JSE Listings Requirements + Membership Rules member-firm naming clearance.
- **§ 6 — Filing cadence** — new top-level section. Counsel files all three CIPC reservations in a single batch at the SARB / FSCA pre-application engagement window. Cross-references the SARB pre-application engagement timing as an open CRO-seat-criteria question (deferred per memory `feedback_decisions_workflow.md`).
- **§ 7 — Sub-brand domain coordination** — new top-level section. Cross-references the Devon + Tomas Hoz domain plan (PR #73, merged); folds the sub-brand domain question (`securities.hoz.<tld>` vs `hozsecurities.<tld>`) into the `D-HOZ-DOMAIN-REGISTRATION-SET` decision-card adjudication; Devon's seat owns the card.
- **§ 8 (Cross-links) and § 9 (Open items / [citation: TBC])** — original §§ 5–6 renumbered downward; Open-items list extended with seven new `[citation: TBC]` items reflecting the per-entity citation surface (Banks Act § 60, Banks Act § 37, FAIS s.13, FSCA conduct-standards, JSE rules, D-HOZ-DOMAIN-REGISTRATION-SET location).

### 1.2 `Owner Inbox/2026-05-09_imani_hoz-name-clearance-scoping.md` — master four-gate scoping (cross-reference update)

- A small note added above the four-gate index table cross-referencing D-LEGAL-ENTITY-TREE-V0 (PR #82, merged) and stating that the Gate 3 sub-brief now scopes a three-reservation filing.
- Gate 3 row in the index table updated:
  - **Gate** column extended with `(now three reservations — Hoz Group + Hoz Bank + Hoz Securities — per D-LEGAL-ENTITY-TREE-V0)`.
  - **Authority** column extended with the per-entity citation surface (Banks Act §§ 22, 37, 60; FAIS s.13 + FSCA conduct-standards; JSE Listings Requirements + Membership Rules).

### 1.3 This completion note (`Owner Inbox/2026-05-09_imani_cipc-three-reservation-update.md`)

- New file. Records the update; routes the open-counsel-engagement gate; lists the `[citation: TBC]` items for Mira (Compliance / RegTech engineer) to pick up in the obligations-register entry once counsel's deliverables land.

---

## 2. Filing cadence summary

Counsel files all three CIPC reservations in a single batch at the SARB / FSCA pre-application engagement window. Rationale (full text in sub-brief § 6): single coherent group story to the regulator + reduced Reg.8 short-name objection surface (one rider, three names) + alignment with the regulator-engagement timing where the bank's name choice is first formally notified. The exact wall-clock filing date attaches when the CRO seat is filled and the SARB pre-application engagement is scheduled — counsel-engagement is deferred until then per Option C of the external-counsel-engagement plan.

---

## 3. Open counsel-engagement gate

This update is **build-phase preparation**, not counsel-execution. The counsel-engagement gate remains:

- **Trigger:** SARB Prudential Authority pre-application engagement scheduled (a wall-clock event, not an agent-cadence event); CRO seat filled (engagement counterparty) per `Owner Inbox/2026-05-08_helena_cro-seat-criteria.md`.
- **Scope on trigger:** counsel executes (a) the CIPC name-availability search across all three names; (b) the three CIPC name reservations under Companies Act s.12; (c) the Companies Act s.11 / s.12 written opinion confirming each name satisfies s.11; (d) the Reg.8 objection-handling plan; (e) the reservation-extension plan; (f) the per-entity opinions covering the Banks Act § 22 / § 37 / § 60 surface (parent + bank) and the FAIS s.13 + FSCA conduct-standards + JSE Listings Requirements + JSE Membership Rules surface (securities).
- **Status today:** **deferred-with-precondition** per `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md` Option C. No counsel engaged today.

This update therefore lands the legal-as-code substrate for the three-reservation filing. The Companies Act s.12 filings themselves activate when the trigger fires.

---

## 4. [citation: TBC] items routed to Mira (Compliance / RegTech engineer)

The new `[citation: TBC]` items in the sub-brief § 9 are owed by Mira (Compliance / RegTech engineer) at obligations-register-update time once counsel's authoritative outputs land. Listing here for completeness:

- Companies Act 71 of 2008 — s.8(2)(a) public-company form (each reservation).
- Companies Act 71 of 2008 — s.11(2) name-requirement criteria; s.12 reservation period and extension procedure.
- Companies Regulations 2011 — Reg.8 CIPC published practice notes on short-name objection risk.
- Banks Act 94 of 1990 — § 22 sub-sections; § 37 acquisition-of-shares-in-a-bank thresholds and parent shareholder clearance (Reservation 2 parent-of-bank linkage); § 60 controlling-company / parent-of-bank consolidated-supervision provisions (Reservation 1).
- FAIS Act 37 of 2002 — s.13 sub-sections; FAIS Subordinate Legislation Determination of Fit and Proper Requirements; FAIS General Code of Conduct (BN 80 of 2003) (Reservation 3).
- FSCA — published conduct-standard / practice-note covering authorised-FSP naming (Reservation 3).
- JSE — Equities Rules + Debt Listings Requirements + Membership Rules clauses on member-firm naming (Reservation 3).

These are register-entry citations, not blocking items for this update; the build-phase preparation lands without them.

---

## 5. Cross-references

- **Decision record (this update's authority).** `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md` — D-LEGAL-ENTITY-TREE-V0 (PR #82, merged).
- **Joint v0 ratified.** `Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md` — Imani (Legal-as-code engineer) + Owen (Company Secretary, governance) joint v0.
- **Upstream group-structure decision.** `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-group-structure.md` — D-GROUP-STRUCTURE (PR #78, merged).
- **Upstream bank-name decision.** `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md` — D-BANK-NAME-HOZ (PR #57, merged).
- **Counsel-engagement plan.** `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md` — Option C defer-with-precondition.
- **Master scoping (touched).** `Owner Inbox/2026-05-09_imani_hoz-name-clearance-scoping.md` — Gate 3 row updated.
- **Sub-brief (primary update).** `Owner Inbox/2026-05-09_imani_hoz-cipc-reservation-scoping.md` — three-reservation expansion.
- **Domain coordination.** Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer) Hoz domain plan (PR #73, merged); the sub-brand domain question now feeds `D-HOZ-DOMAIN-REGISTRATION-SET`.

---

—Imani (Legal-as-code engineer)
