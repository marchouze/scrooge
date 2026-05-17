---
title: Codebase quality review — 2026-05-11
author: Vera (Internal audit engineer, third-line)
date: 2026-05-11
summary: 3 recons run; 0 fail / 20 warn / 2 info findings across 569 assertions.
decision-required: false
authority: GOV-FRAMEWORK-CAE-INDEPENDENCE
---

# Codebase quality review — 2026-05-11

Autonomous run of Vera's code-quality recons under the `vera:codebase-quality-review` weekly handler. Distinct from the overnight continuous-controls recon — this slice is the deterministic-checkable subset of code review.

## Summary

- Recons run: 3
- Assertions: 569
- Fail findings: 0
- Warn findings: 20
- Info findings: 2

| Recon | Asserted | Fail | Warn | Info |
|---|---|---|---|---|
| code-quality:any-density | 284 | 0 | 0 | 1 |
| code-quality:swallowed-errors | 284 | 0 | 20 | 0 |
| code-quality:legacy-bypass-watch | 1 | 0 | 0 | 1 |

## Findings

### code-quality:swallowed-errors

- **[warn]** `platform/event-store/postgres-sync.ts:193` — Swallowed error: `catch { // not a URL; leave as unknown }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `platform/event-store/permission-gate.ts:489` — Swallowed error: `catch { // hook must not propagate — gate decision dominates. }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `platform/event-store/permission-gate.ts:516` — Swallowed error: `catch { // Best-effort. If alert emission fails (e.g. closed store // during tea`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `platform/event-store/permission-gate.ts:530` — Swallowed error: `catch { // onDeny must not propagate; the gate decision dominates. }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `platform/event-store/store.ts:183` — Swallowed error: `catch { // column already present; pre-Slice-1 path doesn't need this. }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `platform/recon/decision-required-event-pairing.ts:204` — Swallowed error: `catch { // Empty store / read error — return empty. }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `platform/recon/decision-required-event-pairing.ts:209` — Swallowed error: `catch { // best-effort }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `platform/recon/code-quality/legacy-bypass-watch.ts:97` — Swallowed error: `catch { // climb }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `platform/recon/harness.ts:20` — Swallowed error: `catch { // first run; nothing to remove }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `runtime/agents/anya-projection-drift.ts:137` — Swallowed error: `catch { // Fall through to derivation. }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `runtime/agents/owen-governance-cycle-prep.ts:81` — Swallowed error: `catch { // Fall through to fresh derivation on parse error. }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `runtime/agents/atlas-substrate-state.ts:165` — Swallowed error: `catch { // ignore }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `dashboard/server.ts:846` — Swallowed error: `catch { // best-effort }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `scenarios/02-onboard-counterparty.ts:33` — Swallowed error: `catch { /* first run */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `scenarios/03-fx-end-to-end-rehearsal.ts:540` — Swallowed error: `catch { /* first run */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `scenarios/03-fx-end-to-end-rehearsal.ts:568` — Swallowed error: `catch { /* nothing to clean */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `scenarios/03-fx-end-to-end-rehearsal.ts:1030` — Swallowed error: `catch { /* first run */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `scenarios/03-fx-end-to-end-rehearsal.ts:1145` — Swallowed error: `catch { /* nothing to clean */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `scenarios/03-fx-end-to-end-rehearsal.ts:1258` — Swallowed error: `catch { /* first run */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.
- **[warn]** `scenarios/03-fx-end-to-end-rehearsal.ts:1411` — Swallowed error: `catch { /* nothing to clean */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore.

## Heartbeat (info-severity)

- `code-quality:any-density` — 4 `any` occurrences across 284 files scanned (threshold 3/file).
- `code-quality:legacy-bypass-watch` — LEGACY_PRE_A1_EVENT_TYPES at baseline (215 entries, as of 2026-05-10). No drift.

## Substrate gaps surfaced

**LLM-judgment findings remain Scrooge-coordinated until handler-LLM-runtime lands.** Today's recurring run covers the deterministic-checkable subset only — `any` density, swallowed errors, and the legacy permission-gate bypass count. The contextual judgment piece (which `any` is a justified boundary vs lazy escape; which empty `catch` is best-effort vs swallowed; which design choice violates which principle) needs an LLM in the handler. The big LLM-in-handler primitive is out of scope for this slice; flagging here so the gap is tracked, not hidden.

Recurring substrate gaps observed when the run runs at all: a fresh repo / fresh runner has no `.local/event.db`, so Vera's run-coupled handler emits its `AuditFinding` events into the per-process tmp store and the dashboard does not see them until the cloud-substrate (M8 Container App Jobs + per-event-source persistent store) lands.

## Substrate

Recons invoked: `any-density`, `swallowed-errors`, `legacy-bypass-watch`.

Events emitted: one `AuditFinding` per warn/fail finding (info-severity heartbeat rows are rendered into the deliverable, not emitted as events).

Routing: warn-severity code-quality findings recommend owner `Thandiwe` (CAE) per Vera spec § 9 — they are tracked but do not escalate unless they cluster. Fail-severity (substrate-broken) findings would route immediately; none expected from this recon set.
