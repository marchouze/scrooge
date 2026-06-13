// v2-core/decision-impact/projection.ts
//
// Decision-impact sweep register projection (V2 S9) — a pure fold over the two
// lifecycle events that produces the canonical sweep register.
//
//   getSweep(id)               — a single sweep record (latest fold state)
//   listSweeps()               — all sweeps (any lifecycle stage)
//   impactsForDecision(id)     — the impacted-artefact set of the latest sweep
//                                over that decision (empty if none / un-assessed)
//   sweepsForDecision(id)      — all sweeps whose decisionId matches
//
// PRINCIPLE 1 INVARIANT: the register is a query over events, not stored state.
// The fold is deterministic and replayable from any suffix of the event log.
// Every Assessed folds onto its Requested — an orphan Assessed (no matching
// Requested) is a fold violation surfaced for the recon gate. An orphan-impact
// (an impact referencing an artefact ref the caller cannot resolve to a live
// artefact) is surfaced by the recon gate, NOT here — the projection has no
// view of the live registers (purity); it only carries the recorded impact set.
//
// Mirrors the S8 assessment register projection pattern
// (`applicability/projection.ts`): tolerant fold, violations accumulated rather
// than thrown, latest-wins per key.
//
// PACKAGE BOUNDARY: no v1 imports.
// Authority: D-W8-DECISION-IMPACT-SWEEP; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Owen (Company Secretary, governance).

import type { ImpactedArtefact, RecommendedAction } from "./events";

// ---------------------------------------------------------------------------
// Sweep record — the projected state of a single sweep
// ---------------------------------------------------------------------------

/** The lifecycle stage a sweep has reached, derived from folded events. */
export type SweepStage = "requested" | "assessed";

/**
 * The projected state of a single decision-impact sweep. A fold output — never
 * stored directly; always derived from events (Principle 1).
 */
export interface Sweep {
  readonly sweepId: string;
  readonly decisionId: string;
  readonly triggeredBy: string;
  readonly citations: readonly string[];
  /** The furthest lifecycle stage reached. */
  readonly stage: SweepStage;
  // --- Assessed fields (present once Assessed has folded) ---
  readonly impacted?: readonly ImpactedArtefact[];
  readonly recommendedActions?: readonly RecommendedAction[];
  readonly assessedBy?: string;
  readonly rationale?: string;
}

// ---------------------------------------------------------------------------
// Internal mutable state
// ---------------------------------------------------------------------------

interface SweepState {
  sweepId: string;
  decisionId: string;
  triggeredBy: string;
  citations: readonly string[];
  stage: SweepStage;
  impacted: readonly ImpactedArtefact[] | undefined;
  recommendedActions: readonly RecommendedAction[] | undefined;
  assessedBy: string | undefined;
  rationale: string | undefined;
}

// ---------------------------------------------------------------------------
// Raw event shapes understood by the fold
// ---------------------------------------------------------------------------

interface RawRequested {
  kind: "DecisionImpactSweepRequested";
  sweepId: string;
  decisionId: string;
  triggeredBy: string;
  citations: readonly string[];
}

interface RawAssessed {
  kind: "DecisionImpactAssessed";
  sweepId: string;
  decisionId: string;
  impacted: readonly ImpactedArtefact[];
  recommendedActions: readonly RecommendedAction[];
  assessedBy: string;
  rationale: string;
  citations: readonly string[];
}

type RawSweepEvent = RawRequested | RawAssessed;

// ---------------------------------------------------------------------------
// Register surface
// ---------------------------------------------------------------------------

export interface SweepRegister {
  /** A single sweep by id, or `null` if no Requested with that id folded. */
  getSweep(sweepId: string): Sweep | null;
  /** All sweeps in the register. */
  listSweeps(): Sweep[];
  /** All sweeps whose `decisionId` equals `id`. */
  sweepsForDecision(id: string): Sweep[];
  /**
   * The impacted-artefact set of the latest assessed sweep over `id`. Empty
   * array if there is no sweep, or the sweep is not yet assessed.
   */
  impactsForDecision(id: string): readonly ImpactedArtefact[];
  /** Structural integrity findings surfaced during fold (for the recon gate). */
  readonly violations: readonly SweepRegisterViolation[];
  /** Total number of events folded. */
  readonly eventCount: number;
}

