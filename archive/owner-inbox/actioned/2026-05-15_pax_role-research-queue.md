---
agent: PAX
trigger: role-research-queue
asOf: 2026-05-15T08:11:30.180Z
decision-required: false
---

# PAX — role-research queue snapshot, 2026-05-15

Autonomous run of PAX's weekly role-research-queue snapshot per `Team/PAX.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Handler #18 in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING` — closes the meta-agent silence on the role-research loop (PAX has been doing per-role research in-session for the last few hires; this slice gives PAX an autonomous handler so the loop closes without needing Marc to spawn it manually).

**Headline:** 0 draft / stub personas · 0 substrate-gap entries naming PAX research / Nolan hire · 7 pending hire-briefs in Owner Inbox.

## Draft / stub personas

_None — every `/Team/<Name>.md` is at change-log v1.0 or higher._

## Substrate-gap entries naming PAX research / Nolan hire (§ 16)

_None — no persona's § 16 names PAX research or Nolan hire as the gap-owner today._

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

Zero open role-research items on the queue today — every persona file is at v1.0 or higher, and no `§ 16` substrate-gap row across the bench currently names "PAX research" or "Nolan hire" without a brief already drafted. The queue is in a brief-in-flight state, not a research-backlog state: all six role-briefs from the 2026-05-10 batch sit in Owner Inbox awaiting CEO decision, wrapped under `2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md` ([D-HIRE-SIX-SEATS-PACK]). Headline consequence: the human-CRO brief (`2026-05-10_pax_role-brief_human-cro.md`, [D-HIRE-HUMAN-CRO]) is the only Priority-1 item in the batch and is licence-day-bound; the five Priority-2 briefs (Independent Chair, NED #2, NED #3, Compliance Lead, Company Secretary) are also licence-day-bound but downstream of the CRO seat in the governance sequencing.

The critical-path observation is that the human-CRO decision gates the independent-validation reporting line, which in turn gates ICAAP / ILAAP sign-off — until the CEO records a decision on [D-HIRE-HUMAN-CRO] and Nolan can author the spec, the second-line attestation chain has no human owner. The Compliance Lead brief ([D-HIRE-COMPLIANCE-LEAD]) is the second-most consequential: triple-hatting MLRO + FIC CO + POPIA IO in a single seat is a reporting-line determination under CLAUDE.md Principle 6 (role-independence) that the CEO needs to ratify before any of the three statutory registers can be opened. All six briefs are now five days old in Owner Inbox; none is overdue against a stated SLA, but the licence-day binding means the clock is shared.

Next research move: no new role to research — the queue is research-complete pending CEO decision. My concrete action this week is to escalate through Scrooge that [D-HIRE-HUMAN-CRO] should be unbatched from the six-seat pack and decided first, since it is the only Priority-1 and the only seat gating a downstream procedure (ICAAP / ILAAP independent validation) rather than a governance-composition requirement. If the CEO prefers to keep the batch intact, I will hold; if unbatched, I will prepare a follow-up note firming up the CRO → independent-validation reporting line under CLAUDE.md Principle 6 so Nolan has the determination in hand the moment the decision lands.

## Provenance

Draft / stub personas folded from the latest `| vN.M |` row in each `/Team/<Name>.md` § 17 Change log table; PAX.md, Nolan.md, and `_agent-spec-template.md` are excluded by spec. Substrate-gap hires extracted from § 16 bullet lines that match `(PAX research|Nolan hire)`. Pending hire-briefs read from `Owner Inbox/*.md` frontmatter (`decision-required: true` + decision-id / title regex match). Counts are coarse — refines once `MandateGapDetected` and `RoleResearchRequested` event producers are live (substrate gaps above).
