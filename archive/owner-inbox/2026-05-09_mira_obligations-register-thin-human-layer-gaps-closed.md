---
title: Obligations register — 10 thin-human-layer gaps closed (D-THIN-HUMAN-LAYER-MINIMUM)
author: Mira
date: 2026-05-09
summary: Closes the 10 obligations-register gaps named in the conduct-side confirmation paper §5 under CEO decision D-THIN-HUMAN-LAYER-MINIMUM. New Domain O ("Thin human layer obligations") added to `Regulations/_obligations-register.md` with 7 new rows + 3 gloss/reconciliation rows that cross-reference existing parents (ORG-FC-11, ORG-PR(IV)-13, ORG-CY-02). Three rows carry [citation: TBC] flags pending precise FIC PCC / FAIS subordinate-legislation references.
decision-required: false
maps-to-decision-id: D-THIN-HUMAN-LAYER-MINIMUM
---

# Obligations register — 10 thin-human-layer gaps closed

**Author:** Mira (Compliance / RegTech engineer — obligations-register curator)
**Reports through:** Zara (CCO)
**Date:** 2026-05-09
**Decision authority:** `Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-thin-human-layer-minimum.md`
**Source paper:** `Owner Inbox/2026-05-09_mira-zara_concentration-risk-conduct-confirmation.md` §5

---

## 1. What this closes

CEO decision `D-THIN-HUMAN-LAYER-MINIMUM` (approved 2026-05-08) routed a follow-on to Mira to close the 10 obligations-register gaps named in the conduct-side confirmation paper §5. This note is the closure record. The substantive content for each gap is sourced from the confirmation paper; this pass authors the register rows.

The 10 rows now sit in a new **Domain O — Thin human layer obligations (D-THIN-HUMAN-LAYER-MINIMUM)** section in `Regulations/_obligations-register.md` (register version 1.4). The new domain section header carries the prologue contextualising it against the CEO decision, the conduct-side confirmation paper, and the Owen+Imani composition paper.

7 of the 10 rows are net-new register entries; 3 are gloss / reconciliation rows that cross-reference existing parents (ORG-FC-11, ORG-PR(IV)-13, ORG-CY-02). The gloss rows keep parser-compatibility with the dashboard view (`prototype/dashboard/obligations-view.ts`) by using distinct stable IDs that match the `^ORG-` regex.

---

## 2. The 10 URNs landed

Each row carries a stable URN under `urn:obligation:bank:` (the canonical scheme defined in `prototype/platform/citation/types.ts`). The URN is the machine-readable handle (event-emit, Vera-recon-input). The `ORG-*` ID is the human-readable handle (markdown register, dashboard view).

| # | ORG ID | URN | Citation |
|---|---|---|---|
| 1 | ORG-GV-DIRECTORS-MINIMUM | `urn:obligation:bank:org:gv:directors-minimum:v1` | Companies Act 71/2008 s.66(2); Banks Act 94/1990 s.60 |
| 2 | ORG-GV-AC-MINIMUM | `urn:obligation:bank:org:gv:ac-minimum:v1` | Companies Act 71/2008 s.94; Companies Reg. 43; King IV |
| 3 | ORG-GV-CRO-INDEPENDENCE | `urn:obligation:bank:org:gv:cro-independence:v1` | Joint Standard 1/2024 §6–§7; BCBS Corp Gov Principles 2015 §3; Banks Act s.60 |
| 4 | ORG-GV-CFO-INDEPENDENCE | `urn:obligation:bank:org:gv:cfo-independence:v1` | Banks Act s.60; Companies Act s.94 read with PA fit-and-proper |
| 5 | ORG-FC-11-GLOSS-CEO-MLRO-BAR | `urn:obligation:bank:org:fc:ceo-mlro-bar:v1` | FIC Act 38/2001 s.43A; FIC published RMCP guidance; supervisory precedent |
| 6 | ORG-FC-MLRO-ALTERNATE | `urn:obligation:bank:org:fc:mlro-alternate:v1` | FIC Act 38/2001 s.43A; FIC PCC guidance on MLRO-alternate **[citation: TBC]** |
| 7 | ORG-PR(IV)-13-GLOSS-DEPUTY-IO | `urn:obligation:bank:org:privacy:deputy-io:v1` | POPIA 4/2013 ss.55–56; POPIA Reg. 4 |
| 8 | ORG-FAIS-KI | `urn:obligation:bank:org:fais:key-individual:v1` | FAIS Act 37/2002 s.8; Fit and Proper Determination 2017; FAIS subordinate legislation on s.45 institutional exemptions **[citation: TBC]** |
| 9 | ORG-FC-SANCTIONS-SCREENING | `urn:obligation:bank:org:fc:sanctions-screening:v1` | FIC Act ss.21–28A; FIC PCC on sanctions screening **[citation: TBC]**; UNSC sanctions; POCDATARA 33/2004 |
| 10 | ORG-CY-02-RECON-CRO-INDEPENDENCE | `urn:obligation:bank:org:cyber:cro-independence-recon:v1` | Joint Standard 1/2024 §6–§7; BCBS Corp Gov Principles 2015 §3 |

