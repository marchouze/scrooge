---
agent: Imani
trigger: legal-readiness
asOf: 2026-05-15T07:09:13.023Z
decision-required: false
---

# Imani — Legal-readiness snapshot, 2026-05-15

Autonomous run of Imani's weekly legal-readiness snapshot per `Team/Imani.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. 14th handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 31 Imani-owned obligations on the register (0 IN FORCE; 0 IN FLIGHT; 1 PARTIAL; 23 PLANNED) · 0 master agreements signed (last 7d) · clause-library version-published: **no — substrate gap** · legal-entity tree count: 1.

## Imani-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 0 |
| IN FLIGHT | 0 |
| PARTIAL | 1 |
| PLANNED | 23 |
| DRAFTING | 3 |
| **Total** | **31** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Imani (co-curated rows with Mira / Saskia / Tomas / Owen included). Coarse parser — refines once the obligations register exposes a structured per-row API._

## Legal-domain events (last 7 days)

| Event | Count |
|---|---|
| `MasterAgreementSigned` | 0 |
| `ClauseLibraryVersionPublished` | 0 |
| `LegalEntityRegistered` | 0 |
| `ECTAExecutionRecorded` | 0 |

_Build-phase posture: zero legal-domain events. The clause-library DSL, ECTA-execution engine, and CLM platform are design-only (Imani spec § 16). Live event flow activates at commencement of trading — first `MasterAgreementSigned` is gated on Niko's counterparty-onboarding pipeline activating at licence-day._

## Legal-as-code substrate state

| Item | State |
|---|---|
| Clause-library version published | **no — substrate gap (DSL design-only)** |
| Legal-entity tree count | 1 (`BANK-ZA-001` placeholder; no `LegalEntityRegistered` events yet) |
| ECTA-execution path exercised | **no — engine + HSM integration design-only (§ 16)** |
| Counterparty-onboarding exercised | **no — Niko paused until commencement of trading** |
| Prior `LegalReadinessSnapshot` runs (last 30d) | 1 |

## Substrate gaps surfaced this run

- **Clause-library DSL** — design only; no DSL implemented; no `ClauseLibraryVersionPublished` events. Active build-phase work; co-owned with Atlas (substrate). Targets M1 alongside ISDA / GMRA template architecture (Imani spec § 16).
- **ECTA-execution engine** — cryptographic-signature substrate not yet integrated to platform HSM (Senna's domain). Design only. Required pre-licence for Schedule-1 gating, electronic-signature evidence, and the wet-signature exception path (§ 16).
- **CLM platform** — pattern-research only; vendor-vs-build decision pending. Owners: Imani + Camille (cost) + Devon. Target: pre-licence (§ 16).
- **Legal-entity-tree as live registry** — designed in Owner Inbox notes; not yet a queryable registry; tree count today derives from a placeholder floor. Co-owned with Anya (semantic-layer integration). Target: M1 (§ 16).
- **External-counsel panel** — recommendation paper (S5) drafted; CEO decision pending. Engagement timing 6–9 months ahead of SARB licence lodgment.
- **Customer-facing terms / employment contracts / live signed counterparty agreements** — paused until licence-day per build-phase model. Soft-franchise negotiations-in-principle structured artefacts only.

## Imani's narrative

The legal-as-code substrate is effectively unbuilt. Of 31 Imani-owned obligations, one sits at PARTIAL, three at DRAFTING, and 23 at PLANNED; nothing is IN FORCE because there is nothing yet to enforce against — no customers, no signed counterparty agreements (soft-franchise negotiations-in-principle only), no employment surface (Sade's HR slice paused). Zero legal-domain events in the last seven days is the expected build-phase reading, not a defect. What is load-bearing on the first signed master agreement at commencement of trading and not yet built: (i) a clause-library DSL with a published version (clause count: 0), (ii) the ECTA-execution engine wired to the platform HSM so that a signed instance carries an Electronic Communications and Transactions Act 25 of 2002 s 13 advanced-electronic-signature attribution and s 14 data-integrity hash — noting that nothing we plan to sign falls within ECTA Schedule 1 (wills, alienation of land, long-term leases of land exceeding ten years, bills of exchange under the Bills of Exchange Act), so the electronic path is statutorily open to us, (iii) the legal-entity tree as a queryable registry (currently a BANK-ZA-001 floor of one, no Companies Act 71 of 2008 s 14 incorporations recorded), and (iv) the CLM vendor-vs-build decision that gates how (i)–(iii) compose.

The most consequential single obligation is the PARTIAL row covering the written trading-relationship agreement that must exist with each counterparty before first trade — the ISDA Master Agreement (2002 form) with Schedule and Credit Support Annex for derivatives, GMRA 2011 for repo, GMSLA 2010 for securities lending. None of those templates exist as authored ZA-jurisdiction instances in the clause library yet, and absent that template-architecture work the substrate cannot produce a signed instance on day one of trading. The external-counsel recommendation paper (S5) — which should give us the vendor-vs-build call on CLM and confirm the ZA-law modifications to the ISDA Schedule (governing-law, jurisdiction, Section 5(a)(vii) bankruptcy cross-references to the Insolvency Act and the resolution regime under the Banks Act 94 of 1990 and the Financial Sector Regulation Act) — remains outstanding and is the critical-path input I cannot author around.

Next legal move, concrete: (a) draft clause-library increment v0.1 covering the ISDA Schedule Part 1–5 ZA-law overlay (governing law, jurisdiction, tax representations, credit-support documents, termination-currency) as the first authored template, so we have a non-empty library to version-publish; (b) escalate the written trading-relationship-agreement obligation (the PARTIAL row at counterparty-onboarding) to Mira for elevation to a licence-day blocker with an explicit dependency edge to the S5 external-counsel paper; (c) commission, against `Team/Imani.md` § 16, three substrate items — with Atlas, the clause-library DSL schema and storage model; with Senna, the ECTA s 13 AES path to the platform HSM including the s 14 integrity-hash capture into the obligations evidence chain; with Anya, the legal-entity tree as a queryable registry seeded from CIPC Companies Act s 14 registration data. Until those three land, every "signed" event we contemplate is a template, not an instance.

## Provenance

Imani-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Imani appears in any cell); legal-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; clause-library / legal-entity / ECTA / counterparty-onboarding state from typed event presence. Citation chain: ECTA 25 of 2002, Companies Act 71 of 2008, ISDA Master Agreement (2002 form), GMRA 2011, Banks Act 94 of 1990.
