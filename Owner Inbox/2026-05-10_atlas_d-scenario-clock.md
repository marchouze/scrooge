---
title: Scenario clock substrate — controlled time for simulated scenarios (D-SCENARIO-CLOCK)
author: Atlas (Core banking platform architect, engineering — substrate)
date: 2026-05-10
summary: Composition-side ScenarioClock interface (WallClock + SimulatedClock) lets dry-run scenarios drive event `as_of` deterministically. Default behaviour unchanged — production callers see wall-clock; scenarios opt in via env-var or direct construction.
decision-required: false
decision-id: D-SCENARIO-CLOCK
decision-category: near-term
decision-owner: Atlas (Core banking platform architect, engineering — substrate)
---

# Scenario clock substrate — D-SCENARIO-CLOCK

**Standing authority.** D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10) which adopted **D-SCENARIO-CLOCK** as a net-new sub-decision. Pack: [`Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md`](2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md) §6 dispatch #A2. No new CEO decision required.

**Scope.** Smallest substrate that lets simulated scenarios drive event `as_of` timestamps deterministically (T0 → T0+2min → T+2 settlement → month-end close), without perturbing production behaviour.

## 1. API surface

`prototype/platform/scenario-clock/` — four files, ~150 LOC of substrate + 24 tests:

```ts
export interface ScenarioClock {
  readonly mode: "wall" | "simulated";
  now(): string;             // ISO-8601 UTC
  nowMs(): number;           // epoch ms
  advance(duration: number): void;
  setTo(asOf: string): void; // ISO-8601 UTC
  freeze(): void;
  unfreeze(): void;
  readonly frozen: boolean;
}

export class WallClock implements ScenarioClock { /* delegates to Date.now() */ }
export class SimulatedClock implements ScenarioClock { /* deterministic */ }

export function resolveCompositionClock(env?: NodeJS.ProcessEnv): ScenarioClock;
```

Helper duration constants — `ONE_SECOND_MS`, `ONE_MINUTE_MS`, `ONE_HOUR_MS`, `ONE_DAY_MS`, `T_PLUS_TWO_MS` — keep scenario scripts readable.

**Mutator semantics on `WallClock`.** `advance`, `setTo`, `freeze`, `unfreeze` are **no-ops**. Scenario-aware code that shares its hot path with production can call mutators unconditionally without branching on `clock.mode`. Production cannot be rewound; the no-op is a deliberate ergonomic choice rather than a thrown error.

