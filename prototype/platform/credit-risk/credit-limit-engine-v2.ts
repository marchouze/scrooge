// platform/credit-risk/credit-limit-engine-v2.ts
//
// Phase 3d — V2 credit-limit approval engine.
//
// This module provides:
//   1. Dual-run emitters — functions that emit V2 credit-limit approval events
//      alongside V1, stamping tenantId from ANCHOR_TENANT_ID and converting
//      V1 minor-unit integer amounts to MoneyWire.
//   2. Approval-registry reader — reads V2 approval events from the event store
//      and builds the Map<counterpartyId, CreditLimitV2RegistryEntry> shape.
//
// ## Dual-run pattern
//
// The V2 emitters are a thin wrapper over the makeCreditLimit*V2 factories.
// They accept the same arguments as the V1 factories (still using V1 integer
// amounts for backward compat at call sites) plus convert on the fly. Call
// sites that already emit V1 events can add a V2 emit in parallel without
// changing their own API surface.
//
// ## Approval-registry shape
//
// `Map<counterpartyId, CreditLimitV2RegistryEntry>` — the snapshot read by
// pre-deal checks and recon gates. See credit-limit-registry-v2.ts for the
// snapshot-cached projection that builds this map.
//
// ## Why no direct import from v2-core in the payload?
//
// MoneyWire lives in platform/core/money-codec (the V1 decimal-native cutover).
// TenantId lives in v2-core/control-plane/tenant. Platform → v2-core imports
// are allowed (the constraint is v2-core MUST NOT import from platform — not
// the reverse). This file imports both correctly.
//
// Authority: D-V1-REMOVAL-PHASE-3D (CEO-approved 2026-06-15).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Citations:
//   Banks Act 94 of 1990 §73; RRB Regulation 23; LEX Directive D3/2022;
//   BCBS 283; Policies/credit-risk-policy-v1.md; D-V2-CORE-MONEY-DECIMAL-NATIVE.
// Author: Atlas (Substrate Architect, engineering).

import { ANCHOR_TENANT_ID, type TenantId as _TenantId } from "../../v2-core/control-plane/tenant";
import { moneyWireFromMinor } from "../core/money-codec";
import type { MoneyWire } from "../core/money-codec";
import {
  type CreditApprovalAuthority,
  type CreditLimitWithdrawnReason,
  type TenantId,
  makeCreditLimitApprovedV2,
  makeCreditLimitLoadedV2,
  makeCreditLimitWithdrawnV2,
} from "../event-store/event-types/credit-limit";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";

// ANCHOR_TENANT_ID is typed as the literal "tenant:za-bank" (AnchorTenantId), but
// payload schemas that require TenantId (the branded string type) need an explicit
// cast. This is safe: ANCHOR_TENANT_ID passes the tenantIdSchema Zod parse — it is
// a valid TenantId value; the cast only widens the TypeScript type at this boundary.
const ANCHOR_TENANT = ANCHOR_TENANT_ID as _TenantId;

// ---------------------------------------------------------------------------
// CreditLimitV2RegistryEntry — shape of a single counterparty's approval record.
// ---------------------------------------------------------------------------

export interface CreditLimitV2RegistryEntry {
  /** Approved limit (MoneyWire, decimal-native major units). */
  readonly approvedLimit: MoneyWire;
  /** Limit loaded into the risk engine (null until CreditLimitLoadedV2). */
  readonly loadedLimit: MoneyWire | null;
  /**
   * Current utilisation (MoneyWire, null until computed by the LEX engine).
   * This phase only records the approval-registry; utilisation is a
   * downstream computation (LexUtilisationComputed family). Placeholder null.
   */
  readonly currentUtilisation: MoneyWire | null;
  /**
   * Limit lifecycle status:
   *   "active"    — loaded and no withdrawal event observed
   *   "breached"  — a CreditLimitBreached event is live (V1 side; V2 parallel pending)
   *   "withdrawn" — CreditLimitWithdrawnV2 received
   *   null        — approved but not yet loaded
   */
  readonly breachStatus: "active" | "breached" | "withdrawn" | null;
  /** ISO 8601 timestamp of the most recent CreditLimitApprovedV2. */
  readonly approvedAt: string;
  /** Approval-authority level (CRO / CRC / BRC / CEO / Board). */
  readonly approvalAuthority: CreditApprovalAuthority;
  /** ISO 8601 date from which the loaded limit is effective for pre-deal checks. */
  readonly effectiveFrom: string | null;
  /** ISO 8601 expiry date of the approved limit (optional on the approval event). */
  readonly expiryDate: string | null;
  /** Tenant the approval was emitted against. */
  readonly tenantId: TenantId;
}

