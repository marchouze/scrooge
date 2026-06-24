// platform/accounting/gl-posting-engine-v2.ts
//
// Phase 3A — V2 GL Posting Engine (D-V1-REMOVAL-PHASE-3A, CEO-approved 2026-06-15).
//
// This engine runs DUAL-PARALLEL to the V1 posting engine (gl-posting-engine.ts
// / fx-accounting.ts SLA interpreter). It does NOT replace V1; it is the V2
// shadow that enables the parity gate (recon:gl-v2-parity) to compare outputs.
//
// ## Scope — what V2 covers in Phase 3A
//
// The only V1 trigger events that have V2 equivalents today are the FIL instance
// lifecycle events (FilInstrumentCreated / FilInstrumentAmended /
// FilInstrumentTerminated). These cover the FX sub-ledger only (3 posting rules):
//
//   PR-FX-001-V2  — Initial recognition at trade date (FilInstrumentCreated, FX)
//   PR-FX-REVAL-V2 — FVTPL revaluation (FilInstrumentAmended, FX, kind=revaluation)
//   PR-FX-CLOSE-V2 — Derecognition on settlement/cancellation (FilInstrumentTerminated)
//
// All other V1 posting rules (bond, equity, IRS, repo, MMD, IBL, period-close)
// have no V2 trigger equivalents yet. Their gap is documented in the design doc
// (prototype/docs/phase3a-gl-v2-design.md) and surfaced by the parity gate as
// advisory warnings — which is correct and expected.
//
// ## Output
//
// The engine emits GlPostingEmitted events (one per DR or CR leg) into the
// caller-supplied event store. Paired events form balanced double-entry entries.
// Each event carries:
//   - accountCode: COA account ID (resolved from the FIL economic terms)
//   - creditDebit: "debit" or "credit"
//   - amount: MoneyWire (decimal-native; NEVER amountMinor)
//   - postingDate: ISO date (from the FIL event asOf)
//   - tenantId: from the FIL event tenant field
//   - sourceEventId: the FIL event's instance URN (as the V2-side event ref)
//   - iasRule: IFRS/IAS citation
//   - postingRuleId: e.g. "PR-FX-001-V2"
//
// ## Posting rules lifted (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD, 2026-06-17)
//
// The pure FX leg logic (initial recognition / revaluation / close) is LIFTED to
// `posting-rules-v2/fx.ts` as `payload → FxPostingLeg[]` functions. This engine
// now MATERIALISES those legs into stored GlPostingEmitted events, and the FX
// trial-balance read path (gl-projection-v2.ts) folds the SAME lifted rules in
// memory — eliminating the stored GlPostingEmitted from the FX read path while
// the engine remains the byte-equivalence reference and the non-FX emitter.
//
// ## PR-FX-CLOSE-V2 derecognition follow-up (flagged, NOT applied)
//
// PR-FX-CLOSE-V2 still posts a zero-amount memo (FilInstrumentTerminated carries
// no economic terms). Applying a proper derecognition (reverse the prior
// recognition using the prior notional) would change the legs and break the
// byte-equivalence golden — so it is a SEPARATE follow-up, NOT done here.
//
// ## Package boundary
//
// This file is in platform/, NOT v2-core/, so it MAY import from both sides.
// The v2-core/ package must NOT import from here (recon:v2-no-v1-import).
//
// Authority: D-V1-REMOVAL-PHASE-3A (CEO-approved 2026-06-15);
//            D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17).
// Citations: IFRS-9-§3.1.1; IAS-21-§23; P1-EVENTS-AS-TRUTH; P2-SINGLE-GRAPH-DISCIPLINE.
// Author: Atlas (Substrate Architect, engineering).

