---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-11T05:25:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-AGENT-AUTONOMY-OPERATIONAL, 2026-05-11

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-AGENT-AUTONOMY-OPERATIONAL`
- **Title:** Agent autonomy — close the four operational gaps to make Principle 7 production-true
- **Action:** approve
- **Source proposal:** [`Owner Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md`](2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md) ([scrooge#205](https://github.com/marchouze/scrooge/pull/205), merged 2026-05-11)
- **Outcome:** Approve Atlas (Core banking platform architect; substrate)'s residual-only build plan. The 2026-05-07 D-AGENT-RUNTIME-AUTHORIZE A0–A5 plan substantively shipped under S8 + D-A22-RETIRE-LEGACY + S8 Tier 1 (registry, identity, scheduler, bus, lifecycle wrapper, worker isolation, oversight UI, 27 personas registered) — but four operational gaps still keep Principle 7 session-simulated rather than production-true.

  **Approved for immediate dispatch under no-pause:**
  - **Slice 1** — macOS `launchd` plist + Linux `systemd` unit running `bun run scheduler:tick` every 1m, with rotating logs. Closes Gap 1 (no daemon) + Gap 2 (build-phase persistent-host fixture). Owner: Atlas (substrate). Co-routed: Devon (Chief Operating Officer, governance) for operational accountability; Senna (Security engineer) reviews logging surface for credential leakage. ~1 PR.
  - **Slice 2** — `recon:trigger-spec-handler-symmetry` pipeline + per-persona stub-handler remediation batch. Closes Gap 3 (currently ≈34% trigger coverage — 110 declared §7 triggers across 29 persona specs vs 37 entries in `prototype/runtime/handlers-metadata.ts`). Owner: Atlas (the recon pipeline) + Vera (Internal audit / continuous-assurance engineer; reviews finding shape for Wave-4 mandate-coverage compatibility). Per-persona stubs dispatched to persona owners; **sequenced not parallel** per the `feedback_handlers_metadata_three_way_clash` memory. ~1 recon PR + 8–12 small per-persona stub PRs.

  **Approved as spec-only:**
  - **Slice 3** — Per-persona goal-loop substrate spec. Frames Gap 4 (no goal-pursuit). Owner: Atlas (substrate spec) co-authored with Senna + Rashida (Chief Information Security Officer, governance) gating per Principle 4, Vera reviewing audit-event shapes for Wave-5 capability-creep recon compatibility, Anya (Data substrate engineer) for world-state read-API ↔ semantic layer. Build dispatched per-persona under separate authorisations later — the spec is the gate. ~1 PR (spec only).

  **Deferred under this decision:**
  - Gap 2 production-grade always-on host (Azure Container Apps Jobs + Logic Apps per spec §6) is rerouted to the existing Azure-migration workstream when that gets scheduled. Honest framing per `project_ai_driven_bank` memory: build-phase doesn't need cloud, licence-day does.

  **Predecessor superseded:**
  - [`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`](2026-05-07_atlas_agent-runtime-substrate-spec.md) (decision-id `D-AGENT-RUNTIME-AUTHORIZE`, decision-required: true since 2026-05-07) is superseded by this approval and moves to `Owner Inbox/actioned/2026-05-07_atlas_agent-runtime-substrate-spec_[SUPERSEDED-BY-D-AGENT-AUTONOMY-OPERATIONAL].md`.

  **Caveats:**
  - The 27 GH-Actions cron workflows continue to run in parallel with the launchd driver — follow-on decision to deprecate them after Slice 1 has ≥1 substrate cadence of clean telemetry.
  - T-01 permission-gate-default-off (Senna+Rashida threat model 2026-05-10) remains routed via separate `D-T-01-PERMISSION-GATE-SECURE-DEFAULT` decision.
  - A2.2 Phase 2 (delete shadow path) remains gated per `D-A22-RETIRE-LEGACY`'s Phase-2 criteria.

- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "go with atlas recommendation" — chat-intake 2026-05-11 after PR #205 summary.
- **Authority chain:** Standing CEO authority over substrate architecture (Principle 7 in [`CLAUDE.md`](../CLAUDE.md) — autonomous by default; humans oversee the residual). Underwrites obligations under Banks Act 94 of 1990 (the substrate hosts the operational realisation of the AI-bank's labour force), Joint Standard 1 of 2024 (cyber resilience — the substrate must operate under this once licence-day binds), Joint Standard 2 of 2024 (operational risk — the substrate is an operational-resilience-relevant capability), BCBS principles on operational resilience, POPIA s.71 (automated decisioning — the oversight UI carries the standing notice).

## Follow-on routes recorded

- `agent:Atlas (Core banking platform architect; substrate)` — **Slice 1 dispatch** (launchd + systemd cron driver). Brief in source proposal §4 Slice 1 + acceptance criteria. Dispatch this session in an isolated worktree.
- `agent:Atlas (Core banking platform architect)` + `agent:Vera (Internal audit / continuous-assurance engineer)` — **Slice 2 dispatch (recon pipeline only)** — `recon:trigger-spec-handler-symmetry` pipeline. Per-persona remediation batch sequenced after recon lands. Brief in source proposal §4 Slice 2.
- `agent:Atlas (Core banking platform architect)` + `agent:Senna (Security engineer)` + `agent:Rashida (Chief Information Security Officer, governance)` + `agent:Vera` + `agent:Anya (Data substrate engineer)` — **Slice 3 dispatch (spec only)** — per-persona goal-loop substrate spec. Brief in source proposal §4 Slice 3 + acceptance criteria for the *spec* (not the build).

## Substrate gaps surfaced

Inherited from the source proposal §6 inventory; CEO approval doesn't add new gaps, only authorises closure of named ones. See source for full table.

## Change log

- 2026-05-11 — Initial record. Author: Scrooge (Chief of Staff / Orchestrator).
