---
title: S8 §3.1 + A4 — fleet rollout (27 personas registered)
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-10
decision-required: false
authority: D-AGENT-RUNTIME-AUTHORIZE (S8, CEO-approved 2026-05-08)
summary: Drive Team/_team-roster.json (27 personas) through the agent spec parser → emit AgentRegistered + IdentityKeyRotated + PermissionPolicyPublished per persona. Idempotent. Wired into dashboard server boot. Decision on Gap #2 (parser triggerSubscriptions) recorded inline.
---

# S8 §3.1 + A4 — fleet rollout

**Authority:** S8 (`D-AGENT-RUNTIME-AUTHORIZE`) — CEO-approved 2026-05-08; spec at [Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md](2026-05-07_atlas_agent-runtime-substrate-spec.md), §3.1 (agent identity + permissioning) + §9 phase A4 (fleet rollout).

**Predecessors:** A1.1 registry (`prototype/platform/agent-runtime/registry.ts`), A1.2 issuer + permission-policy publisher (`prototype/platform/agent-identity/`), spec parser (`prototype/platform/agent-runtime/spec-parser.ts`).

## Path chosen — Path A (close Gap #2 inline)

The dispatch brief offered two paths:

- **Path A** — close Gap #2 (parser doesn't capture `triggerSubscriptions`) in this slice. Permission policies emitted with non-empty `eventSubscribeAllowList` from the start.
- **Path B** — register with the parser as-is, defer Gap #2; re-issue 27 permission policies later when the parser improves.

I took **Path A**. Rationale:

- Inspection of §7 trigger tables across the fleet (Vera, Mira, Bea, Atlas, Senna, Helena, Owen, Saskia) shows a stable convention: the trigger column carries either backticked typed event names (e.g. `` `TransactionPosted` `` , `` `CeoDecision` ``), "Scheduled wake-up — ..." rows, or natural-language source descriptions. Extracting the backticked typed event names is a single regex pass over the first column of the §7 table — contained to `prototype/platform/agent-runtime/spec-parser.ts`. No event-schema changes; `eventSubscribeAllowList` already exists in the `PermissionPolicyPublished` payload.
- Path B would force a same-day re-issue of all 27 permission policies on the next slice — wasted work + a noisy event log.
- The parser change is bug-fix-shaped, not policy-shaped — within S8 authority.

**Gap #2 status:** **closed** for typed-event subscriptions. Scheduled triggers and natural-language triggers are still parser-invisible (the scheduler consumer wires them via §6 cadence on the §7 row's source column). That is a different gap and remains open as a follow-on.

## Per-persona registration table

_Run this slice's CLI (`bun run register-fleet`) to refresh the table; the CI / boot-path run regenerates idempotently. The table below records the post-merge state on first run against a fresh event store._

| Persona | Position | Spec file present | Parsed cleanly | Registered |
|---|---|---|---|---|
| PAX | Role researcher | yes | yes | yes |
| Nolan | Recruiter | yes | yes | yes |
| Atlas | Core banking platform architect | yes | yes | yes |
| Bea | Accounting & financial reporting engineer | yes | yes | yes |
| Mira | Compliance / RegTech engineer | yes | yes | yes |
| Kai | Trading systems engineer | yes | yes | yes |
| Rohan | Risk engineer | yes | yes | yes |
| Nadia | Independent-validation engineer (second line) | yes | yes | yes |
| Tomas | Operations & payments engineer | yes | yes | yes |
| Imani | Legal-as-code engineer | yes | yes | yes |
| Sade | HR systems engineer | yes | yes | yes |
| Niko | Sales / CRM engineer | yes | yes | yes |
| Yael | Tax engineer | yes | yes | yes |
| Vera | Internal audit / continuous-assurance engineer | yes | yes | yes |
| Senna | Security engineer | yes | yes | yes |
| Ravi | Treasury / ALM engineer | yes | yes | yes |
| Anya | Data / analytics engineer | yes | yes | yes |
| Helena | Chief Risk Officer | yes | yes | yes |
| Owen | Company Secretary | yes | yes | yes |
| Zara | Chief Compliance Officer | yes | yes | yes |
| Iris | Information Officer | yes | yes | yes |
| Devon | Chief Operating Officer | yes | yes | yes |
| Camille | Chief Financial Officer | yes | yes | yes |
| Eitan | Treasurer | yes | yes | yes |
| Saskia | Head of Global Markets | yes | yes | yes |
| Thandiwe | Chief Audit Executive | yes | yes | yes |
| Rashida | Chief Information Security Officer | yes | yes | yes |

The roster source is `Team/_team-roster.json` (27 entries; canonical per CLAUDE.md "Team structure"). The `Team/` directory also contains `Linnea.md` and `Scrooge.md` — both are deliberately out of the autonomous-fleet roster (Linnea is an emerging persona pending roster admission by Nolan; Scrooge is the Chief of Staff orchestrator running as an in-session voice, not a registered substrate agent). The fleet rollout reads the roster, not a glob, so they are not registered.

## What lands

- `prototype/scripts/register-fleet.ts` — driver that walks the roster, parses each persona's spec, and calls `registry.register(spec)` → `issuer.issue(spec)` → `publisher.publish(spec)` once per persona. Three idempotency keys (`specHash` × 2, `policyHash` × 1) make a clean re-run a no-op.
- `prototype/platform/agent-runtime/spec-parser.ts` — extended to extract `triggerSubscriptions: readonly string[]` from §7's first column (backticked typed event names, deduplicated, in input order).
- `prototype/platform/agent-identity/permission-policy.ts` — `derivePermissionPolicy` consumes `spec.triggerSubscriptions` for the subscribe allow-list (Gap #2 closure path).
- `prototype/dashboard/server.ts` — `bootDerive()` invokes the fleet registration after derive; idempotent on subsequent boots (skip-count log only when `emitted === 0`).
- `prototype/tests/fleet-registration.test.ts` — four tests against a tmp event store + tmp roster + tmp `Team/` directory.
- `prototype/package.json` — adds the `register-fleet` script.

## Substrate gaps surfaced

Carrying forward from the prior substrate-state assessment, plus what this slice itself surfaced:

1. **Inactivity-SLA scheduler consumer not wired** — open from prior assessment. The scheduler tick CLI emits `ScheduledTrigger`; no consumer yet folds the `AgentRunCompleted` stream against the §6 inactivity SLA per persona. Follow-on slice.
2. **Trigger-source side of §7 still parser-invisible** — Path A captured typed event names. The natural-language trigger sources ("PR opened on `prototype/platform/*`", "Scheduled wake-up — daily close at 17:00 SAST") are not yet machine-readable. Wave-4 #11 (event-subscribe coverage) and the cron-map-drift recon are the existing surfaces; widening will let the scheduler register per-cadence wakes from the spec rather than from a separate cron registry.
3. **Bun-worker out-of-process boundary** — open from prior assessment. M8 cloud-lift concern.
4. **Linnea / Scrooge roster admission status** — `Team/Linnea.md` and `Team/Scrooge.md` exist as files but are not in `_team-roster.json`. Routed to Nolan as a separate item: either roster-add (fleet rollout will then register them) or rename / archive (parsers ignore them either way).
5. **`agent:atlas:substrate-runner` permission policy** — the lifecycle-wrapper actor introduced in PR #186 has no published policy yet; the runner currently appends through the legacy bypass. Out of scope for this slice (substrate-internal actor, not a persona); follow-on once #186 lands.

—Atlas (Core banking platform architect, engineering)
