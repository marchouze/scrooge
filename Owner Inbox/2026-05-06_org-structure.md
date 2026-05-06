# Organisational structure — current state

**Author:** Sade (HCM)
**Date:** 2026-05-06
**For:** Marc (CEO)
**Coordinated with:** Helena (CRO — three-lines-of-defence governance), Imani (legal-entity dimension), Anya (master-data projection), Vera (audit interest)

> **Note on derivation (Principle 6).** The org structure is a **projection** over HCM events. This document is the rendered view at as-of date 2026-05-06. The events are the source of truth; this artefact is a generated summary. Sources cited inline.

---

## 1. Roster

Source: `CLAUDE.md` *Team structure*; persona files in `/Team/`; role briefs in `Team Inbox/`.

| Name | Role | Type | Hired | Persona |
|---|---|---|---|---|
| Marc | Chief Executive Officer | Governance | Founder | (CEO) |
| Scrooge | Chief of Staff | Functional | Founder | (CoS, orchestrator) |
| PAX | Role researcher | Functional | Pre-2026-05-05 | `/Team/PAX.md` |
| Nolan | Recruiter | Functional | Pre-2026-05-05 | `/Team/Nolan.md` |
| Atlas | Core banking platform architect | Engineering | 2026-05-05 | `/Team/Atlas.md` |
| Bea | Accounting & financial reporting engineer | Engineering | 2026-05-05 | `/Team/Bea.md` |
| Mira | Compliance / RegTech engineer | Engineering | 2026-05-05 | `/Team/Mira.md` |
| Kai | Trading systems engineer | Engineering | 2026-05-05 | `/Team/Kai.md` |
| Rohan | Risk engineer | Engineering | 2026-05-05 | `/Team/Rohan.md` |
| Tomas | Operations & payments engineer | Engineering | 2026-05-05 | `/Team/Tomas.md` |
| Imani | Legal-as-code engineer | Engineering | 2026-05-05 | `/Team/Imani.md` |
| Sade | HR systems engineer | Engineering | 2026-05-05 | `/Team/Sade.md` |
| Niko | Sales / CRM engineer | Engineering | 2026-05-05 | `/Team/Niko.md` |
| Yael | Tax engineer | Engineering | 2026-05-05 | `/Team/Yael.md` |
| Vera | Internal audit / continuous-assurance engineer | Engineering | 2026-05-05 | `/Team/Vera.md` |
| Senna | Security engineer | Engineering | 2026-05-06 | `/Team/Senna.md` |
| Ravi | Treasury / ALM engineer | Engineering | 2026-05-06 | `/Team/Ravi.md` |
| Anya | Data / analytics engineer | Engineering | 2026-05-06 | `/Team/Anya.md` |
| Helena | Chief Risk Officer | Governance | 2026-05-06 | `/Team/Helena.md` |
| Owen | Company Secretary | Governance | 2026-05-06 | `/Team/Owen.md` |
| Zara | Chief Compliance Officer | Governance | 2026-05-06 | `/Team/Zara.md` |
| Iris | Information Officer | Governance | 2026-05-06 | `/Team/Iris.md` |
| Devon | Chief Operating Officer | Governance | 2026-05-06 | `/Team/Devon.md` |
| Camille | Chief Financial Officer | Governance | 2026-05-06 | `/Team/Camille.md` |
| Eitan | Treasurer | Governance | 2026-05-06 | `/Team/Eitan.md` |
| Saskia | Head of Global Markets | Governance | 2026-05-06 | `/Team/Saskia.md` |

Total: 1 CEO + 1 CoS + 8 governance + 14 engineers + 2 functional = **26 seats** (one is Marc).

## 2. Reporting tree

```
Marc (CEO)
├── Scrooge (Chief of Staff) — orchestrator
│   ├── PAX — role research (functional / shared service)
│   └── Nolan — recruitment (functional / shared service)
├── Helena (CRO)
│   └── Rohan — risk engineer
├── Devon (COO)
│   ├── Atlas — core banking platform
│   ├── Tomas — operations & payments
│   ├── Niko — sales / CRM (retail / commercial)
│   ├── Anya — data / analytics
│   ├── Senna — security engineer (interim until CISO hired)
│   ├── Imani — legal-as-code engineer (interim until GC hired)
│   └── Sade — HR systems engineer (interim until CHRO hired)
├── Camille (CFO)
│   ├── Bea — accounting & financial reporting engineer
│   └── Yael — tax engineer
├── Eitan (Treasurer; chairs ALCO)
│   └── Ravi — treasury / ALM engineer
├── Saskia (Head of Global Markets)
│   └── Kai — trading systems engineer
│   └── [GAP: institutional-markets-sales engineer — flagged]
├── Owen (Company Secretary)
├── Zara (CCO; named MLRO and FIC Compliance Officer)
│   └── Mira — compliance / RegTech engineer
├── Iris (Information Officer; POPIA s.56)
└── Vera — internal audit engineer
    [admin line through CEO; functional dotted line to Owen and a future CAE — third-line independence]
```

## 3. Three lines of defence overlay

Source: `CLAUDE.md`; `Team Inbox/2026-05-06_brief_governance-framework.md`.

| Line | Discipline | Seats |
|---|---|---|
| **First** | Risk-taking and operating | Atlas, Bea, Kai, Tomas, Imani, Sade, Niko, Yael, Ravi, Anya; Senna in build-and-run capacity |
| **Second** | Independent oversight | Helena (CRO); Zara (CCO); Iris (IO); cyber-risk dimension under future CISO; Mira reports to Zara; Rohan reports to Helena |
| **Third** | Independent assurance | Vera; reports administratively through CEO with dotted line to Owen and a future CAE |

