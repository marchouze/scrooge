// v2-core/control-plane/onboarding.ts
//
// Tenant onboarding mechanics + onboarding-readiness — V2 S15 (last Wave-4 slice).
//
// WHAT THIS IS
// ------------
// A typed, replayable onboarding FLOW that provisions a tenant by WIRING the
// existing control-plane substrate — it invents no new state, it sequences what
// the prior slices already own:
//
//   1. REGISTER TENANT      (S1)  — TenantRegistered (tier from the S16 tier model).
//   2. DERIVE + GRANT SEATS (S11) — derive the tenant's functional-seat map from
//                                   the roster and register one FunctionalSeat
//                                   per persona (tenant-scoped seat keys).
//   3. GRANT RELEASED SURFACE(S5) — TenantSurfaceGranted at the surface version
//                                   the tier is entitled to (S16 entitlement).
//   4. SET FLEET STATE      (S14) — TenantUpgradeLedgerEntry brings the tenant
//                                   onto its genesis platform version so the
//                                   FleetProjection reports it `active`.
//
// The PER-TENANT STORE (S10) is bound by the caller through `resolveTenantStore`
// — onboarding records the tenant in the cross-tenant CONTROL-PLANE store; the
// tenant's OWN event store is the S10 routing concern. This module asserts the
// binding resolves (fail-closed) but does not own the per-tenant store path.
//
// STRUCTURED-FIRST + FAIL-CLOSED
// ------------------------------
// Every step is a typed event appended to the control-plane store (Principle 1).
// The flow is FAIL-CLOSED: a step that cannot complete (e.g. an empty seat map,
// a surface the tier is not entitled to) ABORTS the flow before emitting the
// downstream events — there is never a half-provisioned tenant left behind. The
// readiness gate (see `assertOnboardingReadiness`) is the independent check that
// a tenant is ONLY `ready` when every step landed AND its tier preconditions are
// met; the platform can REFUSE an incomplete onboarding.
//
// SCRATCH-ONLY REHEARSAL: this module reads/writes whatever ControlPlaneStore it
// is handed. The rehearsal (scripts/v2-onboarding-rehearsal.ts) hands it a
// SCRATCH in-memory/temp store so no rehearsal tenant ever reaches the live
// canonical store and no anchor data is touched.
//
// NO WALL CLOCK. v2-core must not read the wall clock (wall-clock-callsite
// ratchet; it bit S11). Every timestamp is REQUIRED from the caller (`onboardedAt`).
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory. See `recon:v2-no-v1-import`.
//
// CEO WAVE-4 POSTURE (D-V2-WAVE4-COMMERCIAL-POSTURE, CEO-approved 2026-06-13):
//   - The PA approval-file is held entirely as internal IP and is NOT
//     productised. Onboarding provisions TENANCY ONLY — it packages/ships no
//     part of the anchor's regulatory approval IP. There is deliberately no
//     approval-file artefact anywhere in this module.
//   - Build mechanics now; selling gated. This flow is exercised as a REHEARSAL;
//     it makes no external commitment and registers no real second tenant.
//
// Authority: D-V2-WAVE4-COMMERCIAL-POSTURE (CEO-approved 2026-06-13);
// D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s15-tenant-onboarding-mechanics-onboarding-re:2026-06-13
// Author: Atlas (Substrate Architect, engineering).

import {
  TENANT_REGISTERED,
  TENANT_SURFACE_GRANTED,
  TENANT_UPGRADE_LEDGER_ENTRY,
  type TenantTier,
  tenantRegisteredPayloadSchema,
  tenantSurfaceGrantedPayloadSchema,
  tenantUpgradeLedgerEntryPayloadSchema,
} from "./events";
import {
  type DerivedSeatMap,
  type RosterPersona,
  deriveSeatMap,
  loadRoster,
  makeFunctionalSeatRegisteredEvent,
} from "./functional-seats";
import { ControlPlaneProjection } from "./projection";
import type { ControlPlaneStore, CpEvent } from "./store";
import { ANCHOR_TENANT_ID } from "./tenant";

