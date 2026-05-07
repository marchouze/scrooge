# CEO decision — interim operating posture: build-only

**Author:** Scrooge (Chief of Staff) — capture of CEO decision
**Date:** 2026-05-06 (end-of-day, after the strategic foundation was set)
**For:** Marc (CEO) — record · circulated to all governance and engineering seats.
**Decision authority:** CEO (executive).
**Context:** Strategic foundation set today (`Owner Inbox/2026-05-06_strategic-foundation.md`); banking licence application deferred. The interim posture was the resulting structural question — surfaced as **D1** in `Owner Inbox/2026-05-06_next-decisions-proposal.md`.

---

## The decision

**Build-only, no live trading**, until the SARB banking licence is granted. No interim FSP-licensed dealer mode. No sponsored access for live execution.

The bank during the build phase is a *fully-designed, fully-built, fully-tested institution running on synthetic flows*. It earns no revenue, executes no live transactions, and onboards no live counterparties operationally — but is, by the end of the build, ready to switch on the day SARB licences it.

## What this means concretely

| Domain | Build-phase posture |
|---|---|
| **Trading (Saskia, Kai)** | OMS/EMS built and integrated against simulators (`prototype/simulators/` for JSE, SAMOS, BankservAfrica, SWIFT). No live exchange connectivity. No live market-data subscriptions. Synthetic order flow + synthetic fills under realistic distributions. |
| **Settlement (Tomas)** | STRATE / SAMOS / SWIFT integrations built and tested against simulators. No real settlement instructions issued. |
| **Counterparties (Saskia, Niko, Imani)** | No live ISDA / GMRA / CSA negotiations *executed*. **Soft-franchise track:** relationship-building, ISDA negotiations-in-principle, soundings, MOUs — permitted and encouraged. Documentation programme prepares ready-to-execute templates. |
| **Market access (Saskia, Imani)** | JSE membership *application-ready* but not lodged. No interim sponsored-access arrangement. |
| **Capital (Camille)** | R300m as committed shareholder capital. ICAAP / ILAAP run as paper exercises against the *design* trading book. No regulatory-capital recognition until licensing. |
| **Liquidity (Eitan)** | LCR / NSFR projections run against the design book. No live SAMOS funding; no live repo book. |
| **Risk (Helena, Rohan)** | RAS calibrated to the design profile; live limits only when trading is live. Market-risk engine, IRRBB engine, CCR engine all built and tested against synthetic flows. |
| **Compliance (Zara, Mira)** | RMCP, sanctions screening, surveillance, market-abuse pipelines all built and run against synthetic flows. **No FAIS Cat I/II licence pursued in interim.** No live STR / CTR submissions. The pipelines produce SIMULATED submissions to the mock regulator endpoints in `prototype/simulators/`. |
| **Privacy (Iris)** | POPIA scope is the bank's own data; no customer PII flows in build phase. POPIA IO designation lodgment (E1) still resolved on its own track. |
| **Tax (Yael)** | Tax engines built and run against synthetic flows; no live SARS submissions. Bank registers with SARS as a non-trading entity for the build phase; first live submissions follow licensing. |
| **Reporting (Anya, Bea, Camille)** | BA returns, AFS, FIC submissions, FATCA / CRS XML — all generated end-to-end from synthetic flows; outputs clearly labelled `SIMULATED`. M-phase build (D2 staged authorisation) proceeds as planned. |
| **Internal audit (Thandiwe, Vera)** | Audit plan focuses on **design-quality** rather than in-flight-trading testing. Continuous-controls programme runs against synthetic evidence. Combined-assurance map covers the *built* control surface, with a clear gate at "go-live: re-test against live evidence". |
| **Security (Senna)** | Full zero-trust + key-rotation + IR programme operational on the build environment. No real customer-facing security surface in build phase. |
| **HR / fit-and-proper (Sade)** | Smaller headcount than a live-trading bank profile; fit-and-proper register populated for key individuals; CIPC / Companies-Act registrations as appropriate; no live FSCA key-individual / authorised-user submissions. |
| **Platform (Atlas, Anya)** | Build proceeds per Atlas's M-phase plan. Cloud-lift (M8) sequencing **may now be reconsidered**: with no live trading, M8 timing can stay flexible — the local-build can extend further before lift, reducing cloud spend during the no-revenue period. |

## Why this is the right decision

1. **Lowest legal-structure complexity.** A build-only entity does not need to be FAIS-Cat-licensed today and re-engineered into a banking licence later. One legal vehicle, one regulatory regime when activated.
2. **Architectural integrity preserved.** The bank-as-designed *is* the bank-at-licence; no interim shims, no "we'll redo this when licensed" debt.
3. **Operating evidence accumulates against the design.** Two years of synthetic-but-disciplined operation produces a SARB licence application backed by real continuous-controls evidence, real recon-harness pass rates, real audit-finding closure stats — not aspirational projections.
4. **Capital efficiency.** Live-trading interim modes consume capital on positions that will be unwound at licence transition. R300m goes further as build capital than as trading + transition capital.
5. **Talent focus.** The team builds the bank they want; they don't run two operating models in parallel.

## Tradeoffs the CEO has accepted

- **No revenue for ~18–30 months.** R300m must last the build + licensing road. Burn-rate discipline matters more than initially expected.
- **No live commercial counterparties.** Franchise relationships with corporates / institutional FIs must be cultivated *during* the build (the soft-franchise track above), not after — or the bank goes live without warm pipeline.
- **Talent retention through a no-revenue period.** The team building this needs to stay through ~2 years of paper-only work. Compensation, equity, and mission alignment become first-order considerations (Sade + future CHRO).
- **Licence-grant timing remains a strategic risk.** SARB approval is not on the bank's clock. A build-only posture means the bank has no fallback revenue if licensing extends beyond expected horizon.

## What changes immediately

| Surface | Change |
|---|---|
| `Owner Inbox/2026-05-06_strategic-foundation.md` | §5 question 1 (interim operating posture) marked **resolved**. The §3 / §4 per-seat implications are now scoped to build-phase rather than ambiguous. |
| `Owner Inbox/2026-05-06_next-decisions-proposal.md` | D1 marked **resolved**. The follow-on items previously gated on D1 (D4, D5, D9, D10, D11, D13) inherit the build-only assumption. |
| `Team Inbox/2026-05-06_brief_markets-franchise-design.md` (Saskia) | Working assumption updated via a short follow-up note (`Team Inbox/2026-05-06_followup_saskia_build-only-posture.md`). |
| `Owner Inbox/2026-05-06_ceo-status-summary.md` / `.html` | "What needs CEO next" item D1 removed; D2 (reporting-capability build authorisation) becomes the next-up; D3 (CISO kickoff) follows. |
| Project memory | Strategic-foundation memory updated to reflect resolved interim posture. |
| `MEMORY.md` index | Updated. |

## What still needs CEO

The two remaining pacing-critical decisions from `Owner Inbox/2026-05-06_next-decisions-proposal.md`:

- **D2 — Reporting-capability build authorisation** (recommend: yes, M2–M3 staged).
- **D3 — CISO hire kickoff** (recommend: yes, PAX to draft brief).

—Scrooge
