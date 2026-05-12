// platform/model-registry/registry.ts
//
// Local-first implementation of `ModelRegistry`. Authoritative state is
// the event log (P1) — `list()` and `productionEligible()` fold the
// stream; nothing is cached as authoritative.
//
// Co-ownership (Team/Nadia.md §15 — Nadia's load-bearing boundary):
//   - `submit` is the model-builder (Rohan) entrypoint. Idempotent on
//     `methodologyHash` for a given `modelId`.
//   - `classifyTier`, `approveValidation`, `withholdValidation`,
//     `raiseFinding`, `closeFinding` are validator (Nadia)
//     entrypoints. The Rohan/Nadia segregation is recorded in the
//     `actor` envelope of each emitted event, not enforced at the
//     interface level — Atlas's permission-policy generator (A2) is
//     the enforcement substrate.
//
// Validation invariants enforced here:
//   - `approveValidation` against a model with no prior `ModelSubmitted`
//     throws (a model must exist to be approved).
//   - `approveValidation` against a model with at least one open
//     `severity: blocking` finding throws (independence boundary).
//   - `closeFinding` against an unknown findingId throws.
//   - `closeFinding` against an already-closed finding throws.
//   - `submit` is idempotent on `(modelId, methodologyHash)` — repeated
//     identical submissions emit no event.
//
// Author: Nadia + Rohan (model-registry skeleton, first slice)

import {
  makeModelSubmitted,
  makeModelTierClassified,
  makeModelValidationApproved,
  makeModelValidationWithheld,
  makeValidationFindingClosed,
  makeValidationFindingRaised,
} from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ModelTier = 1 | 2 | 3;

export type FindingSeverity = "low" | "medium" | "high" | "blocking";

/**
 * Computed validation status of a model. Derived by folding the event
 * log; never persisted.
 *
 *   - `submitted`: at least one `ModelSubmitted`, no `ModelValidationApproved`
 *     and no `ModelValidationWithheld` for the latest version.
 *   - `approved`: latest validation event for the latest version is
 *     `ModelValidationApproved`.
 *   - `withheld`: latest validation event for the latest version is
 *     `ModelValidationWithheld`.
 */
export type ValidationStatus = "submitted" | "approved" | "withheld";

export interface FindingView {
  readonly findingId: string;
  readonly modelId: string;
  readonly raisedBy: string;
  readonly severity: FindingSeverity;
  readonly description: string;
  readonly status: "open" | "closed";
  readonly closedBy?: string;
  readonly resolution?: string;
  readonly closedAt?: string;
}

export interface ModelView {
  readonly modelId: string;
  readonly latestVersion: string;
  readonly latestVersionSubmittedBy: string;
  readonly tier: ModelTier;
  /** True when Nadia (or another classifier) has issued a `ModelTierClassified`. */
  readonly tierClassified: boolean;
  readonly description: string;
  readonly validationStatus: ValidationStatus;
  /** Set when validationStatus is `approved`. */
  readonly approvalExpiryDate?: string;
  /** Set when validationStatus is `approved`. */
  readonly approvedBy?: string;
  /** Set when validationStatus is `withheld`. */
  readonly withholdReason?: string;
  /** All findings for this model (open + closed). */
  readonly findings: readonly FindingView[];
  /** Number of open findings, all severities. */
  readonly openFindingsCount: number;
  /** Number of open findings with severity = `blocking`. */
  readonly openBlockingFindingsCount: number;
}

// ---------------------------------------------------------------------------
// Method args + results
// ---------------------------------------------------------------------------

export interface SubmitArgs {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly modelId: string;
  readonly submittedBy: string;
  readonly version: string;
  readonly tier: ModelTier;
  readonly methodologyHash: string;
  readonly description: string;
  readonly eventId?: string;
}

export interface SubmitResult {
  readonly modelId: string;
  readonly version: string;
  readonly methodologyHash: string;
  /**
   * `submitted` — a new `ModelSubmitted` event was emitted (first time
   *   this `(modelId, methodologyHash)` pair has been seen).
   * `unchanged` — an identical `(modelId, methodologyHash)` pair was
   *   already in the log; no event emitted.
   */
  readonly status: "submitted" | "unchanged";
  readonly eventEmitted: boolean;
}