---

## 3. Citations carrying `[citation: TBC]` flags

Three rows have a citation component flagged TBC rather than invented. Each is an open item for the next regulatory-change-management sweep:

1. **ORG-FC-MLRO-ALTERNATE** — exact FIC Public Compliance Communication reference for MLRO-alternate designation guidance is unconfirmed. The expectation is recommended-practice in published guidance, not statute. Resolution: locate the precise PCC ID in the FIC publications library; until then, the citation reads "FIC Public Compliance Communications / published RMCP guidance".
2. **ORG-FAIS-KI** — exact FAIS subordinate-legislation reference for institutional / professional counterparty exemptions under s.45 is unconfirmed in this pass. This is genuinely a counsel question per the Owen+Imani brief and Mira+Zara Q4. Resolution: external-counsel adjudication at the licence-application gate; PAX role-research on whether the institutional-only / wholesale posture requires an FSP licence at all (per CEO decision follow-on to Saskia).
3. **ORG-FC-SANCTIONS-SCREENING** — exact FIC Public Compliance Communication reference for sanctions-screening operational expectations is unconfirmed. The bank's sanctions screening engine (Mira substrate) and procedure (`Procedures/by-policy/sanctions-screening.md`) are live; the citation precision is the open item, not the substrate. Resolution: locate the precise PCC ID in the next regulatory-change sweep.

These TBC flags are themselves Principle-2 compliant — the row is registered as having an open citation question, with the substantive content of the obligation captured. The flag is the honest record, not a guess.

---

## 4. What changed in the register file

`Regulations/_obligations-register.md` (version 1.3 → 1.4):

- New **v1.4** entry in the change-history block at the top.
- New **Domain O — Thin human layer obligations (D-THIN-HUMAN-LAYER-MINIMUM)** section inserted immediately before Domain L (Whistleblowing, ethics, anti-bribery), with prologue + table of 10 rows.
- Status summary updated: counts adjusted to reflect the 10 new rows (3 IN FORCE gloss/recon; 3 PARTIAL; 2 DRAFTING; 1 N/A-yet for ORG-FAIS-KI; 1 mixed). Total tracked obligations: ~178 → ~188 across 13 domains.
- Schema preserved: 6-column table (ID | Citation | Requirement | Fulfilment policy | Owner | Status), parser-compatible with `prototype/dashboard/obligations-view.ts`.

---

## 5. Cross-references

- **CEO decision:** `Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-thin-human-layer-minimum.md`
- **Conduct-side confirmation paper:** `Owner Inbox/2026-05-09_mira-zara_concentration-risk-conduct-confirmation.md` (§5 gap list authority)
- **Owen+Imani composition paper (PR #22):** `Owner Inbox/2026-05-09_owen-imani_thin-human-layer-minimum-possible.md`
- **Register file:** `Regulations/_obligations-register.md` (Domain O, v1.4)
- **Citation types:** `prototype/platform/citation/types.ts` (URN scheme)
- **Dashboard view:** `prototype/dashboard/obligations-view.ts` (parser; six-column schema preserved)
- **Sanctions procedure (cited by ORG-FC-SANCTIONS-SCREENING):** `Procedures/by-policy/sanctions-screening.md`
- **FAIS procedure (cited by ORG-FAIS-KI fulfilment chain):** `Procedures/by-policy/fais-advice-record-capture.md`

---

## 6. What does NOT change in this pass

Per the CEO decision's separate follow-on routes (do not duplicate parallel agents' work):

- Owen is updating the Governance Framework + composition paper to reflect the 6-human composition (separate route).
- Imani is updating the legal-as-code reading on the separate-CRO test under JS 1 of 2024 (separate route).
- Nolan is opening recruitment briefs for the six humans (separate route).
- Zara is operationalising the post-decision compliance posture: FIC submission cycle, FSP application path, TCF substrate planning (separate route — Mira's pass is register-rows-only).
- Helena, Saskia, PAX have their own follow-on routes from the same decision record.

This pass closes Mira's specific scope: **the 10 register-row authoring tasks**, nothing more.

---

—Mira (Compliance / RegTech engineer)
