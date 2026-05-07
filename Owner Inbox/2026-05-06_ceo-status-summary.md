# CEO status summary

**Author:** Scrooge (Chief of Staff) · Owen (CoSec, distribution)
**Date:** 2026-05-06 (regenerated end-of-day, supersedes the morning version of the same date)
**For:** Marc (CEO)

> **Derivation note (Principle 6 — downward).** This summary is a presentation-layer regeneration. Every statement cites its internal source — `CLAUDE.md`, the policy library, the obligations register, the persona files in `/Team/`, the procedures library, the prototype, the strategic-foundation deliverable, the CAE shortlist, the principles-consolidation proposal, and the actioned-decisions audit trail. No new substance is authored at the presentation layer.

---

## At a glance

| | |
|---|---|
| **Team** | 19 virtual employees + CEO (Thandiwe joined as CAE end-of-day) |
| **CEO direct reports** | 10 (Scrooge, Helena, Devon, Camille, Eitan, Saskia, Owen, Zara, Iris, **Thandiwe — CAE**) |
| **Architectural principles** | **6** in `CLAUDE.md` *(consolidated end-of-day from old 7; old P6 + P7 → new P6)* |
| **Strategic foundation** | **Set** — institutional global-markets trading bank (JSE bonds + JSE equities + OTC IRD; institutional-only; SA single-branch; ~R300m capital; banking licence deferred) |
| **CEO decisions actioned** | **30** across 3 rounds (Round 1: 13/3/2; Round 2: 7/7; Round 3 same-day: strategic foundation · principles consolidation B · CAE hire (Thandiwe) · interim posture build-only · reporting build authorised · CISO hire kicked off) |
| **Core policies in force** | **41** across 5 bundles |
| **Procedures populated** | **9** (of ~80 identified; backlog tilts to markets-bank profile after strategic foundation) |
| **Regulatory library** | **~64 instruments** tracked; **~178 obligations** registered; **4 exemplar instrument analyses** populated |
| **Cloud target** | **Microsoft Azure** |
| **Reporting capability** | **Specified** — no build authorisation yet |
| **Prototype** | Walking skeleton **+ projection runtime + identity authenticator** (foundation infra; 17 tests; CI green) |
| **Open governance hires** | **3 remaining:** CISO · GC · CHRO *(CAE filled — Thandiwe Mokoena)* |

## State of the bank

Two days in (2026-05-05 → 2026-05-06), the bank has gone from an empty repository to (1) a complete governance scaffolding + 41-policy stack, (2) a regulatory library of ~178 obligations, (3) a procedures library translating policies into actions, (4) a working prototype platform with substrate-replacement seams in place, and **(5) a fixed strategic foundation** — an institutional global-markets trading bank, JSE-listed bonds and equities plus OTC interest-rate derivatives, ~R300m capital, banking licence application deferred.

The architecture is now ready to hold a bank, the bank's *nature* is defined, and the franchise design is in flight under Saskia. The next bottleneck is two CEO decisions: (a) interim operating posture during licence deferral, and (b) the CAE hire from the shortlist now in front of you.

## Today's defining events

1. **Strategic foundation set** *(`Owner Inbox/2026-05-06_strategic-foundation.md`)* — the bank is a wholesale institutional global-markets dealer in JSE-listed bonds, JSE-listed equities, and OTC interest-rate derivatives, serving large SA corporates and bank/non-bank financial institutions, single-branch SA, ~R300m capital, banking licence application deferred.
2. **Markets franchise design briefed to Saskia** *(`Team Inbox/2026-05-06_brief_markets-franchise-design.md`)* — proposal due ~2 weeks; coordinates Helena (RAS), Camille (capital), Eitan (funding/collateral), Imani (ISDA / GMRA / membership), Kai (technology), Tomas (settlement). B5 (trading mandate) is now the central forward decision.
3. **CAE hired — Thandiwe Mokoena in seat** *(`Owner Inbox/2026-05-06_cae-hire-confirmation.md`; persona at `/Team/Thandiwe.md`)*. Shortlist produced (`Owner Inbox/2026-05-06_cae-shortlist.md`); CEO selected the recommended lead. CLAUDE.md team table and top-of-house section updated; Vera now reports functionally to Thandiwe; first-90-days plan running per the role brief §9.
4. **Principles consolidated** *(`CLAUDE.md` + `Owner Inbox/2026-05-06_principles-consolidation-proposal.md`, Option B chosen)* — old P6 + P7 merged into a new Principle 6 (single-graph discipline: downward + upward); Principle 2 retained separately as atomic citation discipline. Living docs swept; historical records left as written; CLAUDE.md history note records the mapping.
5. **Foundation infra extended** — `@platform/projections` (pure-function projection runtime with as-of replay, type-narrowing, deterministic fold) and `@platform/identity` (Authenticator interface + LocalAuthenticator: HMAC-SHA256, persisted key, `LOCAL_ONLY` env label, tests for tamper, expiry, malformed). Wired at composition root. CI green — typecheck clean, lint clean, **17 tests pass**, citation gate 5/5, recon 100/100.

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

