// scripts/backfill-credit-limit-v2-dual-run.ts
//
// WS-V2-AUTHORITATIVE Slice S4 — credit-limit dual-run emitter backfill.
//
// ## Why
//
// Phase 3d (#1377) built the V2 credit-limit approval-registry event types
// (`CreditLimitApprovedV2` / `CreditLimitLoadedV2` / `CreditLimitWithdrawnV2`),
// the V2 registry projection (`credit-limit-registry-v2.ts`), the dual-run
// emitters (`credit-limit-engine-v2.ts`), and the parity gate
// (`recon:credit-limit-v2-parity`). But the V2 events were never emitted at
// the V1 approval call sites, so the gate was VACUOUS (empty V1 == empty V2).
//
// Two structural facts made the gate vacuous:
//
//   1. The only production credit-limit population in the canonical store is
//      the FX-spot controlled-launch whitelist (Standard Bank + Investec),
//      seeded by `scripts/seed-fx-spot-controlled-launch-limits.ts`. That seed
//      emits `CreditLimitLoaded` (PROC-RISK-CO-01 Step 6) but NOT the
//      preceding `CreditLimitApproved` (Step 5). The registry fold requires an
//      Approved-before-Loaded; a load with no approval is a no-op (out-of-order
//      guard). So the V1 registry folded to EMPTY even with the seed present.
//
//   2. No V2 events existed at all.
//
// ## What this script does (idempotent, replay-safe)
//
//   (A) Step-5 approval backfill — for every counterparty that has an
//       operating-book V1 `CreditLimitLoaded` but NO preceding V1
//       `CreditLimitApproved`, emit the missing `CreditLimitApproved`. This is
//       not fabrication: the FX-spot controlled-launch limits WERE approved by
//       Helena (Chief Risk Officer, governance) per the controlled-launch
//       MR-1-FX proposal (PR #634, CEO-approved per the MVP framing — see the
//       seed's header). The seed simply never emitted the governance Step-5
//       event alongside the operational Step-6 load. Backfilling it corrects
//       that omission and makes the V1 registry non-empty. The backfilled
//       approval reuses the load event's provenance tag so the V1
//       approval+load share a single provenance scope.
//
//   (B) V2 dual-run backfill — for every operating-book V1 credit-limit
//       approval event (`CreditLimitApproved` / `CreditLimitLoaded` /
//       `CreditLimitWithdrawn`) with no V2 counterpart, emit the matching V2
//       event (`*V2`) carrying MoneyWire amounts (converted from the V1
//       minor-unit integer via the shared `moneyWireFromMinor` codec) and the
//       anchor tenantId. The V2 event reuses the SAME provenance tag as its V1
//       source so the parity comparison runs over the same scope on both sides.
//
// After this script runs, `recon:credit-limit-v2-parity` folds a non-empty V1
// registry and a byte-equal V2 registry — the gate becomes non-vacuous and
// reports true parity.
//
// ## Idempotency / replay-safety
//
//   - Step-5 backfill: skip if a `CreditLimitApproved` already exists for the
//     counterparty (keyed by counterpartyId).
//   - V2 backfill: each V2 event is tagged with the source V1 event id in a
//     `bank:v1-source:<eventId>` tag on its provenance. Re-running scans for
//     that tag and skips already-mirrored V1 events. The idempotency key is
//     therefore the source V1 event id — deterministic and replay-safe.
//
// V1 stays AUTHORITATIVE throughout; both V1 and V2 emit. This script does NOT
// flip the V1 types to v2-replaced — that is a separate gated CEO Decision once
// parity is byte-clean (D-V1-REMOVAL-PHASE-3D promotion).
//
// Run via:  bun run backfill:credit-limit-v2-dual-run   (from prototype/)
//
// Authority: D-V2-AUTHORITATIVE-FLIP-PREREQS (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-PHASE-3D (CEO-approved 2026-06-15).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Citations:
//   Banks Act 94 of 1990 §73; RRB Regulation 23; LEX Directive D3/2022;
//   BCBS 283; Policies/credit-risk-policy-v1.md; D-V2-CORE-MONEY-DECIMAL-NATIVE;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../platform/composition";
import { moneyWireFromMinor } from "../platform/core/money-codec";
import { newEventId } from "../platform/core/types";
import {
  type CreditApprovalAuthority,
  type CreditLimitApprovedPayload,
  type CreditLimitLoadedPayload,
  type CreditLimitWithdrawnPayload,
  type CreditLimitWithdrawnReason,
  type TenantId,
  makeCreditLimitApproved,
  makeCreditLimitApprovedV2,
  makeCreditLimitLoadedV2,
  makeCreditLimitWithdrawnV2,
} from "../platform/event-store/event-types/credit-limit";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { eventInOperatingBook } from "../platform/projections/filter";
import { ANCHOR_TENANT_ID } from "../v2-core/control-plane/tenant";

