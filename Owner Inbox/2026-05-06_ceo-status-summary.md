# CEO status summary

**Author:** Scrooge (Chief of Staff) · Owen (CoSec, distribution)
**Date:** 2026-05-06
**For:** Marc (CEO)

> **Derivation note (Principle 6).** Every statement in this summary cites its internal source — `CLAUDE.md`, the policy library, the obligations register, the persona files in `/Team/`, the procedures library, and the deliverables in `Owner Inbox/`. No new substance is authored at the presentation layer.

---

## At a glance

| | |
|---|---|
| **Team** | 18 virtual employees + CEO |
| **CEO direct reports** | 9 (Scrooge, Helena, Devon, Camille, Eitan, Saskia, Owen, Zara, Iris) |
| **Architectural principles** | **7** in `CLAUDE.md` |
| **Decisions actioned** | **25** across 2 rounds (Round 1: 13 approve / 3 defer / 2 modify; Round 2: 7/7 approve) |
| **Core policies in force** | **41** across 5 bundles |
| **Procedures populated** | **9** (of ~80 identified) |
| **Regulatory library** | **~64 instruments** tracked; **~178 obligations** registered; **4 exemplar instrument analyses** populated |
| **Cloud target** | **Microsoft Azure** |
| **Reporting capability** | **Specified** — no build yet (per CEO directive) |
| **Prototype** | Walking-skeleton platform code (typed core, money, event-store) |
| **Open governance hires** | CAE (in flight), CISO, GC, CHRO |

## State of the bank

Two days in (2026-05-05 → 2026-05-06), the bank has gone from an empty repository to a complete governance scaffolding + policy stack, with a regulatory library mapping every applicable obligation to where it is fulfilled, a procedures library translating policies into actions, and a prototype platform underway.

What does *not* yet exist: a business plan, customer segments, products, or a SARB licence application. The infrastructure is now ready to hold a bank; the bank itself is a strategic conversation away.

## Top-of-house

Source: `CLAUDE.md` *Top-of-house reporting*.

| Seat | Holder | Type |
|---|---|---|
| Chief of Staff | Scrooge | Functional (orchestrator) |
| Chief Risk Officer | Helena | Governance |
| Chief Operating Officer | Devon | Governance |
| Chief Financial Officer | Camille | Governance |
| Treasurer | Eitan | Governance |
| Head of Global Markets | Saskia | Governance |
| Company Secretary | Owen | Governance |
| Chief Compliance Officer | Zara | Governance |
| Information Officer | Iris | Governance |

Engineers (14) report through their governance home. Vera (internal audit) is administratively under the CEO with a dotted line to Owen and a future CAE — third-line independence is non-negotiable. PAX (research) and Nolan (recruitment) are functional through Scrooge.