**Open governance seats:** CISO → GC → CHRO (Helena's recommended hire order, A2 approved). *CAE filled — Thandiwe Mokoena hired 2026-05-06.*
**Engineering gap:** institutional-markets-sales engineering counterpart under Saskia (now sharper given strategic foundation; PAX brief expected when Saskia's franchise design lands).

## Architectural principles (six, post-consolidation)

1. **Events are the only source of truth.** Balances, capital, ratios, regulatory cells — all queries; as-of replay first-class.
2. **Every action traces to a source** *(atomic citation discipline)*. No control or process without a register-linked citation.
3. **Cloud-native; nothing manual or physical except where essential.** IaC; coded workflows; structured documents.
4. **Security designed in from the start.** Threat modelling per design, zero trust, HSM-backed keys, secure SDLC.
5. **Multi-currency, multi-entity, multi-country from day one.** New entities are configuration, not project.
6. **Single-graph discipline.** *Downward:* presentations derive from data — `Data → Process → Standard → Policy → Presentation`; generated, not authored. *Upward:* capabilities justify through procedure to regulation — `Reg → Policy → Procedure → System Capability`; no orphan functionality, no orphan procedures, every procedure mandate-owned. *(Consolidated 2026-05-06 from old P6 + P7.)*

## What was decided

Source: `Team Inbox/actioned/2026-05-06_ceo-decisions.md` (Round 1) + `…ceo-decisions-policies.md` (Round 2) + same-day chat decisions (Round 3, captured in `Owner Inbox/2026-05-06_strategic-foundation.md` and the principles-consolidation proposal).

Two-track approval convention in force: **CEO** (executive) and **BOARD** (reserved matter, approved on behalf of CEO + independent NEDs interim until a Board exists).

### Round 1 (18 decisions, 2026-05-06 morning)
13 approved · 3 deferred · 2 modified. Highlights: governance framework, RAS, hire-order CAE→CISO→GC→CHRO, interim governance arrangement, continuous-KYC two-tier default, sanctions zero-appetite, cyber severity tiers, model-risk three-tier, sector concentration ≤25%, climate appetite, client-master + continuous-KYC design, paid-data integrations deferred, Niko placement under Devon, top-of-house structure. Deferred: B2 (capital / liquidity buffer), B5 (trading mandate), E1 (POPIA IO designation). Modified: C2 (CoSec stays under CEO); F1 (framework re-classified to *policy* layer).

### Round 2 (7 decisions, 2026-05-06 afternoon)
7/7 approved. Five policy-bundle approvals (~41 policies in force), IFRS 9 hedge-accounting election, policy register confirmed as taxonomy of record.

### Round 3 (same-day, end-of-day)
- **Strategic foundation set** — institutional global-markets trading bank (full scope above; B2, B5 reactivated).
- **Principles consolidated, Option B** — old P6 + P7 → new P6; six principles total.
- **CAE hire — Thandiwe Mokoena** in seat from 2026-05-06; Vera now reports functionally to her.
- **Interim operating posture — build-only.** No FSP licence, no JSE membership, no sponsored access during build phase. Build runs end-to-end on synthetic flows; switch-to-live is a configuration change at licence-grant.
- **Reporting-capability build — authorised** per M-phase spec; M2–M3 the next staged commits; M4+ re-authorised after M3 lands.
- **CISO hire — kicked off.** PAX role brief authored at `Team Inbox/2026-05-06_role-brief_chief-information-security-officer.md`; Nolan to recruit.

## What is in force

### Constitutional layer
- Risk Appetite Statement (RAS) — *now to be tuned to a wholesale-markets profile in Helena's next pack*.
- Governance Framework (interim) — Board reserved matters defined; sub-committee charters drafted; three lines of defence formalised; interim Risk Forum (Helena chair) and interim Audit Forum (Owen chair) running until a Board is constituted; Markets Committee a near-term agenda item under Saskia.
- **Six architectural principles** in `CLAUDE.md`.
- **Strategic foundation** — `Owner Inbox/2026-05-06_strategic-foundation.md`.

### Operating policy stack — 41 core policies

| Bundle | Policies |
|---|---|
| Risk | RMF · Credit · Market · Liquidity · Op Risk · Op Resilience · Model Risk · Stress Testing |
| Compliance & Privacy | RMCP · AML/CFT · Sanctions · KYC/CDD/EDD · Conduct/TCF · POPIA · PAIA · Cross-Border |
| InfoSec & Ops | InfoSec · Cyber Resilience · IR · Outsourcing · Cloud · BCP/DR · Records · Change |
| Finance & Treasury | Capital Mgmt · IFRS · Tax · IFRS 9 ECL · Funding · FTP · Hedge (IFRS 9) · Collateral |
| Conduct, Ethics & HR | Code of Conduct · Conflicts · ABC · Whistleblowing · Gifts · Insider Trading · Remuneration · Fit-and-Proper · Harassment |

### Architectural elections
- IFRS reporting throughout · IFRS 9 hedge accounting (IAS 39 carryover not used).
- Six-principle architecture (post-consolidation).
- Governance ≠ engineering.
- Two-track decision approval.
- Auto-pickup workflow (Team Inbox → action).
- Azure as production cloud.
- Local-build-first; cloud lift as a single coherent migration phase (M8).

### Regulatory library
- 64 instruments tracked across 11 regulator subfolders.
- 4 exemplar instrument analyses populated: Banks Act, FIC Act, POPIA, Joint Standard 1 of 2024.
- ~178 obligations consolidated in `Regulations/_obligations-register.md` (canonical) + filterable HTML view.

### Procedures library
9 procedures populated: KYC onboarding · Sanctions screening · Capital ratio monitoring · POPIA breach notification · Incident response · Conflicts declaration · POPIA DSAR · Change management · Pricing approval. ~70 more identified; backlog now tilts to markets-bank profile (away from retail-only procedures, which become out-of-scope rather than orphan-flagged).

### Prototype
- **Foundation:** typed core (P5 branded types: currency, legal entity, jurisdiction, calendar, time), money primitives, event-store types, SQLite event store, citation gate, recon harness, observability.
- **New today:** `@platform/projections` (Projection / Reducer / Projector interfaces; LocalProjector with as-of replay; tests for narrowing, determinism, seeded folds) and `@platform/identity` (Authenticator interface; LocalAuthenticator with HMAC-SHA256, persisted key, `LOCAL_ONLY` env label, round-trip / tamper / expiry / malformed tests). Composition root wires both.
- **CI:** typecheck clean · lint clean · **17 tests pass** · citation gate 5/5 · recon 100/100.
- **Next foundation pieces (sequenced, not committed):** crypto/Signer interface (event signing); secrets interface; HTTP server seam; scheduler; projection-cache persistence (M2 — Anya).

## What is in flight

### Carry-forward refinements (now activated by the strategic foundation)
- **B2 — capital / liquidity buffer calibration** — Helena + Camille + Eitan, scoped against the **R300m capital envelope** and a trading-bank profile, via ICAAP / ILAAP. Now urgent rather than placeholder.
- **B5 — trading mandate** — Saskia chairs the markets franchise design; deliverable ~2 weeks.
- **E1 — POPIA IO designation lodgment** — Iris's options paper (Iris / CEO retains / Owen / future hire).

### Active hires
- *(CAE closed — Thandiwe Mokoena in seat from 2026-05-06.)*
- **CISO** — PAX role brief authored today (`Team Inbox/2026-05-06_role-brief_chief-information-security-officer.md`); Nolan to recruit; shortlist expected ~3 weeks.

### Active drafting
- **Markets franchise design** (Saskia, ~2 weeks).
- ~70 procedures (drafting queue under domain leads, coordinated by Owen; backlog re-prioritised to markets-bank profile).
- ~60 regulator instrument analyses (regulatory-change-management cadence under Mira).
- Tier-2 policies (markets, customer, legal, audit-on-CAE-hire, HR labour-law set).
- RAS recalibration to wholesale-markets profile (Helena, follow-up to strategic foundation).

### Reporting capability
- **Specification only** delivered (`Owner Inbox/2026-05-06_reporting-capability-spec.md`); covers AFS, BA returns, FIC submissions, SARS, FSCA, Joint Standard, Information Regulator, Excon, statutory, internal packs, analytics; phased M1–M8 with Azure lift at M8.
- **Build authorisation pending** — and the priority tilt is now visible: BA 700-series market-risk returns, BA 325 large exposures rise; retail-focused returns drop.

## What needs CEO next

The three pacing-critical decisions from earlier today are all resolved. Items that will surface as decisions on your desk over the coming weeks:

1. **Markets franchise design approval** (Saskia, ~2 weeks) — now scoped to build-only posture; soft-franchise track is an explicit deliverable.
2. **RAS recalibration** to wholesale-markets profile (Helena, ~2–3 weeks).
3. **Internal Audit Charter** (Thandiwe; through Interim Audit Forum, ~2 weeks); first 12-month risk-based audit plan (~3–4 weeks).
4. **E1 — POPIA IO designation lodgment** (Iris options paper, ~1 week).
5. **B2 — capital / liquidity buffer calibration** scoped against R300m + trading-bank profile (Helena + Camille + Eitan, ~3–4 weeks first cut).
6. **Strategic-foundation refinements** (within Saskia's proposal): product priority; capital tranching; counterparty-set ambition.
7. **CISO shortlist** when Nolan presents (~3 weeks behind the PAX brief authored today).
8. **Reporting-capability M2–M3 delivery review** (Atlas + Anya + Bea, ~6–8 weeks).
9. **Subsequent governance hires** (GC → CHRO) sequenced behind CISO.
10. **Cloud-lift M8 sequencing** when Atlas presents the plan (longer horizon).

## Architectural integrity check (Principle 6 — upward chain)

The chain `Reg → Policy → Procedure → System Capability` remains wired bidirectionally:

- **Reg → Policy:** `Regulations/_obligations-register.md` maps 178 obligations to policies.
- **Policy → Procedure:** `Procedures/_index.md` maps every approved policy to one or more procedures (9 populated, ~70 planned).
- **Procedure → System Capability:** every populated procedure names its `@platform/...` components (existing or planned). Today's additions: projection runtime now available to procedures requiring projected state (capital monitoring, KYC currency state, sanctions list cache); Authenticator now available to procedures with typed-actor authentication (every procedure with a human or service step).
- **Mandate ownership:** every procedure carries an owner whose persona file in `/Team/` covers the substance — checked bidirectionally; orphans are reportable findings to Vera.

The chain is testable today on the populated slice; testable in full when the procedures and capabilities backlog clears.

## Risks and open observations

1. **Strategic foundation is set; franchise design is the next centre of gravity.** Until Saskia's proposal lands and you decide the interim operating posture, the bank's pace is constrained by *governance velocity*, not engineering velocity.
2. **Single point of failure on Saskia.** With the strategic foundation set, the markets franchise sits squarely on her desk, and Kai is the single critical-path engineer for go-live. Worth flagging that Saskia's deputy or institutional-markets-sales engineer hire is something to consider as the franchise design crystallises.
3. **R300m capital is tight against three product lines simultaneously.** Standardised market-risk RWA + SA-CCR for IRD CCR will eat into the envelope quickly. Camille's capital plan against this number is a near-term blocker — not blocking now, but blocking before live trading.
4. **Interim governance is interim.** Board-reserved decisions still route through CEO + CRO + CFO concurrence. Board formation is a forward-looking item that becomes more pressing as commercial activity approaches.
5. **Single point of failure on Owen.** CoSec, governance framework custodian, board pathway, conflicts register, whistleblowing, PAIA — Owen carries a lot. Succession / deputy is a question for when the bank scales.
6. **POPIA IO designation unsigned.** Iris is operationally in seat but lodgment with the Information Regulator is deferred. Pending E1 resolution.
7. **Prototype is a foundation, not a bank yet.** The substrate is mature enough that domain capabilities can now be built on it (event-store, projections, identity, citations all green); the system-capability layer that procedures reference remains mostly `PLANNED`. Build authorisation is a pending decision.

## Co-dependencies (where this summary derived from)

- `CLAUDE.md` — six architectural principles + team structure + top-of-house.
- `MEMORY.md` (in this session's memory directory) — feedback and project memories established across the work.
- `Owner Inbox/2026-05-06_strategic-foundation.md` — strategic foundation (today).
- `Owner Inbox/2026-05-06_cae-shortlist.md` — CAE shortlist (today).
- `Owner Inbox/2026-05-06_principles-consolidation-proposal.md` — consolidation proposal (Option B chosen).
- `Owner Inbox/2026-05-06_*` — every other deliverable produced today.
- `Team Inbox/2026-05-06_brief_markets-franchise-design.md` — Saskia brief.
- `Team Inbox/actioned/2026-05-06_ceo-decisions*.md` — Rounds 1 and 2 audit trail (Round 3 captured in the strategic-foundation and consolidation-proposal docs).
- `Regulations/_obligations-register.md` + `Regulations/_index.md`.
- `Procedures/_index.md` + `Procedures/by-policy/*`.
- `prototype/platform/*` — walking skeleton + projections + identity.
- `prototype/tests/*` — 17 passing tests.
- `/Team/` — 19 persona files (18 + Marc).

This document is itself a presentation under Principle 6 — generated, not authored. The team operates on the artefacts above; this summary is what they look like from the CEO seat at end-of-day.