export interface SweepRegisterViolation {
  readonly sweepId: string;
  readonly kind: "orphan-assessed";
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Fold
// ---------------------------------------------------------------------------

class SweepRegisterAccumulator {
  private readonly byId = new Map<string, SweepState>();
  readonly violations: SweepRegisterViolation[] = [];
  eventCount = 0;

  fold(raw: unknown): void {
    if (typeof raw !== "object" || raw === null) return;
    const ev = raw as Partial<RawSweepEvent>;
    if (typeof ev.kind !== "string") return;

    switch (ev.kind as string) {
      case "DecisionImpactSweepRequested": {
        const e = ev as RawRequested;
        if (!e.sweepId || !e.decisionId) return;
        this.eventCount += 1;
        const existing = this.byId.get(e.sweepId);
        // Latest-wins for idempotent reseeds: re-requests carry identical fields;
        // preserve any later-stage progress already folded.
        this.byId.set(e.sweepId, {
          sweepId: e.sweepId,
          decisionId: e.decisionId,
          triggeredBy: e.triggeredBy ?? "",
          citations: e.citations ?? [],
          stage: existing?.stage ?? "requested",
          impacted: existing?.impacted,
          recommendedActions: existing?.recommendedActions,
          assessedBy: existing?.assessedBy,
          rationale: existing?.rationale,
        });
        break;
      }
      case "DecisionImpactAssessed": {
        const e = ev as RawAssessed;
        if (!e.sweepId) return;
        this.eventCount += 1;
        const state = this.byId.get(e.sweepId);
        if (!state) {
          this.violations.push({
            sweepId: e.sweepId,
            kind: "orphan-assessed",
            message: `DecisionImpactAssessed for un-requested sweepId: ${e.sweepId}`,
          });
          return;
        }
        state.impacted = e.impacted ?? [];
        state.recommendedActions = e.recommendedActions ?? [];
        state.assessedBy = e.assessedBy;
        state.rationale = e.rationale;
        state.stage = "assessed";
        break;
      }
      default:
        // Unknown event kind — skip silently (forward-compat). Not counted.
        break;
    }
  }

  toRegister(): SweepRegister {
    const snapshot = new Map(this.byId);
    const violations = [...this.violations];
    const eventCount = this.eventCount;

    const latestForDecision = (id: string): SweepState | null => {
      // Latest-wins per decision: the last-folded sweep over the decision.
      let latest: SweepState | null = null;
      for (const s of snapshot.values()) {
        if (s.decisionId === id) latest = s;
      }
      return latest;
    };

    return {
      getSweep(sweepId: string): Sweep | null {
        const s = snapshot.get(sweepId);
        return s ? stateToSweep(s) : null;
      },
      listSweeps(): Sweep[] {
        return Array.from(snapshot.values()).map(stateToSweep);
      },
      sweepsForDecision(id: string): Sweep[] {
        return Array.from(snapshot.values())
          .filter((s) => s.decisionId === id)
          .map(stateToSweep);
      },
      impactsForDecision(id: string): readonly ImpactedArtefact[] {
        const s = latestForDecision(id);
        return s?.impacted ?? [];
      },
      violations,
      eventCount,
    };
  }
}

function stateToSweep(s: SweepState): Sweep {
  return {
    sweepId: s.sweepId,
    decisionId: s.decisionId,
    triggeredBy: s.triggeredBy,
    citations: s.citations,
    stage: s.stage,
    ...(s.impacted !== undefined ? { impacted: s.impacted } : {}),
    ...(s.recommendedActions !== undefined ? { recommendedActions: s.recommendedActions } : {}),
    ...(s.assessedBy !== undefined ? { assessedBy: s.assessedBy } : {}),
    ...(s.rationale !== undefined ? { rationale: s.rationale } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** An empty sweep register. */
export function emptySweepRegister(): SweepRegister {
  return new SweepRegisterAccumulator().toRegister();
}

/**
 * Fold a sequence of raw event payloads into a sweep register. The primary
 * projection entry point. Tolerant fold: unknown shapes skipped; structural
 * violations accumulated rather than thrown.
 */
export function foldSweepRegister(rawEvents: unknown[]): SweepRegister {
  const acc = new SweepRegisterAccumulator();
  for (const ev of rawEvents) {
    acc.fold(ev);
  }
  return acc.toRegister();
}