**Open governance seats:** CAE → CISO → GC → CHRO (Helena's recommended hire order, A2 approved).
**Engineering gap:** institutional-markets-sales engineer (under Saskia, when franchise needs concretise).

## Architectural principles (`CLAUDE.md`)

1. **Events are the only source of truth.** Balances, capital, ratios, regulatory cells — all queries; as-of replay first-class.
2. **Every action traces to a source.** No control or process without a register-linked citation.
3. **Cloud-native; nothing manual or physical except where essential.** IaC; coded workflows; structured documents.
4. **Security designed in from the start.** Threat modelling per design, zero trust, HSM-backed keys, secure SDLC.
5. **Multi-currency, multi-entity, multi-country from day one.** New entities are configuration, not project.
6. **Single source of truth; presentations derive from data.** `Data → Process → Standard → Policy → Presentation`.
7. **Implementation traceability.** `Reg → Policy → Procedure → System Capability` + no orphan functionality, no orphan procedures, every procedure mandate-owned.

## What was decided

Source: `Team Inbox/actioned/2026-05-06_ceo-decisions.md` (Round 1) + `…ceo-decisions-policies.md` (Round 2).

Two-track approval convention established: **CEO** (executive) and **BOARD** (reserved matter, approved on behalf of CEO + independent NEDs interim until a Board exists).

### Round 1 (18 decisions, 2026-05-06 morning)

13 approved · 3 deferred · 2 modified.

Approvals included: governance framework, RAS, hire-order CAE→CISO→GC→CHRO, interim governance arrangement, continuous-KYC two-tier default, sanctions zero-appetite, cyber severity tiers, model-risk three-tier, sector concentration ≤25%, climate appetite, client-master + continuous-KYC design, paid-data integrations deferred, Niko placement under Devon, top-of-house structure.

Deferred: B2 (capital / liquidity buffer calibration), B5 (trading mandate), E1 (POPIA IO designation lodgment).

Modified (resolved): C2 reverted (CoSec stays under CEO); F1 framework re-classified to *policy* layer (not standard).

### Round 2 (7 decisions, 2026-05-06 afternoon)

7/7 approved.

5 policy-bundle approvals (~41 policies in force), IFRS 9 hedge-accounting election, policy register confirmed as taxonomy of record.

## What is in force

### Constitutional layer
- Risk Appetite Statement (RAS).
- Governance Framework (interim) — Board reserved matters defined; sub-committee charters drafted; three lines of defence formalised; interim Risk Forum (Helena chair) and interim Audit Forum (Owen chair) running until a Board is constituted.

### Operating policy stack — 41 core policies

| Bundle | Policies |
|---|---|
| Risk | RMF · Credit · Market · Liquidity · Op Risk · Op Resilience · Model Risk · Stress Testing |
| Compliance & Privacy | RMCP · AML/CFT · Sanctions · KYC/CDD/EDD · Conduct/TCF · POPIA · PAIA · Cross-Border |
| InfoSec & Ops | InfoSec · Cyber Resilience · IR · Outsourcing · Cloud · BCP/DR · Records · Change |
| Finance & Treasury | Capital Mgmt · IFRS · Tax · IFRS 9 ECL · Funding · FTP · Hedge (IFRS 9) · Collateral |
| Conduct, Ethics & HR | Code of Conduct · Conflicts · ABC · Whistleblowing · Gifts · Insider Trading · Remuneration · Fit-and-Proper · Harassment |

### Architectural elections
- IFRS reporting throughout.
- IFRS 9 hedge accounting (IAS 39 carryover not used).
- Principle 6 layer hierarchy.
- Governance ≠ engineering.
- Two-track decision approval.
- Auto-pickup workflow (Team Inbox → action).
- Azure as production cloud.

### Regulatory library
- 64 instruments tracked across 11 regulator subfolders.
- 4 exemplar instrument analyses populated: Banks Act, FIC Act, POPIA, Joint Standard 1 of 2024.
- ~178 obligations consolidated in `Regulations/_obligations-register.md` (canonical) + filterable HTML view.

### Procedures library
9 procedures populated:
- KYC onboarding (Mira/Zara)
- Sanctions screening (Mira/Zara/Senna)
- Capital ratio monitoring (Camille/Bea)
- POPIA breach notification (Iris/Senna/Zara)
- Incident response (Senna/Devon/Iris/Zara)
- Conflicts declaration (Owen/Helena/Zara)
- POPIA DSAR (Iris/Anya/Senna)
- Change management (Devon/Atlas/Senna)
- Pricing approval (Niko/Helena/Eitan/Camille/Zara)

~70 more identified in the index, awaiting domain-lead drafting.

## What is in flight

### Carry-forward refinements (deferred decisions)
- **B2 — capital / liquidity buffer calibration** — Helena + Camille + Eitan, via ICAAP / ILAAP.
- **B5 — trading mandate** — Saskia + Helena + Camille; substantive markets paper.
- **E1 — POPIA IO designation lodgment** — Iris's options paper (Iris / CEO retains / Owen / future hire).

### Active hires
- **CAE** — PAX brief authored; Nolan to hire.

### Active drafting
- ~70 procedures (drafting queue under domain leads, coordinated by Owen).
- ~60 regulator instrument analyses (regulatory-change management cadence under Mira).
- Tier-2 policies (markets, customer, legal, audit-on-CAE-hire, HR labour-law set).

### Prototype
- Walking skeleton: typed core (P5 branded types, money), event-store types, SQLite event store.
- Halted at coherent stopping point during today's work; resumes when authorised.

### Reporting capability
- **Specification only** delivered today (`Owner Inbox/2026-05-06_reporting-capability-spec.md`); covers AFS, BA returns, FIC submissions, SARS, FSCA, Joint Standard, Information Regulator, Excon, statutory, internal packs, analytics; phased M1–M8 with Azure lift at M8.
- **No build yet** per CEO directive.

## What needs CEO next

The bank is not currently blocked on you. Items that will surface as decisions in future packs:

1. **Strategic foundation.** What kind of bank is this? Customer segments, products, geographic / channel strategy, capital plan, SARB licence-application sequencing. The infrastructure is now ready to hold a bank; the bank itself is the next conversation.
2. **B2 / B5 / E1 refined drafts** — when they arrive (B5 ~2 weeks; E1 ~1 week; B2 with the ICAAP / ILAAP cycle).
3. **Authorisation to build the reporting capability** per the M-phase plan in the spec.
4. **CAE hire** when Nolan presents candidates (post-A2 approval).
5. **Subsequent governance hires** (CISO → GC → CHRO) sequenced behind CAE.
6. **Cloud-lift sequencing** when Atlas presents the M8 plan.

## Architectural integrity check (Principle 7)

The chain `Reg → Policy → Procedure → System Capability` is now wired bidirectionally:

- **Reg → Policy:** `Regulations/_obligations-register.md` maps 178 obligations to policies.
- **Policy → Procedure:** `Procedures/_index.md` maps every approved policy to one or more procedures (9 populated, ~70 planned).
- **Procedure → System Capability:** every populated procedure names its `@platform/...` components (existing or planned).
- **Mandate ownership:** every procedure carries an owner whose persona file in `/Team/` covers the substance — checked bidirectionally; orphans are reportable findings to Vera.

The chain is testable today on the populated slice; testable in full when the procedures and capabilities backlog clears.

## Risks and open observations

1. **Scaffolding is mature; substance is thin.** We have 7 architectural principles, 41 policies, 178 mapped obligations, but no business plan, no products, no licence application. The next major work-stream is strategic, not architectural.
2. **Prototype is early.** The walking skeleton runs locally (when Bun is installed); the system-capability layer that procedures reference is mostly `PLANNED`. Build authorisation is a pending decision.
3. **Regulatory library has 60 instrument stubs.** The exemplar pattern is set; the rest is Mira's continuous-change-management cadence — substantive, not urgent.
4. **Interim governance is interim.** Board-reserved decisions currently route through CEO + CRO + CFO concurrence. This is defensible for now; it is not a permanent posture. Board formation is a forward-looking item.
5. **Single point of failure on Owen.** CoSec, governance framework custodian, board pathway, conflicts register, whistleblowing, PAIA — Owen carries a lot. Worth flagging that succession / deputy is a question for when the bank scales.
6. **POPIA IO designation is unsigned.** Iris is operationally in seat but the lodgment with the Information Regulator is deferred. Pending E1 resolution.

## Co-dependencies (where this summary derived from)

- `CLAUDE.md` — architectural principles + team structure + top-of-house.
- `MEMORY.md` (in this session's memory directory) — feedback and project memories established across the work.
- `Owner Inbox/2026-05-06_*` — every deliverable produced today.
- `Team Inbox/actioned/2026-05-06_ceo-decisions*.md` — both decision rounds.
- `Regulations/_obligations-register.md` + `Regulations/_index.md`.
- `Procedures/_index.md` + `Procedures/by-policy/*`.
- `prototype/platform/*` — walking skeleton.
- `/Team/` — 18 persona files.

This document is itself a presentation under Principle 6 — generated, not authored. The team operates on the artefacts above; this summary is what they look like from the CEO seat.