// ---------------------------------------------------------------------------
// Tier → surface-version + platform-version binding.
//
// The surface version a tier is granted at onboarding. v2-core's released
// surface is at v1.0 (the build-phase placeholder, matching the anchor seed).
// The tier model (S16) owns WHICH export tokens a tier may call; the onboarding
// flow grants the SURFACE VERSION at which those tokens are exposed. The two
// are orthogonal: the version is the rolling-release axis; the tier is the
// capability axis. We grant every tier the current platform surface version.
// ---------------------------------------------------------------------------

/** The surface/platform version the platform onboards tenants at (build phase). */
export const ONBOARDING_SURFACE_VERSION = "v1.0" as const;

/** The genesis "from" version of the first upgrade-ledger entry (pre-release). */
export const ONBOARDING_GENESIS_FROM_VERSION = "v0" as const;

/** The platform version a freshly-onboarded tenant is brought onto. */
export const ONBOARDING_PLATFORM_VERSION = "v1.0" as const;

// ---------------------------------------------------------------------------
// Onboarding plan (input) + result (output)
// ---------------------------------------------------------------------------

/**
 * The typed onboarding plan — everything the flow needs to provision a tenant.
 *
 *   tenantId      — the tenant key (`tenant:<segment>`).
 *   tier          — K / R / C (the S16 tier the tenant subscribes to).
 *   displayName   — human-readable tenant name.
 *   legalEntityRef— the tenant's primary legal-entity identifier.
 *   onboardedAt   — REQUIRED ISO-8601 UTC timestamp (no wall clock in v2-core).
 *   rosterPath    — optional explicit roster path (tests); omit → canonical roster.
 *   rosterPersonas— optional explicit personas (tests / rehearsal); omit → load.
 *   citations     — optional citation override for emitted events.
 */
export interface OnboardingPlan {
  readonly tenantId: string;
  readonly tier: TenantTier;
  readonly displayName: string;
  readonly legalEntityRef: string;
  readonly onboardedAt: string;
  readonly rosterPath?: string;
  readonly rosterPersonas?: readonly RosterPersona[];
  readonly citations?: readonly string[];
}

