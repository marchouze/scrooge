# Brief — Organisational structure (HCM)

**Author:** Scrooge (relaying CEO directive)
**Date:** 2026-05-06
**For:** Sade (HR systems engineer — HCM function)
**CC:** Helena (CRO — three-lines-of-defence governance), Imani (legal-entity dimension), Anya (master-data projection — org as projection), Vera (audit interest), Atlas (platform — workflow actors).

## CEO directive

The CEO has asked HCM to **create an org structure** for the bank. This is the first time the team's structure is being formalised as a deliverable in its own right, and it needs to land in a way that is consistent with the four architectural principles and with the governance-vs-engineering distinction the CEO established earlier today.

## What the org structure must capture

1. **Roster.** Every current virtual employee, with name, role, role type (governance / engineering / functional), date hired into the team, and pointer to their persona file in `/Team/`.
2. **Reporting lines.** Who reports to whom. CEO at the top; Scrooge as Chief of Staff; the rest below. Reporting is event-sourced — see P1 below.
3. **Three lines of defence.**
   - **First line** — risk-taking and operating roles (Atlas, Bea, Kai, Tomas, Imani, Sade, Niko, Yael, Ravi, Anya, Senna in their build-and-run capacity).
   - **Second line** — independent oversight (Helena as CRO; Mira on compliance and financial crime; the cyber-risk dimension of Senna's role under the CRO's oversight).
   - **Third line** — independent assurance (Vera).
4. **Governance vs engineering.** Visually and structurally distinguish the two. Helena (CRO) is the only governance seat today. The other governance seats anticipated (CFO, CCO, CISO, GC, CAE, CHRO, possibly COO) are shown as **planned / unfilled** so the gaps are visible without pretending to be hires.
5. **Functional roles.** PAX (role research) and Nolan (recruitment) are functional / shared services, not in any line of defence. Mark them as such.
6. **Interfaces.** Cross-team interfaces beyond reporting lines — i.e. who works with whom on what — already exist in role briefs and persona files. The org structure should *summarise* these without duplicating them.
7. **Legal-entity dimension.** Today there is one legal entity (the SA bank). The structure must be expressible as "person → role → seat in legal-entity X". Today every seat is in the same entity, but the model must accept additional entities without reshaping (P5). Coordinate with Imani.
8. **Accountability map.** For each role, the principal regulatory or board-level accountability the seat carries (if any). This feeds Helena's risk-governance view and Mira's obligations register.
9. **Fit-and-proper status.** Where a seat is regulator-designated as fit-and-proper-relevant (CEO, CRO; later CFO, CCO, CISO, GC), flag that on the role.

## Required design properties

**P1 — Events as source of truth.** The org structure is a **projection** over HR / HCM events: hires, role changes, reporting-line changes, terminations, fit-and-proper attestations. Sade owns the event types in coordination with Atlas. The org-as-of date T is reproducible from the event stream. Anya consumes this projection into the master data set.

**P2 — Traceability.** Every seat that carries regulatory accountability cites the regulation that creates the accountability — Banks Act, Joint Standard 1 of 2024, FIC Act, FAIS, COFI (when in force), POPIA Information Officer designation, etc. Mira maintains the entries; Sade links the seats.

**P3 — Cloud-native, no manual.** The org structure is generated from the HCM event log on demand. It is not a slide deck. The first-cut deliverable Marc receives may be a Markdown document, but it must be reproducible from data, and a slide-rendering is a presentation choice.

**P4 — Security by design.** Personal information about employees (where it eventually exists for non-virtual staff) is field-level encrypted; access is purpose-bound; read events on staff PII are themselves audited. For now, virtual employees, so this is mostly forward-looking.

**P5 — Multi-everything.** The structure is per-legal-entity ready. New entities (a future South African subsidiary, a future foreign branch, a future operational subsidiary for non-banking activities) add as register entries; the model does not change.

## Specific items I need Sade to resolve

1. **CHRO governance seat.** The principle established today (CRO is governance, distinct from engineering) likely implies a CHRO governance seat distinct from Sade as HR engineer. In producing the org structure, explicitly mark **CHRO** as a planned governance seat (not yet filled). Sade does not write her own governance counterpart into existence — but she does flag the gap. Final hiring decision is the CEO's.
2. **PAX / Nolan placement.** Functional / shared-services lane, reporting through Scrooge to the CEO. Confirm.
3. **Risk-engineer reporting.** Rohan reports to Helena (CRO) on risk matters; Rohan still sits in the engineering org for build-and-run purposes. Use a primary line + dotted line convention; document the convention.
4. **Compliance / financial crime.** Mira sits in the second line for governance purposes (under the CRO and a future CCO seat); Mira sits in the engineering org for build-and-run purposes. Same dual-line convention.
5. **Internal audit independence.** Vera reports through the (future) Chief Audit Executive governance seat to the (future) Audit Committee, not through Helena. Today the CAE is unfilled; mark Vera's reporting line as direct-to-CEO with an *audit-committee* dotted line, and flag the CAE governance seat as planned.
6. **Information Officer (POPIA).** The Banks Act / POPIA expects a designated Information Officer. Today, that defaults to the CEO unless designated. Flag this as an open governance designation, not necessarily a separate hire — it can be assigned to a named role.

## Deliverable

A single Owner Inbox document, target turnaround within three working days:

- `Owner Inbox/YYYY-MM-DD_org-structure.md`

Structure:

1. CEO and CoS at the top.
2. The team table (governance / engineering / functional, with hire dates and persona pointers).
3. The reporting tree (Markdown indented list or ASCII diagram is fine for v1).
4. Three lines of defence overlay.
5. Planned (unfilled) governance seats with rationale.
6. Accountability map per seat.
7. Fit-and-proper flags per seat.
8. Legal-entity placement (single entity today; model is per-entity ready).
9. Event types underpinning the org-as-projection (P1).
10. Obligations-register entries to be added (P2).

## Note on coordination

Helena will need to see this as it touches three-lines-of-defence governance. Imani will need to see it as it touches legal-entity placement. Anya consumes it as a master-data projection. Sade owns and authors; Sade coordinates with the others; Scrooge tracks.
