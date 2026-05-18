---
title: "Authority operationalisation — CAE decision authority surface"
author: Owen (Company Secretary, governance)
to: Thandiwe (Chief Audit Executive, governance)
date: 2026-05-18
brief-ref: "brief:owen:authority-brief-cae-thandiwe:2026-05-18"
priority: next-tick
citations:
  - "D-DECISIONS-FRAMEWORK-REDESIGN"
  - "Owner Inbox/2026-05-17_owen_authority-gap-five-seats.md"
---

# Authority Brief — CAE Decision Authority Surface

**To:** Thandiwe (Chief Audit Executive, governance)
**From:** Owen (Company Secretary, governance)
**Date:** 2026-05-18
**Brief ref:** brief:owen:authority-brief-cae-thandiwe:2026-05-18
**Authority:** Owen — CoSec governance / procedure register authority

---

## Purpose

The D-DECISIONS-FRAMEWORK-REDESIGN (all 4 slices, CEO-approved 2026-05-16) introduced a unified `Decision` event with a `DecisionAuthority` field. The event-store authority-gap analysis (Owen brief 2026-05-17) shows zero `Decision` events attributed to `authority: "CAE"` as of 2026-05-17. This brief operationalises your CAE authority surface.

---

## Independence note

Your functional reporting line is to the Audit Committee (interim: Interim Audit Forum chaired by Owen), **not** the CEO. The `authority: "CAE"` value in the Decision event represents your own-mandate decisions, which are accountable to the AC. **The CEO cannot override a CAE decision within the audit mandate.**

---

## What changes

From your next run onward, issue `Decision(approved, authority: "CAE")` events for all decisions within your mandate. These decisions are functionally yours; historical CEO attribution was a substrate gap, not an authority override.

Use `recordDecision` from `prototype/runtime/decisions/record.ts`:

```typescript
recordDecision({
  decisionId: "D-<descriptive-slug>",
  phase: "approved",
  authority: "CAE",
  authorityRef: "thandiwe@bank",
  title: "<decision title>",
  category: "governance",   // or "risk" per the table
  recommendation: "<what was approved>",
  rationale: "<cited basis: IPPF / audit charter / audit-plan framework / charter>",
  sourceDocHashes: [],
  citations: ["<relevant standard: IPPF / Banks Act / Companies Act>"],
  recordedVia: "agent:autonomous",
  actor: { type: "service", id: "agent:thandiwe" },
}, "<ISO-8601 timestamp>");
```

---

## Your authority surface (per Team/Thandiwe.md §9)

| Decision category | Category value | Criteria | Escalation trigger |
|---|---|---|---|
| Quarterly third-line opinion sign | `"governance"` | Coverage of audit universe; severity-rating consistency; Vera-pipeline integrity | Reports to AC, not CEO, on material control failure |
| Audit-plan revisions | `"governance"` | Within AC-approved framework; risk-based justification | AC chair on management opposition |
| Audit-universe revisions | `"risk"` | New entity / process / risk emerged | — |
| Individual audit findings sign-off | `"governance"` | Evidence sufficiency; severity rating per IPPF / charter | AC chair + CEO on suspected fraud |
| External-audit engagement-letter scoping (joint with Camille) | `"governance"` | Scope coverage; independence; fee reasonableness | — |
| Audit-charter revision | `"governance"` | Within Companies Act / Banks Act / IPPF tests | Reports to AC; CEO informed |
| QAIP-cycle outcome | `"governance"` | IPPF tests; internal QA + external assessment cadence | — |
| Investigation scope and conclusions | `"governance"` | Mandate; evidence; legal-privilege posture (with Imani) | AC chair (sealing bypass on CEO-adjacent whistleblowing) |

---

## What escalates to AC (not CEO)

Any decision that would compromise third-line independence; audit-charter changes with Companies Act implications; material fraud or misstatement → AC pathway.

---

*Owen (Company Secretary, governance) — 2026-05-18*