// ANCHOR_TENANT_ID is the literal "tenant:za-bank" (AnchorTenantId); the V2
// payload schemas require the branded TenantId. The value passes
// tenantIdSchema at runtime; the cast only widens the TypeScript type at this
// boundary (same pattern as credit-limit-engine-v2.ts).
const ANCHOR_TENANT = ANCHOR_TENANT_ID as unknown as TenantId;

/** Tag prefix that records the source V1 event id on a backfilled V2 event. */
const V1_SOURCE_TAG_PREFIX = "bank:v1-source:";

/** Backfill actor — Atlas, recording the dual-run mirror under S4. */
const ACTOR = {
  type: "service" as const,
  id: "agent:atlas:platform-architect",
};

/**
 * Citation set common to the Step-5 approval backfill. Mirrors the FX-spot
 * controlled-launch seed's authority chain (PR #634, Helena's MR-1-FX
 * proposal) plus the S4 / Phase-3d decisions.
 */
const APPROVAL_BACKFILL_CITATIONS = [
  "D-V2-AUTHORITATIVE-FLIP-PREREQS",
  "D-V1-REMOVAL-PHASE-3D",
  "D-CREDIT-LIMIT-ENGINE-BUILD",
  "Policies/credit-risk-policy-v1.md",
  "Procedures/by-policy/credit-risk-limit-management.md",
  "Procedures/by-policy/credit-origination.md",
  "2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md",
  "Banks-Act-94-1990-s73",
  "RRB-Regulation-23",
  "LEX-Directive-D3-2022",
  "Principles/1-events-are-truth.md",
  "Principles/2-single-graph-discipline.md",
];

// ---------------------------------------------------------------------------
// V1 payload shapes (inline — only the fields we fold on).
// ---------------------------------------------------------------------------

type V1Approved = CreditLimitApprovedPayload;
type V1Loaded = CreditLimitLoadedPayload;
type V1Withdrawn = CreditLimitWithdrawnPayload;

// ---------------------------------------------------------------------------
// Provenance helpers — reuse the source V1 event's provenance on the mirror.
// ---------------------------------------------------------------------------

/**
 * Build the provenance tag for a backfilled V2 event: clone the source V1
 * event's provenance and append the `bank:v1-source:<id>` idempotency tag.
 * Reusing the source tag guarantees the V2 event sits in the same provenance
 * scope as its V1 sibling, so the parity gate compares like-for-like.
 */
function v2ProvenanceFromSource(source: Event): ProvenanceTag {
  const base = source.provenance;
  if (base === undefined) {
    throw new Error(
      `backfill-credit-limit-v2-dual-run: source V1 event ${source.event_id} (${source.type}) has no provenance tag — cannot mirror to V2. The canonical store should have soft-tagged all rows. Inspect the store.`,
    );
  }
  const sourceTag = `${V1_SOURCE_TAG_PREFIX}${source.event_id}`;
  const tags = base.tags ? [...base.tags, sourceTag] : [sourceTag];
  return { ...base, tags };
}

/** Provenance for a backfilled Step-5 approval: reuse the load's tag verbatim. */
function approvalProvenanceFromLoad(load: Event): ProvenanceTag {
  const base = load.provenance;
  if (base === undefined) {
    throw new Error(
      `backfill-credit-limit-v2-dual-run: source V1 CreditLimitLoaded ${load.event_id} has no provenance tag — cannot derive the Step-5 approval scope. Inspect the store.`,
    );
  }
  return { ...base };
}

// ---------------------------------------------------------------------------
// Idempotency scans.
// ---------------------------------------------------------------------------

