# Brief — M1 handler: `mira:m1-regulator-citation-urns`

**From:** Scrooge (Chief of Staff)
**To:** Mira (compliance / regtech engineer) — handler owner.
**Cc:** Owen (CoSec — register custodian), Zara (CCO), Vera (audit consumer).
**Date:** 2026-05-07
**Authority:** `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07).
**Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §8 (URN set).
**Trigger kind:** event-driven. Subscribes to `CeoDecision` (D-MARKETS-SCHEMA-FOUNDATION).

## What the handler does

Populate the obligations register (`Regulations/_obligations-register.md` + the typed citation graph) with the URN set named in §8 of the markets-foundation proposal. Each URN is a typed entry: `regulator + instrument + section + as-of date`.

URN tranches required at M1:

- **Market infrastructure:** JSE Equities Rules; JSE Listings Requirements; FMA (Financial Markets Act 19 of 2012); FSCA Conduct Standards on market conduct + market abuse; STT (Securities Transfer Tax Act 25 of 2007).
- **OTC derivatives anchors (forward-load for M3):** ISDA Master 2002; ISDA CSA (NY law / English law variants); ICMA GMRA 2011 SA schedule.
- **Accounting:** IFRS 9 (classification + ECL); IFRS 13 (fair-value); IFRS 7 (disclosures); IAS 21 (FX); IAS 12 (income taxes — equity dividends, STT credits).
- **Prudential (forward-load for M2–M5):** BCBS FRTB; BCBS SA-CCR; BCBS IRRBB.
- **Operational + cyber:** Joint Standard 1 of 2024 (Cybersecurity & Cyber Resilience) on the trading estate; Banks Act Regulation 39 (operational risk).
- **AML/KYC + privacy:** FIC Act (s.21–s.43B); POPIA s.71 (automated decisioning).
- **Reporting:** FATCA (IGA Annex II); CRS; FSCA conduct reporting templates.

Each URN is registered with: (a) its citation key per the canonical-source registry; (b) the policy / procedure / system capability that consumes it; (c) Mira's confidence flag (verified vs draft).

## Dependencies

- Owen's canonical-source registry must include the URN namespace conventions for each regulator.
- The obligations register schema (Mira's substrate) — already live.

## Out of scope

- Procedure-side citations (those land per-procedure as Owen + domain leads write them).
- Policy-side citations (those land in the policy register).

## What good looks like

- Every URN has a citation key callable from `@platform/citation/`.
- Every URN reconciles to at least one downstream consumer (procedure / system capability) within 1 sprint of M2 starting; URNs without consumers are flagged.
- Mira's `obligations-snapshot` weekly run picks up the new URN tranche and emits `ObligationsRegisterSnapshot` with the full count.

## Reconciliation

- Vera asserts every URN is reachable by citation key from at least one running pipeline.
- Mira's citation-gate enforces that no new code path emits an event without a URN that exists in the register.

## Owner Inbox deliverable on completion

`Owner Inbox/<date>_mira_m1-regulator-citation-urns_completion.md` — URNs added, consumers mapped, gaps flagged.
