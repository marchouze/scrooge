// scripts/backfill-rwa-computed-v2.ts
//
// WS-V2-MIGRATION-BUCKET-A PILOT — RwaComputed → RwaComputedV2 historical
// backfill (idempotent, replay-safe).
//
// ## Why
//
// The Bucket A pilot flips `RwaComputed` to v2-replaced RETIRED-BY-CONSTRUCTION:
// the live emit path (bea-rwa-period-close.ts) now emits `RwaComputedV2`
// (decimal-native MoneyWire). Any historical V1 `RwaComputed` events that
// pre-date the flip must be mirrored to `RwaComputedV2` so the V2 register is
// the complete record (replay-safety). Today there are ZERO live `RwaComputed`
// events in the canonical store (the type was data-empty in the build phase —
// see prototype/docs/bucket-a-money-bearing-nonfinancial-scope.md §6), so this
// backfill is a NO-OP now. It exists so that the moment any historical RWA
// figure lands, the V2 register stays complete without a code change.
//
// ## What this script does (idempotent, replay-safe)
//
//   For every V1 `RwaComputed` event with no V2 counterpart, emit a matching
//   `RwaComputedV2` carrying the four RWA figures as MoneyWire (converted from
//   the V1 minor-unit integer via the shared `moneyWireFromMinor` codec — the
//   lossless exact-integer → decimal-string converter; no float). The V2 event
//   REUSES the source V1 event's provenance tag plus a `bank:v1-source:<id>`
//   idempotency tag, so the V2 event sits in the same provenance scope as its
//   V1 sibling and the parity gate compares like-for-like.
//
// ## Idempotency / replay-safety
//
//   Each backfilled V2 event is tagged `bank:v1-source:<sourceV1EventId>`.
//   Re-running scans for that tag and skips already-mirrored V1 events. The
//   idempotency key is the source V1 event id — deterministic and replay-safe
//   (INSERT OR IGNORE semantics via tag-scan-and-skip). Same shape as
//   scripts/backfill-credit-limit-v2-dual-run.ts.
//
// Run via:  bun run backfill:rwa-computed-v2   (from prototype/)
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-RWA-ENGINE-W2-SLICE-3.
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Citations:
//   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 23 + Reg 28;
//   BCBS Basel III/IV (CRE20, MAR); D-V2-CORE-MONEY-DECIMAL-NATIVE;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../platform/composition";
import { moneyWireFromMinor } from "../platform/core/money-codec";
import { newEventId } from "../platform/core/types";
import {
  type RwaComputedV2Payload,
  makeRwaComputedV2,
} from "../platform/event-store/event-types/regulatory-reporting-v2";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";

/** ISO 4217 currency the RWA figures are denominated in. */
const RWA_CURRENCY = "ZAR" as const;

/** Tag prefix that records the source V1 event id on a backfilled V2 event. */
const V1_SOURCE_TAG_PREFIX = "bank:v1-source:";

/** Backfill actor — Atlas, recording the V2 mirror under the Bucket A pilot. */
const ACTOR = {
  type: "service" as const,
  id: "agent:atlas:platform-architect",
};

// ---------------------------------------------------------------------------
// V1 payload shape (inline — only the fields we fold on).
// ---------------------------------------------------------------------------

interface V1RwaComputed {
  readonly entityId: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly creditRwaMinor: number;
  readonly marketRwaMinor: number;
  readonly operationalRwaMinor: number;
  readonly totalRwaMinor: number;
  readonly source: string;
  readonly operationalRwaIsPlaceholder: boolean;
  readonly sourceEventIds: readonly string[];
  readonly creditExposureCount: number;
  readonly citations: readonly string[];
}

// ---------------------------------------------------------------------------
// Provenance helper — reuse the source V1 event's provenance on the mirror.
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
      `backfill-rwa-computed-v2: source V1 event ${source.event_id} (${source.type}) has no provenance tag — cannot mirror to V2. The canonical store should have soft-tagged all rows. Inspect the store.`,
    );
  }
  const sourceTag = `${V1_SOURCE_TAG_PREFIX}${source.event_id}`;
  const tags = base.tags ? [...base.tags, sourceTag] : [sourceTag];
  return { ...base, tags };
}

/** Collect the set of source-V1 event ids already mirrored to a V2 event. */
function alreadyMirroredV1SourceIds(): Set<string> {
  const ids = new Set<string>();
  for (const e of eventStore.replay({ type: "RwaComputedV2" })) {
    for (const tag of e.provenance?.tags ?? []) {
      if (tag.startsWith(V1_SOURCE_TAG_PREFIX)) {
        ids.add(tag.slice(V1_SOURCE_TAG_PREFIX.length));
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Backfill — mirror every V1 RwaComputed to RwaComputedV2.
// ---------------------------------------------------------------------------

interface BackfillEntry {
  readonly periodId: string;
  readonly sourceV1EventId: string;
  readonly status: "emitted" | "skipped-already-mirrored";
  readonly eventId?: string;
}

function backfillRwaComputedV2(): BackfillEntry[] {
  const log: BackfillEntry[] = [];
  const mirrored = alreadyMirroredV1SourceIds();

  for (const e of eventStore.replay({ type: "RwaComputed" })) {
    const p = e.payload as V1RwaComputed;
    if (mirrored.has(e.event_id)) {
      log.push({
        periodId: p.periodId,
        sourceV1EventId: e.event_id,
        status: "skipped-already-mirrored",
      });
      continue;
    }

    const eventId = newEventId();
    const payload: RwaComputedV2Payload = {
      entityId: p.entityId,
      asOf: p.asOf,
      periodId: p.periodId,
      functionalCurrency: p.functionalCurrency,
      creditRwa: moneyWireFromMinor(p.creditRwaMinor, RWA_CURRENCY),
      marketRwa: moneyWireFromMinor(p.marketRwaMinor, RWA_CURRENCY),
      operationalRwa: moneyWireFromMinor(p.operationalRwaMinor, RWA_CURRENCY),
      totalRwa: moneyWireFromMinor(p.totalRwaMinor, RWA_CURRENCY),
      source: p.source,
      operationalRwaIsPlaceholder: p.operationalRwaIsPlaceholder,
      sourceEventIds: [...p.sourceEventIds],
      creditExposureCount: p.creditExposureCount,
      citations: [...p.citations],
    };
    const v2 = makeRwaComputedV2({
      asOf: e.as_of,
      entity: e.entity,
      actor: ACTOR,
      citations: [...e.citations],
      payload,
      eventId,
    });
    eventStore.append({ ...v2, provenance: v2ProvenanceFromSource(e) });
    log.push({
      periodId: p.periodId,
      sourceV1EventId: e.event_id,
      status: "emitted",
      eventId,
    });
  }

  return log;
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

function main(): void {
  const entries = backfillRwaComputedV2();
  const emitted = entries.filter((m) => m.status === "emitted").length;
  const skipped = entries.filter((m) => m.status === "skipped-already-mirrored").length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "backfill-rwa-computed-v2",
        v2Emitted: emitted,
        v2Skipped: skipped,
        entries,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main();
}

export { backfillRwaComputedV2, main, V1_SOURCE_TAG_PREFIX };
