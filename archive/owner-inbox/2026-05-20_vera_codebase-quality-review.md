---
title: Codebase quality review — 2026-05-20
author: Vera (Internal audit engineer, third-line)
date: 2026-05-20
summary: 3 recons run; 0 fail / 3 warn / 2 info findings across 1647 assertions.
decision-required: false
authority: GOV-FRAMEWORK-CAE-INDEPENDENCE
---

# Codebase quality review — 2026-05-20

Autonomous run of Vera's code-quality recons under the `vera:codebase-quality-review` weekly handler. Distinct from the overnight continuous-controls recon — this slice is the deterministic-checkable subset of code review.

## Summary

- Recons run: 3
- Assertions: 1647
- Fail findings: 0
- Warn findings: 3
- Info findings: 2

| Recon | Asserted | Fail | Warn | Info |
|---|---|---|---|---|
| code-quality:any-density | 823 | 0 | 0 | 1 |
| code-quality:swallowed-errors | 823 | 0 | 3 | 0 |
| code-quality:legacy-bypass-watch | 1 | 0 | 0 | 1 |

## Findings

### code-quality:swallowed-errors

- **[warn]** `scripts/migrate/backfill-aggregate-ids.ts:118` — Swallowed error: `catch { /* ok */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `scripts/migrate/backfill-aggregate-ids.ts:123` — Swallowed error: `catch { /* ok */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `scripts/migrate/backfill-aggregate-ids.ts:128` — Swallowed error: `catch { /* ok */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.

## Heartbeat (info-severity)

- `code-quality:any-density` — 5 `any` occurrences across 823 files scanned (threshold 3/file).
- `code-quality:legacy-bypass-watch` — LEGACY_PRE_A1_EVENT_TYPES at baseline (225 entries, as of 2026-05-14). No drift.

## Substrate gaps surfaced

**LLM-judgment findings remain Scrooge-coordinated until handler-LLM-runtime lands.** Today's recurring run covers the deterministic-checkable subset only — `any` density, swallowed errors, and the legacy permission-gate bypass count. The contextual judgment piece (which `any` is a justified boundary vs lazy escape; which empty `catch` is best-effort vs swallowed; which design choice violates which principle) needs an LLM in the handler. The big LLM-in-handler primitive is out of scope for this slice; flagging here so the gap is tracked, not hidden.

Recurring substrate gaps observed when the run runs at all: a fresh repo / fresh runner has no `.local/event.db`, so Vera's run-coupled handler emits its `AuditFinding` events into the per-process tmp store and the dashboard does not see them until the cloud-substrate (M8 Container App Jobs + per-event-source persistent store) lands.

## Substrate

Recons invoked: `any-density`, `swallowed-errors`, `legacy-bypass-watch`.

Events emitted: one `AuditFinding` per warn/fail finding (info-severity heartbeat rows are rendered into the deliverable, not emitted as events).

Routing: warn-severity code-quality findings recommend owner `Thandiwe` (CAE) per Vera spec § 9 — they are tracked but do not escalate unless they cluster. Fail-severity (substrate-broken) findings would route immediately; none expected from this recon set.
