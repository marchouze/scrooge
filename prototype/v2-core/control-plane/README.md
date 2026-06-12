# v2-core/control-plane — Wave 1 control plane (V2 S2+)

**Author:** Atlas (Core banking platform architect, engineering)
**Workstream:** WS-V2-BBAAS — Slice **S2** (tenant axis, dark mode)
**Authority:** `D-V2-TENANCY-ARCHITECTURE`, `D-V2-BBAAS-BLUEPRINT-SYNTHESIS`
**Brief:** `brief:atlas:v2-s2-tenant-axis-in-v2-event-envelope-dark:2026-06-12`

This directory holds the v2 control-plane modules. In S2 only the **tenant
axis** lands; the control-plane store, posture register, and routing gate are
later slices.

---

## S2 — Tenant axis (dark mode)

### What lands

| File | Purpose |
|---|---|
| `tenant.ts` | `ANCHOR_TENANT_ID = "tenant:za-bank"`, `TenantId` branded type, `tenantIdSchema`, `isAnchorTenantEvent` predicate |
| `envelope.ts` | `V2Envelope<TPayload>`, `v2EnvelopeSchema`, `createV2Envelope` factory |
| `tenant-axis.test.ts` | Unit tests for all four exports |

Both modules are re-exported from `v2-core/index.ts`.

### Design decisions

**`tenantId` is REQUIRED on `V2Envelope`.**
An unknown tenant is a rejected event, not a defaulted one. The `createV2Envelope`
factory defaults the argument to `ANCHOR_TENANT_ID` when omitted, making the
common case ergonomic without hiding the field. This is the correct
`required-field + ergonomic-default` split: the type enforces presence;
the factory provides the convenience default.

**`ANCHOR_TENANT_ID = "tenant:za-bank"`.**
The format matches the `fil:inst:` tenant segment (W9 §3.1): `"tenant:"` prefix
+ lowercase-kebab identifier. The anchor tenant is the SA bank entity
(LE-ZA-HOZ-BANK) that seeds the v2 code-line. All existing v1-sourced events
will route to this tenant when the routing layer lands (S3+).

**Dark mode: nothing is enforced.**
No live-bus handler, routing gate, or control-plane store reads `tenantId` in S2.
The type and factory are available so call-sites can be written in a
tenant-aware style today; the S3+ routing gate only enables itself — no
retrofit of call-sites needed.

### `recon:v2-tenant-axis-present` (advisory)

`platform/recon/v2-tenant-axis-present.ts` asserts three structural invariants:
1. `control-plane/tenant.ts` exists, contains `"tenant:za-bank"`, exports
   `isAnchorTenantEvent`.
2. `control-plane/envelope.ts` exists, exports `createV2Envelope` and `V2Envelope`.
3. `v2-core/index.ts` barrel re-exports both modules.

Advisory in S2 (exits 0 regardless). Becomes enforcing when the first live-bus
envelope consumer lands (S3+).

---

## What lands next (NOT here yet)

- **S3** — control-plane store: tenant registration events + projection-derived
  tenant register; `TenantRegistered` event type (v1-side adapter); routing gate
  `recon:v2-tenant-routing-coverage`.
- **S4** — posture register: `PostureSnapshot` per-tenant projection, used by
  the `RegulatoryClassifiable` and `PostureRelevant` facets (W9 §3.4).
- **S5** — released-surface gate: `recon:v2-released-surface` enforcing;
  only facets listed in `ReleasedSurface` are callable from v1 consumers.

*Filed as a RecordFiled event into the Documents register (RMS Phase 3,
`D-RMS-PHASE-3`); the content-addressed document store is canonical
(`D-RMS-PHASE-4`).*
