---
title: WS-JS-NUMBER-RECONCILIATION — Joint Standard 1 of 2024 → Joint Standard 2 of 2024 rename across Domain CY (and consequential Domain F + Q + O rows)
author: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator)
date: 2026-05-10
summary: Single-purpose follow-on rename closing the long-standing mis-citation flagged by ORG-CY-17 in v1.14. The cybersecurity-and-cyber-resilience Joint Standard is JS 2 of 2024 (commenced 1 June 2025), not JS 1 of 2024 (which is Outsourcing by Insurers). Register bumped to v1.15.
decision-required: false
---

# WS-JS-NUMBER-RECONCILIATION — JS 1/2024 → JS 2/2024 rename across affected register rows

**Author:** Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator)
**Date:** 2026-05-10
**Authority:** Standing register-curator mandate (Mira under Zara) — no new CEO decision required. Recorded as `CeoDecision` event of record `D-WS-JS-NUMBER-RECONCILIATION` per CLAUDE.md "Operating procedures → Events-first authoring".
**Source finding:** `ORG-CY-17` in v1.14 (`Regulations/_obligations-register.md` line 233) + `Owner Inbox/2026-05-10_mira-imani_pa-communications-research.md` §6 #1.

---

## 1. The finding (recap)

The cybersecurity-and-cyber-resilience Joint Standard is **Joint Standard 2 of 2024** (published 17 May 2024 by SARB Prudential Authority + FSCA; commenced 1 June 2025 — 12 months after publication). The register has, since v1.0, cited **"Joint Standard 1 of 2024"** for cybersecurity. JS 1 of 2024 is in fact the *Outsourcing by Insurers* standard — insurer-only, not banks.

The mis-citation was identified during the SARB PA publications survey (Mira + Imani, 2026-05-10, leading to v1.14 register expansion). v1.14 added `ORG-CY-17` as a corrective umbrella row pinning JS 2/2024 correctly and surfaced the rename across affected rows as workstream `WS-JS-NUMBER-RECONCILIATION`. This deliverable closes that workstream.

---

## 2. Rows renamed

Pure rename: no row IDs change, no row added or removed, no schema change.

### Domain E — Cyber and operational resilience (5 rows)

| Row | Before | After |
|---|---|---|
| `ORG-CY-01` | `Joint Standard 1 of 2024` | `Joint Standard 2 of 2024` |
| `ORG-CY-02` | `Joint Standard 1 of 2024` | `Joint Standard 2 of 2024` |
| `ORG-CY-03` | `Joint Standard 1 of 2024` | `Joint Standard 2 of 2024` |
| `ORG-CY-04` | `Joint Standard 1 of 2024` | `Joint Standard 2 of 2024` |
| `ORG-CY-05` | `Joint Standard 1 of 2024 + BCBS Op Resilience` | `Joint Standard 2 of 2024 + BCBS Op Resilience` |

### Domain F — Governance, board, corporate (1 row)

| Row | Before | After |
|---|---|---|
| `ORG-GV-17` | `Banks Act + Joint Standard 1 of 2024` (board approves RAS, RMF, ICAAP, ILAAP, material policies — read with the cybersecurity-and-cyber-resilience standard for the cyber-policy approval) | `Banks Act + Joint Standard 2 of 2024` |

### Domain Q — Consolidated-supervision rows (1 row)

| Row | Before | After |
|---|---|---|
| `ORG-BNK-CYBER-CONS` | `Joint Standard 1 of 2024 on Cybersecurity and Cyber Resilience` (citation cell + body prose) | `Joint Standard 2 of 2024 on Cybersecurity and Cyber Resilience` (URN slug also renamed — see §3) |

### Domain O — Thin human layer obligations (2 rows)

The Mira+Zara concentration-risk-conduct-confirmation work (PR feeding Domain O) cited "Joint Standard 1/2024 §6–§7" against the responsible-person + operational-independence reading. That reading is the cybersecurity-standard reading (CISO-shaped responsible-person, CRO operational independence read across), which is JS 2/2024.

| Row | Before | After |
|---|---|---|
| `ORG-GV-CRO-INDEPENDENCE` | `Joint Standard 1/2024 §6–§7` | `Joint Standard 2/2024 §6–§7` |
| `ORG-CY-02-RECON-CRO-INDEPENDENCE` | `Joint Standard 1/2024 §6 ... §7` | `Joint Standard 2/2024 §6 ... §7` |

The Domain O intro paragraph at line 481 ("Mira+Zara's Joint Standard 1 of 2024 challenge ... reconcile three existing rows ... against the JS-1-of-2024 + FIC-published-guidance reading") is also renamed — same underlying mis-citation.

### Entity-scope vocabulary section

| Location | Before | After |
|---|---|---|
| Line 61 — `Hoz Group Limited` description | "Joint Standard 1 of 2024 (group-level cyber-resilience programme)" | "Joint Standard 2 of 2024 (group-level cyber-resilience programme)" |
| Line 73 — `consolidated-supervision` table cell | "cyber-resilience programme under Joint Standard 1 of 2024" | "cyber-resilience programme under Joint Standard 2 of 2024" |
| Line 100 — Authority bullet | "Joint Standard 1 of 2024 on Cybersecurity and Cyber Resilience (PA / FSCA) — group-level vs entity-level discharge" | "Joint Standard 2 of 2024 on Cybersecurity and Cyber Resilience (PA / FSCA) — group-level vs entity-level discharge" |

