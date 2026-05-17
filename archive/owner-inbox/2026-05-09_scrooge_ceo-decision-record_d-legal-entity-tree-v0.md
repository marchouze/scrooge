---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T10:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-LEGAL-ENTITY-TREE-V0, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-LEGAL-ENTITY-TREE-V0`
- **Title:** Legal-entity tree v0 — three-entity SA group, shared board, Hoz-as-group-brand
- **Action:** approve
- **Outcome:** Approved as recommended in Imani (Legal-as-code engineer) + Owen (Company Secretary, governance) joint v0 (PR #80). All five CEO open questions resolved as drafted:

  1. **Entity names:** `Hoz Group Limited` (NOT `Hoz Holdings Limited`) + `Hoz Bank Limited` + `Hoz Securities Limited` (NOT `Hoz Securities (Pty) Ltd`).
  2. **Registered office:** **Johannesburg** for all three entities (proximity to SARB / FSCA / JSE / counterparties).
  3. **v0 entity count:** **three entities total** — group + bank + securities. Asset-management / insurance / foreign-jurisdiction holding-companies are deferred to a future capital / market-pull decision point.
  4. **Board structure:** **shared-board v0** — the same six humans + Marc + audit firm serve as directors / officers across the group, the bank, and the securities entity. Fit-and-proper assessments are entity-specific (every director clears bank fit-and-proper AND securities fit-and-proper). Companies-Act-required officers (CoSec; Public Officer) operate at each entity but may be the same human across all three.
  5. **Brand boundary:** **"Hoz" is the group brand**, with `Hoz Bank` / `Hoz Securities` as named sub-brands. Consistent with Linnea (Brand & design lead)'s v3 brand-supplement (PR #72 / merged) voice and tone.

- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "on the d legal entity tree decision required, I approve as recommended" — chat-intake 2026-05-09.
- **Source proposal:** `Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md` (PR #80)
- **Authority chain:** Resolves the five open questions surfaced under `D-GROUP-STRUCTURE` (resolved 2026-05-09; PR #78 record). Sits at the *standard* layer of Principle 6's downward chain (the entity tree is a structural standard the bank's policies, procedures, and capabilities all reference). Cross-references Companies Act 71 of 2008 (incorporation, group), Banks Act 94 of 1990 (s.7 banking licence; § 60 consolidated supervision), FAIS Act 37 of 2002 (FSP licensing for the securities entity), JSE Equities + Bonds Listings Requirements + Membership Rules.

## What this resolves

- **CIPC name reservations** are now scoped: three reservations needed (`Hoz Group Limited`, `Hoz Bank Limited`, `Hoz Securities Limited`), plus the defensive set Imani identified in PR #76. Imani + counsel execute.
- **Single licence-application architecture**: SARB Banks Act § 7 application names `Hoz Bank Limited` as the applicant; FSCA + JSE applications name `Hoz Securities Limited` as the applicant; the group entity is registered with CIPC and notified to the PA under Banks Act § 60 as the parent-of-bank.
- **Thin-human-layer composition**: D-THIN-HUMAN-LAYER-MINIMUM (PR #24) named 6 humans + Marc + audit firm. That composition now serves as the **shared board** across all three entities. The fit-and-proper file template (PROC-FAIS-KI-FAP-01, PR #69; Sade, AgentOps engineer) extends to the bank-board AND securities-board fit-and-proper checks per director.
- **Brand identity**: Linnea's wordmark / lockup / favicon / pronunciation work (PR #72) applies at the group level; sub-brand variants (`Hoz Bank` lockup; `Hoz Securities` lockup) land as a v3.2 brand-supplement task for Linnea.
- **Governance framework**: Owen updates §3A–§3E + §13 to surface the shared-board posture across the three entities. The 6-human composition is unchanged; the *applicability* of the composition extends to the new entities.

## What this does not resolve (ongoing follow-ups)

- The **substantive licence-application bundles** per entity. SARB Banks Act bundle (Hoz Bank); FSCA + JSE bundle (Hoz Securities); group-level PA notification under Banks Act § 60. Imani + counsel + Mira (Compliance / RegTech engineer) + Helena (Chief Risk Officer, governance) jointly own the build-phase preparation; the bundles materialise pre-licence-application gate.
- **Inter-company arrangements**: services agreement (group → subs), IP licensing (group owns "Hoz" trademark; licenses to subs), capital injections (group → subs), intra-group exposures (bank ↔ securities). v0 STUBs in PR #80; substantive contracts at licence-day approach.
- **Consolidated supervision substrate**: the group is subject to consolidated supervision under Banks Act § 60+ + Joint Standard 1 of 2024 + BCBS principles. Group-level RAS, group-level ICAAP / ILAAP, group-level Joint Standard 1 testing all become real at licence-day. Helena + Mira + Owen joint substrate work.
- **IFRS 10 consolidation substrate**: Bea (Accounting & financial reporting engineer) + Camille (Chief Financial Officer, governance) own. Consolidated financial statements + intra-group elimination + minority-interest treatment.

## Follow-on routes recorded

- `agent:Imani (Legal-as-code engineer)` — update `Owner Inbox/2026-05-09_imani_hoz-cipc-reservation-scoping.md` (Gate 3 of the Hoz name-clearance scoping, PR #76 / merged) to reflect the **three-reservation list**: `Hoz Group Limited` + `Hoz Bank Limited` + `Hoz Securities Limited`. Add registration-cadence: counsel files all three CIPC reservations in a single batch; Banks Act § 22 deceptive-similarity clearance applies to all three names; the parent-of-bank notification under Banks Act § 60 piggy-backs on the bank-entity application. Cross-link to D-LEGAL-ENTITY-TREE-V0.
- `agent:Mira (Compliance / RegTech engineer)` — add an `entity` column (or per-entity register sections) to `Regulations/_obligations-register.md`. Classify each existing row by which entity carries the obligation (`group` / `bank` / `securities` / `multi-entity` / `consolidated-supervision`). Substrate task; v0 acceptable. Cross-reference D-GROUP-STRUCTURE + D-LEGAL-ENTITY-TREE-V0. Note: many existing rows are bank-centric; the consolidated-supervision rows are *new* and need authoring (Banks Act § 60+ + Joint Standard 1 of 2024 + BCBS principles applicable at the group level).
- `agent:Owen (Company Secretary, governance)` — update `Owner Inbox/2026-05-06_governance-framework.md` and `Owner Inbox/2026-05-09_owen_thin-human-layer-composition-final.md` (already merged via PR #47 / #65) to:
  - Surface the **shared-board v0** posture across all three entities.
  - Add the entity-specific fit-and-proper triangulation: bank fit-and-proper (under Banks Act § 60 + JS 1 of 2024) AND securities fit-and-proper (under FAIS Determination of Fit and Proper 2017 + JSE Membership Rules) per director.
  - Companies Act-required officers (CoSec, Public Officer) clarification per entity.
- `agent:Linnea (Brand & design lead)` — produce `Owner Inbox/<date>_linnea_hoz-sub-brand-variants.md` (v3.2 brand-supplement). Lockup variants for `Hoz Bank` and `Hoz Securities` sub-brands; voice and tone for sub-brand-specific contexts (e.g. an SARB cover letter from Hoz Bank vs an FSCA cover letter from Hoz Securities); colour-palette permissions (do sub-brands re-tint or stay on the group palette?). Cadence: pre-licence-application gate.
- `agent:Devon (Chief Operating Officer, governance) + agent:Tomas (Operations & payments engineer)` — update `Owner Inbox/2026-05-09_devon-tomas_hoz-domain-registration-plan.md` (PR #73 / merged) for the group framing. Recommendation: register `hoz.bank` (group + bank brand) + `hoz.co.za` + `hoz.ai` PLUS sub-brand or path-style for the securities entity — either `securities.hoz.<tld>` (sub-domain on the group domain) or `hozsecurities.<tld>` (separate registration). The decision-card D-HOZ-DOMAIN-REGISTRATION-SET still pending CEO approval; surface the sub-brand domain question into that adjudication.
- `agent:Atlas (Core banking platform architect)` — typed-event substrate gap promoted: `LegalEntityRegistered` event family (per PR #80 §6 sketch). Payload: `{ entityId, legalName, registeredForm, jurisdiction, registeredOffice, parentEntityId, regulatoryLicences[], directors[], registrationDate, citations[] }`. Plus `LegalEntityChanged` (renames, parent-changes, director-changes) and `IntraGroupArrangementSigned` (services / IP / capital / intra-group-exposure). v1 substrate task.
- `agent:Bea (Accounting & financial reporting engineer)` — IFRS 10 consolidation substrate v0 stub. Per-entity ledger separation under the existing event-store; intra-group elimination event types (`IntraGroupTransactionMatched` / `IntraGroupBalanceEliminated` etc.) for v1; consolidated financial statements as a query over per-entity ledgers per Principle 1.
- `agent:Yael (Tax engineer)` — intra-group transfer-pricing substrate (already in mandate per `Team/Yael.md`). Promoted from backlog to v1 substrate task. Arm's-length pricing for services / IP / capital arrangements; SARS group-tax election scoping.
- `agent:Helena (Chief Risk Officer, governance) + agent:Rohan (Risk engineer)` — group-level RAS scoping. The B-cluster appetite lines (D-RAS-B-CLUSTER, PR #67 record, merged) sit at the bank-entity level; group-level appetite lines (cross-entity exposure aggregation, group-wide concentration, group-wide capital and liquidity) become real under Banks Act § 60+ consolidated supervision. v1 substrate task; lands pre-licence-application gate.
- `agent:Iris (Information Officer, governance)` — POPIA s.55 IO designation per entity. Each entity needs its own designated IO + Deputy IO; the alternates split (D-THIN-HUMAN-LAYER-MINIMUM follow-on: deputy-IO = CoSec) extends to all three entities under the shared-board posture. Iris scopes the per-entity designation cadence.
- `agent:Scrooge (Chief of Staff / Orchestrator)` — curate `/Team/` persona files for entity-scope clarification where personas span multiple entities. Most engineering personas (Atlas, Anya, Mira, etc.) work across all three entities; governance personas (Helena, Devon, Camille, Owen, Zara, Iris, Thandiwe, Rashida, Saskia, Eitan) hold seats that may be entity-specific or group-spanning. Curation task; per-persona triage; surface as a v1 cleanup item.

## Substrate gaps surfaced

1. **CeoDecision event substrate** — recurring gap; Atlas v1.
2. **`LegalEntityRegistered` typed event family** — Atlas v1.
3. **Per-entity obligations-register scoping** — Mira substrate task (high priority for licence-application bundle).
4. **Intra-group transfer-pricing substrate** — Yael v1 substrate task.
5. **IFRS 10 consolidation substrate** — Bea v1 substrate task.
6. **Consolidated-supervision substrate** — Helena + Mira + Owen joint v1 substrate task (Banks Act § 60+ + JS 1 of 2024 + BCBS).
7. **Per-entity persona / mandate visibility** — Scrooge curation task.
8. **Sub-brand lockup variants** — Linnea v3.2 brand-supplement.
9. **Per-entity POPIA s.55 IO designations** — Iris scoping task.
10. **CIPC reservation execution (3 reservations)** — Imani + counsel; HIGH PRIORITY for the licence-application gate.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
