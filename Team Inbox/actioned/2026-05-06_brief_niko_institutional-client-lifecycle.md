# Brief — Institutional client lifecycle (Niko)

**From:** Scrooge (Chief of Staff)
**To:** Niko (Sales / CRM engineer; reports to Devon, COO)
**Cc:** Saskia (Head of Global Markets), Imani (Legal-as-code), Mira (Compliance / RegTech), Zara (CCO), Thandiwe (CAE) via Vera, Anya (Data), Devon (COO).
**Date:** 2026-05-06
**Authority:** CEO strategic-foundation decision (2026-05-06) + build-only operating-posture decision (2026-05-06) + Round 1 client-master + continuous-KYC approvals (`Team Inbox/actioned/2026-05-06_ceo-decisions.md`).
**Anchors:** `Owner Inbox/2026-05-06_strategic-foundation.md` · `Owner Inbox/2026-05-06_ceo-decision_interim-operating-posture.md` · `Owner Inbox/2026-05-06_client-master-and-continuous-kyc.md` · `Team Inbox/2026-05-06_brief_markets-franchise-design.md` (Saskia) · `Team Inbox/2026-05-06_followup_saskia_build-only-posture.md`.
**Status:** **GREEN-LIT to start.** Deliverable: Institutional client lifecycle design proposal in `Owner Inbox/`, ~3 weeks.

---

## Why now

The strategic foundation sets the bank's client base — large SA corporates, banks, non-bank financial institutions, **institutional-only**. The build-only posture (no live trading until SARB licence) means no live clients are onboarded operationally during the build, but the **full lifecycle is designed and built end-to-end** against synthetic counterparties so that switch-to-live at licence-grant is a configuration change. Niko's seat exists for this work; until today there was no concrete brief because the strategic foundation had not been set. It is now.

Saskia's franchise design proposal (D4, ~2 weeks) will name priority counterparties (S2) for the soft-franchise track. The lifecycle you're designing is what those relationships will run on when they convert to clients at licence-grant.

## Scope (CEO-set, not for re-litigation)

- **Client base:** institutional only — large SA corporates, banks, non-bank financial institutions. **No retail.** No SME / commercial banking.
- **Geography:** South Africa, single branch.
- **Operating posture:** build-only. No live onboarding during the build. Full lifecycle designed, built, tested against synthetic counterparties. Soft-franchise track (relationship soundings, ISDA negotiations-in-principle) is *real-world* but not contractual.
- **KYC default:** Tier-1 institutional, two-tier continuous-KYC (per Round 1 approval).

## What I need from you

A single proposal document covering:

### 1. Lifecycle stages

End-to-end stages from first sounding to operational client, including the design-time loops that exist between them. Each stage with: trigger, actors (typed: human / system / service), system capability invoked, evidence produced, exit conditions.

Indicative shape:

1. **Sounding / soft-franchise contact** (Saskia + Niko-engineering; no contractual commitments).
2. **Institutional prospect onboarding** (KYC pre-pass; FIC / FIC GN 7 RBA citations; Mira's screening pipelines on a synthetic counterparty record).
3. **Tier-1 KYC** (the institutional default — UBO, sanctions, PEP, adverse media, jurisdictional risk).
4. **Documentation negotiation** (ISDA Master + Schedule + CSA / GMRA / authorised-signatory schedules; integrates with Imani's clause-library-as-code).
5. **Authorised-trader / authorised-signatory record** (the persons that bind the counterparty; held as events).
6. **Mandate / appetite assignment** (within Saskia's franchise design + Helena's RAS envelope).
7. **Operational go-live** (counterparty becomes transactable; in build-only posture this is the configuration switch at licence-grant).
8. **Continuous KYC** (recurring + signal-driven re-evaluation; per the existing `kyc-recurring.md` and `kyc-continuous.md` procedures).
9. **Off-boarding / wind-down** (the symmetric end of the lifecycle; closure of mandate, run-off of positions, archival).

### 2. Client master (event-sourced)

- Event types: `CounterpartyOnboarded`, `CounterpartyKycCompleted`, `CounterpartyDocumentationSigned`, `AuthorisedSignatoryAdded` / `Removed`, `MandateAssigned`, `MandateRevised`, `CounterpartyOffboarded`.
- Projections: client-master, ISDA-status, authorised-signatory book, mandate book.
- Citations on every event (Principle 2). Reproducible at any as-of date (Principle 1).
- Coordinated with Anya on the projection runtime + semantic-layer naming for client-master quantities.

### 3. ISDA negotiation tracker

- A first-class tracker of where each counterparty sits in the ISDA / GMRA / CSA negotiation flow (relationships → in-principle → drafted → reviewed → ready-to-execute → executed-on-licence-day).
- Integrates with Imani's clause-library-as-code and master-agreement-as-code so the negotiation produces structured documents, not Word files.
- Read by Saskia for franchise pipeline visibility; read by Vera for documentation-integrity assurance.

### 4. KYC tier-1 default

- The institutional Tier-1 default per Round 1 (continuous-KYC two-tier).
- Integrates with Mira's existing onboarding (`kyc-onboarding.md`) and screening (`sanctions-screening.md`) procedures.
- Cite the FIC Act, FIC GN 7 RBA, sanctions framework explicitly per Principle 2.

### 5. Soft-franchise track integration

- How the lifecycle handles relationships that are *not yet* clients (soundings, MOUs, in-principle negotiations).
- Distinct event types so the audit trail is clean (no false-positive "onboarding" before contract).
- Read by Saskia for soft-franchise pipeline visibility.

### 6. Conduct & advice (FAIS context)

- The bank does **not** pursue an interim FSP licence under build-only. The FAIS conduct surface is therefore part of the *built and rehearsed* programme, not in-flight today. The lifecycle still designs the FAIS-compliant advice / intermediary-record posture so that switch-to-live is a configuration change.

### 7. Out of scope (call out explicitly)

- Retail flows. SME / commercial flows. Cash handling. Branch onboarding. Anything you find yourself designing that smells retail is a Principle-violation; flag it back to me.

## Working method

- **Coordinators (substantive):** Saskia (counterparty engagement; soft-franchise priorities), Imani (documentation programme), Mira (KYC / sanctions integration), Zara (CCO sign-off; conduct envelope).
- **Coordinators (platform):** Anya (event-sourced client master; projection runtime), Atlas (composition root). Senna for security review of the onboarding-data path.
- **Coordinators (third-line):** Vera (and Thandiwe via Vera) — design-time involvement so continuous-controls pipelines can be built alongside the lifecycle, not retrofitted.
- **No orphan capabilities (Principle 6 — upward chain).** Anything you build must trace to a procedure (existing or to-be-drafted) which traces to a policy. Flag any procedure gaps; Owen will route procedure-drafting.
- **Generated, not authored (Principle 6 — downward).** All client-master views and the ISDA-status board are projections, not maintained documents.

## Deliverables and cadence

- **State-of-Niko-domain note** (~3 days): a short status of what currently exists in `prototype/domains/` (likely: empty), what you'd build first, and any blockers.
- **Lifecycle design proposal** (~3 weeks): full document in `Owner Inbox/`. I'll route it into the dashboard as a CEO decision.
- **First domain-module skeleton** (~3 weeks, in parallel): `prototype/domains/customer/` (or your chosen name) with event types, first projections, and a tested onboarding scenario against a synthetic institutional counterparty.

Drop blockers into `Team Inbox/` as they arise; final proposal in `Owner Inbox/`. I'll confirm dependencies if you find Saskia's franchise design has not yet landed when you need an input from it.

—Scrooge
