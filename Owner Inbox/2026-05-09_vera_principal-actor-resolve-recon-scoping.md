---
title: Principal-actor-resolve recon — scoping brief and stub pipeline
author: Vera
date: 2026-05-09
summary: Scopes the four assertions the principal-actor-resolve recon will make once the Principal Register lands, ships a stub pipeline that emits warn pre-register-landing, and sequences the assertion-progression to the register's backfill slices.
decision-required: false
maps-to-decision-id: D-PRINCIPAL-REGISTER
note: Scoping brief + stub pipeline. The full recon goes hard once the Principal Register substrate lands (slice 1+2 of D-PRINCIPAL-REGISTER §7 sequencing). Stub emits warn pre-register-landing.
---

# Principal-actor-resolve recon — scoping brief and stub pipeline

This brief scopes the continuous-controls pipeline that asserts every typed event in the bank's event store carries an `actor` that resolves to a registered principal in the forthcoming Principal Register (Sade + Senna proposal `Owner Inbox/2026-05-09_sade-senna_principal-register.md`, in flight). The pipeline is shipped as a stub today and goes hard as the register's backfill slices land.

## 1. What the recon asserts

Once the register substrate is fully populated, the pipeline asserts four properties of every typed event in the event store:

1. **`actor`-field presence.** Every typed event carries an `actor` field with non-empty `type` and `id`. The platform schema (`prototype/platform/event-store/types.ts`) already enforces this at append-time via `actorSchema`; the recon re-asserts it at audit-time as a defence-in-depth structural check (the schema can be bypassed by direct sqlite writes; the audit cannot).
2. **Principal resolution.** For every event, the `actor.id` resolves to a `PrincipalRegistered` event in the same store whose registered URN equals the actor URN. An unresolved actor URN is an **orphan-actor** finding (severe — the bank cannot attribute the action to a known principal). This is the load-bearing assertion of the recon.
3. **Role coverage at event time.** The actor's `roles[]` (as projected from `PrincipalRegistered` + subsequent role-grant / role-revoke events) at the event's `as_of` timestamp covered the action the actor performed. The mapping from event-type → required-role is defined by the action-permission policy (Senna owns the policy generator; D-PRINCIPAL-REGISTER §5 names it). A role-uncovered action is a **role-coverage-gap** finding.
4. **Fit-and-proper currency for regulated actions.** For human actors performing regulated-role events (FAIS-advice records, MLRO sign-offs, director/officer approvals, key-individual decisions), the principal's `fitAndProper.status === "current"` at the event's `as_of`. A stale or absent attestation against a regulated action is a **fit-and-proper-stale** finding.

A small number of additional sub-assertions surface as the lifecycle slices land — `terminated-principal-action` (event recorded after termination event), `suspended-principal-action` (event during suspension window). These are sequenced to slice 8 (lifecycle) per §3 below.

## 2. Pre-landing posture (today)

The stub pipeline at `prototype/platform/recon/principal-actor-resolve.ts` runs on every CI invocation. It is intentionally non-failing:

- **Stage 0 — register-not-yet-on-main.** When the event store contains zero `PrincipalRegistered` events, the pipeline emits a single `warn`-severity violation noting "Principal Register substrate not yet on main; awaiting D-PRINCIPAL-REGISTER §7 slice 1+2" and returns `ok: true`. Sample size is 0; assertion count is 0.
- **Stage 1 — partial-asserted.** When ≥1 `PrincipalRegistered` event exists, the pipeline walks every typed event in the store, computes the set of actor URNs referenced and the set of registered URNs, and emits one `warn`-severity violation per orphan actor URN with `ok: true`. The recon stays warn-only until the backfill markers indicate completeness — this slice flips it to `partial-asserted`, but the severity ladder does not escalate to `fail` until §3 sequencing lands.

