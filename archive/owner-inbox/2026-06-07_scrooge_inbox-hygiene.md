---
agent: Scrooge
trigger: inbox-hygiene
asOf: 2026-06-07T05:58:23.950Z
decision-required: false
---

# Scrooge — inbox hygiene, 2026-06-07

Autonomous run of Scrooge's daily inbox-hygiene sweep per `Team/Scrooge.md` operating spec § Cadence and the standing rule at `feedback_team_inbox_hygiene.md`.

**Headline:** Team Inbox open: 5 (after run); actioned: 59; Owner Inbox: 644 files. 0 items auto-moved this run.

## In Team Inbox (still open)

- `2026-05-18_owen_authority-brief-ciso-rashida.md` — no unambiguous match in Owner Inbox; left in place
- `2026-05-18_owen_authority-brief-cfo-camille.md` — no unambiguous match in Owner Inbox; left in place
- `2026-05-18_owen_authority-brief-cae-thandiwe.md` — no unambiguous match in Owner Inbox; left in place
- `2026-05-18_owen_authority-brief-cco-zara.md` — no unambiguous match in Owner Inbox; left in place
- `2026-05-18_owen_authority-brief-coo-devon.md` — no unambiguous match in Owner Inbox; left in place

## Scrooge's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CboPP5npnpvHk6KRBgEb6"})._

## Provenance

Read `/Team Inbox/`, `/Team Inbox/actioned/`, and `/Owner Inbox/` filesystems. Auto-moves apply only to brief / followup / note items with an unambiguous Owner Inbox match (tail-slug substring). Role-briefs and ambiguous items are surfaced as report-only and require Scrooge or Marc to action manually.
