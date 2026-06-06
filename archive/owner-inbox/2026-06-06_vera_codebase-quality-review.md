---
title: Codebase quality review — 2026-06-06
author: Vera (Internal audit engineer, third-line)
date: 2026-06-06
summary: 3 recons run; 0 fail / 0 warn / 2 info findings across 2615 assertions.
decision-required: false
authority: GOV-FRAMEWORK-CAE-INDEPENDENCE
---

# Codebase quality review — 2026-06-06

Autonomous run of Vera's code-quality recons under the `vera:codebase-quality-review` weekly handler. Distinct from the overnight continuous-controls recon — this slice is the deterministic-checkable subset of code review.

## Summary

- Recons run: 3
- Assertions: 2615
- Fail findings: 0
- Warn findings: 0
- Info findings: 2

| Recon | Asserted | Fail | Warn | Info |
|---|---|---|---|---|
| code-quality:any-density | 1307 | 0 | 0 | 1 |
| code-quality:swallowed-errors | 1307 | 0 | 0 | 0 |
| code-quality:legacy-bypass-watch | 1 | 0 | 0 | 1 |

## Findings

## Heartbeat (info-severity)

- `code-quality:any-density` — 6 `any` occurrences across 1307 files scanned (threshold 3/file).
- `code-quality:legacy-bypass-watch` — LEGACY_PRE_A1_EVENT_TYPES at baseline (226 entries, as of 2026-05-14). No drift.

## Substrate gaps surfaced

**LLM-judgment findings remain Scrooge-coordinated until handler-LLM-runtime lands.** Today's recurring run covers the deterministic-checkable subset only — `any` density, swallowed errors, and the legacy permission-gate bypass count. The contextual judgment piece (which `any` is a justified boundary vs lazy escape; which empty `catch` is best-effort vs swallowed; which design choice violates which principle) needs an LLM in the handler. The big LLM-in-handler primitive is out of scope for this slice; flagging here so the gap is tracked, not hidden.

Recurring substrate gaps observed when the run runs at all: a fresh repo / fresh runner has no `.local/event.db`, so Vera's run-coupled handler emits its `AuditFinding` events into the per-process tmp store and the dashboard does not see them until the cloud-substrate (M8 Container App Jobs + per-event-source persistent store) lands.

## Substrate

Recons invoked: `any-density`, `swallowed-errors`, `legacy-bypass-watch`.

Events emitted: one `AuditFinding` per warn/fail finding (info-severity heartbeat rows are rendered into the deliverable, not emitted as events).

Routing: warn-severity code-quality findings recommend owner `Thandiwe` (CAE) per Vera spec § 9 — they are tracked but do not escalate unless they cluster. Fail-severity (substrate-broken) findings would route immediately; none expected from this recon set.
