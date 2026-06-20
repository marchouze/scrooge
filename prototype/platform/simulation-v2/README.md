# simulation-v2 — FX V2 simulated-outside-world spine

**Workstream:** WS-FX-V2-SIMULATOR. **Authority:** `D-FX-V2-SIMULATOR-FIRST`
(CEO-approved 2026-06-20). **Author:** Atlas (Core banking platform architect,
engineering).

## Why this exists

V1 is **retired** as a correctness oracle for FX — it carried too many errors to
reconcile against. The FX V2 capability is validated not against V1 parity but
against a faithful **simulated outside world**. This package is that simulator.

## The one binding invariant — simulator↔SUT boundary

The **simulator** emits ONLY external-party actions and reference data (market
rates, counterparty confirmations, settlement statuses, credit ratings, margin
responses, regulator acknowledgements, sanctions lists), each tagged
`simulated` with scenario provenance via `simulatedTag(...)`.

The bank's V2 capability is the **System Under Test (SUT)** and emits ONLY
internal events. The bank's logic must NEVER read from or reach into the
simulator. SUT valuation/risk/accounting reads default to `production`
provenance so simulated ticks cannot leak into a real read path.

The boundary is enforced by `recon:fx-v2-sim-boundary`
(`platform/recon/fx-v2-sim-boundary.ts`): it fails if any simulator module emits
an SUT-internal event type, or any SUT module hand-tags an emission `simulated`.

## Layout

| Path | Role |
|---|---|
| `eod-bus.ts` | EOD/cadence trigger bus over the clean `ScenarioClock`. Advancing the simulated clock to an EOD boundary fires registered cadence hooks in a defined deterministic order. |
| `scenario-manifest.ts` | Declarative multi-day FX scenario shape — counterparties, agreements, trades, market path, expected external responses. Seeded PRNG only. |
| `scenario-runner.ts` | Replays a manifest deterministically: wires a fresh `SimulatedClock` + event store + market-data store, drives the EOD bus, returns a typed run result. |
| `sim-modules/` | V2 simulator modules (external-party only): market-data, counterparty-provisioning, trade-confirmation, settlement-lifecycle. |
| `prng.ts` | Seeded PRNG (`mulberry32`) re-export + helpers. NEVER `Math.random()` / `Date.now()` — both break replay-safety. |

## Port & extend, not rebuild

This package reuses the already-event-sourced, provenance-tagged V1 simulation
spine (`platform/simulation/hub/`, `platform/simulation/env-sim/`,
`platform/scenario-clock/`) rather than rebuilding it. The V2 contract is the
same self-describing `SimulatorModule` shape; the additions are the EOD trigger
bus, the declarative scenario manifest/runner, and the boundary recon gate.
