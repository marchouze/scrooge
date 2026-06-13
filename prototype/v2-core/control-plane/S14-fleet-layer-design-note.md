# V2 S14 — Operational fleet layer (design note)

**Author:** Sade (AgentOps, operations), with Atlas (Substrate Architect, engineering)
**Workstream:** WS-V2-BBAAS
**Brief:** `brief:sade:v2-s14-fleet-register-metering-upgrade-ledger-op:2026-06-13`
**Authority:** `D-V2-TENANCY-ARCHITECTURE`, `D-V2-BBAAS-TIER-STRUCTURE` (K/R/C), `D-V2-BBAAS-BLUEPRINT-SYNTHESIS`

## What S14 is

S1 stood up the control-plane store and its four event families
(`TenantRegistered`, `TenantSurfaceGranted`, `TenantUpgradeLedgerEntry`,
`TenantMeterEvent`) plus a basic projection (`listTenants` / `getTenant` /
`getMeteringWindow`). S14 builds the **operational fleet layer** on top — the
AgentOps substrate for running a multi-tenant fleet across the K/R/C tiers.
Anchor-only today (one tenant), but built for N.

Three views, all **pure projections** over the S1 store (Principle 1 — usage,
version, and status are queries over the event log, never stored state):

1. **Fleet register** — the operational picture of every tenant.
2. **Metering aggregation** — usage rollups (the tier-billing *basis*).
3. **Upgrade ledger + version-drift** — who is on what platform version, and
   who is behind.

## How it builds on S1 (extends, does not fork)

`FleetProjection` **extends** `ControlPlaneProjection`. It reuses the parent's
fold of the four event families and layers the fleet-operations query surface on
top; the parent stays the single authority for folding control-plane events.

Two small additive accessors were added to the parent so the fleet layer can
aggregate without re-reading the store:

- `meterEntries()` — the folded metering accumulator rows, read-only.
- `upgradeHistory(tenantId)` — the per-tenant upgrade-ledger entries, oldest
  first (the parent already tracked latest `platformVersion`; S14 needed the
  full chain for history + drift + ledger-consistency recon).

**No new event types.** S14 reuses all four S1 control-plane families, so there
is no registry / event-types / provenance change.

## The model

### Fleet register

`listFleet()` / `getTenantFleetState(tenantId)` return, per tenant: tier (K/R/C),
surface grant (ties to S5 released-surface), current platform version, last-meter
activity (latest `windowEnd`), and a **derived status**:

| Status | Meaning |
|---|---|
| `active` | registered, has a surface grant, on or ahead of the fleet's current version |
| `suspended` | registered but **no surface grant** — cannot call any capability; operationally dark |
| `behind-on-upgrade` | has a surface grant but its platform version trails the highest version observed across the fleet (the de-facto current release) |

The fleet's "current version" is derived as the highest `toVersion` seen across
all tenants' upgrade ledgers — there is no separately stored target, so the view
cannot drift from the events.

### Metering aggregation (the billing basis)

`meteringSummary(tenantId, window)` returns per-metric totals + a grand total for
one tenant within a window; `fleetMeteringSummary(window)` returns one summary
per tenant plus a fleet grand total. A meter row is included when its bounds sit
**inside** the requested window (`windowStart >= window.windowStart &&
windowEnd <= window.windowEnd`). This is the **basis** for tier billing — it is
deliberately *not* invoice generation (out of scope; that is a downstream
consumer of this projection).

### Upgrade ledger + version-drift

`tenantVersion(tenantId)` is the latest ledger `toVersion`;
`tenantUpgradeHistory(tenantId)` is the full chain oldest-first;
`fleetVersionDrift(targetVersion)` returns every tenant strictly behind the
target (a tenant with no ledger entry at all is reported as behind, with
`currentVersion: null` — it has not been brought onto any release).

Version comparison is **numeric, not lexical**: `v1.10` is correctly ahead of
`v1.9`, and `v1` equals `v1.0`. The ledger **records** upgrades; it never
**performs** them (the upgrade mechanism is operational, out of scope).

## How it serves the K/R/C tier operations

- **K (anchor / Kernel):** the anchor bank is the single live fleet member. The
  fleet register is the AgentOps operational dashboard input — is the anchor
  active, on the current version, metering as expected? The whole fleet layer is
  tagged `@tier K` in the released surface (anchor-internal operations).
- **R (regulated tenants) / C (commercial SaaS):** as external tenants onboard
  (Wave 4 S15+), each appears in `listFleet()` with its tier and surface grant;
  `fleetMeteringSummary` becomes the per-tenant billing basis across tiers; and
  `fleetVersionDrift` is the rolling-upgrade management view — which tenants
  AgentOps must bring forward to the target platform release.

## Anchor fleet seed

`scripts/seed-v2-anchor-tenant.ts` (S1) was extended with a genesis
`TenantUpgradeLedgerEntry` (`v0 → v1.0`) so `tenant:za-bank` (tier K) appears in
the fleet with platform version `v1.0` and surface grant `v1.0`. The seed is
idempotent — re-running emits zero events.

## Integrity recon — `recon:v2-fleet-integrity`

Advisory now (anchor-only; the seed is not yet in the CI migrate chain), with an
`ENFORCING` flag ready to flip. Asserts:

1. **Tier + surface presence** — every registered tenant has a K/R/C tier and a
   surface grant (no operationally-dark tenant slips through silently).
2. **Metering windows well-formed** — `windowStart <= windowEnd`; quantities are
   finite and non-negative.
3. **Upgrade-ledger consistency** — no version regression (intra-entry
   `toVersion >= fromVersion`, and a monotonic non-decreasing chain), and chain
   continuity (each entry's `fromVersion` equals the previous `toVersion`).

The pure assertion logic (`assertFleetIntegrity`) is exercised **sabotage-proof**
in the regression test: a synthetic missing-surface, malformed window, negative
quantity, version regression, and chain discontinuity are each individually
caught. Wired into `ci:recon:infra`.

## Out of scope (deferred)

- Real billing / invoicing (this is the metering basis only).
- Actually upgrading a tenant (the ledger records; the mechanism is operational).
- Onboarding a real second tenant (Wave 4 S15).
- v1 imports under `v2-core/` (forbidden by `recon:v2-no-v1-import`).

## Substrate gap

The seed (`seed-v2-anchor-tenant.ts`) is **not yet in the `ci:migrate` chain**,
so on a clean/unseeded runner the control-plane store is empty and the recon is
vacuously clean. The recon stays **advisory** until the seed lands in
`ci:migrate` (so the store is reliably populated on clean CI) — at which point
the `ENFORCING` flag in `platform/recon/v2-fleet-integrity.ts` flips to `true`
and tier/surface/window/ledger violations become blocking. This is the same
posture-progression S1's tenant-registry recon already follows.
