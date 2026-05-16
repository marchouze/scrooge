---
title: "M3 Slice 8 — Conduct Management System (CMS) layer"
author: "Atlas (Platform Engineer, engineering)"
reviewer: "Devon (Chief Operating Officer, governance)"
date: "2026-05-16"
decision-required: false
authority: "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"
tags: ["returns", "conduct", "tcf", "fsra", "cms", "m3"]
---

# M3 Slice 8 — Conduct Management System (CMS) Layer

**Authors:** Atlas (Platform Engineer, engineering) + Devon (Chief Operating Officer, governance — TCF oversight)
**Authority:** D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
**Status:** Complete — scaffold deployed, CI passing

## Summary

The CMS layer provides the data substrate for conduct risk monitoring, complaints management, and FSCA conduct reporting, aligned with the Financial Sector Regulation Act (FSRA) §131 and the FSB Treating Customers Fairly (2012) framework (6 outcomes).

This is a future-tranche slice: the scaffold is production-grade in structure; numeric cells default to 0 (`status: "rehearsal"`) until live event feeds land in M3 Slice 9+.

## Files delivered

| File | Purpose |
|---|---|
| `prototype/platform/returns/cms/types.ts` | `TCFOutcome`, `ConductComplaint`, `ConductMetrics`, `CMSDisclosure`, `CMS_REGULATED_ENTITIES` |
| `prototype/platform/returns/cms/generator.ts` | `CMSGenerator` — folds `AlertOpened` + `ConflictDeclared` events per period |
| `prototype/platform/returns/cms/period-close-subscriber.ts` | `AccountingPeriodClosed` subscriber wiring generator |
| `prototype/platform/returns/cms/cms.test.ts` | 14 scenario tests |

## Test assertions (all pass — 14/14)

1. Numeric cells non-NaN (empty store)
2. Numeric cells non-NaN with `AlertOpened` events
3. `status === "rehearsal"` for empty event store
4. `status === "rehearsal"` even with events (no live feeds yet)
5. Non-regulated entity (`LE-ZA-HOZ-SECURITIES`) silently skipped
6. `LE-ZA-HOZ-BANK` not skipped
7. `CMS_REGULATED_ENTITIES` contains `LE-ZA-HOZ-BANK`
8. TCF outcome breakdown sums to `totalComplaints` (empty store)
9. TCF outcome breakdown sums to `totalComplaints` with events
10. `totalComplaints` equals `AlertOpened` event count in period
11. `averageResolutionDays === 0` (not NaN) when no resolved complaints
12. `ConflictDeclared` events in period are counted
13. `ConflictDeclared` events outside period are excluded
14. Subscriber wires period-close → generator correctly

## Package.json

`returns:cms:smoke` script added: `bun test platform/returns/cms/cms.test.ts`

## Permission-gate carve-out

`platform/returns/cms/` added to `CONSTRUCTION_CARVE_OUT_DIRS` in
`prototype/platform/recon/permission-gate-default.ts` (same rationale as
the `platform/returns/ba325/` carve-out — per-module fixture tests that
build in-memory stores for conduct scenario assertion).

## Substrate gaps (roadmap items for M3 Slice 9+)

| Gap | Description |
|---|---|
| `AlertOpened.counterpartyId` | Payload does not yet carry `counterpartyId` or `tcfOutcome`; CMS maps to TCF Outcome 1 + "conduct-alert" category by default |
| `BestExecutionAnalysisCompleted` event | `bestExecutionBreachCount` cell defaults to 0 until this event type is defined |
| `ConductComplaintFiled` event | Dedicated complaint event type deferred to M3 Slice 9+; `AlertOpened` used as proxy |
| `ConductDisclosureEmitted` event | Durable persistence of CMS disclosures via RMS deferred to M3 Slice 9+ |
| KPI tolerance thresholds | `status` promotion to `"compliant"` / `"breach"` requires RAS policy calibration (Helena / Devon) |

## Citations

- Financial Sector Regulation Act 9 of 2017 §131 (FSCA conduct mandate)
- FSB Treating Customers Fairly 2012 (TCF framework, 6 outcomes)
- D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
- Principles/1-events-are-truth.md
- Principles/2-single-graph-discipline.md
- Principles/6-autonomous-by-default.md