Functional / shared services (PAX, Nolan, Scrooge) sit outside the lines of defence and serve all of them.

## 4. Planned (unfilled) governance seats

These appear in the chart as ghost seats so the gaps remain visible:

| Planned seat | Sits above | Why it matters | Recommended ordering note |
|---|---|---|---|
| **CHRO** | Sade | People governance; remuneration; fit-and-proper sign-off | Helena's framework draft will recommend; HCM (Sade) flags but does not promote her own counterpart |
| **CISO** | Senna | Cyber resilience under Joint Standard 1 of 2024 | Operational accountability sits with Devon today |
| **General Counsel** | Imani | Legal-risk governance; contractual governance | Operational legal sits with Imani under Devon today |
| **Chief Audit Executive** | Vera | Third-line independence; AC functional reporting | Vera reports admin through CEO today |
| **POPIA Information Officer** | (filled — Iris) | Designation must be lodged with the Information Regulator under POPIA Regulation 4 | Iris in seat; lodgment pending CEO signature |
| **MLRO / FIC Compliance Officer** | (filled — Zara) | Banks Act / FIC Act designation | Zara in seat |

## 5. Accountability map (named regulatory designations)

Source: role briefs; CLAUDE.md.

| Seat | Designation | Authority |
|---|---|---|
| CEO (Marc) | "Head of the Body" under POPIA absent designation; ultimate accountable executive | Banks Act; POPIA s.55 (default) |
| CRO (Helena) | Risk-accountable executive | Banks Act; BCBS; Joint Standard 1 of 2024 |
| CFO (Camille) | Signs financial statements and BA returns | Banks Act; IFRS; PA |
| COO (Devon) | Operational resilience accountable executive; cyber-resilience accountable executive (interim, until CISO) | BCBS Operational Resilience; Joint Standard 1 of 2024 |
| Treasurer (Eitan) | LCR / NSFR / IRRBB / SAMOS funding accountable | Banks Act; BCBS D295 / D335 / D368 |
| Head of Global Markets (Saskia) | Trading conduct first-line; market-abuse first-line | Financial Markets Act 19 of 2012; FAIS |
| Company Secretary (Owen) | Statutory CoSec under Companies Act ss.86–89 | Companies Act 71 of 2008 |
| CCO (Zara) | MLRO and FIC Compliance Officer | FIC Act ss.28 / 28A / 29 / 42 |
| Information Officer (Iris) | POPIA s.56 | POPIA 4 of 2013 |

## 6. Fit-and-proper-relevant seats

Source: PA / FSCA fit-and-proper standards; Banks Act.

Marc, Helena, Devon, Camille, Eitan, Saskia, Owen, Zara, and (when hired) CISO, CAE, CHRO, GC are fit-and-proper-relevant under PA / FSCA standards. Vera (audit) and Iris (IO) carry fit-for-purpose expectations under their respective regimes (Audit-Committee independence; POPIA seniority and independence).

## 7. Legal-entity dimension

Source: `Team Inbox/2026-05-06_brief_org-structure.md` §7; coordinated with Imani.

Today: one legal entity (the SA bank, pre-licence). Every seat sits in this entity. The model is per-entity ready: every seat is `(person, role, entity)`. Adding a subsidiary or branch adds a register entry and replicates seats by template (consistent with P5).

## 8. Functional / shared services

PAX (role research) and Nolan (recruitment) sit through Scrooge; serve all governance and engineering seats; not in any line of defence. Shared-service designation is itself a register entry.

## 9. Event types underpinning the org-as-projection (P1)

Source: coordinated with Atlas (event types) and Anya (projection runtime).

- `EmployeeHired { name, role, type, entity, effective_date, citation }`
- `EmployeeRoleChanged { name, from_role, to_role, effective_date, citation }`
- `ReportingLineChanged { name, from_manager, to_manager, effective_date, citation }`
- `EmployeeTerminated { name, effective_date, reason }`
- `FitAndProperAttested { name, designation, attested_by, effective_date }`
- `RegulatoryDesignationLodged { name, designation, regulator, lodged_date }`
- `RegulatoryDesignationRemoved { name, designation, regulator, removed_date }`
- `ShareServicesScopeChanged { service, scope, effective_date }`

The org chart at any past as-of date is reproducible from these events.

## 10. Obligations-register entries to be added (P2)

Coordinated with Mira:

- Companies Act 71 of 2008 ss.86–89 → Owen seat.
- Banks Act / Regulations Relating to Banks → CEO, CRO, CFO, COO, Treasurer fit-and-proper designations.
- BCBS Corporate Governance Principles for Banks (2015) → all CEO direct reports.
- POPIA Regulation 4 → Iris designation lodgment.
- FIC Act ss.28 / 28A / 29 / 42 → Zara MLRO / FIC CO designation.
- Joint Standard 1 of 2024 → CRO, COO (interim CISO) accountability.
- Financial Markets Act 19 of 2012 → Saskia first-line conduct.
- King IV — applies across.

## 11. Open items requiring CEO action

1. **Iris's POPIA Information Officer designation** — to be lodged with the Information Regulator under POPIA Regulation 4. Iris will draft; CEO signs. Out-of-system action.
2. **Confirmation of placements** — particularly that Niko remains under Devon (retail / commercial CRM, not institutional markets sales). Default proceeds on this reading.
3. **Order of remaining governance hires (CISO, GC, CAE, CHRO)** — pending Helena's recommendation in the governance framework.
4. **Institutional-markets-sales engineering counterpart** — Saskia to flag once franchise needs concretise; PAX research / Nolan hire to follow.