The warn-pre-shadow precedent is `parallel-dispatch-divergence` (Vera Wave-4 #13b, PR #11): the same principle applies — the recon must be discoverable from day one so the audit graph (P6) has no orphan capability when the register substrate arrives. The stub also gives the pipeline shape continuity once assertions go hard, so the cut-over is a severity-ladder flip rather than a green-field implementation.

## 3. Post-landing posture (assertion progression)

Each slice of the Sade + Senna register substrate flips a portion of the recon's severity ladder. Sequencing maps directly to D-PRINCIPAL-REGISTER §7 (the proposal's slice plan):

| Slice | What lands | Recon flip |
|---|---|---|
| 1 — schema | `PrincipalRegistered` event-type defined in the platform schema; register projection scaffolded | Stage 1 of the stub activates (any `PrincipalRegistered` switches partial-asserted on) |
| 2 — register substrate | Projection live; permission-policy generator wired | No flip yet (assertions still warn-only — backfill not yet done) |
| 3 — internal-agent backfill | Every persona under `/Team/` registered as `internal-agent` principal; corresponding `PrincipalRegistered` events appended | **Internal-agent actors flip to `fail` severity** for orphan-actor (assertion 1+2 hard for service-typed actor URNs starting with `agent:`); human actors stay warn |
| 4 — director/officer backfill | Marc registered as `director-officer`; any other statutory humans registered | **Director-officer actors flip to `fail` severity**; remaining human actors stay warn |
| 5 — A1.2 re-wire (role-coverage projection) | Action-permission policy projects required-role per event-type; role-grant / role-revoke events live | **Assertion 3 (role-coverage-gap) goes hard at `fail`** for any actor type; assertion 4 stays warn |
| 6 — external-counterparty backfill | External-human and external-agent counterparties registered against the legal-entity tree | External counterparty actors flip to fail |
| 7 — customer / contractor / external-system backfill | Remaining principal types backfilled | Assertion 1+2 fully hard across all actor types |
| 8 — lifecycle slices | Termination, suspension, fit-and-proper attestation events live | **Assertion 4 (fit-and-proper-stale) goes hard at `fail`**; `terminated-principal-action` and `suspended-principal-action` sub-assertions activate |

Each slice flip is a one-line edit in `principal-actor-resolve.ts` (raise the severity for a given actor-type cohort or assertion class); the stub's structure is designed to make the flip mechanical.

## 4. Failure-mode taxonomy

Once hard, the pipeline emits findings in the following classes. Each class corresponds to a distinct procedure-binding and a distinct remediation path.

- **`orphan-actor`** — event's `actor.id` does not resolve to any `PrincipalRegistered` event in the store. Severity `fail` once the relevant cohort is backfilled. **SARB-precedent failure** (Banks Act / FIC Act / FAIS all require the bank to attribute every action to a known principal; an orphan actor breaks that chain). Subject: `<actor.id>`. Remediation: register the principal retrospectively if legitimate, or treat the event as forensic — investigate via Vera's investigation runbook. Citation: P2 (every action has a typed source); Banks Act fit-and-proper / accountable-institution principles.
- **`role-coverage-gap`** — actor was registered but did not hold the role required for the action at the event's `as_of`. Severity `fail` once slice 5 lands. Subject: `<actor.id>::<event.type>`. Remediation: privilege-escalation or stale-permission investigation (Senna's territory); may surface a permission-policy bug.
- **`fit-and-proper-stale`** — regulated-role action by a human principal whose attestation was overdue at `as_of`. Severity `fail` once slice 8 lands. Subject: `<actor.id>::<event.type>`. Remediation: regulator-notification consideration (Banks Act fit-and-proper) plus forward-looking attestation refresh.
- **`terminated-principal-action`** — event recorded after the principal's termination event. Severity `fail`. Subject: `<actor.id>::<event_id>`. Remediation: forensic — credential-leakage / off-boarding-failure investigation. Critical security finding (Senna co-owner).
- **`suspended-principal-action`** — event recorded during a principal's suspension window. Severity `fail`. Subject: `<actor.id>::<event_id>`. Remediation: same as `terminated-principal-action` minus the post-mortem retention step.

