---
title: Project status & roadmap — what's done, what's still to do
author: Scrooge (Chief of Staff)
date: 2026-05-10
summary: Per-workstream view of the bank build — substrate, governance, regulatory chain, markets franchise. Roadmap-leaning — brief done-anchors, fuller to-do queues with sequencing and owners. Refresh of the 2026-05-06 CEO status summary, scoped forward.
decision-required: false
---

# Project status & roadmap

**Author:** Scrooge (Chief of Staff)
**Date:** 2026-05-10
**For:** Marc (CEO)

> **Derivation note (Principle 6 — downward).** This is a presentation-layer regeneration. Every line cites a canonical source — `CLAUDE.md`, `Team/_team-roster.json`, `prototype/seeds/dashboard-state.json`, `Regulations/_obligations-register.md`, the `Owner Inbox/` decision records, and the `git log` on `main`. No new substance is authored here. Counters are re-derived from canonical sources at write time; if any cell drifts from its source the document is stale and must be regenerated.

> **Scope.** The bank as a whole, broken into the four natural workstreams: **substrate** (engineering platform), **governance** (seats, hires, frameworks), **regulatory chain** (obligations, policies, procedures, instrument analyses), **markets franchise** (Saskia's domain — products, RAS lines, correspondent rails, NPA, trading mandate). Roadmap-leaning per Marc's brief — done is anchor only, to-do is the substance.

---

## At a glance

| | | source |
|---|---|---|
| **Bank name** | **Hoz** — three legal entities: `Hoz Group Limited`, `Hoz Bank Limited`, `Hoz Securities Limited` | `D-LEGAL-ENTITY-TREE-V0` (PR #82) · `D-BANK-NAME-SELECTION` revised (PR #61) |
| **Regulatory perimeter** | Bank to PA · Securities to JSE · Group not separately regulated (PA look-through under Banks Act § 60+) | `D-REGULATORY-PERIMETER` (PR #85) |
| **Personas** | **27** (18 engineering + 9 governance) + Marc (CEO) | [Team/_team-roster.json](Team/_team-roster.json) |
| **CEO direct reports** | **11** (incl. CISO Rashida, CAE Thandiwe) | `topOfHouse.ceoDirectReports` in roster |
| **Open governance seats** | **2** (GC, CHRO) — sequenced behind PAX/Nolan | `openSeats` in [prototype/seeds/dashboard-state.json](prototype/seeds/dashboard-state.json) |
| **Thin-human-layer hire searches** | **6 in flight** (Independent Chair, NED #2, NED #3, Human CRO, Compliance Lead, Company Secretary) | `D-HIRE-SIX-SEATS-PACK` (Owner Inbox 2026-05-10) |
| **Architectural principles** | **7** in CLAUDE.md (P6 single-graph + P7 autonomous-by-default) | [CLAUDE.md](CLAUDE.md) "Architectural principles" |
| **CEO decisions resolved** | **6 in dashboard cache** + further D-records actioned since (D-RMS-PHASE-1, D-COMP-FRAMEWORK-SIX-SEATS, D-PRODUCT-CONSTRUCTION-SUBSTRATE, D-EVENT-STORE-SCALING, D-LEGAL-ENTITY-TREE-V0, D-REGULATORY-PERIMETER, D-FX-CORRESPONDENT-PAIR-NAMING, D-MARKETS-SCHEMA-FOUNDATION) — *cache trails* | dashboard cache + `git log` on `main` |
| **CEO decisions open** | **16** in dashboard cache; recent additions: NPA Policy v1.0, six-seats hire pack, event-store scaling, CI-gate integrity | `decisionsOpen` array |
| **Workstreams in flight** | **11** | `inFlight` array |
| **Policies registered** | **112** | dashboard `policies` |
| **Procedures populated** | **42** files (of ~80 identified, ~70 still drafting) | `find Procedures -name "*.md"` · `WS-PROCEDURES-DRAFTING` |
| **Obligations register** | **~224** obligations across **16 domains** and **~68 instruments**; register at v1.12 with `entity-scope` + `applies-at` vocabulary | [Regulations/_obligations-register.md](Regulations/_obligations-register.md) |
| **Cloud target** | Microsoft Azure (single-coherent-phase migration per Principle 3) | memory `project_cloud_target_azure.md` |
| **CI** | Branch-protected on `main`; full `bun run ci` gate (typecheck · lint · tests · citation-gate · 9 recon harnesses) | `prototype/package.json` `ci` script |

---

## Workstream A — Substrate (engineering)

**Owner:** Atlas (Core banking platform architect, engineering) · **Governance home:** Devon (COO).

### Done (anchor)

- Walking-skeleton platform: event store, projection runtime, identity authenticator, IaC seam, recon harnesses (`prototype/platform/recon/*`).
- Bank UI v0 + intranet shell + dashboard with obligations page (PRs #52, #48, #81).
- CI gate live: typecheck, lint, tests, citation-gate, nine recon harnesses; branch protection enforced on `main` (memory `project_github_plan_upgrade_pending` — resolved 2026-05-10 via repo-visibility shift).
- Markets schema foundation: FX foundation slice — Spot/Forward/Swap/NDF typed shapes + bookType discriminator (`D-MARKETS-SCHEMA-FOUNDATION`, PR #49).
- Correspondent routing-policy projection + switch-test event family (`D-FX-CORRESPONDENT-PAIR-NAMING`, PR #64).
- Legal-entity events + IFRS 10 consolidation substrate v0 (PRs #90, #92).
- **Recently CEO-approved:** `D-PRODUCT-CONSTRUCTION-SUBSTRATE`, `D-EVENT-STORE-SCALING`, `D-RMS-PHASE-1` (Records Management Substrate retires inboxes — 4-phase migration; spec at [Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md](Owner%20Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md)).

### In flight

- **RMS Phase 1 build** (Owen CoSec + Atlas) — seven typed events + content-addressed doc store + seven projection registers.
- **Markets schema foundation handlers** — handler-callables sync, parallel-dispatch divergence recon (memory `feedback_handlers_metadata_three_way_clash`).
- **Product-construction substrate slices** — six gaps listed at [Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md](Owner%20Inbox/2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md) §"Substrate gaps" (pricing-model registration, RWA-delta engine, trade-confirmation generators, etc.).
- **Event-store scaling** — design landed; build sequencing pending (`D-EVENT-STORE-SCALING`, [Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md](Owner%20Inbox/2026-05-10_atlas_event-store-scaling-design.md)).
- **Reporting-capability M2–M3 build** (Atlas + Anya + Bea, ~6–8 weeks per `WS-REPORTING-M2-M3`).
- **Agent-runtime substrate (S8)** — scheduler, AgentEscalation/AgentDecision events, event-sourced workstream lifecycle. Drafted; CEO approval pending (S8 in `decisionsOpen`).

### To do (sequenced)

1. **Approve agent-runtime substrate (S8)** → unblocks autonomous personas (Principle 7). Pending CEO decision.
2. **Approve substrate-completeness budget (S7)** → caps the run-rate (`WS-SUBSTRATE-BUDGET`, Atlas + Anya).
3. **RMS Phase 2** (dual-render — RMS registers co-exist with `Owner Inbox/` + `Team Inbox/`).
4. **Product-construction substrate gap closure** — six items, sequenced by Atlas + Kai + Saskia.
5. **RMS Phase 3 → Phase 4** (cutover → archive legacy inboxes).
6. **M2 → M8 markers** — reporting build, then projection runtime hardening, then agent-runtime ingest (M8 — single auto-commit ingest, memory `feedback_agent_autocommit_race`).
7. **Azure migration** — single-coherent-phase per Principle 3 ([Principles/3-cloud-native.md](Principles/3-cloud-native.md)). Substrate-replacement seams already in place.

### Open decisions / blockers

- `S6` API + cloud cost budget (Marc + Camille) — gates ongoing run-rate.
- `S7` Substrate-completeness budget (Atlas + Anya).
- `S8` Agent-runtime-substrate brief — approve scope.
- `D-CI-GATE-INTEGRITY` — closure record exists ([Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-ci-gate-integrity-closure.md](Owner%20Inbox/2026-05-10_scrooge_ceo-decision-record_d-ci-gate-integrity-closure.md)); confirm closed in dashboard.

---

## Workstream B — Governance

**Coordinated by:** Owen (CoSec) + Devon (COO) + Camille (CFO) for comp; Nolan (Recruiter) executes hires.

### Done (anchor)

- 11 CEO direct reports filled: Scrooge, Helena (CRO), Devon (COO), Camille (CFO), Eitan (Treasurer), Saskia (Head of Global Markets), Owen (CoSec), Zara (CCO), Iris (IO), **Thandiwe (CAE)**, **Rashida (CISO)**.
- **Compensation framework approved** — six-seat thin-human-layer comp envelope (`D-COMP-FRAMEWORK-SIX-SEATS`, PR #134, recorded #136).
- **Thin-human-layer composition fixed** at six humans (`D-THIN-HUMAN-LAYER-MINIMUM`, PR #47).
- **Legal-entity tree v0** approved — Group + Bank + Securities with shared board across three entities + per-entity statutory officers (`D-LEGAL-ENTITY-TREE-V0`, PRs #82, #93).
- **Regulatory perimeter set** — bank to PA, securities to JSE, group not separately regulated (`D-REGULATORY-PERIMETER`, PR #85).
- Per-entity POPIA s.55–56 IO designation scoping + procedure (`PROC-PRIV-IO-DSG-01`, PR #91).
- 41+ policies in force (precedent count); current registered count **112** per dashboard.
- Principles consolidated to **7** (P6 single-graph + P7 autonomous-by-default; CLAUDE.md "Architectural principles").

### In flight

- **Six thin-human-layer recruitment searches** — role briefs landed today by PAX:
  - [pax_role-brief_independent-chair.md](Owner%20Inbox/2026-05-10_pax_role-brief_independent-chair.md)
  - [pax_role-brief_ned-2.md](Owner%20Inbox/2026-05-10_pax_role-brief_ned-2.md) (`D-HIRE-NED-2`, PR #133)
  - [pax_role-brief_ned-3.md](Owner%20Inbox/2026-05-10_pax_role-brief_ned-3.md)
  - [pax_role-brief_human-cro.md](Owner%20Inbox/2026-05-10_pax_role-brief_human-cro.md)
  - [pax_role-brief_compliance-lead.md](Owner%20Inbox/2026-05-10_pax_role-brief_compliance-lead.md) (triple-hatted MLRO + FIC CO + POPIA IO)
  - [pax_role-brief_company-secretary.md](Owner%20Inbox/2026-05-10_pax_role-brief_company-secretary.md) (separate human, deputy-IO)
- **Internal Audit Charter + first audit plan** (Thandiwe, ~2 + ~4 weeks per `WS-IA-CHARTER`).
- **CISO recruitment** — kept in flight as `WS-CISO-RECRUITMENT` (Nolan); confirm closure given Rashida is in seat.
- **Persona agent-spec upgrades** — sections 6–17 backfill on legacy character-sheet personas (memory `feedback_persona_agent_spec_default`).
- **RAS recalibration for AI-driven bank** — substrate / coherence / supply-chain risks (Helena, `WS-RAS-RECALIBRATION`).

### To do (sequenced)

1. **CEO decision on `D-HIRE-SIX-SEATS-PACK`** — approve the batched hire pack (six role briefs above) — [Owner Inbox/2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md](Owner%20Inbox/2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md).
2. **Open governance seats** — GC then CHRO per Helena's hire-order (A2-approved).
3. **Board AC constitution** — replaces Interim Audit Forum (Owen chair) once independent-NED hires land.
4. **Vera Wave-4 #10** — agent-spec-integrity recon pipeline (asserts persona files have sections 6–17).
5. **Decisions `S3`** — thin-human-layer composition and timing for licence-day (Owen).

### Open decisions / blockers

- `D-HIRE-SIX-SEATS-PACK` — single CEO go/no-go for all six briefs at once (recommended path).
- `S3` Thin-human-layer composition and timing.

---

## Workstream C — Regulatory chain

**Curator:** Mira (Compliance / RegTech engineer) · **Governance home:** Zara (CCO) with Iris (IO), Imani (Legal-as-code), Owen (CoSec) cross-cutting.

### Done (anchor)

- Obligations register at **v1.12** — **~224 obligations across 16 domains and ~68 instruments**, with `entity-scope` + `applies-at` vocabulary supporting PA look-through (Banks Act § 60+).
- Domain Q reclassification under PA look-through perimeter (PRs #84, #89).
- **FAIS Posture A confirmed** — bank-entity does not need its own FSP licence; securities entity holds the FSP path (`D-FSP-LICENCE-NECESSITY` confirm-A, PRs #66, #68, #70 close).
- **FIC cycle + FSP path + TCF substrate v0** (PR #44).
- **Naming pre-clearance procedure** — TM + Banks Act + CIPC + 11-language (`PROC-CORP-NPC-01`, PR #74); CIPC three-reservation update for Hoz Group + Bank + Securities (PR #83).
- **42 procedures** populated (was 9 in the 2026-05-06 precedent — five-fold increase).
- **Records Management Policy + retention citation coverage** — substrate retention rules registered (Atlas Slice 3 follow-on; v1.12 Mira authoring).
- **Per-entity POPIA s.55–56 IO designation scoping** (PR #91).
- **Mira closed 10 thin-human-layer obligations gaps** (`D-THIN-HUMAN-LAYER-MINIMUM`, PR #42).

### In flight

- **~60 instrument analyses** — Mira (`WS-INSTRUMENT-ANALYSES`, continuous).
- **~70 procedures still drafting** — Domain leads (`WS-PROCEDURES-DRAFTING`, continuous).
- **New Product Approval Policy v1.0** — Saskia (lead) + Helena + Camille + Zara; pending CEO decision (`D-NEW-PRODUCT-APPROVAL-POLICY`, [Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md](Owner%20Inbox/2026-05-10_saskia_new-product-approval-policy.md)).
- **POPIA IO designation finalisation** — Marc interim, real human at licence-day (Iris, `WS-E1-IO-OPTIONS`).

### To do (sequenced)

1. **CEO decide `D-NEW-PRODUCT-APPROVAL-POLICY`** — required gate before products approach commencement-of-trading.
2. **Complete instrument analyses** — drive ~60 → 0; each unlocks rows in the obligations register.
3. **Drive procedures backlog** — 42 → ~80 populated, prioritised by markets-bank profile.
4. **Bind-status taxonomy completion** — every obligation tagged CORPORATE-BIND / LICENCE-BIND / COMMENCEMENT-BIND / CONDITIONAL-BIND (memory `project_rules_bind_at_commencement`).
5. **Obligation-source tagging** — every policy carries `Source` column showing whether it implements a regulation, a bank objective, or both (memory `project_policies_implement_regs_and_objectives`).
6. **SARB licence application package** — assembled when Saskia + Rashida + Devon's pre-licence go-live readiness gate lights green; needs Imani's external-counsel decision (`S5`).

### Open decisions / blockers

- `D-NEW-PRODUCT-APPROVAL-POLICY` — pending CEO.
- `S5` External legal counsel for SARB licence application (Imani).

---

## Workstream D — Markets franchise (Saskia's domain)

**Owner:** Saskia (Head of Global Markets, governance). **Coordinates:** Helena (RAS), Camille (capital), Eitan (funding/collateral), Imani (ISDA/GMRA/membership), Kai (technology, OMS/EMS), Tomas (settlement), Ravi (ALM).

### Done (anchor)

- **Strategic foundation set** — institutional global-markets dealer in JSE bonds + JSE equities + OTC IRD; institutional-only; SA single-branch; ~R300m capital target; banking licence application deferred ([Owner Inbox/2026-05-06_strategic-foundation.md](Owner%20Inbox/2026-05-06_strategic-foundation.md)).
- **FX foundation slice** — Spot/Forward/Swap/NDF typed shapes + bookType discriminator (`D-MARKETS-SCHEMA-FOUNDATION`, PR #49).
- **Named correspondent pair + switch-test cadence + outsourcing procedures** (`D-M4-FX-SUB-DECISIONS Sub-1`, PR #58).
- **Correspondent routing-policy projection** (`D-FX-CORRESPONDENT-PAIR-NAMING`, PR #64).
- **B-cluster FX-settlement-concentration appetite lines** (Helena, PR #60).
- **FAIS-KI handover gate-(a) closed** + counterparty institutional-eligibility screening v0 (PRs #66, #77).
- **Product-construction substrate** approved (`D-PRODUCT-CONSTRUCTION-SUBSTRATE`, PR #115 series).
- **FinSurv URN cluster wave-1** — current-account + capital-account (PR #56).
- **Validation methodology** — slice A tier definitions locked (`D-S7-TARGETED-3-5`, PR #50).

### In flight

- **Markets franchise design proposal** (Saskia, ~2 weeks from 2026-05-06 brief — `WS-MARKETS-FRANCHISE`).
- **D-MARKETS-SCHEMA-FOUNDATION** ongoing build — handler-callables sync.
- **Product-construction substrate slices 4+** — Atlas + Kai + Saskia.
- **ALM readiness** (Ravi, autonomous run, 2026-05-09).
- **Daily accounting readiness** (Bea, autonomous run, 2026-05-09) — adjacent dependency.
- **Liquidity snapshot** (Eitan, autonomous run, 2026-05-09) — adjacent dependency.

### To do (sequenced)

1. **B5 trading-mandate decision** — central forward decision per the precedent; awaiting Saskia's franchise-design proposal close-out.
2. **CEO decide NPA Policy v1.0** — gates first product through approval (cross-ref Workstream C item 1).
3. **NPA gate fires** as products approach commencement-of-trading (memory `project_product_lifecycle_npa_vs_engineering`).
4. **JSE Listings Requirements scoping** — forward-compat row (`ORG-MK-10`); fires only on first listing event.
5. **Pre-licence go-live readiness gate** — co-owned Saskia + Rashida + Devon; defines build-phase endpoint (CLAUDE.md "Operating model — what is real, deferred, paused").
6. **Licence-day commencement** — real capital, real customers, real human directors per the thin-human-layer composition.

### Open decisions / blockers

- `D-NEW-PRODUCT-APPROVAL-POLICY` (shared with Workstream C).
- B5 trading-mandate decision — pending Saskia's franchise-design proposal.

---

## Cross-cutting watch items

- **Build-phase endpoint** — pre-licence go-live readiness gate (Saskia + Rashida + Devon). Target gate not yet date-set; defines transition real-now → real-at-licence-day.
- **Anthropic API token spend** — currently the largest real cost; Marc + Camille tracking under `S6` / `WS-API-CLOUD-BUDGET`.
- **Substrate gaps tagged on persona files** — count needs derivation; Vera Wave-4 #10 will assert at audit time (memory `feedback_persona_agent_spec_default`).
- **Dispatch-discipline incidents** in the last 4 days: handlers-metadata three-way clash, agent-worktree isolation incidents, chip-vs-background-agent duplication. Mitigations now in CLAUDE.md "Dispatch discipline"; substrate fixes (harness chroot, M8 auto-commit ingest) on the to-do.

---

## What needs CEO next

Ordered by sequencing pressure. Each cites the decision record path.

1. **`D-HIRE-SIX-SEATS-PACK`** — approve the batched six-role hire pack (Independent Chair, NED #2, NED #3, Human CRO, Compliance Lead, Company Secretary). [Owner Inbox/2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md](Owner%20Inbox/2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md). Unblocks 18 months of recruitment lead time.
2. **`D-NEW-PRODUCT-APPROVAL-POLICY`** — approve NPA Policy v1.0 (Saskia, [Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md](Owner%20Inbox/2026-05-10_saskia_new-product-approval-policy.md)). Gates first product through approval — required before commencement-of-trading.
3. **`S8`** — agent-runtime substrate scope approval (Atlas + Anya). Unblocks Principle 7 autonomous-by-default — every persona currently runs as Scrooge-coordinated session (memory `project_ai_driven_bank`).
4. **`S6`** — API + cloud cost budget for the build phase (Marc + Camille). Sets the run-rate cap.
5. **`S7`** — substrate-completeness budget (Atlas + Anya). Sequences against the spec.
6. **`S5`** — external legal counsel for SARB licence application (Imani). Time-sensitive once licence-application gate approaches.

---

## Integrity checks

- This document is a derivation. If any cited count drifts from canonical source (dashboard cache, roster JSON, obligations register, git log), the document is stale and must be regenerated.
- The dashboard cache (`prototype/seeds/dashboard-state.json`) trails the event store on `decisionsResolved` — recent CEO decisions D-RMS-PHASE-1, D-COMP-FRAMEWORK-SIX-SEATS, D-PRODUCT-CONSTRUCTION-SUBSTRATE, D-EVENT-STORE-SCALING, D-LEGAL-ENTITY-TREE-V0, D-REGULATORY-PERIMETER, D-FX-CORRESPONDENT-PAIR-NAMING, D-MARKETS-SCHEMA-FOUNDATION are recorded in git but the cache shows only the original six. Re-derive the cache to refresh (memory `feedback_dashboards_live_reports_as_of`).
- No CEO-decision items in `decisionsOpen` carry `forCeo: true` in the cache — the lift convention may have shifted; the "What needs CEO next" list above is derived from frontmatter + recent records, not from the `forCeo` filter.
- `WS-CISO-RECRUITMENT` is still listed as in-flight despite Rashida being in seat in the roster — likely cache lag; close on next derivation.

— Scrooge