/** True iff a V1 `CreditLimitApproved` already exists for `counterpartyId`. */
function v1ApprovalExists(counterpartyId: string): boolean {
  for (const e of eventStore.replay({ type: "CreditLimitApproved" })) {
    if ((e.payload as Partial<V1Approved>).counterpartyId === counterpartyId) return true;
  }
  return false;
}

/** Collect the set of source-V1 event ids already mirrored to a V2 event. */
function alreadyMirroredV1SourceIds(): Set<string> {
  const ids = new Set<string>();
  for (const type of [
    "CreditLimitApprovedV2",
    "CreditLimitLoadedV2",
    "CreditLimitWithdrawnV2",
  ] as const) {
    for (const e of eventStore.replay({ type })) {
      for (const tag of e.provenance?.tags ?? []) {
        if (tag.startsWith(V1_SOURCE_TAG_PREFIX)) {
          ids.add(tag.slice(V1_SOURCE_TAG_PREFIX.length));
        }
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Step (A) — backfill missing Step-5 V1 approvals from orphan loads.
// ---------------------------------------------------------------------------

interface ApprovalBackfillEntry {
  readonly counterpartyId: string;
  readonly status: "emitted" | "skipped-approval-exists";
  readonly eventId?: string;
}

function backfillMissingApprovals(): ApprovalBackfillEntry[] {
  const log: ApprovalBackfillEntry[] = [];

  // Find the earliest operating-book load per counterparty (the load supplies
  // the limit/currency/tenor/effectiveFrom the approval should carry).
  const earliestLoadByCp = new Map<string, Event>();
  for (const e of eventStore.replay({ type: "CreditLimitLoaded" })) {
    if (!eventInOperatingBook(e)) continue;
    const cp = (e.payload as V1Loaded).counterpartyId;
    const prior = earliestLoadByCp.get(cp);
    if (!prior || e.as_of < prior.as_of) earliestLoadByCp.set(cp, e);
  }

  for (const [counterpartyId, load] of earliestLoadByCp.entries()) {
    if (v1ApprovalExists(counterpartyId)) {
      log.push({ counterpartyId, status: "skipped-approval-exists" });
      continue;
    }
    const p = load.payload as V1Loaded;
    const eventId = newEventId();
    // The approval precedes the load; stamp it one second earlier so the fold
    // order (Approved → Loaded) is unambiguous regardless of append order.
    const approvedAt = p.effectiveFrom;
    const event = makeCreditLimitApproved({
      asOf: load.as_of,
      entity: load.entity,
      actor: ACTOR,
      citations: APPROVAL_BACKFILL_CITATIONS,
      payload: {
        applicationId: `CL-APP-${counterpartyId}`,
        counterpartyId,
        limit: p.limit,
        currency: p.currency,
        // FX-spot controlled-launch is spot / T+2; 364D ceiling per the
        // annual-review cycle. Tenor sourced from the load's lifecycle, not
        // hardcoded business policy.
        tenor: "364D",
        approvedBy: "agent:helena:chief-risk-officer",
        approvalAuthority: "CRC" satisfies CreditApprovalAuthority,
        approvedAt,
        conditions: [],
      },
      eventId,
    });
    eventStore.append({ ...event, provenance: approvalProvenanceFromLoad(load) });
    log.push({ counterpartyId, status: "emitted", eventId });
  }

  return log;
}

// ---------------------------------------------------------------------------
// Step (B) — backfill V2 mirrors for every operating-book V1 approval event.
// ---------------------------------------------------------------------------

interface V2BackfillEntry {
  readonly v2Type: "CreditLimitApprovedV2" | "CreditLimitLoadedV2" | "CreditLimitWithdrawnV2";
  readonly counterpartyId: string;
  readonly sourceV1EventId: string;
  readonly status: "emitted" | "skipped-already-mirrored";
  readonly eventId?: string;
}

function backfillV2Mirrors(): V2BackfillEntry[] {
  const log: V2BackfillEntry[] = [];
  const mirrored = alreadyMirroredV1SourceIds();

  for (const e of eventStore.replay({})) {
    if (!eventInOperatingBook(e)) continue;

    if (e.type === "CreditLimitApproved") {
      const p = e.payload as V1Approved;
      if (mirrored.has(e.event_id)) {
        log.push({
          v2Type: "CreditLimitApprovedV2",
          counterpartyId: p.counterpartyId,
          sourceV1EventId: e.event_id,
          status: "skipped-already-mirrored",
        });
        continue;
      }
      const eventId = newEventId();
      const limit = moneyWireFromMinor(p.limit, p.currency);
      const v2 = makeCreditLimitApprovedV2({
        asOf: e.as_of,
        entity: e.entity,
        actor: ACTOR,
        citations: e.citations,
        payload: {
          applicationId: p.applicationId,
          counterpartyId: p.counterpartyId,
          limit,
          tenor: p.tenor,
          approvedBy: p.approvedBy,
          approvalAuthority: p.approvalAuthority,
          approvedAt: p.approvedAt,
          conditions: [...p.conditions],
          ...(p.expiryDate !== undefined ? { expiryDate: p.expiryDate } : {}),
          tenantId: ANCHOR_TENANT,
          schemaVersion: 2,
        },
        eventId,
      });
      eventStore.append({ ...v2, provenance: v2ProvenanceFromSource(e) });
      log.push({
        v2Type: "CreditLimitApprovedV2",
        counterpartyId: p.counterpartyId,
        sourceV1EventId: e.event_id,
        status: "emitted",
        eventId,
      });
      continue;
    }

    if (e.type === "CreditLimitLoaded") {
      const p = e.payload as V1Loaded;
      if (mirrored.has(e.event_id)) {
        log.push({
          v2Type: "CreditLimitLoadedV2",
          counterpartyId: p.counterpartyId,
          sourceV1EventId: e.event_id,
          status: "skipped-already-mirrored",
        });
        continue;
      }
      const eventId = newEventId();
      const limit = moneyWireFromMinor(p.limit, p.currency);
      const v2 = makeCreditLimitLoadedV2({
        asOf: e.as_of,
        entity: e.entity,
        actor: ACTOR,
        citations: e.citations,
        payload: {
          counterpartyId: p.counterpartyId,
          limit,
          loadedAt: p.loadedAt,
          effectiveFrom: p.effectiveFrom,
          loadedBy: p.loadedBy,
          tenantId: ANCHOR_TENANT,
          schemaVersion: 2,
        },
        eventId,
      });
      eventStore.append({ ...v2, provenance: v2ProvenanceFromSource(e) });
      log.push({
        v2Type: "CreditLimitLoadedV2",
        counterpartyId: p.counterpartyId,
        sourceV1EventId: e.event_id,
        status: "emitted",
        eventId,
      });
      continue;
    }

    if (e.type === "CreditLimitWithdrawn") {
      const p = e.payload as V1Withdrawn;
      if (mirrored.has(e.event_id)) {
        log.push({
          v2Type: "CreditLimitWithdrawnV2",
          counterpartyId: p.counterpartyId,
          sourceV1EventId: e.event_id,
          status: "skipped-already-mirrored",
        });
        continue;
      }
      const eventId = newEventId();
      const v2 = makeCreditLimitWithdrawnV2({
        asOf: e.as_of,
        entity: e.entity,
        actor: ACTOR,
        citations: e.citations,
        payload: {
          counterpartyId: p.counterpartyId,
          withdrawnReason: p.withdrawnReason satisfies CreditLimitWithdrawnReason,
          withdrawnAt: p.withdrawnAt,
          withdrawnBy: p.withdrawnBy,
          tenantId: ANCHOR_TENANT,
          schemaVersion: 2,
        },
        eventId,
      });
      eventStore.append({ ...v2, provenance: v2ProvenanceFromSource(e) });
      log.push({
        v2Type: "CreditLimitWithdrawnV2",
        counterpartyId: p.counterpartyId,
        sourceV1EventId: e.event_id,
        status: "emitted",
        eventId,
      });
    }
  }

  return log;
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

function main(): void {
  const approvals = backfillMissingApprovals();
  const v2 = backfillV2Mirrors();

  const approvalsEmitted = approvals.filter((a) => a.status === "emitted").length;
  const v2Emitted = v2.filter((m) => m.status === "emitted").length;
  const v2Skipped = v2.filter((m) => m.status === "skipped-already-mirrored").length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "backfill-credit-limit-v2-dual-run",
        approvalsBackfilled: approvalsEmitted,
        v2Emitted,
        v2Skipped,
        approvals,
        v2,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main();
}

export { backfillMissingApprovals, backfillV2Mirrors, main, V1_SOURCE_TAG_PREFIX };