**Mutator semantics on `SimulatedClock`.** All mutators take effect immediately. `advance` accepts negative durations (rewind is legal — the event store's as-of replay is monotonic in sequence, not clock time). `freeze()` blocks `advance` and `setTo` (both throw with a clear "frozen; call unfreeze() first" message); `now()` continues to return the pinned instant.

## 2. Composition-side wiring

`prototype/platform/composition.ts` now exports `clock`, resolved once at boot:

```
BANK_SCENARIO_CLOCK_MODE=wall        → WallClock    (default; production-unchanged)
BANK_SCENARIO_CLOCK_MODE=simulated   → SimulatedClock initialised to
                                       BANK_SCENARIO_CLOCK_BASELINE
                                       (defaults to Date.now() at boot)
```

Existing `nowUtc()` / `Date.now()` callsites are intentionally **not** rewritten in this slice — they remain wall-clock-bound. Scenario-aware callers migrate over time by importing `clock` from `platform/composition` (or constructing their own `SimulatedClock` and threading it explicitly). This keeps the slice small and reversible.

The `eventStore.append()` call already accepts `as_of` from the caller's payload — there is no central time-source to swap inside the store. The clock is therefore positioned where `as_of` is *constructed*, not where the event is *persisted*. This is the correct seam for a scenario substrate: the store stays storage-only.

## 3. Scenario-script usage example

```ts
import {
  ONE_MINUTE_MS,
  SimulatedClock,
  T_PLUS_TWO_MS,
} from "@platform/scenario-clock";
import { eventStore } from "@platform/composition";
import { newEventId, BANK_ZA_001 } from "@platform/core/types";

const clock = new SimulatedClock("2026-05-10T08:00:00.000Z");

// T0 — RFQ requested
eventStore.append({
  event_id: newEventId(),
  type: "RfqRequested",
  as_of: clock.now(),               // ← deterministic, not Date.now()
  entity: BANK_ZA_001,
  actor: { type: "service", id: "fx-rfq-router" },
  citations: ["FX-RFQ-PROC-V1"],
  payload: { /* … */ },
  provenance: { kind: "simulated", scenario: "first-dry-run-2026-Q1",
                sourceLineage: "scenario-runner:03-fx-end-to-end-rehearsal" },
});

clock.advance(2 * ONE_MINUTE_MS);
// T0+2min — pricing model evaluated
eventStore.append({ /* as_of: clock.now() */ });

clock.advance(30 * 1_000);
// T0+2min30s — trade executed
eventStore.append({ /* as_of: clock.now() */ });

clock.advance(T_PLUS_TWO_MS);
// T+2 — settlement
eventStore.append({ /* as_of: clock.now() */ });
```

Phase-A dispatch #A4 (`scenarios/03-fx-end-to-end-rehearsal.ts`) is the first scripted consumer. Existing scenarios (`01-hello-bank.ts`, `02-onboard-counterparty.ts`) are unmodified — they continue to use `nowUtc()` / `Date.now()` on the wall-clock path.

## 4. Test coverage (`prototype/tests/scenario-clock.test.ts` — 24 tests)

- WallClock — mode marker, ISO-8601 round-trip, mutators no-op, frozen always false.
- SimulatedClock — baseline (ISO + numeric), advance() (single + accumulated + negative + non-finite rejection), T+2 helper, setTo() (pin + invalid ISO rejection), freeze() / unfreeze() (block + restore + no-op).
- `resolveCompositionClock()` — env-var combinations (unset / explicit wall / unrecognised / simulated+baseline / simulated-without-baseline).
- `resolveScenarioClockMode()` — case-sensitive parsing.
- End-to-end usage pattern — four-event RFQ→price→trade→settle sequence with deterministic `as_of` array.

`bun run typecheck && bun run lint && bun test tests/scenario-clock.test.ts` — all green. Pre-existing tsconfig deprecation warnings (`baseUrl`, `bun-types` resolution) untouched; not introduced by this slice.

## 5. Substrate gaps surfaced

These do **not** block dispatch #A4 or the dry-run; they are the next-cadence roadmap items the slice exposes.

| # | Gap | Surface | Cadence to fix |
|---|---|---|---|
| 1 | **Existing `nowUtc()` / `Date.now()` callsites are not clock-aware.** ~25 callsites across `platform/`, `runtime/`, `dashboard/`. Scenarios that need controlled time across the substrate (not just script-emitted events) need each callsite to source from `clock` instead. | Substrate-coverage finding. | Roll out per-module as scenarios exercise each surface. Not a blocker for Phase-A dispatch #A4 (the script controls its own time). |
| 2 | **Multi-clock / distributed-time.** Today there's a single composition-root clock. Cross-process replays (event-store-sync, dashboard server, scheduler tick) each construct their own composition root and therefore their own clock. Real distributed simulated-time needs a shared clock state (event-sourced clock ticks, or env-pinned baseline + advance log). | Substrate-completeness. | M8 cloud lift — Cosmos-backed clock state, or an event-typed `ScenarioClockTick` if a future scenario needs cross-process time control. Per dispatch scope: the design pack §6 #A2 originally floated `ScenarioClockTick`; the dispatch tightened scope to composition-only. The event-typed expansion lands when M8 / scenario #5+ needs it. |
| 3 | **Recon for "scenario emitted with wall-clock `as_of`".** A scenario script that forgets to use `clock.now()` and falls back to `nowUtc()` would silently produce wall-clock-stamped events with simulated provenance — a subtle determinism bug. A recon harness could assert: every event with `provenance.kind === "simulated"` has an `as_of` consistent with its scenario's clock baseline + advance log. | Substrate-completeness; Vera audit pipeline. | Wave-4+ recon item; pair with the provenance-tag-coverage harness already shipped. |

## 6. Citation chain (Principle 6 upward)

- D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10) → adopts D-SCENARIO-CLOCK (this slice).
- Pack §6 #A2 — scope tightening (composition-only; no event type) per dispatch.
- Principle 1 (events are truth) — the clock does not introduce a parallel state; it is a composition-side time source for caller-supplied `as_of` values that flow through the existing event-store.
- Principle 7 (autonomous by default) — scenarios are themselves agent-orchestrated runs; the controlled-time substrate is part of the agent-runtime affordance set.

## 7. Roll-out posture

- Land this slice (composition-only, default wall-clock).
- Dispatch #A4 (`scenarios/03-fx-end-to-end-rehearsal.ts`, Saskia + Kai + Bea) is the first consumer.
- Substrate-coverage gap #1 (callsite migration) sequenced as scenarios exercise each surface — no big-bang rewrite.
- Cross-process / event-typed expansion (gap #2) waits for the first scenario that needs it.

—Atlas (Core banking platform architect, engineering — substrate)
