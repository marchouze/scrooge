# simulation-v2-live — live, dashboard-controllable FX V2 third-party simulator

**Workstream:** WS-FX-V2-SIMULATOR. **Authority:** `D-FX-V2-SIMULATOR-FIRST`
(CEO-approved 2026-06-20).

## Why this package exists (separate from `simulation-v2/`)

`platform/simulation-v2/` is the **deterministic batch scenario-replay** harness:
a declarative `ScenarioManifest` replayed day-by-day with no wall-clock read
anywhere (`recon:fx-v2-sim-boundary` Rule C forbids `Date.now`/`new Date()`/
`Math.random` in that package — replay-safety, Principle 1).

This package is the **live operating model** of that same simulator — the V2
analogue of the V1 `ThirdPartySimHub` + `EnvSimEngine`: a real-time loop that
**generates** FX spot trades on a tick and streams the full born-V2 lifecycle into
the **live shared event store**, start/stop/fire-controllable from the dashboard.

## The reconciliation — scheduler vs payload

A live loop inherently needs a wall-clock timer to decide *when* to fire. We keep
replay-safety by splitting the two concerns cleanly:

- **Scheduler (wall-clock, here):** a single annotated `setInterval` is the only
  wall-clock read in the package. Each tick calls `clock.advance(stepMs)` on a
  `SimulatedClock`, then drives the `simulation-v2/` modules + `EodTriggerBus`.
  This callsite is covered by `recon:wall-clock-callsite-coverage`.
- **Payload (deterministic, in `simulation-v2/`):** every value that lands in an
  emitted event — `asOf`, rates, trade params, stochastic draws — derives from the
  `SimulatedClock` + a `SeededRng`. A recorded live run replays exactly from
  `(seed, clock-start, tick-count, stepMs)`.

`recon:fx-v2-sim-boundary` therefore covers this package with **Rule A**
(impersonation — it must never emit an SUT-internal event type; it only drives the
external-party modules + delegates booking/settlement to SUT entry points) but
leaves **Rule C** scoped to `simulation-v2/`.

## The binding invariant is unchanged

The simulator emits ONLY external-party `simulated`-tagged stimuli; the bank's V2
capability (SUT) emits ONLY internal events. The live driver orchestrates both
sides but never hand-constructs an SUT-internal event — it calls the SUT entry
points (`bookAffirmedFxTrade`, `settleFxLeg`, `provisionCounterparty`) which do.

## Port & extend, not rebuild

The live driver REUSES the existing born-V2 `simulation-v2/sim-modules/`
(market-data feed, counterparty-provisioning, trade-confirmation,
settlement-lifecycle) and the V2-native generative engine
(`fx-rate-walk-v2.ts`, `fx-trade-generator-v2.ts`). It adds only the live
scheduler, the cadence-hook factory, and the `SimulatorModule` hub wrapper.

## Layout

| Path | Role |
|---|---|
| `live-driver.ts` | `V2LiveFxDriver` — the real-time scheduler (`start`/`stop`/`isRunning`/`tickOnce`). The single annotated `setInterval`. |
| `cadence-hooks.ts` | Shared SUT `EodHook` factory (reval / daily P&L / VaR) used by both the live driver and the read-only `v2-world-simulator-view`. |
| `hub-module.ts` | `makeV2FxGenerativeModule` — wraps the live driver as a `SimulatorModule` (mode `loop+fire`) for the hub. |
| `register-v2-defaults.ts` | `buildV2Hub(...)` — constructs a `ThirdPartySimHub` and registers the born-V2 modules. |
