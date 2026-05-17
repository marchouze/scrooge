---
agent: PAX
trigger: role-research-queue
asOf: 2026-05-11T05:51:51.331Z
decision-required: false
---

# PAX — role-research queue snapshot, 2026-05-11

Autonomous run of PAX's weekly role-research-queue snapshot per `Team/PAX.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Handler #18 in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING` — closes the meta-agent silence on the role-research loop (PAX has been doing per-role research in-session for the last few hires; this slice gives PAX an autonomous handler so the loop closes without needing Marc to spawn it manually).

**Headline:** 1 draft / stub persona · 1 substrate-gap entry naming PAX research / Nolan hire · 7 pending hire-briefs in Owner Inbox.

## Draft / stub personas

| Persona | Latest version | Mandate hint |
|---|---|---|
| `Team/Nadia.md` | v0.1 | Nadia owns independent model validation end-to-end: model-spec review, validation testing (independent re-implementation, parallel runs, benchmark and challenger models, sensitivity analysis, edge-case coverage), backtesting and ongoing ... |

_Source: latest `| vN.M |` row in the persona's § 17 Change log table. Below v1.0 indicates the persona is in draft / stub form — research input precedes Nolan's spec authoring._

## Substrate-gap entries naming PAX research / Nolan hire (§ 16)

| Persona | Gap entry |
|---|---|
| `Team/Helena.md` | **Independent model-validation function** — not staffed. Standing escalation route bypasses Helena and reads to her after validation; until staffed, Helena signs without independent validation, with the gap registered. Owner: PAX research / Nolan hire. |

_Source: bullet lines under § 16 Substrate gaps in each persona file that match `(PAX research|Nolan hire)`. These are open research / hire requests embedded in existing mandate text — distinct from a draft persona awaiting research._

## Pending hire-related decision briefs (Owner Inbox)

| File | Date | decision-id | Title |
|---|---|---|---|
| `Owner Inbox/2026-05-10_pax_role-brief_company-secretary.md` | 2026-05-10 | D-HIRE-COMPANY-SECRETARY | PAX role-brief — Company Secretary (separate human, deputy-IO under POPIA Reg. 4) (Priority-2, licence-day-bound) |
| `Owner Inbox/2026-05-10_pax_role-brief_compliance-lead.md` | 2026-05-10 | D-HIRE-COMPLIANCE-LEAD | PAX role-brief — Triple-hatted Compliance Lead (MLRO + FIC CO + POPIA IO) (Priority-2, licence-day-bound) |
| `Owner Inbox/2026-05-10_pax_role-brief_human-cro.md` | 2026-05-10 | D-HIRE-HUMAN-CRO | PAX role-brief — Human CRO (Priority-1, licence-day-bound) |
| `Owner Inbox/2026-05-10_pax_role-brief_independent-chair.md` | 2026-05-10 | D-HIRE-INDEPENDENT-CHAIR | PAX role-brief — Independent Chair / AC Chair / S&E NED (Priority-2, licence-day-bound) |
| `Owner Inbox/2026-05-10_pax_role-brief_ned-2.md` | 2026-05-10 | D-HIRE-NED-2 | PAX role-brief — NED #2 (AC member, strict-independent) (Priority-2, licence-day-bound) |
| `Owner Inbox/2026-05-10_pax_role-brief_ned-3.md` | 2026-05-10 | D-HIRE-NED-3 | PAX role-brief — NED #3 (AC member, non-strict-independent) (Priority-2, licence-day-bound) |
| `Owner Inbox/2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md` | 2026-05-10 | D-HIRE-SIX-SEATS-PACK | CEO decision pack — D-HIRE × 6 (thin-human-layer recruitment, batched) |

_Source: frontmatter parse of every `.md` in `Owner Inbox/`; filtered to `decision-required: true` AND (decision-id matches `(HIRE|RECRUIT|ROLE|BRAND-DESIGN|INDEPENDENT-VALIDATION)` OR title / decision-for-ceo matches `(role brief|hire|recruit)`)._

## Escalation posture

Per `Team/PAX.md` § 10 (Decisions that escalate), PAX escalates if a hire is critical-path on a regulator deadline. None today — build phase, no regulator deadlines bind until commencement-of-trading (`project_rules_bind_at_commencement`). Items above are research / hire requests, not regulator-driven obligations.

## Substrate gaps surfaced this run

- **`MandateGapDetected` event type** — Vera Wave-4 #12 mandate-agent reconciliation pipeline is planned but not yet live. Until then, gaps surface via filename heuristics here (decision-id / title regex match) rather than typed events. Owner: Vera. Target: post-runtime.
- **`RoleResearchRequested` event producer** — no producer today; the queue is read from filesystem (persona files + Owner Inbox) rather than from a typed event stream. Owner: Scrooge + PAX. Target: post-runtime.
- **Skills-taxonomy register** — not yet a structured artefact (named in `Team/PAX.md` § 16); the taxonomy is implicit in PAX's authoring. Owner: PAX. Target: M2.
- **Structured-citation storage for role briefs** — citations live in markdown narrative; future state is structured-citation register entries flowing into Mira's obligations register where the source is a regulatory instrument. Owner: PAX + Mira. Target: post-runtime.

## PAX's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own._

## Provenance

Draft / stub personas folded from the latest `| vN.M |` row in each `/Team/<Name>.md` § 17 Change log table; PAX.md, Nolan.md, and `_agent-spec-template.md` are excluded by spec. Substrate-gap hires extracted from § 16 bullet lines that match `(PAX research|Nolan hire)`. Pending hire-briefs read from `Owner Inbox/*.md` frontmatter (`decision-required: true` + decision-id / title regex match). Counts are coarse — refines once `MandateGapDetected` and `RoleResearchRequested` event producers are live (substrate gaps above).
