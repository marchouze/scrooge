---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T09:30:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-GROUP-STRUCTURE, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-GROUP-STRUCTURE`
- **Title:** Legal-entity structure — Hoz as a group, not a single entity
- **Action:** approve (CEO-direct posture statement)
- **Outcome:** **The Hoz organisation is structured as a group of legal entities, not a single entity.** The CEO has stated:
  1. The group will be **multi-entity** by design — consistent with the existing strategic posture (memory `project_strategic_foundation.md`) and with Principle 5 (multi-entity from day one).
  2. The group will likely require **distinct legal entities for banking and stock-broking activities in South Africa**, because the regulatory regimes differ (SARB Banks Act 94 of 1990 for banking; FSCA + JSE rules for stock-broking).
  3. **"Hoz Bank" remains as one entity** within the group — it carries the SARB Banks Act licence — but the licence-application architecture must surface a group / holdco above it, with siblings or specialised vehicles for non-bank activities.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment (paraphrased from chat):** "highly likely we will have multiple entities because firstly we are planning to be multi-entity, and secondly we might need different entities for banking versus stock-broking activity in South Africa. So I suggest we don't just call it Hoz Bank — although clearly there will be Hoz Bank, but it needs to fit into an overall group."
- **Source proposals (this decision supersedes the single-entity default in):**
  - `Owner Inbox/2026-05-09_imani_hoz-cipc-reservation-scoping.md` (PR #76) — Imani's Gate 3 default-recommendation was `Hoz Bank Limited` as the single entity; supersedes that single-entity framing.
  - `Owner Inbox/2026-05-09_devon-tomas_hoz-domain-registration-plan.md` (PR #73) — domain working-set was scoped to `hoz.<tld>` for a single brand; the group structure may want sub-brand domains (e.g. `bank.hoz.<tld>`, `securities.hoz.<tld>`).
- **Authority chain:** Refines `D-BANK-NAME-SELECTION` (Hoz, PR #57) under the *legal-entity-architecture* layer. Sits at the *standard* layer of Principle 6's downward chain (the entity tree is a structural standard the bank's policies, procedures, and capabilities all reference). Cross-references the strategic-foundation memory and Principle 5.

## What this resolves

- **The CIPC legal-suffix question is now multi-part.** Multiple CIPC reservations and registrations are required. At minimum:
  - **Hoz Group Limited** (or **Hoz Holdings Limited** — counsel + Imani + Owen pick the form-of-words at scoping) — the group / holdco entity
  - **Hoz Bank Limited** — the SARB-licensed banking entity (subsidiary of the group)
  - **Hoz Securities Limited** (or similarly-named entity — counsel + Imani + Owen pick the exact name) — the FSCA-licensed stock-broking entity
- **Imani (Legal-as-code engineer)'s legal-entity-tree work becomes load-bearing now, not later.** The mandate at `Team/Imani.md` already includes "legal-entity hierarchy"; the CEO has now made entity-tree design a build-phase priority.
- **Owen (Company Secretary, governance) co-curates the group structure on the corporate-law surface.** Companies Act 71 of 2008 governs the group as a parent + subsidiaries; specific sections on inter-company arrangements, intra-group cross-shareholding, holdco-secretariat duties, and consolidated reporting all apply.

## What this does not resolve (open follow-ups)

- **The exact entity names** (Imani + Owen propose; counsel ratifies; CEO approves at the next sweep). Recommended placeholder vocabulary used in this record: `Hoz Group Limited`, `Hoz Bank Limited`, `Hoz Securities Limited`. These are placeholders; the actual names land via Imani + Owen's scoping work.
- **The exact entity count.** Two SA entities (bank + securities) is the minimum the CEO has named. The strategic foundation also flags multi-jurisdiction (Principle 5) — eventual foreign-jurisdiction entities may be siblings or sub-subsidiaries; that lands at a future decision point.
- **The brand boundary** between the group and the bank. Linnea (Brand & design lead) considers whether "Hoz" is the group-level brand (with sub-brands like "Hoz Bank" and "Hoz Securities") or whether the brand applies only to the bank with the group carrying a different identity.
- **The licensing-application path per entity.** SARB Banks Act licence applies to Hoz Bank Limited; FSCA Authorised Dealer licence + JSE membership apply to Hoz Securities Limited; the group itself may not require a primary regulatory licence but is subject to consolidated supervision under Banks Act §60+ + Joint Standard 1 of 2024.
- **The thin-human-layer composition implications.** D-THIN-HUMAN-LAYER-MINIMUM (PR #24, resolved 2026-05-08) named 6 humans + Marc + audit firm for *the bank*. Whether the group requires its own thin human layer (separate or shared boards / officers) is an open question. Owen + Imani assess and surface.
- **The obligations register's entity column / per-entity scoping.** The current register is bank-centric; per-entity scoping is a Mira (Compliance / RegTech engineer) substrate task.

## Follow-on routes recorded

- `agent:Imani (Legal-as-code engineer) + agent:Owen (Company Secretary, governance)` — joint authorship of the legal-entity-tree v0 at `Owner Inbox/<date>_imani-owen_legal-entity-tree-v0.md`. Sections: (1) named entities (group + Hoz Bank + Hoz Securities + any other v0 entity); (2) registered offices + directors composition per entity; (3) regulatory licence path per entity (SARB Banks Act for Hoz Bank; FSCA + JSE for Hoz Securities; consolidated supervision for the group); (4) inter-company arrangements (services, IP, capital, intra-group exposures); (5) consolidated reporting + IFRS treatment; (6) the typed-event substrate gap (`LegalEntityRegistered` / `LegalEntityChanged` / `IntraGroupArrangementSigned`); (7) substrate gaps named. Cadence: pre-licence-application gate; HIGH PRIORITY for the CIPC reservation work.
- `agent:Imani (Legal-as-code engineer)` — update the CIPC scoping (Gate 3 of PR #76) to reflect multiple reservations: `Hoz Group Limited` + `Hoz Bank Limited` + `Hoz Securities Limited` + any defensive-set names. Reservation cadence: counsel + Imani; counsel ratifies entity names against TM Act + Banks Act § 22 + FSCA name-conduct rules.
- `agent:Mira (Compliance / RegTech engineer)` — add an `entity` column (or per-entity sections) to `Regulations/_obligations-register.md`. Existing rows are bank-centric; classify each by which entity carries the obligation (group / bank / securities / multi-entity). Substrate task; v0 acceptable. Cross-reference D-GROUP-STRUCTURE.
- `agent:Owen (Company Secretary, governance)` — update `Owner Inbox/2026-05-06_governance-framework.md` to reflect the group structure. The 6-human composition decision (D-THIN-HUMAN-LAYER-MINIMUM) was authored bank-centric; surface whether the group requires separate-or-shared boards/officers; flag the Companies Act provisions on group-secretariat duties.
- `agent:Linnea (Brand & design lead)` — produce a brand-vs-group boundary note. Is "Hoz" the *group* brand (with `Hoz Bank` and `Hoz Securities` as named sub-brands), or is "Hoz" the *bank* brand and the group carries a different identity? Recommendation: default to "Hoz" as the group-level brand with `Hoz <activity>` sub-naming. Surface the design implications for the wordmark + lockup variants in PR #72 (v3 brand-supplement).
- `agent:Devon (Chief Operating Officer, governance) + agent:Tomas (Operations & payments engineer)` — update domain-registration plan (PR #73) to consider sub-domain or per-entity domain options: `hoz.bank` (group + bank brand), `securities.hoz.<tld>` (sub-brand), `hozsecurities.<tld>` (separate brand). Re-scope the working set + defensive set under the group framing.
- `agent:Atlas (Core banking platform architect)` — typed-event substrate gap promoted: `LegalEntityRegistered` event family (payload includes entity identity, regulator path, parent-subsidiary link, registered-office, named directors, registration date). v1 substrate task.
- `agent:Helena (Chief Risk Officer, governance) + agent:Rohan (Risk engineer)` — note that consolidated supervision under Banks Act §60+ + Joint Standard 1 of 2024 + BCBS principles may impose group-level RAS in addition to entity-level RAS. The B-cluster appetite lines (D-RAS-B-CLUSTER, PR #67) sit at the bank-entity level; group-level appetite lines may be a separate v1 work-item.
- `agent:Bea (Accounting & financial reporting engineer)` — IFRS-consolidation treatment for the group is a substantive substrate task; consolidated financial statements + intra-group elimination + minority-interest treatment all become real at licence-day.

## Substrate gaps surfaced

1. **CeoDecision event substrate** — recurring gap; Atlas v1.
2. **`LegalEntityRegistered` typed event family** — Atlas v1.
3. **Per-entity obligations-register scoping** — Mira substrate task.
4. **Per-entity persona / mandate visibility** — `/Team/` files are bank-centric today; if any persona's mandate spans multiple entities (e.g. a group-level CFO vs a bank-level CFO), the persona file needs entity-scope clarification. Owen + Scrooge curation task.
5. **Intra-group transfer-pricing substrate** — Yael (Tax engineer)'s mandate already names this; promotion to v1 substrate task once the entity tree lands.
6. **Consolidated supervision substrate** — Mira + Helena + Owen jointly: which obligations apply at the group level (in addition to the bank-entity level), under Banks Act §60+, Joint Standard 1 of 2024, BCBS principles.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
