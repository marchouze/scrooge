// prototype/scripts/assign-bcbs-obligation-owners.ts
//
// One-off owner-assignment pass for the graph-imported BCBS obligations
// (D-OBLIGATIONS-REGISTER-CLEANUP · P3 follow-on, WS-OBLIGATIONS-CLEANUP).
//
// The BCBS obligations are NOT in `Regulations/_obligations.seed.json` (they are
// adopted from the knowledge base, derived from the imported BCBS obligation
// graphs), so they cannot be fixed through the seed-backfill path PR #1139 used
// for the 417 SA rows. Originally their `ObligationAdopted` events carried an
// empty `owner`, and this script corrected them at the EVENT level: replay
// `ObligationAdopted` from the shared store, take latest-per-id, filter to the
// `^BCBS-` set with empty owner, and emit one corrected later-dated
// `ObligationAdopted` per affected id that preserves every other field and fills
// `owner` by Basel family.
//
// ROOT-CAUSE FIX (Atlas, follow-on to this script's PR #1143): the empty `owner`
// was stamped by the LIVE adopt path — the `/api/obligations/adopt` knowledge-
// base branch in `dashboard/server.ts` — which set `owner: ""` at wall-clock-now.
// Because that wins the `as_of` fold, every fresh adopt silently reverted this
// script's backfill. The emit path now stamps `owner` at emit time from the SAME
// shared map this script consumes (`platform/regulatory/basel-family-seat.ts`),
// so the two can never drift and THIS SCRIPT IS NOW A PERMANENT NO-OP. It is
// retained for one-off repair of any historical empty-owner rows.
//
// Owner is assigned with the SAME seat vocabulary PR #1139 used
// (cco|cfo|cro|company-secretary|operational|head-of-global-markets|…). No new
// seats are invented; a family that does not fit leaves owner empty and is
// reported. The projection's replace-on-re-adopt semantics (later `as_of` wins,
// `buildBankObligations` folds by `as_of`, ties keep replay order) carry the
// correction.
//
// Fold-race safety: each correction is stamped strictly LATER than the latest
// existing `as_of` for that id (max + 1s), which deterministically wins the
// `as_of` fold. With the emit path now owner-aware there is no further empty-
// owner re-emit to race; the stamping is retained for robustness.
//
// Idempotent: an id whose latest payload already carries the correct owner is
// skipped, so a second run is a no-op. The seed JSON and the 417 SA rows are NOT
// touched (recon:obligations-seed-parity stays green) — this is owner-only and
// leaves fulfilmentPolicy / requirement / urn / domain as-is.
//
// Run from prototype/ against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/assign-bcbs-obligation-owners.ts
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/assign-bcbs-obligation-owners.ts --write
//
// Default is a dry-run report; --write emits the corrected events.
//
// Author: Mira (Compliance / RegTech engineer, engineering);
//   root-cause fix by Atlas (Core banking platform architect, engineering).

