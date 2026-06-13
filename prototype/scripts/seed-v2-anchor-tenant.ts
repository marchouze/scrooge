// scripts/seed-v2-anchor-tenant.ts
//
// Idempotent seed script — V2 S1.
//
// Emits the bootstrap event sequence for the anchor bank tenant in the
// control-plane store:
//
//   1. TenantRegistered   — tenant:za-bank, tier K, legalEntityRef LE-ZA-HOZ-BANK
//   2. TenantSurfaceGranted — grants surfaceVersion "v1.0" (build-phase placeholder)
//
// Idempotency: replays the store first and skips any event whose logical
// subject already exists, so re-running is safe. The seed is a build-phase
// bootstrap; it is NOT part of the CI migrate chain in S1 (added in S2 once
// the tenant-axis gate enforces the registry invariant).
//
// Usage (against the default home store):
//   bun run scripts/seed-v2-anchor-tenant.ts
//
// Override the control-plane DB path:
//   BANK_V2_CONTROL_PLANE_DB=/tmp/test-cp.db bun run scripts/seed-v2-anchor-tenant.ts
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12
// Author: Atlas (Substrate Architect, engineering).

import {
  TENANT_REGISTERED,
  TENANT_SURFACE_GRANTED,
  TENANT_UPGRADE_LEDGER_ENTRY,
  buildControlPlaneProjection,
  defaultControlPlanePath,
  newCpEventId,
  openControlPlaneStore,
} from "../v2-core/control-plane";

const TENANT_ID = "tenant:za-bank";
const TIER = "K" as const;
const DISPLAY_NAME = "The Bank (ZA) — anchor tenant";
const LEGAL_ENTITY_REF = "LE-ZA-HOZ-BANK";
const SURFACE_VERSION = "v1.0";
// S14: the anchor's genesis platform version — the upgrade ledger's first
// entry brings the anchor from the pre-release placeholder onto v1.0 so the
// fleet view (FleetProjection.tenantVersion) is populated for the live tenant.
const GENESIS_FROM_VERSION = "v0";
const PLATFORM_VERSION = "v1.0";
const NOW = new Date().toISOString();
const ACTOR = { type: "service" as const, id: "scripts:seed-v2-anchor-tenant" };
const CITATIONS = ["D-V2-TENANCY-ARCHITECTURE", "D-V2-BBAAS-BLUEPRINT-SYNTHESIS"] as const;
const ENTITY = "control-plane";

const dbPath = defaultControlPlanePath();
console.log(`[seed-v2-anchor-tenant] opening control-plane store at: ${dbPath}`);

const store = openControlPlaneStore(dbPath);
const projection = buildControlPlaneProjection(store);

let emitted = 0;

// Step 1 — TenantRegistered (idempotent: skip if already present)
const existing = projection.getTenant(TENANT_ID);
if (existing) {
  console.log(
    `[seed-v2-anchor-tenant] TenantRegistered already present for ${TENANT_ID} — skipping.`,
  );
} else {
  store.append({
    event_id: newCpEventId(),
    type: TENANT_REGISTERED,
    as_of: NOW,
    entity: ENTITY,
    actor: ACTOR,
    citations: [...CITATIONS],
    payload: {
      tenantId: TENANT_ID,
      tier: TIER,
      displayName: DISPLAY_NAME,
      legalEntityRef: LEGAL_ENTITY_REF,
      registeredAt: NOW,
    },
  });
  console.log(`[seed-v2-anchor-tenant] TenantRegistered emitted for ${TENANT_ID}.`);
  emitted += 1;
}

// Step 2 — TenantSurfaceGranted (idempotent: skip if already granted at this version)
// Re-build projection to pick up the TenantRegistered we may have just emitted.
const projectionAfterRegister = buildControlPlaneProjection(store);
const tenantAfterRegister = projectionAfterRegister.getTenant(TENANT_ID);

if (tenantAfterRegister?.surfaceVersion === SURFACE_VERSION) {
  console.log(
    `[seed-v2-anchor-tenant] TenantSurfaceGranted(${SURFACE_VERSION}) already present for ${TENANT_ID} — skipping.`,
  );
} else {
  store.append({
    event_id: newCpEventId(),
    type: TENANT_SURFACE_GRANTED,
    as_of: NOW,
    entity: ENTITY,
    actor: ACTOR,
    citations: [...CITATIONS],
    payload: {
      tenantId: TENANT_ID,
      surfaceVersion: SURFACE_VERSION,
      tier: TIER,
      grantedAt: NOW,
    },
  });
  console.log(
    `[seed-v2-anchor-tenant] TenantSurfaceGranted(${SURFACE_VERSION}) emitted for ${TENANT_ID}.`,
  );
  emitted += 1;
}

// Step 3 — TenantUpgradeLedgerEntry (S14): bring the anchor onto its genesis
// platform version so the fleet view is populated. Idempotent: skip if the
// tenant is already on (or ahead of) PLATFORM_VERSION.
const projectionAfterSurface = buildControlPlaneProjection(store);
const tenantAfterSurface = projectionAfterSurface.getTenant(TENANT_ID);

if (tenantAfterSurface?.platformVersion === PLATFORM_VERSION) {
  console.log(
    `[seed-v2-anchor-tenant] TenantUpgradeLedgerEntry(${PLATFORM_VERSION}) already present for ${TENANT_ID} — skipping.`,
  );
} else if (tenantAfterSurface?.platformVersion != null) {
  console.log(
    `[seed-v2-anchor-tenant] ${TENANT_ID} already on platform version ${tenantAfterSurface.platformVersion} — leaving as-is.`,
  );
} else {
  store.append({
    event_id: newCpEventId(),
    type: TENANT_UPGRADE_LEDGER_ENTRY,
    as_of: NOW,
    entity: ENTITY,
    actor: ACTOR,
    citations: [...CITATIONS, "D-V2-BBAAS-TIER-STRUCTURE"],
    payload: {
      tenantId: TENANT_ID,
      fromVersion: GENESIS_FROM_VERSION,
      toVersion: PLATFORM_VERSION,
      appliedAt: NOW,
    },
  });
  console.log(
    `[seed-v2-anchor-tenant] TenantUpgradeLedgerEntry(${GENESIS_FROM_VERSION}→${PLATFORM_VERSION}) emitted for ${TENANT_ID}.`,
  );
  emitted += 1;
}

store.close();
console.log(
  `[seed-v2-anchor-tenant] done. Emitted ${emitted} event(s). ` + `Control-plane store: ${dbPath}`,
);