// ---------------------------------------------------------------------------
// Dual-run emitter arguments.
// ---------------------------------------------------------------------------

/**
 * Arguments for emitting a V2 approval event alongside a V1 approval.
 * Accepts the V1 integer minor-unit `limit` + `currency` to allow call
 * sites to emit V2 without changing their API surface; the emitter
 * converts to MoneyWire internally.
 */
export interface EmitApprovalV2Args {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  /** V1 application ID — passed through to the V2 aggregate label. */
  readonly applicationId: string;
  readonly counterpartyId: string;
  /** V1 minor-unit integer limit. Converted to MoneyWire internally. */
  readonly limitMinor: number;
  /** ISO 4217 currency code (e.g. "ZAR"). */
  readonly currency: string;
  readonly tenor: string;
  readonly approvedBy: string;
  readonly approvalAuthority: CreditApprovalAuthority;
  readonly approvedAt: string;
  readonly conditions: string[];
  readonly expiryDate?: string;
  readonly eventId?: string;
}

export interface EmitLoadedV2Args {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly counterpartyId: string;
  /** V1 minor-unit integer limit. Converted to MoneyWire internally. */
  readonly limitMinor: number;
  /** ISO 4217 currency code. */
  readonly currency: string;
  readonly loadedAt: string;
  readonly effectiveFrom: string;
  readonly loadedBy: string;
  readonly eventId?: string;
}

export interface EmitWithdrawnV2Args {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly counterpartyId: string;
  readonly withdrawnReason: CreditLimitWithdrawnReason;
  readonly withdrawnAt: string;
  readonly withdrawnBy: string;
  readonly eventId?: string;
}

// ---------------------------------------------------------------------------
// Dual-run emitters — emit V2 event into the store alongside V1.
// ---------------------------------------------------------------------------

/**
 * Emit a `CreditLimitApprovedV2` event into `store`.
 *
 * Call this immediately after emitting the corresponding V1
 * `CreditLimitApproved` event. The V2 event carries MoneyWire limit
 * (converted from the V1 minor-unit integer) and the anchor tenantId.
 *
 * Fail-closed: throws synchronously if `store.append` throws.
 */
export function emitCreditLimitApprovedV2(store: EventStore, args: EmitApprovalV2Args): void {
  const limit = moneyWireFromMinor(args.limitMinor, args.currency);
  const event = makeCreditLimitApprovedV2({
    asOf: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: {
      applicationId: args.applicationId,
      counterpartyId: args.counterpartyId,
      limit,
      tenor: args.tenor,
      approvedBy: args.approvedBy,
      approvalAuthority: args.approvalAuthority,
      approvedAt: args.approvedAt,
      conditions: args.conditions,
      // Conditional spread for optional fields — exactOptionalPropertyTypes requires
      // we not pass `undefined` for an optional property.
      ...(args.expiryDate !== undefined ? { expiryDate: args.expiryDate } : {}),
      tenantId: ANCHOR_TENANT,
      schemaVersion: 2,
    },
    ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
  });
  store.append(event);
}

/**
 * Emit a `CreditLimitLoadedV2` event into `store`.
 *
 * Call this immediately after emitting the corresponding V1
 * `CreditLimitLoaded` event.
 *
 * Fail-closed: throws synchronously if `store.append` throws.
 */
export function emitCreditLimitLoadedV2(store: EventStore, args: EmitLoadedV2Args): void {
  const limit = moneyWireFromMinor(args.limitMinor, args.currency);
  const event = makeCreditLimitLoadedV2({
    asOf: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: {
      counterpartyId: args.counterpartyId,
      limit,
      loadedAt: args.loadedAt,
      effectiveFrom: args.effectiveFrom,
      loadedBy: args.loadedBy,
      tenantId: ANCHOR_TENANT,
      schemaVersion: 2,
    },
    ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
  });
  store.append(event);
}

/**
 * Emit a `CreditLimitWithdrawnV2` event into `store`.
 *
 * Call this immediately after emitting the corresponding V1
 * `CreditLimitWithdrawn` event.
 *
 * Fail-closed: throws synchronously if `store.append` throws.
 */
export function emitCreditLimitWithdrawnV2(store: EventStore, args: EmitWithdrawnV2Args): void {
  const event = makeCreditLimitWithdrawnV2({
    asOf: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: {
      counterpartyId: args.counterpartyId,
      withdrawnReason: args.withdrawnReason,
      withdrawnAt: args.withdrawnAt,
      withdrawnBy: args.withdrawnBy,
      tenantId: ANCHOR_TENANT,
      schemaVersion: 2,
    },
    ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
  });
  store.append(event);
}
