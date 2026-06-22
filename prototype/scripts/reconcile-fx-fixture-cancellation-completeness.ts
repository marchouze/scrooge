// scripts/reconcile-fx-fixture-cancellation-completeness.ts
//
// Idempotent, replay-safe data reconciliation — append a `cancelled`
// FilInstrumentTerminated for every FX FIL instance whose materialised
// settlement-cash sub-instances were cancelled in the prior provenance
// remediation but whose OWN FX leg was left with only a `settled` zero-memo
// termination (so its opening position still stands in the V2 trial balance).
//
// ─── WHY THIS GAP EXISTS ──────────────────────────────────────────────────────
//
// "A cancel must undo what WAS done" (D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN,
// CEO-approved 2026-06-22; CEO: leave the FX book empty). A prior remediation
// cancelled the FX fixture trades. For the two SETTLED fixture trades
// (`*-USD-SETTLED-001`) it cancelled their materialised cash sub-instances
// (`-cash-received` / `-cash-paid`) but NOT the FX instance itself, which kept its
// 2026-06-03 `settled` termination. A `settled` bare terminal posts only the
// PR-FX-CLOSE-V2 zero memo, so the FX opening recognition legs persist — leaving
// the cancelled trade's position standing in the GL.
//
// The fold reverses BARE CANCELLATIONS (PR-FX-CANCEL-REVERSAL-V2). This script
// makes the data tell the truth: the whole trade was backed out, so the FX leg
// carries a `cancelled` termination too. The fold then nets it to zero.
//
// ─── APPROACH ────────────────────────────────────────────────────────────────
//
//   1. Replay FilInstrumentCreated → index FX instances (type starts fil:type:fx:).
//   2. Replay FilInstrumentTerminated → for each FX instance, record its terminal
//      stages AND whether its materialised cash sub-instances (`<instance>-cash-*`)
//      were cancelled.
//   3. For every FX instance that (a) has NO `cancelled` termination of its own AND
//      (b) whose cash sub-instances WERE cancelled, append a bare `cancelled`
//      FilInstrumentTerminated. The `type`, `tenant`, `originatingEvent` are SOURCED
//      verbatim from the instance's own created event — never synthesised.
//   4. Provenance: build-phase-fixture, variant `ceo-leave-empty`, sourceLineage
//      `fx-fixture-cancellation-completeness` — matching the prior backout's intent.
//
// IDEMPOTENT: re-running emits nothing (every target already has a `cancelled`
// termination). APPEND-ONLY: no event is mutated or deleted (Principle 1).
//
// ─── AUTHORITY ────────────────────────────────────────────────────────────────
//
//   D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN — "a cancel must undo what WAS done"
//   Principle 1 — events are the only source of truth (append-only)
//
// Author: Atlas (Core banking platform architect, engineering)
//
// Run with:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/reconcile-fx-fixture-cancellation-completeness.ts
// The BANK_EVENT_DB env var must point at the shared store the dashboard reads.

import { eventStore } from "../platform/composition";
import type { Actor } from "../platform/core/types";
import { makeFilInstrumentTerminated } from "../platform/event-store/event-types/fil-instances";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { filInstrumentTerminatedPayloadSchema } from "../v2-core/fil-instances/events";

const ACTOR: Actor = { type: "system", id: "atlas:fx-cancellation-completeness" };
const CITES = ["D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN"];
const FX_TYPE_PREFIX = "fil:type:fx:";
const PROVENANCE = buildPhaseFixtureTag({
  sourceLineage: "fx-fixture-cancellation-completeness",
  variant: "ceo-leave-empty",
});

interface CreatedFacts {
  readonly type: string;
  readonly tenant: string;
  readonly originatingEvent: { eventType: string; eventId: string };
}

function main(): void {
  // (1) Index FX created instances → their sourced facts.
  const fxCreated = new Map<string, CreatedFacts>();
  for (const e of eventStore.replay({ type: "FilInstrumentCreated" })) {
    const p = e.payload as {
      instance?: string;
      type?: string;
      tenant?: string;
      originatingEvent?: { eventType: string; eventId: string };
    };
    if (p.instance === undefined || p.type === undefined || !p.type.startsWith(FX_TYPE_PREFIX)) {
      continue;
    }
    if (p.tenant === undefined || p.originatingEvent === undefined) continue;
    fxCreated.set(p.instance, {
      type: p.type,
      tenant: p.tenant,
      originatingEvent: p.originatingEvent,
    });
  }

  // (2) Per-instance terminal stages (across the FULL terminated stream).
  const stagesByInstance = new Map<string, Set<string>>();
  for (const e of eventStore.replay({ type: "FilInstrumentTerminated" })) {
    const p = e.payload as { instance?: string; terminalStage?: string };
    if (p.instance === undefined || p.terminalStage === undefined) continue;
    const set = stagesByInstance.get(p.instance) ?? new Set<string>();
    set.add(p.terminalStage);
    stagesByInstance.set(p.instance, set);
  }

  // (3) Targets: an FX instance with NO `cancelled` of its own whose cash
  //     sub-instances WERE cancelled (so the whole trade was being backed out).
  const emitted: string[] = [];
  const skipped: string[] = [];
  for (const [instance, facts] of fxCreated) {
    const ownStages = stagesByInstance.get(instance) ?? new Set<string>();
    if (ownStages.has("cancelled")) {
      skipped.push(`${instance} (already cancelled)`);
      continue;
    }
    // Cash sub-instances materialised by this FX trade carry the instance id as a
    // prefix (`<instance>-cash-received` / `-cash-paid`). A cancelled cash leg is
    // the signal the whole trade was backed out.
    let cashCancelled = false;
    for (const [other, stages] of stagesByInstance) {
      if (other.startsWith(`${instance}-cash`) && stages.has("cancelled")) {
        cashCancelled = true;
        break;
      }
    }
    if (!cashCancelled) {
      skipped.push(`${instance} (no cancelled cash leg — not a backed-out trade)`);
      continue;
    }

    const asOf = "2026-06-22T16:05:40.650Z"; // align with the prior backout batch
    const event = makeFilInstrumentTerminated({
      asOf,
      entity: facts.tenant,
      actor: ACTOR,
      citations: CITES,
      payload: filInstrumentTerminatedPayloadSchema.parse({
        kind: "FilInstrumentTerminated",
        instance,
        type: facts.type,
        tenant: facts.tenant,
        asOf,
        originatingEvent: {
          eventType: "FxFixtureCancellationCompleteness",
          eventId: `completeness:cancel:${instance}`,
        },
        terminalStage: "cancelled",
      }),
    });
    eventStore.append({ ...event, provenance: PROVENANCE });
    emitted.push(instance);
  }

  process.stdout.write(
    `reconcile-fx-fixture-cancellation-completeness: emitted ${emitted.length} cancellation(s), skipped ${skipped.length}.\n`,
  );
  for (const i of emitted) process.stdout.write(`  EMITTED cancelled: ${i}\n`);
  for (const s of skipped) process.stdout.write(`  skip: ${s}\n`);
}

main();