All five classes carry the citation chain `D-PRINCIPAL-REGISTER → CLAUDE.md P2 → CLAUDE.md P7` at minimum; class-specific citations layer on top.

## 5. Substrate gaps blocking hard assertion

| Gap | Owner | Sequence target |
|---|---|---|
| `PrincipalRegistered` event type does not exist in `prototype/platform/event-store/event-types.ts` | Sade + Senna | Slice 1 (schema) |
| Principal-register projection (`prototype/platform/projections/principal-register.ts`, not yet present) | Sade + Senna | Slice 2 (substrate) |
| Action-permission policy generator (event-type → required-role mapping) | Senna | Slice 5 (A1.2 re-wire) |
| Backfill events for every persona under `/Team/` as internal-agent principals | Sade | Slice 3 |
| Director-officer principal record for Marc | Sade + Owen | Slice 4 |
| Lifecycle event types (`PrincipalTerminated`, `PrincipalSuspended`, `FitAndProperAttested`) | Sade | Slice 8 |
| Continuous-controls-assurance procedure (`Procedures/by-policy/continuous-controls-assurance.md`) does not yet exist; the recon is the system capability that performs it | Vera + Owen | Vera authoring queue |

The last gap is a Vera-side gap on the procedure registration; the procedure is named in the recon's header for forward-binding, with a TODO sentinel until the procedure file lands. Until the procedure is authored, the binding is a unidirectional reference (P6 violation; surfaced explicitly in this brief).

## 6. Procedure binding

Once authored, the procedure `Procedures/by-policy/continuous-controls-assurance.md` (Vera-owned, Thandiwe-signed) names this pipeline as one of the recurring continuous-controls system capabilities. The procedure cycle:

1. Trigger — every CI run + every fleet-cycle Vera overnight-recon tick (cron `agent:vera-overnight-recon`).
2. Steps — (a) recon executes on the event store; (b) findings are emitted as JSON-line stdout; (c) violations are appended as `ContinuousControlFinding` events (future event type — gap).
3. Reconciliation — number of `ContinuousControlFinding` events with class `orphan-actor` equals the number of orphan rows the recon emitted; the test for this lives in `prototype/tests/recon-principal-actor-resolve.test.ts`.
4. Evidence — JSON-line stdout snapshot retained per CI run; `ContinuousControlFinding` events retained immutably in the event store.

The procedure sits inside the upward chain `Banks Act / FIC Act / FAIS → fit-and-proper + accountable-institution policy → continuous-controls-assurance procedure → principal-actor-resolve recon`.

## 7. Authority

Citations:

- **D-PRINCIPAL-REGISTER** (Sade + Senna proposal `Owner Inbox/2026-05-09_sade-senna_principal-register.md`, decision card in flight) — the register substrate this recon asserts against.
- **CLAUDE.md Principle 1** — events are authoritative; this pipeline reads the event store directly with no derived-state shortcut.
- **CLAUDE.md Principle 2** — every action carries a typed citation to the register / regulation / contract that justifies it; an orphan actor is a P2 violation by construction.
- **CLAUDE.md Principle 6** — single-graph discipline; this recon closes the upward chain from event-actor to registered principal to mandate to procedure.
- **CLAUDE.md Principle 7** — autonomous-by-default; the audit must verify the autonomous principal directly, not the procedure that registers it.
- **Banks Act 94 of 1990 fit-and-proper** — the regulatory anchor for assertion 4.
- **FIC Act accountable-institution requirements** — the regulatory anchor for assertions 1+2 (the bank must attribute every monetary action to a known accountable party).
- **D-A22-RETIRE-LEGACY** — gating-precedent for the warn-pre-shadow stub pattern this pipeline reuses.

## 8. Change log

| Date | Author | Change |
|---|---|---|
| 2026-05-09 | Vera | Brief authored alongside stub pipeline at `prototype/platform/recon/principal-actor-resolve.ts`; slice-progression sequencing aligned to D-PRINCIPAL-REGISTER §7. |