### Domain N — Citation-URN inventory (1 row)

| Symbol | Before URN slug | After symbol | After URN slug |
|---|---|---|---|
| `JOINT-STANDARD-1-2024-CYBER` | `urn:obligation:bank:m1:operational-cyber:joint-standard-1-2024-cyber:v1` | `JOINT-STANDARD-2-2024-CYBER` | `urn:obligation:bank:m1:operational-cyber:joint-standard-2-2024-cyber:v1` |

---

## 3. URN-slug renames

| Row | Before URN | After URN |
|---|---|---|
| `ORG-BNK-CYBER-CONS` | `urn:obligation:bank:bank:cyber-resilience-consolidated-basis:v1` | (unchanged — no JS-number in slug) |
| Domain N — cyber row | `urn:obligation:bank:m1:operational-cyber:joint-standard-1-2024-cyber:v1` | `urn:obligation:bank:m1:operational-cyber:joint-standard-2-2024-cyber:v1` |

`ORG-CY-01..05` carry `[TBD]` URN cells; no slug-rename needed there. `ORG-CY-17` already carries the correct `urn:obligation:bank:cyber:js-2-2024-cybersecurity-cyber-resilience:v1` slug from v1.14.

---

## 4. Why the original mis-citation occurred

The cybersecurity-and-cyber-resilience Joint Standard was first publicly known by its draft / consultation stage as "the cybersecurity Joint Standard" without a number; when the register was first authored (v1.0–v1.7), the author (and most public-facing references) used "JS 1 of 2024" as a placeholder, conflating it with the publication-year. The actual numbering by SARB PA + FSCA in 2024 was:

- **JS 1 of 2024** — Outsourcing by Insurers
- **JS 2 of 2024** — Cybersecurity and Cyber Resilience Requirements for Financial Institutions (banks explicit in scope)

The publication-record was confirmed during the Mira + Imani SARB PA publications-portal survey (2026-05-10), per `Joint Communication 2 of 2024` (publication notice URL in `ORG-CY-17` citation cell).

Per Principle 2 (every action traces to a source) — no atomic citation should rest on a placeholder. The v1.14 corrective umbrella `ORG-CY-17` and this v1.15 rename close the citation gap.

---

## 5. Recon implications

### Code references to citation symbol `JOINT-STANDARD-1-2024`

The substrate uses the citation symbol `JOINT-STANDARD-1-2024` (no `-CYBER` suffix) in 8 files (event-store registry, agent-runtime registry, scheduler, event-trigger bus, agent-identity issuer + permission-policy, runtime agents Senna/Devon/Rashida cyber-resilience snapshots). All of these are pointing at the cybersecurity Joint Standard — i.e. the same mis-citation in code form.

Rename: `JOINT-STANDARD-1-2024` → `JOINT-STANDARD-2-2024` across these 8 files. The append-only event-store retains old events with the old symbol (Principle 1 — events are immutable); only newly-emitted events carry the corrected symbol. Old events' citation correctness is now governed by the v1.15 rename of the register's symbol-to-meaning binding (which is documented here), not by event mutation.

Domain N symbol rename `JOINT-STANDARD-1-2024-CYBER` → `JOINT-STANDARD-2-2024-CYBER` is propagated to Domain N row + the `mira:m1-regulator-citation-urns` runtime agent (`prototype/runtime/agents/mira-m1-regulator-citation-urns.ts:417`) and the test harness `prototype/tests/recon-retention-citation-coverage.test.ts:93,340`.

### Recon harness (`retention-citation-coverage.ts`)

The recon harness matches on prefix `JOINT-STANDARD-` (line 112). Both the old `JOINT-STANDARD-1-2024-*` and the new `JOINT-STANDARD-2-2024-*` symbols match the same prefix; no prefix-list change required.

### Banner history preserved

Per established convention, prior version-banners (v1.0 through v1.14) are not edited. The historical use of "Joint Standard 1 of 2024" for cybersecurity in the v1.8 + v1.10 + v1.14 banners reads as the literal historical text — the v1.15 banner explains the rename. Vera mandate-coverage recon reads citations from rows, not from version-banners; banner-prose retention is acceptable under Principle 1.

### Out-of-scope (filed as follow-on)

- Pre-Phase-1 historical Owner Inbox files (e.g. `Owner Inbox/2026-05-05_obligations-register-seed.md`, `Owner Inbox/2026-05-07_helena_ras-recalibration-v1.md`) carry the old symbol. Per CLAUDE.md "Records substrate" pre-Phase-1 posture, those are historical-record files and are not edited; they are mis-citations preserved as-of-date. Phase 4 archive will move them to `archive/`; the canonical register is the rename surface.

---

## 6. Authority

Standing register-curator mandate held by Mira under Zara CCO. The brief explicitly authorises this single-purpose rename (Scrooge dispatch, 2026-05-10). No new CEO decision required; recorded as `CeoDecision` event of record `D-WS-JS-NUMBER-RECONCILIATION` per CLAUDE.md "Operating procedures → Events-first authoring" — the event is the curator-action record, not a new authorisation.

Source: `Owner Inbox/2026-05-10_mira-imani_pa-communications-research.md` §6 #1; v1.14 register banner; `ORG-CY-17` row in v1.14.

—Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator)
