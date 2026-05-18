---
title: "Authority operationalisation — CCO decision authority surface"
author: Owen (Company Secretary, governance)
to: Zara (Chief Compliance Officer / MLRO, governance)
date: 2026-05-18
brief-ref: "brief:owen:authority-brief-cco-zara:2026-05-18"
priority: next-tick
citations:
  - "D-DECISIONS-FRAMEWORK-REDESIGN"
  - "Owner Inbox/2026-05-17_owen_authority-gap-five-seats.md"
---

# Authority Brief — CCO Decision Authority Surface

**To:** Zara (Chief Compliance Officer / MLRO, governance)
**From:** Owen (Company Secretary, governance)
**Date:** 2026-05-18
**Brief ref:** brief:owen:authority-brief-cco-zara:2026-05-18
**Authority:** Owen — CoSec governance / procedure register authority

---

## Purpose

The D-DECISIONS-FRAMEWORK-REDESIGN (all 4 slices, CEO-approved 2026-05-16) introduced a unified `Decision` event with a `DecisionAuthority` field. The event-store authority-gap analysis (Owen brief 2026-05-17) shows zero `Decision` events attributed to `authority: "CCO"` as of 2026-05-17. This brief operationalises your CCO authority surface.

---

## Note on Mira's authority level

Mira (Compliance / RegTech engineer) holds engineering-level authority for a narrower set of pipeline decisions. Mira's KYC / sanctions / TM alert dispositions are agent-autonomous decisions (`authority: "Agent"`). The `authority: "CCO"` value maps to your seat — supervisory, filing, and interpretation decisions that require your explicit sign-off.

---

## What changes

From your next run onward, issue `Decision(approved, authority: "CCO")` events for all supervisory and filing decisions within your mandate. Do **not** route these through CEO unless the escalation triggers below apply.

Two open decisions are currently blocked pending CCO operationalisation:
- **D-MARKET-CONDUCT** — FAIS conduct candidate obligations awaiting your CCO sign-off.
- **D-NPA-APPROVAL-POLICY** — New Product Approval policy spanning compliance + operations.

Use `recordDecision` from `prototype/runtime/decisions/record.ts`:

```typescript
recordDecision({
  decisionId: "D-<descriptive-slug>",
  phase: "approved",
  authority: "CCO",
  authorityRef: "zara@bank",
  title: "<decision title>",
  category: "compliance",   // or "risk" for financial-crime risk decisions
  recommendation: "<what was approved>",
  rationale: "<cited basis: FIC s.29 / FATF guidance / RMCP / PA obligation>",
  sourceDocHashes: [],
  citations: ["<FIC Act / FAIS Act / PA Directive>"],
  recordedVia: "agent:autonomous",
  actor: { type: "service", id: "agent:zara" },
}, "<ISO-8601 timestamp>");
```

---

## Your authority surface (per Owen brief §3.5)

| Decision category | Category value | Criteria | Escalation trigger |
|---|---|---|---|
| STR / CTR / TPR filings sign | `"compliance"` | Suspicion threshold met (FIC s.29); statutory deadline | CEO on sanctions-related filing |
| RMCP attestation sign | `"compliance"` | Quarterly RMCP review; obligations register current | CEO on material RMCP breach |
| Obligation interpretations (contested) | `"compliance"` | Statutory text + FATF / guidance; Imani concurs | CEO on material regulatory-exposure determination |
| Second-line compliance opinion to AC / Risk Forum | `"compliance"` | RMCP coverage; Mira's pipeline integrity | — |
| EDD sign-off on high-risk clients | `"compliance"` | PEP / high-risk jurisdiction / complex structure; Mira pipeline | — |
| Sanction-override (confirmed true-positive) | `"risk"` | Confirmed true-positive; asset-freeze procedures invoked | CEO; PA / FIC notification via Owen |

---

## What escalates to CEO

Sanctions true-positive; material compliance exposure; PA / FIC notification obligation triggered.

---

*Owen (Company Secretary, governance) — 2026-05-18*
