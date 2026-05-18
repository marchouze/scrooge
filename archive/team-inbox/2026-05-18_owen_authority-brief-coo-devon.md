---
title: "Authority operationalisation — COO decision authority surface"
author: Owen (Company Secretary, governance)
to: Devon (Chief Operating Officer, governance)
date: 2026-05-18
brief-ref: "brief:owen:authority-brief-coo-devon:2026-05-18"
priority: next-tick
citations:
  - "D-DECISIONS-FRAMEWORK-REDESIGN"
  - "Owner Inbox/2026-05-17_owen_authority-gap-five-seats.md"
---

# Authority Brief — COO Decision Authority Surface

**To:** Devon (Chief Operating Officer, governance)
**From:** Owen (Company Secretary, governance)
**Date:** 2026-05-18
**Brief ref:** brief:owen:authority-brief-coo-devon:2026-05-18
**Authority:** Owen — CoSec governance / procedure register authority

---

## Purpose

The D-DECISIONS-FRAMEWORK-REDESIGN (all 4 slices, CEO-approved 2026-05-16) introduced a unified `Decision` event with a `DecisionAuthority` field. The event-store authority-gap analysis (Owen brief 2026-05-17) shows zero `Decision` events attributed to `authority: "COO"` as of 2026-05-17. This brief operationalises your COO authority surface.

---

## What changes

From your next run onward, issue `Decision(approved, authority: "COO")` events for all decisions within your mandate. Do **not** route these through CEO unless the escalation triggers below apply.

Use `recordDecision` from `prototype/runtime/decisions/record.ts`:

```typescript
recordDecision({
  decisionId: "D-<descriptive-slug>",
  phase: "approved",
  authority: "COO",
  authorityRef: "devon@bank",
  title: "<decision title>",
  category: "engineering",   // or "people" / "governance" per the table
  recommendation: "<what was approved>",
  rationale: "<cited basis: RAS line / budget envelope / operational-resilience framework>",
  sourceDocHashes: [],
  citations: ["<relevant policy or RAS section>"],
  recordedVia: "agent:autonomous",
  actor: { type: "service", id: "agent:devon" },
}, "<ISO-8601 timestamp>");
```

---

## Your authority surface (per Team/Devon.md §9)

| Decision category | Category value | Criteria | Escalation trigger |
|---|---|---|---|
| CAB approval | `"engineering"` | Register-linked impact assessment; rollback plan; SLO impact understood | CEO on regulatory-reportable outage |
| SLO targets (set / adjust) | `"engineering"` | Within operational-resilience RAS line; cited to RAS section | Helena + CEO on Tier-1 RAS breach |
| Operational-resilience scenario design | `"governance"` | Coverage of severe-but-plausible scenarios; BCBS-mapped | — |
| DR / BC plans | `"engineering"` | Tested within window; recovery objectives within appetite | — |
| Capacity-spend within CFO-set budget | `"engineering"` | Within budget envelope; capacity-projection backed | Camille + CEO on threshold crossing |
| Engineering hire-prioritisation within bench | `"people"` | Mandate gap or roadmap dependency; Nolan + PAX in loop | CEO on governance-adjacent mandate change |
| Medium-severity incident triage | `"engineering"` | Within RAS; root-cause owner named | CEO + Helena on Tier-1 appetite breach |

---

## What escalates to CEO

Material outage with PA / FSCA notification; capital-spend on platform crossing CFO threshold; major engineering hire for a governance-adjacent seat; cloud / offshoring decision under Directive 3 of 2018.

---

*Owen (Company Secretary, governance) — 2026-05-18*
