// prototype/scripts/backfill-obligations.ts
//
// Backfill the bank-obligation register into events (Plane B,
// D-REGULATORY-ARCHITECTURE-TWO-PLANE). Reads the canonical authored origin
// Regulations/_obligations.seed.json and emits one ObligationAdopted event per
// row whose payload is not yet the latest adopted state. Idempotent: re-running
// emits nothing once every row's latest ObligationAdopted matches the seed.
//
// Correction mechanism (D-OBLIGATIONS-REGISTER-CLEANUP): a field correction in
// the seed (URN, owner, domain, …) flows through THIS single pipeline as a
// later-dated ObligationAdopted. `buildBankObligations` folds by `as_of` and
// replaces the whole record, so the correction wins. There is no competing
// emitter script — the skip logic is payload-aware: skip only when the ID is
// already adopted AND its latest payload matches the seed row.
//
// Wired into `ci:migrate` so the event-sourced obligation register is
// deterministically reconstructable in CI. The seed JSON is the authored origin;
// the legacy markdown register is a parity-checked render (recon:obligations-
// seed-parity).
//
// Run from prototype/ against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/backfill-obligations.ts
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../platform/composition";
import { makeObligationAdopted } from "../platform/event-store/event-types/obligation-lifecycle";
import type { ObligationAdoptedPayload } from "../platform/event-store/event-types/obligation-lifecycle";
import type { Actor } from "../platform/event-store/types";

/** A row of the committed obligations seed (the canonical authored origin). */
interface SeedRow {
  id: string;
  urn?: string;
  citation?: string;
  requirement?: string;
  fulfilmentPolicy?: string;
  owner?: string;
  reviewStatus?: string;
  section?: string;
  /** Clean A..J domain letter (D-OBLIGATIONS-REGISTER-CLEANUP P3); falls back to `section`. */
  domain?: string;
}

const SEED_PATH = resolve(import.meta.dir, "../../Regulations/_obligations.seed.json");
const ADOPTED_AT = "2026-06-04T00:00:00Z"; // deterministic original backfill stamp
// Later-dated stamp for corrected re-emits (D-OBLIGATIONS-REGISTER-CLEANUP P2/P3).
// `buildBankObligations` folds by `as_of`, so a correction must post strictly
// after the original backfill to win the fold.
const CORRECTION_AT = "2026-06-09T00:00:00Z";
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:mira:obligations-backfill" };
const CITATIONS = [
  "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
  "D-OBLIGATIONS-REGISTER-CLEANUP",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

/** Build the desired ObligationAdopted payload for a seed row. */
function payloadForRow(row: SeedRow): ObligationAdoptedPayload {
  return {
    obligationId: row.id,
    urn: row.urn ?? "",
    domain: row.domain ?? row.section ?? "",
    citation: row.citation ?? "",
    requirement: row.requirement ?? "",
    fulfilmentPolicy: row.fulfilmentPolicy ?? "",
    owner: row.owner ?? "",
    status: row.reviewStatus || "legacy-unreviewed",
    adoptedAt: ADOPTED_AT,
  };
}

/**
 * Latest adopted payload per obligation id, folded by `as_of` (ties keep
 * replay order — the same fold `buildBankObligations` uses). The returned
 * payload is the record currently in force.
 */
function latestAdoptedById(): Map<string, ObligationAdoptedPayload> {
  const events = [...eventStore.replay({ type: "ObligationAdopted" })].sort((a, b) =>
    a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0,
  );
  const byId = new Map<string, ObligationAdoptedPayload>();
  for (const ev of events) {
    const p = ev.payload as ObligationAdoptedPayload;
    if (p.obligationId) byId.set(p.obligationId, p);
  }
  return byId;
}

/**
 * Identity-field comparison: the fields the cleanup corrects (urn/domain/owner)
 * plus the substantive content fields. `adoptedAt` is excluded — it is a
 * backfill-stamp artefact, not a register field, so it must not trigger a
 * spurious re-emit on an otherwise-identical row.
 */
function payloadMatches(a: ObligationAdoptedPayload, b: ObligationAdoptedPayload): boolean {
  return (
    a.urn === b.urn &&
    a.domain === b.domain &&
    a.citation === b.citation &&
    a.requirement === b.requirement &&
    a.fulfilmentPolicy === b.fulfilmentPolicy &&
    a.owner === b.owner &&
    a.status === b.status
  );
}

function main(): void {
  const rows = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedRow[];
  const latest = latestAdoptedById();

  let emitted = 0;
  let corrected = 0;
  for (const row of rows) {
    const desired = payloadForRow(row);
    const current = latest.get(row.id);

    // Skip only when the ID is already adopted AND its latest payload matches
    // the seed row (payload-aware idempotency — the replay-safety change).
    if (current && payloadMatches(current, desired)) continue;

    // First adoption uses the original stamp; a correction of an already-adopted
    // row posts a later-dated event so the fold replaces the prior record.
    const isCorrection = current !== undefined;
    const payload: ObligationAdoptedPayload = isCorrection
      ? { ...desired, adoptedAt: CORRECTION_AT }
      : desired;

    eventStore.append(
      makeObligationAdopted({
        asOf: isCorrection ? CORRECTION_AT : ADOPTED_AT,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload,
      }),
    );
    emitted++;
    if (isCorrection) corrected++;
  }

  console.log(
    `backfill:obligations — ${rows.length} register row(s); ${emitted} ObligationAdopted emitted (${corrected} correction(s), ${emitted - corrected} new), ${rows.length - emitted} already in force.`,
  );
}

main();
