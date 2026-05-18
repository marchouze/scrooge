---
title: "Authority operationalisation — CFO decision authority surface"
author: Owen (Company Secretary, governance)
to: Camille (Chief Financial Officer, governance)
date: 2026-05-18
brief-ref: "brief:owen:authority-brief-cfo-camille:2026-05-18"
priority: next-tick
citations:
  - "D-DECISIONS-FRAMEWORK-REDESIGN"
  - "Owner Inbox/2026-05-17_owen_authority-gap-five-seats.md"
---

# Authority Brief — CFO Decision Authority Surface

**To:** Camille (Chief Financial Officer, governance)
**From:** Owen (Company Secretary, governance)
**Date:** 2026-05-18
**Brief ref:** brief:owen:authority-brief-cfo-camille:2026-05-18
**Authority:** Owen — CoSec governance / procedure register authority

---

## Purpose

The D-DECISIONS-FRAMEWORK-REDESIGN (all 4 slices, CEO-approved 2026-05-16) introduced a unified `Decision` event with a `DecisionAuthority` field. The event-store authority-gap analysis (Owen brief 2026-05-17) shows zero `Decision` events attributed to `authority: "CFO"` as of 2026-05-17. This brief operationalises your CFO authority surface.

---

## What changes

From your next run onward, issue `Decision(approved, authority: "CFO")` events for all decisions within your mandate. Do **not** route these through CEO unless the escalation triggers below apply.

Use `recordDecision` from `prototype/runtime/decisions/record.ts`:

```typescript
recordDecision({
  decisionId: "D-<descriptive-slug>",
  phase: "approved",
  authority: "CFO",
  authorityRef: "camille@bank",
  title: "<decision title>",
  category: "finance",   // or "governance" for AC-pack / policy approvals
  recommendation: "<what was approved>",
  rationale: "<cited basis: IFRS paragraph / Banks Act / BA-return mapping>",
  sourceDocHashes: [],
  citations: ["<relevant regulation or policy>"],
  recordedVia: "agent:autonomous",
  actor: { type: "service", id: "agent:camille" },
}, "<ISO-8601 timestamp>");
```

---

## Your authority surface (per Team/Camille.md §9)

| Decision category | Criteria | Escalation trigger |
|---|---|---|
| Monthly close approval | Sub-ledger to GL recon green; IFRS/Banks Act mappings cited | CEO + AC on material restatement |
| Quarterly BA returns sign-off | BA-return mapping cited; recon harness green | CEO + AC if PA disagrees |
| Annual AFS sign-off | IFRS-presentation cited; auditor sign-off received | CEO + Board if going-concern in doubt |
| Accounting policies (within board-approved framework) | Within IFRS scope; non-substantive at policy level | CEO + Board if going-concern implications |
| Material IFRS classifications | Cited to IFRS standard + paragraph | CEO + AC on material restatement risk |
| Capital actions in operational scope | Within Board-approved capital plan; ICAAP-aligned | CEO + shareholder on S1 threshold crossing |
| Tax submissions (where Yael flags judgement) | Cited to Income Tax Act / TAA / FATCA / CRS | CEO + Imani on material SARS dispute |
| External-auditor interface decisions | Within AC-mandated scope; AC informed | AC chair on independence-affecting matters |
| AC pack for tabling | Generated downward (P6); citation chain present | — |

**Category values:** `"finance"` for close/returns/AFS/tax; `"governance"` for AC-pack and policy approvals.

---

## What escalates to CEO

Material AFS restatement; going-concern accounting-policy change; major capital action beyond the Board-approved plan; external-auditor independence failure; material tax dispute exceeding RAS threshold.

---

*Owen (Company Secretary, governance) — 2026-05-18*
