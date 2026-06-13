# V2 S16 — K/R/C flat-tier packaging + tier-entitlement coherence gate (design note)

**Author:** Atlas (Substrate Architect, engineering), with PAX (Research) input on tier-content mapping
**Workstream:** WS-V2-BBAAS
**Brief:** `brief:atlas:v2-s16-k-r-c-flat-tier-packaging-tier-entitlemen:2026-06-13`
**Authority:** `D-V2-WAVE4-COMMERCIAL-POSTURE` (CEO-approved 2026-06-13), `D-V2-BBAAS-TIER-STRUCTURE`, `D-V2-BBAAS-BLUEPRINT-SYNTHESIS`

## What S16 is

S5 (`v2-core/released-surface.ts`) defined the **technical** tier boundary —
which v2-core exports each of K / R / C may access, enforced at the code level
by `recon:v2-released-surface-clean-core` (C ⊆ R ⊆ K). S16 adds the
**commercial packaging** of that boundary: a typed K/R/C **flat-tier
entitlement** table that maps each tier to its S5 surface scope, and a coherence
gate that proves the packaging never drifts from the surface boundary.

**The tier boundary IS the surface boundary** — the clean-core doctrine made
mechanical at the packaging layer. Tier capabilities are *derived* from the
`RELEASED_SURFACE` manifest, never hand-maintained, so the manifest stays the
single source of truth.

## CEO Wave-4 posture (the constraints that shaped this)

`D-V2-WAVE4-COMMERCIAL-POSTURE` constrains S16:

1. **Flat tiered subscription.** A tier is a flat subscription *level*, not a
   per-seat or metered-token billing axis. Every entitlement carries the
   `subscriptionModel: "flat-tier"` marker. S14 metering stays
   operations-internal (the billing *basis*), NOT a billing axis here.
2. **Build mechanics now; selling gated.** S16 defines tier STRUCTURE +
   ENTITLEMENTS only. There are **no** price fields / rate-cards / external
   commitments anywhere — selling is gated on the anchor PA-approval proof
   (held as internal IP, not productised, not touched here). The coherence gate
   defends the no-pricing rule (a price-shaped key on an entitlement fails CI).
3. **K → R → C** sequencing. **Anchor = K.**

## The tier-entitlement model (`v2-core/tier-entitlement.ts`)

A `TierEntitlement` is:

```
{ tier, surfaceScope, capabilities, subscriptionModel: "flat-tier" }
```

- `tier` / `surfaceScope` — the tier letter and the S5 surface key it maps to.
  Always equal (the tier boundary IS the surface boundary).
- `capabilities` — the v2-core surface export tokens the tier is licensed to
  access, **derived from `RELEASED_SURFACE`** (token = the v2-core/index.ts
  relative path minus `./`, matching the S5 gate convention).
- `subscriptionModel` — always `"flat-tier"`. No price field exists.

Capability derivation:

| Tier | Surface scope | Capabilities derived from |
|---|---|---|
| **K** (anchor) | K — full internal access | `R.exports ∪ C.exports ∪ K.kOnlyExports` (the full surface; K has no restriction) |
| **R** (regulated tenant) | R | `RELEASED_SURFACE.R.exports` |
| **C** (commercial SaaS) | C | `RELEASED_SURFACE.C.exports` |

The K capability set is the **union of all annotated exports** (every export in
`v2-core/index.ts` is `@tier`-classified by the S5 gate, so the union is
exhaustive). This makes C ⊆ R ⊆ K hold by construction; the coherence gate
asserts it rather than assuming it.

## Anchor = K

`ANCHOR_TIER = "K"` and `ANCHOR_TIER_TENANT_ID = ANCHOR_TENANT_ID`
(`tenant:za-bank`), consistent with S14 fleet state (the anchor is the K tier).
`isAnchorTier(tenantId)` is the dark-mode helper mirroring
`isAnchorTenantEvent`. The coherence gate asserts `ANCHOR_TIER === "K"`.

## C-tier go-live preconditions (standing constraints, gated to C)

C is the most externally-exposed tier; before it can go live a set of standing
constraints must be satisfied. Each is a typed `CTierGoLivePrecondition`
(`{ key, title, description, satisfied, authority }`). The canonical set:

1. **`second-provider-fallback`** (Wave-4 decision #5) — C cannot go live
   without a **tested second-provider (model/inference) fallback**, so a
   primary-provider outage/withdrawal does not take a commercial tenant dark.
   This is the **constraint/precondition record + gate only**; the actual
   fallback implementation is a separate, larger workstream. `satisfied: false`
   until that workstream lands and is tested.
2. **`cross-tenant-csi-gate-cleared`** (D-W7) — cross-tenant learning is not in
   the C surface until the cross-tenant CSI gate clears (competition-law
   keystone). Documented here so the full C-gate-set is in one place.

`isCTierGoLiveReady()` is a pure derivation — `true` only when **every**
precondition is satisfied. In the build phase it is `false` (selling is gated;
the fallback is not yet implemented). There is no stored "go-live" flag.

## The coherence gate (`recon:v2-tier-entitlement-coherence`, ENFORCING)

`platform/recon/v2-tier-entitlement-coherence.ts` reads the real entitlement
table + real `RELEASED_SURFACE` and FAILS CI unless all hold:

1. **surfaceScope == tier** for every entitlement.
2. **Every capability resolves** to a real released export (no phantoms).
3. **Within scope** — no tier grants a capability outside its surface scope
   (C entitling a K-only export is caught here).
4. **Containment** C ⊆ R ⊆ K.
5. **Flat-tier marker** + **no price-shaped field** on any entitlement.
6. **Anchor == K.**
7. **C-go-live preconditions** present, include the second-provider fallback,
   and gate go-live (C is never reported go-live-ready while any precondition is
   unsatisfied).

The pure assertion (`assertTierEntitlementCoherence`) is separated from the live
read so the regression test drives it with a **synthetic over-grant** (C
entitling the K-only `cross-tenant` token) and proves the catch is
**non-vacuous** (the gate fails on the sabotage). The live `run()` asserts 82
checks across the real K/R/C table with 0 violations. Wired into the infra recon
suite (`ci:recon:infra`).

## What S16 is NOT

No pricing / rate-cards / external commitments (structure only). No per-seat /
metered billing (flat tiers only). No second-provider-fallback *implementation*
(precondition + gate only). The PA approval-file is untouched (internal IP).
Onboarding is S15 (the next slice). No v1 imports under v2-core; no wall-clock
callsite added in v2-core (the model is pure data + pure functions).

## Files

- `v2-core/tier-entitlement.ts` — the entitlement model + C-go-live preconditions.
- `v2-core/index.ts` — `@tier R` export of the packaging model.
- `platform/recon/v2-tier-entitlement-coherence.ts` — the ENFORCING gate.
- `platform/recon/v2-tier-entitlement-coherence.test.ts` — sabotage-proof tests.
- `package.json` + `scripts/run-recon-suite.ts` — gate wiring (infra suite).