/** The canonical onboarding step sequence, in execution order. */
export const ONBOARDING_STEPS = [
  "register-tenant",
  "derive-and-grant-seats",
  "grant-released-surface",
  "set-fleet-state",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** A single executed onboarding step. */
export interface OnboardingStepResult {
  readonly step: OnboardingStep;
  /** How many control-plane events this step appended. */
  readonly eventsEmitted: number;
  /** Human-readable note of what the step provisioned. */
  readonly note: string;
}

/** The result of running the onboarding flow. */
export interface OnboardingResult {
  readonly tenantId: string;
  readonly tier: TenantTier;
  readonly completed: boolean;
  readonly steps: readonly OnboardingStepResult[];
  /** Seats derived + registered (empty when seat derivation failed). */
  readonly seatMap: DerivedSeatMap;
  /** Total control-plane events appended across all steps. */
  readonly eventsEmitted: number;
}

/**
 * Raised when an onboarding step cannot complete. The flow is fail-closed: the
 * error is thrown BEFORE any downstream event is emitted, so a partially-
 * provisioned tenant is never left in the store.
 */
export class OnboardingAbortedError extends Error {
  readonly step: OnboardingStep;
  readonly tenantId: string;
  constructor(step: OnboardingStep, tenantId: string, reason: string) {
    super(
      `onboarding: ABORTED at step "${step}" for tenant "${tenantId}" — ${reason}. No downstream events emitted (fail-closed; no half-provisioned tenant).`,
    );
    this.name = "OnboardingAbortedError";
    this.step = step;
    this.tenantId = tenantId;
  }
}

const ENTITY = "control-plane";
const DEFAULT_CITATIONS = [
  "D-V2-WAVE4-COMMERCIAL-POSTURE",
  "D-V2-TENANCY-ARCHITECTURE",
  "D-V2-BBAAS-TIER-STRUCTURE",
] as const;

// ---------------------------------------------------------------------------
// Pre-flight validation — fail-closed BEFORE any event is emitted.
// ---------------------------------------------------------------------------

/**
 * Validate the plan and derive the seat map WITHOUT touching the store. Returns
 * the derived seat map (so the caller can reuse it). Throws
 * `OnboardingAbortedError` for any condition that would leave a half-provisioned
 * tenant — this is the fail-closed pre-flight: it runs before step 1 emits.
 *
 * A derivation FINDING (unknown seat type, duplicate role slug, dangling
 * reportsTo) is a hard abort: a tenant must not be onboarded against a roster
 * that does not derive cleanly into a seat map.
 */
export function preflightOnboarding(plan: OnboardingPlan): {
  personas: readonly RosterPersona[];
  seatMap: DerivedSeatMap;
} {
  if (!plan.tenantId.startsWith("tenant:")) {
    throw new OnboardingAbortedError(
      "register-tenant",
      plan.tenantId,
      `tenantId must start with "tenant:" (e.g. "tenant:uk-bank")`,
    );
  }
  if (plan.onboardedAt.trim().length === 0) {
    throw new OnboardingAbortedError(
      "register-tenant",
      plan.tenantId,
      "onboardedAt timestamp is required (v2-core does not read the wall clock)",
    );
  }

  // Derive the seat map (S11). Load the roster if personas were not supplied.
  const personas = plan.rosterPersonas ?? loadRoster(plan.rosterPath);
  if (personas.length === 0) {
    throw new OnboardingAbortedError(
      "derive-and-grant-seats",
      plan.tenantId,
      "roster yielded zero personas — a tenant cannot be provisioned with no functional seats",
    );
  }
  const seatMap = deriveSeatMap(personas, plan.tenantId, plan.onboardedAt);
  if (seatMap.seats.length === 0) {
    throw new OnboardingAbortedError(
      "derive-and-grant-seats",
      plan.tenantId,
      "seat derivation produced no seats",
    );
  }
  if (seatMap.findings.length > 0) {
    const summary = seatMap.findings.map((f) => `${f.subject}: ${f.message}`).join(" | ");
    throw new OnboardingAbortedError(
      "derive-and-grant-seats",
      plan.tenantId,
      `seat derivation produced ${seatMap.findings.length} finding(s) — the roster must derive cleanly: ${summary}`,
    );
  }

  return { personas, seatMap };
}

// ---------------------------------------------------------------------------
// The onboarding flow — provision a tenant by wiring the existing substrate.
// ---------------------------------------------------------------------------

/**
 * Run the onboarding flow against `store`, provisioning the tenant described by
 * `plan`. FAIL-CLOSED: a full pre-flight (`preflightOnboarding`) runs first and
 * throws before ANY event is emitted, so an invalid plan never leaves a
 * half-provisioned tenant.
 *
 * `bindTenantStore` is an OPTIONAL hook the caller uses to wire the tenant's S10
 * per-tenant scoped store. The flow calls it (if supplied) as the binding step
 * and aborts fail-closed if it throws. The default is a no-op (the control-plane
 * store is the cross-tenant authority; the per-tenant store path is an S10
 * concern the caller owns).
 *
 * Idempotency: TenantRegistered re-registration overwrites the projection state
 * but does not duplicate (the seat events are deterministic-id, INSERT OR IGNORE
 * dedupes). Surface/upgrade events are appended each run; re-running an already-
 * onboarded tenant is therefore safe at the projection layer though it adds
 * ledger rows — callers that want strict idempotency should check readiness
 * first (the anchor is already-onboarded and the readiness gate passes without
 * re-provisioning).
 */
export function runOnboarding(
  store: ControlPlaneStore,
  plan: OnboardingPlan,
  bindTenantStore?: (tenantId: string) => void,
): OnboardingResult {
  // ── Fail-closed pre-flight (throws before any emit) ──────────────────────
  const { seatMap } = preflightOnboarding(plan);

  const citations = plan.citations ?? [...DEFAULT_CITATIONS];
  const actor = { type: "service" as const, id: "v2:onboarding-flow" };
  const steps: OnboardingStepResult[] = [];
  let totalEmitted = 0;

  const emit = (event: CpEvent): void => {
    store.append(event);
  };

  // ── Step 1 — REGISTER TENANT (S1) ────────────────────────────────────────
  const registeredPayload = {
    tenantId: plan.tenantId,
    tier: plan.tier,
    displayName: plan.displayName,
    legalEntityRef: plan.legalEntityRef,
    registeredAt: plan.onboardedAt,
  };
  tenantRegisteredPayloadSchema.parse(registeredPayload);
  emit({
    event_id: `tenant-registered:${plan.tenantId}`,
    type: TENANT_REGISTERED,
    as_of: plan.onboardedAt,
    entity: ENTITY,
    actor,
    citations,
    payload: registeredPayload as unknown as Record<string, unknown>,
  });
  totalEmitted += 1;
  steps.push({
    step: "register-tenant",
    eventsEmitted: 1,
    note: `registered ${plan.tenantId} (tier ${plan.tier}, LE ${plan.legalEntityRef})`,
  });

  // ── Bind the per-tenant store (S10) — caller hook, fail-closed ──────────
  if (bindTenantStore) {
    try {
      bindTenantStore(plan.tenantId);
    } catch (err) {
      throw new OnboardingAbortedError(
        "register-tenant",
        plan.tenantId,
        `per-tenant store binding (S10) failed: ${String(err)}`,
      );
    }
  }

  // ── Step 2 — DERIVE + GRANT SEATS (S11) ──────────────────────────────────
  let seatEvents = 0;
  for (const seat of seatMap.seats) {
    emit(makeFunctionalSeatRegisteredEvent(seat));
    seatEvents += 1;
  }
  totalEmitted += seatEvents;
  steps.push({
    step: "derive-and-grant-seats",
    eventsEmitted: seatEvents,
    note: `derived + registered ${seatEvents} tenant-scoped functional seat(s) from the roster`,
  });

  // ── Step 3 — GRANT RELEASED SURFACE per tier (S5/S16) ────────────────────
  const surfacePayload = {
    tenantId: plan.tenantId,
    surfaceVersion: ONBOARDING_SURFACE_VERSION,
    tier: plan.tier,
    grantedAt: plan.onboardedAt,
  };
  tenantSurfaceGrantedPayloadSchema.parse(surfacePayload);
  emit({
    event_id: `tenant-surface-granted:${plan.tenantId}:${ONBOARDING_SURFACE_VERSION}`,
    type: TENANT_SURFACE_GRANTED,
    as_of: plan.onboardedAt,
    entity: ENTITY,
    actor,
    citations,
    payload: surfacePayload as unknown as Record<string, unknown>,
  });
  totalEmitted += 1;
  steps.push({
    step: "grant-released-surface",
    eventsEmitted: 1,
    note: `granted released surface ${ONBOARDING_SURFACE_VERSION} for tier ${plan.tier}`,
  });

  // ── Step 4 — SET FLEET STATE (S14) ───────────────────────────────────────
  const upgradePayload = {
    tenantId: plan.tenantId,
    fromVersion: ONBOARDING_GENESIS_FROM_VERSION,
    toVersion: ONBOARDING_PLATFORM_VERSION,
    appliedAt: plan.onboardedAt,
  };
  tenantUpgradeLedgerEntryPayloadSchema.parse(upgradePayload);
  emit({
    event_id: `tenant-upgrade:${plan.tenantId}:${ONBOARDING_GENESIS_FROM_VERSION}->${ONBOARDING_PLATFORM_VERSION}`,
    type: TENANT_UPGRADE_LEDGER_ENTRY,
    as_of: plan.onboardedAt,
    entity: ENTITY,
    actor,
    citations,
    payload: upgradePayload as unknown as Record<string, unknown>,
  });
  totalEmitted += 1;
  steps.push({
    step: "set-fleet-state",
    eventsEmitted: 1,
    note: `set fleet state: brought onto platform ${ONBOARDING_PLATFORM_VERSION} (status active)`,
  });

  return {
    tenantId: plan.tenantId,
    tier: plan.tier,
    completed: true,
    steps,
    seatMap,
    eventsEmitted: totalEmitted,
  };
}

// ---------------------------------------------------------------------------
// Onboarding-readiness — the independent check the platform gates on.
// ---------------------------------------------------------------------------

/**
 * A tier precondition the readiness gate evaluates. Mirrors the S16
 * `CTierGoLivePrecondition` shape but is supplied by the caller so the readiness
 * assertion stays pure (no import of the S16 module is required to assert; the
 * recon wires the real S16 preconditions in). `satisfied:false` blocks readiness
 * for the gated tier.
 */
export interface OnboardingTierPrecondition {
  readonly key: string;
  readonly satisfied: boolean;
}

/**
 * The folded onboarding state of a single tenant — exactly what the readiness
 * gate reads. Derived from the control-plane projection (the fleet view).
 */
export interface TenantOnboardingState {
  readonly tenantId: string;
  readonly tier: TenantTier;
  /** Whether TenantRegistered landed (the tenant exists in the registry). */
  readonly registered: boolean;
  /** The seat count registered for the tenant (S11). */
  readonly seatCount: number;
  /** The granted surface version, or null (S5). */
  readonly surfaceVersion: string | null;
  /** The platform version from the upgrade ledger, or null (S14). */
  readonly platformVersion: string | null;
}

/**
 * A readiness violation — a reason a tenant is NOT ready.
 */
export interface OnboardingReadinessViolation {
  readonly tenantId: string;
  readonly reason: string;
}

/**
 * The readiness verdict for a single tenant.
 */
export interface OnboardingReadinessVerdict {
  readonly tenantId: string;
  readonly tier: TenantTier;
  readonly ready: boolean;
  readonly violations: readonly OnboardingReadinessViolation[];
}

/**
 * PURE readiness assertion: a tenant is `ready` ONLY when EVERY provisioning
 * step landed AND its tier preconditions are met. The platform can therefore
 * REFUSE an incomplete onboarding.
 *
 *   1. registered            — TenantRegistered landed.
 *   2. seats granted         — at least one functional seat registered (S11).
 *   3. released surface       — a surface version is granted (S5).
 *   4. fleet state set        — a platform version is on the upgrade ledger (S14).
 *   5. tier preconditions met — for a tier with go-live preconditions (e.g. C),
 *      EVERY precondition is satisfied. A C-tier tenant CANNOT be ready while the
 *      S16 C-go-live preconditions (tested second-provider fallback, cross-tenant
 *      CSI gate) are unsatisfied — selling is gated.
 *
 * `tierPreconditions` maps a tier label to its preconditions. K/R tiers
 * typically have none (empty list → no precondition block); the C tier carries
 * the S16 go-live set. A tier absent from the map is treated as having no
 * preconditions.
 *
 * NON-VACUOUS: a synthetic half-provisioned tenant (e.g. registered but no
 * surface grant, or a C-tier tenant with an unsatisfied precondition) yields
 * `ready:false` with the specific violation — the regression test drives exactly
 * that and asserts the refusal.
 */
export function assertOnboardingReadiness(
  state: TenantOnboardingState,
  tierPreconditions: ReadonlyMap<TenantTier, readonly OnboardingTierPrecondition[]>,
): OnboardingReadinessVerdict {
  const violations: OnboardingReadinessViolation[] = [];

  if (!state.registered) {
    violations.push({
      tenantId: state.tenantId,
      reason: "not registered — no TenantRegistered event (step 1 missing)",
    });
  }
  if (state.seatCount <= 0) {
    violations.push({
      tenantId: state.tenantId,
      reason:
        "no functional seats registered — seat derivation/grant did not land (step 2 missing)",
    });
  }
  if (state.surfaceVersion === null) {
    violations.push({
      tenantId: state.tenantId,
      reason: "no released-surface grant — operationally dark (step 3 missing)",
    });
  }
  if (state.platformVersion === null) {
    violations.push({
      tenantId: state.tenantId,
      reason: "no fleet state — no upgrade-ledger entry / platform version (step 4 missing)",
    });
  }

  // Tier preconditions — a tenant on a gated tier cannot be ready while any
  // precondition is unsatisfied (selling is gated).
  const preconditions = tierPreconditions.get(state.tier) ?? [];
  for (const p of preconditions) {
    if (!p.satisfied) {
      violations.push({
        tenantId: state.tenantId,
        reason: `tier-${state.tier} go-live precondition "${p.key}" is unsatisfied — the platform refuses to mark the tenant ready (selling is gated)`,
      });
    }
  }

  return {
    tenantId: state.tenantId,
    tier: state.tier,
    ready: violations.length === 0,
    violations,
  };
}

// ---------------------------------------------------------------------------
// Fold the onboarding state of a tenant from a control-plane store.
// ---------------------------------------------------------------------------

/**
 * Derive the onboarding state of a tenant from the control-plane store. Counts
 * the tenant's registered functional seats by replaying FunctionalSeatRegistered
 * (the seatId embeds the tenantId, so seats are filtered by prefix). Reads
 * registration / surface / platform version from the control-plane projection.
 *
 * Returns `null` when the tenant is not registered at all.
 */
export function foldTenantOnboardingState(
  store: ControlPlaneStore,
  tenantId: string,
): TenantOnboardingState | null {
  const projection = new ControlPlaneProjection(store);
  const tenant = projection.getTenant(tenantId);
  if (tenant === null) return null;

  // Count seats whose key is scoped to this tenant. The seatId is
  // `tenant:<segment>:seat:<slug>` so we match the `<tenantId>:seat:` prefix.
  const seatPrefix = `${tenantId}:seat:`;
  let seatCount = 0;
  for (const ev of store.replay({ type: "FunctionalSeatRegistered" })) {
    const seatIdValue = (ev.payload as { seatId?: unknown }).seatId;
    if (typeof seatIdValue === "string" && seatIdValue.startsWith(seatPrefix)) {
      seatCount += 1;
    }
  }

  return {
    tenantId: tenant.tenantId,
    tier: tenant.tier,
    registered: true,
    seatCount,
    surfaceVersion: tenant.surfaceVersion,
    platformVersion: tenant.platformVersion,
  };
}

/**
 * Convenience: fold a tenant's onboarding state and assert its readiness in one
 * call. Returns `ready:false` with a "not registered" violation when the tenant
 * is absent from the store (the platform refuses to call an unregistered tenant
 * ready).
 */
export function checkTenantReadiness(
  store: ControlPlaneStore,
  tenantId: string,
  tier: TenantTier,
  tierPreconditions: ReadonlyMap<TenantTier, readonly OnboardingTierPrecondition[]>,
): OnboardingReadinessVerdict {
  const state = foldTenantOnboardingState(store, tenantId);
  if (state === null) {
    return {
      tenantId,
      tier,
      ready: false,
      violations: [
        {
          tenantId,
          reason: "not registered — tenant absent from the control-plane store",
        },
      ],
    };
  }
  return assertOnboardingReadiness(state, tierPreconditions);
}

/** The anchor tenant id, re-exported for onboarding call-sites (anchor=ready). */
export const ONBOARDING_ANCHOR_TENANT_ID = ANCHOR_TENANT_ID;