export interface ClassifyTierArgs {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly modelId: string;
  readonly classifiedBy: string;
  readonly tier: ModelTier;
  readonly rationale: string;
  readonly eventId?: string;
}

export interface ClassifyResult {
  readonly modelId: string;
  readonly tier: ModelTier;
  readonly eventId: string;
}

export interface ApproveArgs {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly modelId: string;
  readonly version: string;
  readonly approvedBy: string;
  readonly validationFindingsResolved: readonly string[];
  readonly expiryDate: string;
  readonly eventId?: string;
}

export interface ApproveResult {
  readonly modelId: string;
  readonly version: string;
  readonly eventId: string;
}

export interface WithholdArgs {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly modelId: string;
  readonly version: string;
  readonly withheldBy: string;
  readonly reason: string;
  readonly findings: readonly string[];
  readonly eventId?: string;
}

export interface WithholdResult {
  readonly modelId: string;
  readonly version: string;
  readonly eventId: string;
}

export interface RaiseFindingArgs {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly findingId: string;
  readonly modelId: string;
  readonly raisedBy: string;
  readonly severity: FindingSeverity;
  readonly description: string;
  readonly eventId?: string;
}

export interface RaiseFindingResult {
  readonly findingId: string;
  readonly modelId: string;
  readonly eventId: string;
}

export interface CloseFindingArgs {
  readonly asOf: string;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: string[];
  readonly findingId: string;
  readonly closedBy: string;
  readonly resolution: string;
  /** ISO 8601 — defaults to `asOf` if omitted. */
  readonly closedAt?: string;
  readonly eventId?: string;
}

export interface CloseFindingResult {
  readonly findingId: string;
  readonly eventId: string;
}

// ---------------------------------------------------------------------------
// ModelRegistry interface
// ---------------------------------------------------------------------------

export interface ModelRegistry {
  /** Rohan submits a new model version. Idempotent on `(modelId, methodologyHash)`. */
  submit(args: SubmitArgs): SubmitResult;
  /** Nadia classifies tier (may agree with Rohan or override). */
  classifyTier(args: ClassifyTierArgs): ClassifyResult;
  /** Nadia approves production use of a specific version. */
  approveValidation(args: ApproveArgs): ApproveResult;
  /** Nadia withholds approval. */
  withholdValidation(args: WithholdArgs): WithholdResult;
  /** Raise a validation finding. */
  raiseFinding(args: RaiseFindingArgs): RaiseFindingResult;
  /** Close a validation finding. */
  closeFinding(args: CloseFindingArgs): CloseFindingResult;
  /** Query: latest state per model (folded from event log per Principle 1). */
  list(): readonly ModelView[];
  /**
   * Query: production-eligible models. A model is production-eligible
   * when:
   *   - validationStatus is `approved`, AND
   *   - the approval's `expiryDate` is in the future (relative to
   *     `now`, defaulting to wall-clock now), AND
   *   - it has zero open `severity: blocking` findings.
   */
  productionEligible(now?: Date): readonly ModelView[];
}

export interface ModelRegistryConfig {
  readonly eventStore: EventStore;
}

// ---------------------------------------------------------------------------
// Internal fold types
// ---------------------------------------------------------------------------

interface ModelFold {
  /** Latest ModelSubmitted for this modelId. */
  readonly latestSubmission: {
    readonly version: string;
    readonly submittedBy: string;
    readonly tier: ModelTier;
    readonly methodologyHash: string;
    readonly description: string;
    readonly asOf: string;
  };
  /** All `(modelId, methodologyHash)` pairs we've already seen. */
  readonly seenHashes: ReadonlySet<string>;
  /** Latest tier classification, if Nadia has classified. */
  readonly tierClassification?: {
    readonly tier: ModelTier;
    readonly classifiedBy: string;
    readonly rationale: string;
    readonly asOf: string;
  };
  /** Latest validation event (approved or withheld) for the latest version. */
  readonly latestValidation?:
    | {
        readonly kind: "approved";
        readonly version: string;
        readonly approvedBy: string;
        readonly expiryDate: string;
        readonly asOf: string;
      }
    | {
        readonly kind: "withheld";
        readonly version: string;
        readonly withheldBy: string;
        readonly reason: string;
        readonly asOf: string;
      };
  readonly findings: readonly FindingView[];
}

