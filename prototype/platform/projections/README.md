# `@platform/projections`

Pure-function projection runtime over the event store.

## What it is

A projection is a deterministic fold of events into state. By Principle 1, projections are *caches* — never authoritative. The event log outranks every projection in every reconciliation.

Reducers are pure: `(state, event) → state`. The runtime calls them many times with the same inputs (as-of replay, recon harness, regulator-pack regeneration) and expects identical outputs.

## Interface

```ts
interface Projector {
  build<S, E>(p: Projection<S, E>, opts?: ProjectionReplayOpts): S;
  fold<S, E>(p: Projection<S, E>, initial: S, opts?: ProjectionReplayOpts): S;
}
```

Capability code depends only on `Projector`. The local implementation (`LocalProjector`) reads from the SQLite event store; the cloud implementation (M8) reads from the cloud event substrate. Reducers and projection definitions are identical across substrates.

## Substrate-replacement seam (P6 — upward chain)

| Element | Local (M1) | Cloud (M8) |
|---|---|---|
| Source | SQLite event store via `bun:sqlite` | Postgres logical decoding **or** Event Hubs + Cosmos Change Feed |
| Runtime | In-process Bun fold | Container App / Function reading the cloud substrate |
| Cache | None yet (M1.5 in-memory only) | Azure SQL / Cosmos / Redis depending on access pattern |

## What it does *not* do (yet)

- No projection-cache persistence. Each `build()` re-replays from the start. Cache layer is M2 (Anya owns).
- No incremental subscription. Projections are pull-based, not push-based. Streaming subscriptions are M2+.
- No materialised SQL views. Domain modules build typed projections; SQL views are not the seam.

## Usage example

```ts
import { LocalProjector, acceptType } from "@platform/projections";

const eventCount: Projection<number, Event> = {
  name: "event-count",
  initial: 0,
  accepts: acceptAll,
  reduce: (s) => s + 1,
};

const total = projector.build(eventCount);
```

## Principles

- **P1** — replay, not state.
- **P6 (downward)** — projections are generated, not assembled.
- **P6 (upward / substrate seam)** — capability code imports the interface; the substrate is wired at the composition root.
