---
title: Shared-board governance update — three-entity Hoz group (D-LEGAL-ENTITY-TREE-V0 + D-REGULATORY-PERIMETER)
author: Owen (Company Secretary, governance)
date: 2026-05-09
summary: Completion note for the governance-framework update that operationalises D-LEGAL-ENTITY-TREE-V0 (PR #82) and D-REGULATORY-PERIMETER (PR #85). Adds §3F (Group structure governance) to the framework with a per-entity statutory-officers table covering Hoz Group Limited + Hoz Bank Limited + Hoz Securities Limited. Adds the regulatory-perimeter table per D-REGULATORY-PERIMETER. Updates §11 for multi-entity subsidiarity framing. Extends the thin-human-layer composition paper (PR #47/#65) with a §7A multi-entity application section. The 6-human composition itself is unchanged — what changes is multi-entity applicability and entity-specific fit-and-proper triangulation. Mirrored to the HTML version. Surfaces four substrate gaps: Sade per-entity PROC-FAIS-KI-FAP-01 extension; Owen per-entity board-pack generation; future Helena handover-note generator; corporate-naming-policy v0.
decision-required: false
---

# Shared-board governance update — completion note (Owen)

**Author:** Owen (Company Secretary, governance — direct report to CEO).
**Date:** 2026-05-09
**For:** Marc (CEO)
**Branch / PR:** `claude/owen-shared-board-governance-update`

> **Derivation (Principle 6).** This note operationalises CEO decisions D-LEGAL-ENTITY-TREE-V0 (PR #82) and D-REGULATORY-PERIMETER (PR #85) at the *policy* layer of the bank's downward chain. The canonical authoring location for the per-entity governance posture is now §3F of the governance framework (`Owner Inbox/2026-05-06_governance-framework.md`); this note is the close-out audit record.

---

## 1. What landed

### 1.1 Governance framework — `Owner Inbox/2026-05-06_governance-framework.md`

**New §3F — Group structure governance.** Inserted after §3E and before §4. Carries:

- The three-entity v0 specification (Hoz Group Limited + Hoz Bank Limited + Hoz Securities Limited), citing D-LEGAL-ENTITY-TREE-V0 and the joint v0 spec (`Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md`, PR #80).
- The shared-board posture statement: the same 6 humans + Marc + audit firm specified in §3A serves across all three entities; composition unchanged; same humans wear entity-specific hats.
- The entity-specific fit-and-proper triangulation: bank fit-and-proper (Banks Act s.60 + JS 1 of 2024 §6); securities fit-and-proper (FAIS Determination of Fit and Proper Requirements 2017 + JSE Membership Rules + JSE Listings Requirements); director fit-and-proper (Companies Act ss.69, 71). Cites Sade (AgentOps engineer)'s PROC-FAIS-KI-FAP-01 (PR #69, merged) as the substrate template that extends to multi-entity.
- A **per-entity statutory officers table** (sub-section §3F "Per-entity statutory officers") covering Public Officer, CoSec, External Auditor, MLRO + FIC CO, POPIA IO + Deputy IO, FAIS Key Individual, JSE Member-firm representatives. Same humans may carry the role across entities; the *seat* is entity-specific even when the *human* is reused. Defers to Iris (Information Officer, governance) for the substantive POPIA IO scoping (concurrent dispatch, `claude/iris-per-entity-popia-io-designation`).
- A **regulatory perimeter table** (sub-section §3F "Regulatory perimeter per entity") carrying the D-REGULATORY-PERIMETER text verbatim. Hoz Group is not separately regulated (Companies Act + IFRS 10 + IAS 24; PA consolidated-supervision look-through via the bank). Hoz Bank is SARB PA-regulated. Hoz Securities is JSE-regulated (primary) + FSCA-regulated (secondary).
- Cross-references to Imani's CIPC reservation scoping (PR #76), Linnea's sub-brand lockup variants, Bea's IFRS 10 consolidation substrate, Atlas's LegalEntityRegistered event family, and Helena+Rohan's RAS PA-look-through reframe.

**§11 update — Subsidiarity vs centralisation.** Light update to cross-reference §3F as the canonical authoring location for the three-Hoz-entity group structure. The general subsidiarity framework is retained for future jurisdictions / entities. Adds explicit notes on intra-group services agreement, IP licensing, capital injections, and intra-group exposures (v0 stubs in PR #80).

**§14 — Open items resolution.** Two new resolution entries:

- Item 8 — D-LEGAL-ENTITY-TREE-V0 resolved.
- Item 9 — D-REGULATORY-PERIMETER resolved.

### 1.2 Governance framework HTML — `Owner Inbox/2026-05-06_governance-framework.html`

Mirror of the markdown changes. §3F inserted with same content (group structure, shared-board posture, fit-and-proper triangulation, per-entity statutory officers table, regulatory perimeter table, cross-references). §11 mirrored. §14 items 8 and 9 mirrored.

### 1.3 Composition paper — `Owner Inbox/2026-05-09_owen_thin-human-layer-composition-final.md`

**New §7A — Multi-entity application** (added 2026-05-09 supplement). Carries:

- §7A.1 — Shared-board posture across the three Hoz entities. Composition unchanged; multi-entity applicability is the change.
- §7A.2 — Entity-specific fit-and-proper triangulation. Cites PROC-FAIS-KI-FAP-01 (Sade) as the substrate template; the per-entity extension is a v1 substrate task.
- §7A.3 — Per-entity statutory officers (cross-references to governance framework §3F as canonical).
- §7A.4 — Regulatory perimeter implications per D-REGULATORY-PERIMETER.
- §7A.5 — Substrate gaps surfaced by multi-entity application.

Frontmatter `summary` updated to reflect the multi-entity supplement. Change log carries the new 2026-05-09 supplement entry.

---

## 2. Per-entity statutory officers — table summary

| Statutory officer | Hoz Group | Hoz Bank | Hoz Securities |
|---|---|---|---|
| Public Officer (tax) | shared with Bank | Marc (interim) | shared with Bank |
| Company Secretary | shared with Bank | Seat #4 (separate human; not Marc) | shared with Bank |
| External Auditor | shared firm | PA-approved firm (Banks Act s.61) | shared firm |
| MLRO + FIC Compliance Officer | n/a (group not an accountable institution) | Seat #5 (Compliance Lead) | Seat #5 (same human; both bank and securities are FIC accountable institutions under Schedule 1) |
| POPIA IO + Deputy IO | IO + Deputy (Iris's per-entity scoping) | Seat #5 IO + Seat #4 Deputy | IO + Deputy (default same as Bank) |
| FAIS Key Individual | n/a | n/a | Saskia (per D-FSP-LICENCE-NECESSITY confirm-A) |
| JSE Member-firm reps | n/a | n/a | Directors + Compliance + Settlement (per JSE Membership Rules; counsel ratifies) |

Authority chain per row carried verbatim in governance framework §3F.

---

## 3. Substrate gaps surfaced

1. **RAS version-control convention.** The Risk Appetite Statement under Helena (Chief Risk Officer, governance) needs an explicit version-control convention now that PA-look-through framing changes the document's regulatory anchor. Helena+Rohan's reframe (`claude/helena-rohan-ras-pa-lookthrough-reframe`, concurrent dispatch) is the substrate; Owen's gap is the meta-convention for how the RAS is versioned across the three-entity application. **Cadence:** Owen authors a v0 RAS-version-control convention as a follow-on substrate task; Helena ratifies.
2. **Corporate-naming-policy v0.** The three Hoz entities + the defensive set Imani (Legal-as-code engineer) named in PR #76 surface the need for a typed corporate-naming-policy that future entity additions reference. **Cadence:** Owen authors v0 corporate-naming-policy as a separate Owen task (already on the roadmap; not in scope of this PR).
3. **§13 hiring-order revisit.** D-LEGAL-ENTITY-TREE-V0 may shift the hiring order: a JSE-Member-firm Compliance Officer designation on Hoz Securities Limited may need a separate human earlier than the post-licence CISO/CAE/GC/CHRO sequence assumes. The shared-board posture means one CoSec across all three entities is fine, but the JSE Compliance Officer is a JSE-regulator-binding designation that may require its own human (counsel ratifies at licence-application). **Cadence:** Owen revisits §13 once counsel responds on the JSE Compliance Officer / Settlement Officer scope.
4. **Future Helena handover-note generator.** As the human CRO seat (Seat #6) is filled before licence-application lodgment, the agent-CRO Helena substrate must produce a handover-note for the human CRO at appointment. The handover-note generator is itself a substrate gap — the convention for how an agent hands over operational context to a newly-appointed human in a designated seat. **Cadence:** v1 substrate task; Helena + Sade (AgentOps engineer) joint scoping. Surface to D-CRO-HANDOVER-CONVENTION decision-card if the CRO appointment date approaches before substrate is in place.

---

## 4. Cross-references

- **CEO decision records.** `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md` (PR #82); `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md` (PR #85).
- **Joint v0 spec.** `Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md` (PR #80) — Imani (Legal-as-code engineer) + Owen joint authoring.
- **Canonical authoring.** `Owner Inbox/2026-05-06_governance-framework.md` §3F (per-entity governance); §11 (subsidiarity); §14 items 8–9 (resolution).
- **Composition paper.** `Owner Inbox/2026-05-09_owen_thin-human-layer-composition-final.md` §7A (multi-entity supplement).
- **PROC-FAIS-KI-FAP-01.** Sade (AgentOps engineer) — fit-and-proper file template (PR #69, merged), substrate template extended to multi-entity.
- **Concurrent dispatches (no file-clash).** Atlas (`claude/atlas-legal-entity-event-family-v0`); Helena+Rohan (`claude/helena-rohan-ras-pa-lookthrough-reframe`); Mira (`claude/mira-domain-q-reclassification`); Linnea (`claude/linnea-hoz-sub-brand-lockups-v3-2`); Bea (`claude/bea-ifrs10-consolidation-substrate-v0`); Iris (`claude/iris-per-entity-popia-io-designation`).

---

## 5. Authority

- `CLAUDE.md` — Operating model + Principles 6 (single-graph discipline) + 7 (autonomous by default).
- **Companies Act 71 of 2008** — ss.66, 69, 71 (director duties, fit-and-proper); ss.86–89 (CoSec); s.90 (auditor); s.94 (AC composition).
- **Banks Act 94 of 1990** — s.7 (banking licence); s.60 (Board composition + consolidated supervision); s.61 (auditor).
- **FIC Act 38 of 2001** — Schedule 1 items 6 (banks) + 13 (persons authorised to deal in securities); ss.43A, 43B (MLRO, FIC CO).
- **POPIA Act 4 of 2013** — s.55–56 (Information Officer); POPIA Regulation 4 (deputy IO).
- **FAIS Act 37 of 2002** — s.8 (Key Individual); Determination of Fit and Proper Requirements 2017.
- **Tax Administration Act 28 of 2011** — s.246 (Public Officer).
- **Joint Standard 1 of 2024** (PA / FSCA Cybersecurity & Cyber Resilience) — §6 responsible-person designation.
- **JSE Equities + Bonds Membership Rules**; **JSE Listings Requirements**; **STRATE Participant Rules**.
- **IFRS 10** (Consolidated Financial Statements); **IAS 24** (Related-Party Disclosures).
- **CEO decisions.** D-LEGAL-ENTITY-TREE-V0 (PR #82); D-REGULATORY-PERIMETER (PR #85); D-THIN-HUMAN-LAYER-MINIMUM (PR #24); D-FSP-LICENCE-NECESSITY confirm-A (PR #62).

---

—Owen (Company Secretary, governance)