// ---------------------------------------------------------------------------
// LocalModelRegistry
// ---------------------------------------------------------------------------

export class LocalModelRegistry implements ModelRegistry {
  private readonly eventStore: EventStore;

  constructor(config: ModelRegistryConfig) {
    this.eventStore = config.eventStore;
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  submit(args: SubmitArgs): SubmitResult {
    // Idempotency: walk ModelSubmitted events for this modelId; if any
    // event has the same methodologyHash, no-op.
    const folds = this.buildFolds();
    const fold = folds.get(args.modelId);
    if (fold?.seenHashes.has(args.methodologyHash)) {
      return {
        modelId: args.modelId,
        version: args.version,
        methodologyHash: args.methodologyHash,
        status: "unchanged",
        eventEmitted: false,
      };
    }

    const event = makeModelSubmitted({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload: {
        modelId: args.modelId,
        submittedBy: args.submittedBy,
        version: args.version,
        tier: args.tier,
        methodologyHash: args.methodologyHash,
        description: args.description,
      },
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    return {
      modelId: args.modelId,
      version: args.version,
      methodologyHash: args.methodologyHash,
      status: "submitted",
      eventEmitted: true,
    };
  }

  classifyTier(args: ClassifyTierArgs): ClassifyResult {
    const folds = this.buildFolds();
    const fold = folds.get(args.modelId);
    if (!fold) {
      throw new Error(
        `ModelRegistry.classifyTier: model "${args.modelId}" has no prior ModelSubmitted event`,
      );
    }

    const event = makeModelTierClassified({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload: {
        modelId: args.modelId,
        classifiedBy: args.classifiedBy,
        tier: args.tier,
        rationale: args.rationale,
      },
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    return { modelId: args.modelId, tier: args.tier, eventId: event.event_id };
  }

  approveValidation(args: ApproveArgs): ApproveResult {
    const folds = this.buildFolds();
    const fold = folds.get(args.modelId);
    if (!fold) {
      throw new Error(
        `ModelRegistry.approveValidation: model "${args.modelId}" has no prior ModelSubmitted event`,
      );
    }

    // Independence boundary (Team/Nadia.md §15): a model with open
    // blocking findings cannot be approved. The registry enforces this
    // as a typed-event invariant, not a soft signal.
    const openBlocking = fold.findings.filter(
      (f) => f.status === "open" && f.severity === "blocking",
    );
    if (openBlocking.length > 0) {
      const ids = openBlocking.map((f) => f.findingId).join(", ");
      throw new Error(
        `ModelRegistry.approveValidation: model "${args.modelId}" has ${openBlocking.length} open blocking finding(s) [${ids}]; close them before approval`,
      );
    }

    const event = makeModelValidationApproved({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload: {
        modelId: args.modelId,
        version: args.version,
        approvedBy: args.approvedBy,
        validationFindingsResolved: [...args.validationFindingsResolved],
        expiryDate: args.expiryDate,
      },
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    return { modelId: args.modelId, version: args.version, eventId: event.event_id };
  }

  withholdValidation(args: WithholdArgs): WithholdResult {
    const folds = this.buildFolds();
    if (!folds.has(args.modelId)) {
      throw new Error(
        `ModelRegistry.withholdValidation: model "${args.modelId}" has no prior ModelSubmitted event`,
      );
    }

    const event = makeModelValidationWithheld({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload: {
        modelId: args.modelId,
        version: args.version,
        withheldBy: args.withheldBy,
        reason: args.reason,
        findings: [...args.findings],
      },
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    return { modelId: args.modelId, version: args.version, eventId: event.event_id };
  }

  raiseFinding(args: RaiseFindingArgs): RaiseFindingResult {
    const event = makeValidationFindingRaised({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload: {
        findingId: args.findingId,
        modelId: args.modelId,
        raisedBy: args.raisedBy,
        severity: args.severity,
        description: args.description,
      },
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    return {
      findingId: args.findingId,
      modelId: args.modelId,
      eventId: event.event_id,
    };
  }

  closeFinding(args: CloseFindingArgs): CloseFindingResult {
    // Validate: finding must exist and be open.
    const findings = this.collectFindings();
    const existing = findings.get(args.findingId);
    if (!existing) {
      throw new Error(
        `ModelRegistry.closeFinding: finding "${args.findingId}" has no prior ValidationFindingRaised event`,
      );
    }
    if (existing.status === "closed") {
      throw new Error(`ModelRegistry.closeFinding: finding "${args.findingId}" is already closed`);
    }

    const event = makeValidationFindingClosed({
      asOf: args.asOf,
      entity: args.entity,
      actor: args.actor,
      citations: args.citations,
      payload: {
        findingId: args.findingId,
        closedBy: args.closedBy,
        resolution: args.resolution,
        closedAt: args.closedAt ?? args.asOf,
      },
      ...(args.eventId !== undefined ? { eventId: args.eventId } : {}),
    });
    this.eventStore.append(event);

    return { findingId: args.findingId, eventId: event.event_id };
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  list(): readonly ModelView[] {
    const folds = this.buildFolds();
    const views: ModelView[] = [];
    for (const [modelId, fold] of folds) {
      views.push(this.viewOf(modelId, fold));
    }
    return views.sort((a, b) => a.modelId.localeCompare(b.modelId));
  }

  productionEligible(now: Date = new Date()): readonly ModelView[] { // wall-clock: default; inject now for deterministic scenarios
    const all = this.list();
    return all.filter((v) => {
      if (v.validationStatus !== "approved") return false;
      if (v.openBlockingFindingsCount > 0) return false;
      if (!v.approvalExpiryDate) return false;
      const expiryMs = new Date(v.approvalExpiryDate).getTime();
      if (Number.isNaN(expiryMs)) return false;
      return expiryMs > now.getTime();
    });
  }

  // -------------------------------------------------------------------------
  // Folds
  // -------------------------------------------------------------------------

  /**
   * Walk the entire model-registry event stream and build a per-model
   * fold. O(N) over the relevant event types — adequate for build-phase
   * volume; production volume warrants an indexed projection (Anya).
   */
  private buildFolds(): Map<string, ModelFold> {
    // We accumulate into mutable working state, then freeze into the
    // exported ReadonlyMap of readonly ModelFold values.
    interface MutFold {
      latestSubmission?: {
        version: string;
        submittedBy: string;
        tier: ModelTier;
        methodologyHash: string;
        description: string;
        asOf: string;
      };
      seenHashes: Set<string>;
      tierClassification?: {
        tier: ModelTier;
        classifiedBy: string;
        rationale: string;
        asOf: string;
      };
      latestValidation?: ModelFold["latestValidation"];
      findings: FindingView[];
    }
    const working = new Map<string, MutFold>();

    const ensure = (modelId: string): MutFold => {
      let f = working.get(modelId);
      if (!f) {
        f = { seenHashes: new Set<string>(), findings: [] };
        working.set(modelId, f);
      }
      return f;
    };

    // Pull all relevant events, in sequence order. Replay() yields in
    // sequence ASC per the EventStore contract.
    const submittedEvents: Event[] = [...this.eventStore.replay({ type: "ModelSubmitted" })];
    const tierEvents: Event[] = [...this.eventStore.replay({ type: "ModelTierClassified" })];
    const approvedEvents: Event[] = [
      ...this.eventStore.replay({ type: "ModelValidationApproved" }),
    ];
    const withheldEvents: Event[] = [
      ...this.eventStore.replay({ type: "ModelValidationWithheld" }),
    ];
    const findingRaisedEvents: Event[] = [
      ...this.eventStore.replay({ type: "ValidationFindingRaised" }),
    ];
    const findingClosedEvents: Event[] = [
      ...this.eventStore.replay({ type: "ValidationFindingClosed" }),
    ];

    // First: all submissions (latest-wins on modelId; the as-of order
    // is the SQLite sequence which is monotonic with append).
    for (const e of submittedEvents) {
      const p = e.payload as Record<string, unknown>;
      const modelId = String(p.modelId ?? "");
      if (!modelId) continue;
      const f = ensure(modelId);
      f.seenHashes.add(String(p.methodologyHash ?? ""));
      f.latestSubmission = {
        version: String(p.version ?? ""),
        submittedBy: String(p.submittedBy ?? ""),
        tier: Number(p.tier) as ModelTier,
        methodologyHash: String(p.methodologyHash ?? ""),
        description: String(p.description ?? ""),
        asOf: e.as_of,
      };
    }

    // Tier classifications: latest-wins on modelId.
    for (const e of tierEvents) {
      const p = e.payload as Record<string, unknown>;
      const modelId = String(p.modelId ?? "");
      if (!modelId) continue;
      const f = ensure(modelId);
      f.tierClassification = {
        tier: Number(p.tier) as ModelTier,
        classifiedBy: String(p.classifiedBy ?? ""),
        rationale: String(p.rationale ?? ""),
        asOf: e.as_of,
      };
    }

    // Validation events: walk in sequence order, latest-wins on modelId.
    // We interleave by sequence by sorting on event_id as a stable
    // order; SQLite already gave us sequence ASC per type, so we merge.
    // Conservative approach: just walk approved then withheld; a later
    // withheld supersedes an earlier approval, and vice versa, by the
    // as_of comparison.
    type ValEv =
      | { kind: "approved"; payload: Record<string, unknown>; asOf: string }
      | { kind: "withheld"; payload: Record<string, unknown>; asOf: string };
    const validations: ValEv[] = [];
    for (const e of approvedEvents) {
      validations.push({ kind: "approved", payload: e.payload, asOf: e.as_of });
    }
    for (const e of withheldEvents) {
      validations.push({ kind: "withheld", payload: e.payload, asOf: e.as_of });
    }
    // Stable sort by as_of ascending; equal as_of preserves insertion
    // order (approved first since pushed first).
    validations.sort((a, b) => a.asOf.localeCompare(b.asOf));

    for (const v of validations) {
      const modelId = String(v.payload.modelId ?? "");
      if (!modelId) continue;
      const f = ensure(modelId);
      if (v.kind === "approved") {
        f.latestValidation = {
          kind: "approved",
          version: String(v.payload.version ?? ""),
          approvedBy: String(v.payload.approvedBy ?? ""),
          expiryDate: String(v.payload.expiryDate ?? ""),
          asOf: v.asOf,
        };
      } else {
        f.latestValidation = {
          kind: "withheld",
          version: String(v.payload.version ?? ""),
          withheldBy: String(v.payload.withheldBy ?? ""),
          reason: String(v.payload.reason ?? ""),
          asOf: v.asOf,
        };
      }
    }

    // Findings: walk raised then closed; populate per-model lists.
    const closedById = new Map<string, Record<string, unknown>>();
    for (const e of findingClosedEvents) {
      const p = e.payload as Record<string, unknown>;
      closedById.set(String(p.findingId ?? ""), p);
    }
    for (const e of findingRaisedEvents) {
      const p = e.payload as Record<string, unknown>;
      const findingId = String(p.findingId ?? "");
      const modelId = String(p.modelId ?? "");
      if (!findingId || !modelId) continue;
      const f = ensure(modelId);
      const closed = closedById.get(findingId);
      const view: FindingView = closed
        ? {
            findingId,
            modelId,
            raisedBy: String(p.raisedBy ?? ""),
            severity: String(p.severity ?? "low") as FindingSeverity,
            description: String(p.description ?? ""),
            status: "closed",
            closedBy: String(closed.closedBy ?? ""),
            resolution: String(closed.resolution ?? ""),
            closedAt: String(closed.closedAt ?? ""),
          }
        : {
            findingId,
            modelId,
            raisedBy: String(p.raisedBy ?? ""),
            severity: String(p.severity ?? "low") as FindingSeverity,
            description: String(p.description ?? ""),
            status: "open",
          };
      f.findings.push(view);
    }

    // Freeze into a public Map<string, ModelFold>, dropping anything
    // that never had a submission (defensive — closeFinding could have
    // recorded a finding for a model that was never submitted, which
    // would itself be a substrate-integrity issue).
    const out = new Map<string, ModelFold>();
    for (const [modelId, f] of working) {
      if (!f.latestSubmission) continue;
      out.set(modelId, {
        latestSubmission: f.latestSubmission,
        seenHashes: f.seenHashes,
        ...(f.tierClassification ? { tierClassification: f.tierClassification } : {}),
        ...(f.latestValidation ? { latestValidation: f.latestValidation } : {}),
        findings: f.findings,
      });
    }
    return out;
  }

  /**
   * Build a flat finding-id → view map for `closeFinding`'s validation.
   * Folds the ValidationFindingRaised + ValidationFindingClosed streams
   * directly so the lookup is independent of model-fold construction.
   */
  private collectFindings(): Map<string, FindingView> {
    const closed = new Map<string, Record<string, unknown>>();
    for (const e of this.eventStore.replay({ type: "ValidationFindingClosed" })) {
      const p = e.payload as Record<string, unknown>;
      closed.set(String(p.findingId ?? ""), p);
    }
    const out = new Map<string, FindingView>();
    for (const e of this.eventStore.replay({ type: "ValidationFindingRaised" })) {
      const p = e.payload as Record<string, unknown>;
      const findingId = String(p.findingId ?? "");
      if (!findingId) continue;
      const c = closed.get(findingId);
      out.set(
        findingId,
        c
          ? {
              findingId,
              modelId: String(p.modelId ?? ""),
              raisedBy: String(p.raisedBy ?? ""),
              severity: String(p.severity ?? "low") as FindingSeverity,
              description: String(p.description ?? ""),
              status: "closed",
              closedBy: String(c.closedBy ?? ""),
              resolution: String(c.resolution ?? ""),
              closedAt: String(c.closedAt ?? ""),
            }
          : {
              findingId,
              modelId: String(p.modelId ?? ""),
              raisedBy: String(p.raisedBy ?? ""),
              severity: String(p.severity ?? "low") as FindingSeverity,
              description: String(p.description ?? ""),
              status: "open",
            },
      );
    }
    return out;
  }

  private viewOf(modelId: string, fold: ModelFold): ModelView {
    const sub = fold.latestSubmission;
    const tier: ModelTier = fold.tierClassification?.tier ?? sub.tier;
    const validationStatus: ValidationStatus =
      fold.latestValidation?.kind === "approved"
        ? "approved"
        : fold.latestValidation?.kind === "withheld"
          ? "withheld"
          : "submitted";

    const openFindings = fold.findings.filter((f) => f.status === "open");
    const openBlocking = openFindings.filter((f) => f.severity === "blocking");

    const approvedExtras =
      fold.latestValidation?.kind === "approved"
        ? {
            approvalExpiryDate: fold.latestValidation.expiryDate,
            approvedBy: fold.latestValidation.approvedBy,
          }
        : {};
    const withheldExtras =
      fold.latestValidation?.kind === "withheld"
        ? { withholdReason: fold.latestValidation.reason }
        : {};

    return {
      modelId,
      latestVersion: sub.version,
      latestVersionSubmittedBy: sub.submittedBy,
      tier,
      tierClassified: fold.tierClassification !== undefined,
      description: sub.description,
      validationStatus,
      ...approvedExtras,
      ...withheldExtras,
      findings: fold.findings,
      openFindingsCount: openFindings.length,
      openBlockingFindingsCount: openBlocking.length,
    };
  }
}