import { eventStore } from "../platform/composition";
import { makeObligationAdopted } from "../platform/event-store/event-types/obligation-lifecycle";
import type { ObligationAdoptedPayload } from "../platform/event-store/event-types/obligation-lifecycle";
import type { Actor } from "../platform/event-store/types";
import { baselFamilyOf, seatForBcbsObligationId } from "../platform/regulatory/basel-family-seat";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:mira:bcbs-obligation-owners" };
const CITATIONS = [
  "D-OBLIGATIONS-REGISTER-CLEANUP",
  "WS-OBLIGATIONS-CLEANUP",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

// The Basel family → accountable-seat map and the id→family extractor now live
// in the shared single-source-of-truth module
// `platform/regulatory/basel-family-seat.ts`, consumed BOTH here and by the live
// emit path (dashboard /api/obligations/adopt). Keeping them in one place is the
// root-cause fix: the emit path stamps owner from this same map, so this script
// is now a permanent no-op rather than a recurring backfill of empty-owner rows.

/** Is this a graph-imported BCBS obligation (id `^BCBS-` or urn containing bcbs)? */
function isBcbsImport(p: ObligationAdoptedPayload): boolean {
  return /^BCBS-/i.test(p.obligationId) || /bcbs/i.test(p.urn ?? "");
}

interface LatestAdopted {
  /** The in-force payload (last by `as_of`, ties by replay order). */
  payload: ObligationAdoptedPayload;
  /** Max `as_of` seen for this id, across every event (used to win the fold). */
  maxAsOf: string;
}

/**
 * Latest adopted payload + max `as_of` per obligation id, folded by `as_of`
 * (ties keep replay order — the same fold `buildBankObligations` uses).
 */
function latestAdoptedById(): Map<string, LatestAdopted> {
  const events = [...eventStore.replay({ type: "ObligationAdopted" })].sort((a, b) =>
    a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0,
  );
  const byId = new Map<string, LatestAdopted>();
  for (const ev of events) {
    const p = ev.payload as ObligationAdoptedPayload;
    if (!p.obligationId) continue;
    const prev = byId.get(p.obligationId);
    const maxAsOf = prev && prev.maxAsOf > ev.as_of ? prev.maxAsOf : ev.as_of;
    // Ascending sort means each later iteration carries the in-force payload.
    byId.set(p.obligationId, { payload: p, maxAsOf });
  }
  return byId;
}

/** ISO timestamp one second later than `iso` — strictly wins the `as_of` fold. */
function oneSecondAfter(iso: string): string {
  return new Date(new Date(iso).getTime() + 1000).toISOString();
}

function main(): void {
  const write = process.argv.includes("--write");
  const latest = latestAdoptedById();

  const bcbs = [...latest.values()].filter((l) => isBcbsImport(l.payload));
  const emptyOwner = bcbs.filter((l) => !(l.payload.owner ?? "").trim());

  let emitted = 0;
  const unfit: Array<{ id: string; family: string }> = [];
  const assigned: Array<{ id: string; family: string; seat: string }> = [];

  for (const { payload: current, maxAsOf } of emptyOwner) {
    const family = baselFamilyOf(current.obligationId);
    const seat = seatForBcbsObligationId(current.obligationId);
    if (!seat) {
      unfit.push({ id: current.obligationId, family: family || "(none)" });
      continue;
    }

    // Idempotency: skip if the in-force payload already carries the right owner.
    // (The empty-owner filter already guarantees a change is needed, but this
    //  keeps the guard explicit so a re-run after a partial write is a no-op.)
    if ((current.owner ?? "").trim() === seat) continue;

    // Stamp strictly later than the latest existing event for this id so the
    // correction deterministically wins the `as_of` fold even if the live BCBS
    // graph-import re-emitted an empty-owner row after us.
    const correctionAt = oneSecondAfter(maxAsOf);
    const payload: ObligationAdoptedPayload = {
      ...current,
      owner: seat,
      adoptedAt: correctionAt,
    };

    if (write) {
      eventStore.append(
        makeObligationAdopted({
          asOf: correctionAt,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload,
        }),
      );
    }
    emitted++;
    assigned.push({ id: current.obligationId, family, seat });
  }

  // Report.
  console.log("assign-bcbs-obligation-owners —", write ? "WRITE" : "dry-run");
  console.log(`  BCBS-imported ObligationAdopted ids: ${bcbs.length}`);
  console.log(`  with empty owner (before): ${emptyOwner.length}`);
  console.log(`  corrected ObligationAdopted ${write ? "emitted" : "would emit"}: ${emitted}`);
  console.log(`  left unowned (no fitting seat): ${unfit.length}`);

  const byFamily = new Map<string, { seat: string; count: number }>();
  for (const a of assigned) {
    const e = byFamily.get(a.family) ?? { seat: a.seat, count: 0 };
    e.count++;
    byFamily.set(a.family, e);
  }
  console.log("  --- family → seat assignments ---");
  for (const [fam, e] of [...byFamily.entries()].sort()) {
    console.log(`    ${fam} → ${e.seat}  (${e.count})`);
  }
  if (unfit.length > 0) {
    console.log("  --- left unowned (report) ---");
    for (const u of unfit) console.log(`    ${u.id} :: family=${u.family}`);
  }
}

main();
