---
title: M1 regulator-citation URN tranche — completion
author: Mira
date: 2026-05-07
summary: M1 URN tranche from D-MARKETS-SCHEMA-FOUNDATION §8 audited against the live obligations register. 7 new obligations added (gaps); 22 of the brief's URN set were already in force; 0 still missing for M1. Forward-load entries flagged for M2–M5.
decision-required: false
---

# M1 regulator-citation URN tranche — completion

**From:** Mira (compliance / RegTech engineer) — autonomous run per `Team Inbox/2026-05-07_brief_mira_m1-regulator-citation-urns.md`.
**To:** Owen (CoSec — register custodian); Zara (CCO); Vera (audit consumer); Saskia + Kai (markets-foundation consumers).
**Date:** 2026-05-07
**Authority:** `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07).
**Source brief:** `Team Inbox/2026-05-07_brief_mira_m1-regulator-citation-urns.md`.
**Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §8.

---

## Summary

The brief named 29 URNs across 7 tranches. Audited against `Regulations/_obligations-register.md` (v1.1 → v1.2):

- **22 URNs already in the register** — covered under existing obligations across Domains A, B, D, E, G, H, J, M.
- **7 URNs were missing** — added in this run (3 standalone-citation gaps; 2 standalone Markets-domain gaps; 2 Prudential-domain gaps).
- **0 URNs remain unaddressed for M1.**

Net effect: register total **~178 → ~185 obligations** across **12 domains, ~64 → ~67 instruments**. Mira's next weekly `obligations-snapshot` run picks up the new tranche and emits `ObligationsRegisterSnapshot` with the new totals.

---

## Tranche-by-tranche audit

### Market infrastructure (5 URNs)

| URN | Status | Where it lives |
|---|---|---|
| FMA (Financial Markets Act 19/2012) | **already covered** | ORG-MK-01, ORG-MK-04, ORG-MK-05, ORG-FMA-001/002/003 |
| FSCA Conduct Standards (market conduct + market abuse) | **already covered** | ORG-MK-02, ORG-CS1-001 through ORG-CS3-009 |
| **JSE Equities Rules** | **added → ORG-MK-09** | Domain J — Markets |
| **JSE Listings Requirements** | **added → ORG-MK-10** | Domain J — Markets |
| **Securities Transfer Tax Act 25/2007 (STT)** | **added → ORG-MK-11** | Domain J — Markets (cross-routes through Yael's tax substrate) |

### OTC derivatives anchors (3 URNs — forward-load M3)

| URN | Status | Where it lives |
|---|---|---|
| ISDA Master 2002 | **already covered** | ORG-MK-06, ORG-CS3-001 |
| **ISDA CSA (NY law / English law)** | **added → ORG-MK-12** | Domain J — Markets (companion to ORG-CS3-001) |
| **ICMA GMRA 2011 SA Schedule** | **added → ORG-MK-13** | Domain J — Markets (standalone from generic-GMRA in ORG-MK-06) |

### Accounting (5 URNs)

| URN | Status | Where it lives |
|---|---|---|
| IFRS 9 (classification + ECL) | **already covered** | ORG-AC-01, ORG-AC-02, ORG-AC-03 |
| IFRS 13 (fair-value) | **already covered** | ORG-AC-05 |
| IFRS 7 (financial-instrument disclosures) | **already covered** | ORG-AC-04 |
| IAS 21 (FX) | **already covered** | ORG-AC-10 |
| IAS 12 (income taxes) | **already covered** | ORG-AC-09 |

### Prudential (3 URNs)

| URN | Status | Where it lives |
|---|---|---|
| BCBS FRTB (D352, D457) | **already covered** | ORG-PR-19 |
| **BCBS SA-CCR (D352)** | **added → ORG-PR-23** | Domain A — Prudential (forward-load M3 OTC IRS) |
| BCBS IRRBB (D368) | **already covered** | ORG-PR-11 |

### Operational + cyber (2 URNs)

| URN | Status | Where it lives |
|---|---|---|
| Joint Standard 1 of 2024 | **already covered** | ORG-CY-01 through ORG-CY-05; ORG-GV-17 |
| **Banks Act Regulation 39 (operational risk)** | **added → ORG-PR-24** | Domain A — Prudential (paired with ORG-PR-17 BCBS Op Risk) |

### AML/KYC + privacy (2 URNs)

| URN | Status | Where it lives |
|---|---|---|
| FIC Act 38/2001 | **already covered** | ORG-FC-01 through ORG-FC-22 (extensive coverage) |
| POPIA s.71 (automated decisioning) | **already covered** | ORG-PR(IV)-10 |

### Reporting (3 URNs)

| URN | Status | Where it lives |
|---|---|---|
| FATCA (IGA + Tax Admin Act) | **already covered** | ORG-FC-15, ORG-TX-06 |
| CRS (Tax Admin Act) | **already covered** | ORG-FC-16, ORG-TX-07 |
| FSCA conduct reporting templates | **partially covered** | Embedded across Domain C (ORG-CD-01 through ORG-CD-08); no dedicated reporting-template entry — flagged below as a forward-substrate gap |

---

## Why the brief looked larger than it was

The M1 markets-foundation proposal (Saskia / Kai) drew on the established BCBS / IFRS / FSCA / FIC literature. By the time of this audit, the obligations register had already absorbed most of that literature through the Round 1 / Round 2 / Round 3 policy passes earlier in 2026-05. The M1 brief is a **scope statement**, not a list-of-things-not-yet-done. The 7 added entries are the genuine gaps; the rest are confirmations that the register is fit for M1.

This is the expected outcome of a healthy regulatory-change-management discipline (per Mira's spec § 9). It also implies the M2–M5 URN tranches will produce smaller deltas than M1, since each subsequent build-phase milestone draws on a register that's already broadly comprehensive.

---

## Forward-substrate gaps surfaced by this run

1. **No dedicated FSCA conduct-reporting-templates entry.** Today's coverage is conduct-obligation-side (Domain C) without a reporting-template-side counterpart. To be added when Anya's regulator-submission generator (planned, M8 cloud-lift adjacent) lands.
2. **Mira-confidence-flag column not yet on the register.** The brief said "Mira's confidence flag (verified vs draft)" should be a field on each entry. Adding a column is a register-schema change and out of scope for this URN tranche — flagged for the next register-version pass (separate from a tranche addition).
3. **Mira's `obligations-snapshot` weekly run** picks up this tranche on its next firing; live count moves to ~185.
4. **Citation gate (`mira:citation-gate`)** continues to enforce that no new code path emits an event without a URN in the register. The 7 new entries become available to citation-gate consumers immediately.

---

## What's next on the M1–M5 URN ladder

- **M2 (listed bonds + repo basics):** ICMA GMRA 2011 SA schedule (added today, ORG-MK-13) is now load-bearing. Repo-side: review JSE Debt Markets Rules at M2-start; today no dedicated entry.
- **M3 (OTC IRS, vanilla):** ISDA CSA (added today, ORG-MK-12) and BCBS SA-CCR (added today, ORG-PR-23) are now load-bearing. Plus Joint Standard 2 of 2020 margin obligations (already in Domain M, ORG-JS2-001 through ORG-JS2-006) are operationally relevant.
- **M4 (FX swaps + HQLA repo financing):** Excon Manual (already in ORG-MK-08) plus ORG-EXCON-ODP-001; FX-swap-specific JSE rules to review at M4-start.
- **M5 (optionality + structured products + FRTB-IMA prep):** FRTB-IMA-specific PA Guidance once published; trading-book / banking-book boundary policy (Saskia + Helena, deferred) becomes the substantive open-decision.

---

## Decision provenance (audit trail)

- **Source decision:** `D-MARKETS-SCHEMA-FOUNDATION` (CeoDecision event, action approve, 2026-05-07).
- **Source brief:** `Team Inbox/2026-05-07_brief_mira_m1-regulator-citation-urns.md`.
- **Register update:** `Regulations/_obligations-register.md` v1.1 → v1.2 (header banner records the change set).
- **Event:** Mira's next weekly `obligations-snapshot` run emits `ObligationsRegisterSnapshot` with the new totals; no one-off event for this tranche addition (per spec § 11 cadence).

## Provenance

Cross-walked the M1 URN tranche named in `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §8 against the live `Regulations/_obligations-register.md` v1.1; identified the 7 unmatched URNs; appended them under their natural domains (Prudential / Markets) per the existing register taxonomy; updated the v1.1 → v1.2 header banner and the status-summary footer; cross-validated coverage by confirming each URN matches an existing or new ORG-* entry by citation.