import type { FilInstanceLifecycleEvent } from "../../v2-core/fil-instances/events";
import type {
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../v2-core/fil-instances/events";
import { newEventId } from "../core/types";
import { makeGlPostingEmitted } from "../event-store/event-types/fx-accounting";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import { readFilInstanceEvents } from "../risk/sa-ccr/fil-instance-positions";
import {
  type FxPostingLeg,
  isFxInstance,
  isFxObsCommitmentLeg,
  postFxCloseLegs,
  postFxInitialRecognitionLegs,
  postFxObsCommitmentReleaseLegs,
  postFxRevaluationLegs,
} from "./posting-rules-v2/fx";

// ---------------------------------------------------------------------------
// Leg materialiser — turn a pure FxPostingLeg into a GlPostingEmitted event.
//
// The FX posting RULES are LIFTED to platform/accounting/posting-rules-v2/fx.ts
// as pure `payload → FxPostingLeg[]` functions (D-ACCT-MODULAR-PRODUCT-COMPOSED-
// FOLD). This engine remains the DUAL-RUN emitter that materialises those legs
// into stored GlPostingEmitted events for the non-FX-fold consumers and the
// byte-equivalence golden. The FX trial-balance read path no longer needs these
// stored events — it folds the same lifted rules in memory (gl-projection-v2.ts).
// ---------------------------------------------------------------------------

function materialiseLeg(
  leg: FxPostingLeg,
  actor: Actor,
  entity: string,
  citations: string[],
): Event {
  return makeGlPostingEmitted({
    asOf: leg.postingDate,
    entity,
    actor,
    citations,
    payload: {
      creditDebit: leg.creditDebit,
      accountCode: leg.accountCode,
      amount: leg.amount,
      postingDate: leg.postingDate,
      tenantId: leg.tenantId,
      sourceEventId: leg.sourceEventId,
      iasRule: leg.iasRule,
      postingRuleId: leg.postingRuleId,
      description: leg.description,
    },
    eventId: newEventId(),
  });
}

function postFxRevaluation(
  payload: FilInstrumentAmendedPayload,
  actor: Actor,
  entity: string,
  citations: string[],
): Event[] {
  return postFxRevaluationLegs(payload).map((l) => materialiseLeg(l, actor, entity, citations));
}

function postFxClose(
  payload: FilInstrumentTerminatedPayload,
  actor: Actor,
  entity: string,
  citations: string[],
): Event[] {
  return postFxCloseLegs(payload).map((l) => materialiseLeg(l, actor, entity, citations));
}

// ---------------------------------------------------------------------------
// Main engine function — process a batch of FIL instance events and emit
// GlPostingEmitted events to the supplied store.
// ---------------------------------------------------------------------------

export interface GlV2EngineArgs {
  /** FIL instance lifecycle events to process. Defaults to reading from V2 anchor store. */
  readonly events?: readonly FilInstanceLifecycleEvent[];
  /** Event store to emit GlPostingEmitted events into. */
  readonly eventStore: EventStore;
  /** Actor to attribute postings to. */
  readonly actor: Actor;
  /** Legal entity the postings belong to. */
  readonly entity: string;
  /** ISO 8601 as-of bound — only process events at or before this date. */
  readonly asOf?: string;
}

export interface GlV2EngineResult {
  /** Total number of GlPostingEmitted events emitted. */
  readonly emitted: number;
  /** FIL instances processed (by kind). */
  readonly processed: {
    readonly created: number;
    readonly amended: number;
    readonly terminated: number;
    readonly skipped: number; // non-FX or out-of-scope
  };
}

const CITATIONS = [
  "IFRS-9-§3.1.1",
  "IFRS-9-§5.7.1",
  "IFRS-9-§3.2.3",
  "IAS-21-§23",
  "D-V1-REMOVAL-PHASE-3A",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

/**
 * Process FIL instance lifecycle events and emit V2 GL postings.
 *
 * This is the core V2 posting engine. It reads V2 FIL instance events
 * and applies the posting rules for the covered FX sub-set (PR-FX-001-V2,
 * PR-FX-REVAL-V2, PR-FX-CLOSE-V2). All other instrument types are skipped
 * with a count in `processed.skipped`.
 *
 * The engine is DUAL-RUN parallel to V1 — it NEVER writes to the same
 * store as V1 SubLedgerPostingEmitted events. The caller passes a distinct
 * event store (typically a V2-specific store or a test store). If called
 * with the shared V1 canonical store, GlPostingEmitted and SubLedgerPostingEmitted
 * co-exist (different event types) and the parity gate folds each separately.
 */
export function runGlV2Engine(args: GlV2EngineArgs): GlV2EngineResult {
  const events = args.events ?? readFilInstanceEvents();
  const cutoff = args.asOf;

  let emitted = 0;
  const processed = { created: 0, amended: 0, terminated: 0, skipped: 0 };

  // OBS commitment opening legs per instance (the trade-date ACC-9100-* legs).
  // Captured at creation so a SETTLED / MATURED termination can RELEASE the
  // commitment by reversing them (PR-FX-OBS-RELEASE-V2, D-FX-TRADE-DATE-FVTPL-OBS)
  // — the engine processes the stream in order, so the created legs precede the
  // termination for any one instance.
  const obsOpeningByInstance = new Map<string, FxPostingLeg[]>();

  for (const event of events) {
    // As-of gate: skip events after the cutoff.
    if (cutoff && event.asOf > cutoff) continue;

    let legs: Event[] = [];

    if (event.kind === "FilInstrumentCreated") {
      if (!isFxInstance(event.type)) {
        processed.skipped++;
        continue;
      }
      const created = event as FilInstrumentCreatedPayload;
      const ruleLegs = postFxInitialRecognitionLegs(created);
      // Capture the OBS commitment opening legs for the eventual settlement release.
      const obsLegs = ruleLegs.filter(isFxObsCommitmentLeg);
      if (obsLegs.length > 0) obsOpeningByInstance.set(created.instance, obsLegs);
      legs = ruleLegs.map((l) => materialiseLeg(l, args.actor, args.entity, CITATIONS));
      processed.created++;
    } else if (event.kind === "FilInstrumentAmended") {
      if (!isFxInstance(event.type)) {
        processed.skipped++;
        continue;
      }
      legs = postFxRevaluation(
        event as FilInstrumentAmendedPayload,
        args.actor,
        args.entity,
        CITATIONS,
      );
      processed.amended++;
    } else if (event.kind === "FilInstrumentTerminated") {
      // Terminated events don't carry type URN for non-FX check; include all.
      // The termination derecognition applies to any FIL instance regardless of
      // type (the initial recognition was already posted by Created). However,
      // we only posted Created for FX instances, so we only need to close those.
      // Since Terminated doesn't carry the type URN independently, we emit the
      // advisory zero-amount close for all terminations at Phase 3A scope.
      const terminated = event as FilInstrumentTerminatedPayload;
      legs = postFxClose(terminated, args.actor, args.entity, CITATIONS);
      // SETTLEMENT / MATURITY: release the trade-date OBS commitment by reversing
      // the captured OBS opening legs (D-FX-TRADE-DATE-FVTPL-OBS). A cancellation
      // is handled by the read-path reversal (the engine posts no opening-leg
      // reversal for cancellations either — byte-equivalence is on the fold side).
      if (terminated.terminalStage === "settled" || terminated.terminalStage === "matured") {
        const obsOpening = obsOpeningByInstance.get(terminated.instance);
        if (obsOpening !== undefined && obsOpening.length > 0) {
          const releaseLegs = postFxObsCommitmentReleaseLegs(obsOpening, {
            instance: terminated.instance,
            ...(terminated.tenant !== undefined ? { tenant: terminated.tenant } : {}),
            asOf: terminated.asOf,
          });
          legs = [
            ...legs,
            ...releaseLegs.map((l) => materialiseLeg(l, args.actor, args.entity, CITATIONS)),
          ];
        }
      }
      processed.terminated++;
    }

    for (const leg of legs) {
      args.eventStore.append(leg);
      emitted++;
    }
  }

  return { emitted, processed };
}
