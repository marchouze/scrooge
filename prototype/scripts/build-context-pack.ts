// scripts/build-context-pack.ts
//
// Per-seat context pack builder CLI (W8 Slice D).
//
// Usage:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/build-context-pack.ts --seat <seatId> [--as-of YYYY-MM-DD] [--emit] [--json]
//
//   --seat <seatId>    Required. Lowercase seat name (e.g. "mira", "helena").
//   --as-of YYYY-MM-DD Optional. Build as of this date (default: today UTC).
//   --emit             Write ContextPackBuilt event to the canonical event store.
//   --json             Print the full pack as JSON (default: human-readable summary).
//
// Authority: D-W8-PARAMETRIC-TRAINING-POSITION; D-W8-EXAM-GOVERNANCE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.

import { nowUtc } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { makeContextPackBuilt } from "../platform/event-store/event-types/context-pack";
import { buildContextPack, hashPack, packToEventPayload } from "../v2-core/context-pack/builder";
import type { RawEvent } from "../v2-core/context-pack/builder";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function flag(name: string): boolean {
  return args.includes(name);
}

function option(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

const seatId = option("--seat");
if (!seatId) {
  process.stderr.write("[build-context-pack] ERROR: --seat <seatId> is required.\n");
  process.exit(1);
}

const asOf = option("--as-of") ?? nowUtc().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
  process.stderr.write(`[build-context-pack] ERROR: --as-of must be YYYY-MM-DD, got: ${asOf}\n`);
  process.exit(1);
}

const doEmit = flag("--emit");
const doJson = flag("--json");

// ---------------------------------------------------------------------------
// Event store
// ---------------------------------------------------------------------------

const eventDbPath = process.env.BANK_EVENT_DB;
if (!eventDbPath) {
  process.stderr.write("[build-context-pack] ERROR: BANK_EVENT_DB not set.\n");
  process.exit(1);
}

const store = new EventStore(eventDbPath);

// ---------------------------------------------------------------------------
// Load all relevant events
// ---------------------------------------------------------------------------

const RELEVANT_TYPES = [
  "PostureRegistered",
  "ApplicabilityAssessmentRequested",
  "ApplicabilityAssessmentConcluded",
  "DecisionImpactAssessed",
];

const rawEvents: RawEvent[] = [];
for (const type of RELEVANT_TYPES) {
  for (const ev of store.replay({ type })) {
    rawEvents.push(ev as RawEvent);
  }
}

// ---------------------------------------------------------------------------
// Build pack
// ---------------------------------------------------------------------------

const pack = buildContextPack(seatId, rawEvents, asOf);
const packHash = await hashPack(pack);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

if (doJson) {
  console.log(JSON.stringify({ ...pack, packHash }, null, 2));
} else {
  console.log(`\n  Context pack: ${seatId}  (as-of ${asOf})`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  Postures:            ${pack.postures.length}`);
  if (pack.postures.length > 0) {
    for (const p of pack.postures) {
      console.log(`    • ${p.postureId}  [${p.postureClass}]`);
    }
  }
  console.log(`  Applicable oblig.:   ${pack.applicableObligations.length}`);
  console.log(`  Open queue:          ${pack.openQueue.length}`);
  if (pack.openQueue.length > 0) {
    for (const q of pack.openQueue.slice(0, 5)) {
      console.log(`    • ${q.assessmentId}`);
    }
    if (pack.openQueue.length > 5) {
      console.log(`    ... and ${pack.openQueue.length - 5} more`);
    }
  }
  console.log(`  Decision impacts:    ${pack.decisionImpactItems.length}`);
  if (pack.decisionImpactItems.length > 0) {
    for (const d of pack.decisionImpactItems.slice(0, 3)) {
      console.log(`    • ${d.sweepId}  [${d.recommendedActions.join(", ")}]`);
    }
    if (pack.decisionImpactItems.length > 3) {
      console.log(`    ... and ${pack.decisionImpactItems.length - 3} more`);
    }
  }
  console.log(`  Pack hash:           ${packHash.slice(0, 16)}...`);
}

// ---------------------------------------------------------------------------
// Emit ContextPackBuilt event
// ---------------------------------------------------------------------------

if (doEmit) {
  const payload = packToEventPayload(pack, packHash);
  const event = makeContextPackBuilt({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { kind: "agent", id: "agent:mira:context-pack-builder" },
    citations: [
      "D-W8-PARAMETRIC-TRAINING-POSITION",
      "D-W8-EXAM-GOVERNANCE",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
    ],
    payload,
  });
  store.append(event);
  if (!doJson) {
    console.log(`\n  ✓ ContextPackBuilt emitted — event_id: ${event.event_id}`);
    console.log(`    seatId: ${payload.seatId}  packVersion: ${payload.packVersion}\n`);
  } else {
    // Print the event_id to stderr so JSON stdout stays clean.
    process.stderr.write(`[build-context-pack] ContextPackBuilt emitted: ${event.event_id}\n`);
  }
}

store.close();
