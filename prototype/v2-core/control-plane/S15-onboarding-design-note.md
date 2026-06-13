# V2 S15 — Tenant onboarding mechanics + onboarding-readiness gate (design note)

**Author:** Atlas (Substrate Architect, engineering)
**Date:** 2026-06-13
**Authority:** D-V2-WAVE4-COMMERCIAL-POSTURE (CEO-approved 2026-06-13); D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Brief:** brief:atlas:v2-s15-tenant-onboarding-mechanics-onboarding-re:2026-06-13

## What S15 is

The last Wave-4 slice. S1–S16 built the multi-tenant substrate piecemeal; S15
sequences it into a single typed, replayable, **fail-closed** onboarding flow,
and adds an **enforcing readiness gate** the platform can refuse against. It
invents no new state — it wires what the prior slices already own.

## The onboarding flow

`runOnboarding(store, plan, bindTenantStore?)` provisions a tenant in four steps,
each a typed control-plane event (Principle 1):

1. **register-tenant** (S1) — `TenantRegistered`; tier from the S16 tier model.
2. **derive-and-grant-seats** (S11) — derive the tenant-scoped functional-seat
   map from the roster, register one `FunctionalSeatRegistered` per persona.
3. **grant-released-surface** (S5/S16) — `TenantSurfaceGranted` at the surface
   version the tier is entitled to.
4. **set-fleet-state** (S14) — `TenantUpgradeLedgerEntry` brings the tenant onto
   its genesis platform version so the FleetProjection reports it `active`.

The per-tenant store (S10) is bound by the caller through an optional hook
(`resolveTenantStore` is the S10 routing concern; onboarding records the tenant
in the cross-tenant control-plane store).

**Fail-closed.** A full `preflightOnboarding` runs first and throws
`OnboardingAbortedError` BEFORE any event is emitted — a bad tenantId, an empty
roster, a dirty seat derivation, or a missing timestamp aborts with zero events
written. There is never a half-provisioned tenant left in the store.

**No wall clock.** v2-core must not read the wall clock (the ratchet bit S11).
Every timestamp is required from the caller (`onboardedAt`).

## The readiness gate (`recon:v2-onboarding-readiness`, ENFORCING)

A tenant is `ready` ONLY when every provisioning step landed (registered + ≥1
seat + surface grant + fleet state) AND its tier preconditions are met. A C-tier
tenant CANNOT be ready while the S16 C-go-live preconditions (tested
second-provider fallback, cross-tenant CSI gate) are unsatisfied — selling is
gated. The platform can REFUSE incomplete onboarding. The synthetic
half-provisioned tenant is caught sabotage-proof in the regression test
(non-vacuous). Store-optional: vacuously clean on a fresh runner.

## CEO Wave-4 posture honoured

- **NO approval-file productised.** Onboarding provisions **tenancy only**; no
  part of the anchor's PA approval-file IP is packaged or shipped (held as
  internal IP). There is no approval-file artefact anywhere in the module.
- **Selling gated.** Exercised as a rehearsal (`scripts/v2-onboarding-rehearsal.ts`),
  scratch-only — no real tenant, no external commitment, `liveStoreWritten === false`.

## Anchor = ready

`seed-v2-anchor-tenant` now also derives + appends the anchor's S11 seats
(idempotent), so the already-onboarded anchor (K) satisfies the readiness gate
without re-provisioning.

## Substrate gap

The Position-Keeping ingestion seam (how a freshly-onboarded tenant's positions
flow into the platform at depth) is noted but not built here — it is a later
slice. S15 provisions the tenant; it does not wire the trade/position ingest.
