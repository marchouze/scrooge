# Owner Inbox — frontmatter convention

**As of 2026-05-07.** Default action set by Marc (CEO): every deliverable saved to `/Owner Inbox/` surfaces in the dashboard's **Owner Inbox** section automatically; deliverables that require a CEO decision additionally appear in **Decisions for CEO**, lifted via frontmatter.

The dashboard derivation reads frontmatter from each `.md` file in this directory. Frontmatter is *optional* — files without it still surface (title from the body's first H1, author from the `**Author:**` line, date from the filename) — but **only** files with `decision-required: true` lift into the open-decisions queue.

## Frontmatter shape

```yaml
---
title: <one-line title>
author: <author or comma-separated authors>
date: YYYY-MM-DD
summary: <one-or-two-sentence summary>
decision-required: <true|false>
# When decision-required: true, all of these are optional except decision-id
decision-id: D-<SLUG>
decision-category: <pacing|near-term|second-order|medium-term|long-horizon>
decision-for-ceo: <one-line decision the CEO must make>
decision-recommendation: <one-line stance + reasoning>
decision-owner: <person/team driving the decision; defaults to author>
---
```

Rules:
- All values are **single-line**. Multi-paragraph context belongs in the body.
- `decision-id` must be unique. Convention: `D-<DOMAIN>-<SLUG>`. If omitted on a `decision-required: true` file, the parser auto-generates from the filename — readable but unstable; explicit IDs are preferred.
- `decision-category` defaults to `near-term` if omitted.
- `decision-status` is **derived**, not authored: `resolved` iff a `CeoDecision` event with the matching `decisionId` exists in the event store, otherwise `open`.

## Files without frontmatter

Pre-existing files (and quick notes) work without the block. The parser falls back to:

| Field | Fallback source |
|---|---|
| `title` | first `# H1` line in the body |
| `author` | first `**Author:**` line in the body |
| `date` | `YYYY-MM-DD_` prefix on the filename |
| `summary` | first non-empty paragraph after the H1, capped at ~240 chars |
| `decision-required` | `false` (must be explicit) |

## Worked example — informational deliverable

```yaml
---
title: Persona-file upgrade pass — agent-spec rollout
author: Scrooge
date: 2026-05-07
summary: Vanguard four personas upgraded; remaining 22 sequenced into four tranches.
decision-required: false
---
```

## Worked example — decision-required deliverable

```yaml
---
title: Agent-runtime substrate — specification
author: Atlas
date: 2026-05-07
summary: Substrate hosting the autonomous-agent fleet — identity, scheduler, event-trigger bus, run lifecycle, escalation channel, oversight UI.
decision-required: true
decision-id: D-AGENT-RUNTIME-AUTHORIZE
decision-category: near-term
decision-owner: Atlas (build) · Devon (governance)
decision-for-ceo: Authorise build of the agent-runtime substrate (phases A0–A3).
decision-recommendation: Approve A0 schema-freeze immediately; sequence A1–A3 over ~5 weeks.
---
```

## Why this convention exists

- **Single source of truth.** The dashboard is *derived*, never hand-edited (`feedback_dashboard_always_derived`). Frontmatter is the canonical input for the Owner Inbox feed and decision lifts.
- **Principle 2 (downward).** The dashboard is a query over Owner Inbox + the event store; nothing about a deliverable is authored at the dashboard layer.
- **Principle 6 (autonomous by default).** Agent-authored deliverables that need human discretion are surfaced through this channel; the CEO sees them where work happens, not in chat.
- **Audit-friendliness.** Frontmatter gives Vera's pipelines a typed handle on every deliverable — title, author, decision-required state, decision-id — without parsing prose.

## Coverage

Today: today's four 2026-05-07 deliverables (Vera assurance extension, persona-rollout, Atlas runtime spec, procedure audit) carry frontmatter. Pre-existing Owner Inbox files (~40+) appear in the feed via fallback parsing; they are retrofitted with frontmatter as they are touched, in the same gradual-rollout posture as the persona-spec upgrade.

—Scrooge
