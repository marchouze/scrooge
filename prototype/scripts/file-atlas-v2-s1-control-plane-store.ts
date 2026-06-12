// scripts/file-atlas-v2-s1-control-plane-store.ts
//
// One-shot RMS Phase 3 filing for Atlas's V2 S1 control-plane store design note.
// Emits a RecordFiled event so the Documents register holds the canonical record.
// Idempotent — skips if already filed.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
//   D-RMS-PHASE-3 (active).
// Brief: brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12
// Author: Atlas (Substrate Architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-s1-control-plane-store:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-s1-control-plane-store] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 S1: Control-plane store — tenant registry + fleet/metering/upgrade ledger

**Author:** Atlas (Substrate Architect, engineering)
**Date:** 2026-06-12
**Authority:** D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Brief:** brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12
**Workstream:** WS-V2-BBAAS

---

## 1. What S1 delivers

S1 adds the **control-plane store** to the v2-core package — the shared,
cross-tenant SQLite store in the Option C tenancy architecture. Per-tenant
event stores are fully isolated; the control-plane store holds the fleet metadata
that spans tenants: who the tenants are, what surface they have been granted,
metering, and the upgrade ledger.

### 1.1 New files

| File | Purpose |
|---|---|
| \`v2-core/control-plane/events.ts\` | Four typed event shapes + Zod schemas |
| \`v2-core/control-plane/store.ts\` | \`openControlPlaneStore()\` factory; DDL; \`ControlPlaneStore\` interface |
| \`v2-core/control-plane/projection.ts\` | In-memory projection: \`listTenants\`, \`getTenant\`, \`getMeteringWindow\` |
| \`v2-core/control-plane/index.ts\` | Barrel re-export |
| \`platform/event-store/registry/v2-control-plane.ts\` | F-032 registry rows (v1-side) |
| \`platform/recon/v2-control-plane-tenant-registry.ts\` | Recon gate (advisory, S1) |
| \`scripts/seed-v2-anchor-tenant.ts\` | Idempotent anchor-bank seed |
| \`scripts/file-atlas-v2-s1-control-plane-store.ts\` | This filing script |

### 1.2 Event types

- **TenantRegistered** — tenant joins the fleet; establishes tenantId + tier + legalEntityRef.
- **TenantSurfaceGranted** — a released-surface version is granted to a tenant.
- **TenantUpgradeLedgerEntry** — a platform version upgrade is applied to a tenant.
- **TenantMeterEvent** — metered usage event (no live collection in S1; schema only).

### 1.3 Control-plane store bootstrap

\`openControlPlaneStore(path?): ControlPlaneStore\`

Path resolves from:
  1. \`BANK_V2_CONTROL_PLANE_DB\` environment variable
  2. \`$HOME/.local/share/bank/v2-control-plane.db\` (default)

Schema is structurally identical to the v1 EventStore (\`events\` table + same
index set + \`recon_cursors\` table) so existing tooling is compatible without
modification. WAL mode + NORMAL sync for file-backed stores.

### 1.4 Projection

\`ControlPlaneProjection\` folds the four event types into:
- \`listTenants() → Tenant[]\` — all registered tenants with tier, surface grant, and platform version.
- \`getTenant(tenantId) → Tenant | null\`
- \`getMeteringWindow(tenantId, metricKey, window) → number\` — aggregate metered quantity.

### 1.5 Anchor-bank seed

\`scripts/seed-v2-anchor-tenant.ts\` emits:
- TenantRegistered: tenantId=\`tenant:za-bank\`, tier=K, legalEntityRef=\`LE-ZA-HOZ-BANK\`
- TenantSurfaceGranted: surfaceVersion=\`v1.0\`

### 1.6 Recon gate

\`recon:v2-control-plane-tenant-registry\` (advisory warn-severity in S1):
1. At least one K-tier tenant is registered.
2. Anchor tenant \`tenant:za-bank\` exists.
3. Every registered tenant has a surface grant.

## 2. Design choices

- **Structural parity with v1 EventStore** — identical DDL so existing tooling transfers directly.
- **Advisory gate in S1** — severity flips to fail-blocking in S3 when the surface enforcement gate lands.
- **v1-side F-032 registry** — Zod schemas imported via the permitted v1→v2 direction.

## 3. What is next

- S2 — tenant-axis: per-tenant event store isolation + scoped routing.
- S3 — released-surface gate enforcement.
- S10 (Wave 3) — full tenant isolation on the main event store.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-V2-TENANCY-ARCHITECTURE", "D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S1: Control-plane store — tenant registry + fleet/metering/upgrade ledger",
      path: "2026-06-12_atlas_v2-s1-control-plane-store.md",
      category: "engineering-design",
      author: "Atlas (Substrate Architect, engineering)",
    },
  },
  clock.now(),
);

console.log(`[file-atlas-v2-s1-control-plane-store] RecordFiled: ${result.event.event_id}`);
console.log(`  recordId: ${RECORD_ID}`);
