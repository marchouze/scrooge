// platform/event-store/registry/types.ts
//
// F-021 (Atlas, 2026-05-12): shared types and retention constants extracted
// from the monolithic registry.ts into this per-domain barrel structure.
//
// This module owns:
//   - ArchivalTier
//   - RetentionMetadata + pre-canned retention constants
//   - RETENTION_CONSERVATIVE_DEFAULT (exported)
//   - SnapshotCadence + DEFAULT_SNAPSHOT_CADENCE (exported)
//   - ReplayFold
//   - EventTypeStatus
//   - EventTypeMetadata

import type { z } from "zod";

/**
 * Archival-tier policy per event type. Mirrors §4.2 of the event-store
 * scaling design (PR #38; Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md):
 *
 *   - "hot-only"        — never tiers down. Reserved for short-lived
 *                         operational events kept entirely in the hot
 *                         path; not used at v1 (every type has at least
 *                         a Cool target by Q2 of D-EVENT-STORE-SCALING).
 *   - "hot-cool"        — hot for 90 days then Cool indefinitely. Used
 *                         for substrate-runtime events whose retention
 *                         floor is short and whose cold-restore needs
 *                         do not justify Archive's restore latency.
 *   - "hot-cool-archive" — hot 90 days, Cool 90 days, Archive thereafter.
 *                         Default for regulated retention; matches the
 *                         regulator-request horizons specified in §3.4
 *                         and the Q2-resolution of D-EVENT-STORE-SCALING.
 *
 * Local build-phase substrate stores everything in one SQLite table —
 * the tier is metadata only today; the cloud lift (D-EVENT-STORE-SCALING
 * Slice 8 / M8) reads this field to drive Blob Storage tier transitions.
 */
export type ArchivalTier = "hot-only" | "hot-cool" | "hot-cool-archive";

/**
 * Per-event-type retention metadata. Authority: D-EVENT-STORE-SCALING
 * (CEO approved 2026-05-10) Slice 1; design brief
 * Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md §5.
 *
 * Every registered event type carries this field. The retention floor
 * is a *minimum* — the bank's Principle 1 default is to retain the
 * append-only log indefinitely; compaction (§3.4) reduces hot-storage
 * footprint without deleting the underlying log. Deletion only occurs
 * where a citation requires it (e.g. POPIA s.14 minimum-necessary for
 * personal information once the lawful basis lapses).
 *
 * The `citationRef` resolves into the obligations register
 * (Regulations/_obligations-register.md) — Vera's planned Wave-4 #14
 * recon (`retention-citation-coverage`) asserts every value here is a
 * live URN. As of v1.12 of the obligations register
 * (D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 follow-on, 2026-05-10),
 * every retention class below carries a concrete URN — the four
 * `[register: route to Mira]` markers introduced under
 * D-EVENT-STORE-SCALING Slice 1 are closed (`ORG-GV-21`,
 * `ORG-MK-15`, `ORG-RM-01`, plus the M2-fixture
 * `ORG-MK-16` JSE Debt Listing Rules row). The recon may now
 * fail-closed on any future regression to a marker form.
 */
export interface RetentionMetadata {
  /** Minimum retention horizon in years (regulator-mandated floor). */
  readonly minimumYears: number;
  /** Archival-tier policy for cold storage. */
  readonly archivalTier: ArchivalTier;
  /**
   * Obligations-register URN (or `[register: route to Mira — ...]`
   * marker pending citation population). Resolved by Vera's Wave-4 #14
   * recon once Mira lands the JSE-Equities-Rules / Companies-Act /
   * BCBS-239 / Records-Management-Policy rows.
   */
  readonly citationRef: string;
}

/**
 * Pre-canned retention classes. Mirrors the §5 retention table of the
 * design brief — every event type maps onto one of these. Local
 * helpers keep the per-row authoring noise low while the structured
 * shape stays uniform across ~50 types.
 */
export const RETENTION_BANKING_5Y: RetentionMetadata = {
  minimumYears: 5,
  archivalTier: "hot-cool-archive",
  citationRef: "ORG-CS3-009", // SARB CS 3/2018 §12 — records ≥5y, tamper-evident
};

export const RETENTION_FIC_5Y: RetentionMetadata = {
  minimumYears: 5,
  archivalTier: "hot-cool-archive",
  citationRef: "ORG-FC-05", // FIC Act 38/2001 s.22
};

export const RETENTION_ACCOUNTING_7Y: RetentionMetadata = {
  minimumYears: 7,
  archivalTier: "hot-cool-archive",
  citationRef: "COMPANIES-ACT-71-2008-S24", // accounting-records retention
};

export const RETENTION_GOVERNANCE_7Y: RetentionMetadata = {
  // Audit / governance / decision events. Companies Act director-decision
  // retention (Companies Act ss.24 + 66 + 71 + 73 + 75 read together with
  // Banks Act s.60) + BCBS 239 audit-trail expectations (Principles I,
  // III, IX, XIV). Register row `ORG-GV-21` (Domain F) — landed under
  // v1.12 of `Regulations/_obligations-register.md` per
  // D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 follow-on Mira route.
  minimumYears: 7,
  archivalTier: "hot-cool-archive",
  citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
};

export const RETENTION_JSE_TRADE_7Y: RetentionMetadata = {
  // JSE Equities Rules — trade-record retention sub-rules (the JSE
  // Equities Rules' record-keeping section imposes a 7-year retention
  // floor on trading-member books and records; cross-reads with FMA
  // s.5 exchange-licence-conditions). Register row `ORG-MK-15`
  // (Domain J) — landed under v1.12 of
  // `Regulations/_obligations-register.md` per
  // D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 follow-on Mira route.
  minimumYears: 7,
  archivalTier: "hot-cool-archive",
  citationRef: "urn:obligation:bank:mk:jse-equities-rules-retention:v1",
};

export const RETENTION_RUNTIME_1Y: RetentionMetadata = {
  // Operational substrate events. Internal-policy retention via the
  // bank's Records Management Policy (planned — Owen primary, Devon
  // secondary, Board approval per `Owner Inbox/2026-05-06_policy-register.md`
  // line 111). Register row `ORG-RM-01` (Domain RM — internal-policy
  // citation handles) — landed under v1.12 of
  // `Regulations/_obligations-register.md` per
  // D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 follow-on Mira route.
  // The URN handle is a citation seat: it resolves to the policy
  // register entry today; once Owen authors policy text, the URN's
  // citation chain expands to name precise policy sections (Vera
  // Wave-4 records-management-policy-authoring-gap finding tracks the
  // gap).
  minimumYears: 1,
  archivalTier: "hot-cool",
  citationRef: "urn:policy:bank:records-management:operational-substrate-retention:v1",
};

/**
 * Default-when-unknown retention. Conservative class — Banks Act +
 * CS 3/2018 §12 5-year floor; full-tier-down. Any row using this
 * default is an explicit "use the strongest applicable floor pending
 * classification" and is a Mira follow-on to refine.
 *
 * Exported so future event-type rows that ship before the contributor
 * has classified the retention class can drop in this default safely;
 * the Vera Wave-4 #14 retention-citation-coverage recon then surfaces
 * them as findings to refine. Today (Slice 1 exit) every registered
 * row carries a classified retention — no row uses this default.
 */
export const RETENTION_CONSERVATIVE_DEFAULT: RetentionMetadata = {
  minimumYears: 5,
  archivalTier: "hot-cool-archive",
  citationRef: "ORG-CS3-009",
};

/**
 * Per-event-type snapshot cadence. Authority: D-EVENT-STORE-SCALING
 * (CEO-approved 2026-05-10) Slice 2; Q1 resolution — *hybrid: every K
 * events OR every T time, tunable per stream*. Design brief
 * `Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md` §4.2 +
 * §7 Q1.
 *
 * Two thresholds; consumers that call
 * `eventStore.shouldSnapshot({ streamKey, eventType })` snapshot when
 * **either** is met (the scaling design rationale: K-only starves
 * low-velocity streams of fresh snapshots; T-only burns RU/IO on
 * high-velocity streams for redundant snapshots).
 *
 * The store does *not* auto-snapshot inside `append()` — Slice 3
 * consumers own the projection state being snapshotted and call
 * `snapshot()` after a fold update. The cadence rule is a hint; the
 * consumer remains free to snapshot more / less aggressively.
 *
 * The field is **optional** on `EventTypeMetadata`. Rows without an
 * explicit cadence resolve to `DEFAULT_SNAPSHOT_CADENCE` (1000 events,
 * 24 hours). A Mira follow-on (Wave-5; routed via Slice 1 retention
 * uplift) populates per-event-type cadence values where retention or
 * read-amplification characteristics warrant tighter or looser
 * cadence.
 */
export interface SnapshotCadence {
  /** Snapshot when ≥ this many events have been appended since the
   *  last snapshot for the affected stream. */
  readonly everyKEvents: number;
  /** Snapshot when ≥ this many seconds have elapsed since the last
   *  snapshot. */
  readonly everyTSeconds: number;
}

/**
 * Default cadence — Q1 of the design brief: 1000 events / 1 hour. The
 * scaling brief's §4.2 example (K=1000) is the events-floor; T = 1
 * hour is the time-floor for low-velocity streams. Per-event-type
 * tuning lands as Mira's follow-on classifies high-velocity types
 * (e.g. `MarkToMarketObserved` at K=10,000) and low-velocity types
 * (e.g. `AgentRegistered` at K=100). The store falls back here for
 * any type lacking a `cadence` field, including unregistered types.
 */
export const DEFAULT_SNAPSHOT_CADENCE: SnapshotCadence = {
  everyKEvents: 1000,
  everyTSeconds: 60 * 60, // 1 hour
};

/**
 * Replay-fold rule the substrate's projections obey for this event type.
 * Mirrors A0 freeze §6 ("folding rules").
 */
export type ReplayFold =
  /** Once present, fixes the projection; later events on the same subject
   * are recorded but don't change state. e.g. TradeMatured. */
  | "idempotent-terminal"
  /** Latest event with the same key supersedes earlier values; replay at
   * as-of < latest yields the earlier value. e.g. MarkToMarketObserved. */
  | "latest-wins-per-key"
  /** Projection accumulates the full sequence; value at as-of is the
   * fold of all events ≤ as-of. e.g. Reset, BarrierObservation. */
  | "cumulative-fold"
  /** Open-until-paired; projections track open/closed state. e.g.
   * AgentEscalation ↔ AgentEscalationDecided. */
  | "pair-coupled"
  /** Append-only audit observation; projections aggregate but don't
   * compute current-state. e.g. RiskRaised, AuditFinding. */
  | "append-only-audit";

/**
 * V1→V2 migration status for a registered event type. Tracks the journey
 * from V1/platform store authority to V2/v2-core authority for each type.
 * Authority: D-V1-REMOVAL-PHASE-1 (CEO-approved, session-delegation 2026-06-15).
 *
 *   - "v1-only"      — no V2 equivalent exists; the V1 event-store path is the
 *                      sole authority for this type. The ratchet gate
 *                      (`recon:v1-removal-ratchet`) ensures this count can
 *                      only shrink (never grow) without a recorded Decision.
 *   - "v2-parallel"  — a V2 model/projection runs in parallel; V1 is still
 *                      the authoritative emitter. Parity gates validate that
 *                      both paths produce byte-equivalent outputs before a
 *                      domain flip is approved.
 *   - "v2-replaced"  — the V2 path is authoritative; the V1 version of this
 *                      type is retired. No event types hold this status in
 *                      Phase 1 — it is the target state for Phase 2+ flips.
 */
export type V2CutoverStatus = "v1-only" | "v2-parallel" | "v2-replaced";

/**
 * Lifecycle status for a registered event type.
 *
 *   - "active"     — the current canonical type; producers should emit it.
 *   - "deprecated" — superseded by a newer type (see `supersededBy`); the
 *                    append path still accepts the type for backward compat
 *                    but no new code should emit it. Vera's
 *                    `event-type-registry-coverage` recon asserts that no
 *                    new `eventStore.append` call sites reference a
 *                    deprecated type. Authority: D-PARTY-REGISTER (2026-05-11).
 */
export type EventTypeStatus = "active" | "deprecated";

export interface EventTypeMetadata {
  /** Canonical type name. Matches the `event.type` literal at append. */
  readonly type: string;
  /** Class — agent-runtime substrate or markets lifecycle. Mirrors A0 §4 / §5. */
  readonly class: "runtime" | "markets" | "governance" | "audit";
  /**
   * Lifecycle status. Defaults to `"active"` when absent (all rows authored
   * before D-PARTY-REGISTER PR 4 omit this field; the `lookupEventType`
   * helper normalises the absence to `"active"` so callers may always
   * compare `status === "deprecated"` without an undefined guard).
   */
  readonly status?: EventTypeStatus;
  /**
   * The event type that supersedes this one. Set when `status === "deprecated"`.
   * Carries the canonical type name of the replacement; callers and producers
   * should migrate to that type. Omit for active rows.
   */
  readonly supersededBy?: string;
  /**
   * Zod schema for the payload, when one exists. When undefined the
   * append path validates only the envelope (event_id / type / as_of /
   * entity / actor / citations / payload-as-Record<string,unknown>) and
   * waits for the producer to land its typed schema.
   */
  readonly payloadSchema?: z.ZodType<Record<string, unknown>>;
  /**
   * Who emits this event. "any-agent" means any registered agent may
   * emit it (e.g. AgentEscalation). Specific agent names match the
   * /Team/<Name>.md persona file. "substrate" means the runtime emits
   * it without an agent in the loop (e.g. ScheduledTrigger).
   */
  readonly issuer: "any-agent" | "substrate" | string;
  /**
   * Agents (and "external" / "audit") that read this event type. Used by
   * Atlas's permission-policy generator (A2) to publish event-subscribe
   * allow-lists, and by Vera's audit pipelines to know what to expect.
   */
  readonly subscribers: readonly string[];
  /** Replay-fold rule this type's payload obeys (A0 §6). */
  readonly replay: ReplayFold;
  /**
   * Per-type retention floor + archival-tier policy. Authority:
   * D-EVENT-STORE-SCALING (CEO approved 2026-05-10) Slice 1. Required
   * non-null on every row — conservative-default backfill is
   * `RETENTION_CONSERVATIVE_DEFAULT` and is a Mira follow-on to refine.
   */
  readonly retention: RetentionMetadata;
  /**
   * Per-type snapshot cadence. Authority: D-EVENT-STORE-SCALING
   * (CEO-approved 2026-05-10) Slice 2 / Q1 resolution. **Optional** —
   * unset rows resolve to `DEFAULT_SNAPSHOT_CADENCE` at lookup time.
   * Mira (Compliance / RegTech engineer) follow-on populates per-type
   * cadence values where retention / read-amplification justify
   * tighter or looser thresholds; until then, every type rides the
   * default.
   */
  readonly cadence?: SnapshotCadence;
  /**
   * Citation-set hint — a starter list of obligation URNs / governance
   * tokens the producer is expected to cite. Not enforced by this
   * registry (the P2 gate is content-of-citations agnostic; it just
   * requires non-empty); used as a documentation aid and as input to
   * Mira's URN-coverage recon.
   */
  readonly citationsHint?: readonly string[];
  /** Source-spec reference (A0 freeze entry, persona spec section, etc.). */
  readonly source: string;
  /**
   * V1→V2 migration journey for this event type. Required on every row so
   * TypeScript enforces coverage across the full registry. The
   * `recon:v1-removal-v2status-coverage` gate asserts this at runtime.
   * The `recon:v1-removal-ratchet` gate tracks the count of `"v1-only"`
   * rows — the ratchet may only decrease (harden-only; D-V1-REMOVAL-PHASE-1).
   *
   * Tagging guide:
   *   - "v2-parallel"  — CCR-EAD family (SA-CCR runs in parallel on V2);
   *                      FIL-instance / FIL-model events whose V2 projections
   *                      are live read-only alongside the V1 book.
   *   - "v2-replaced"  — none yet in Phase 1. Set when the domain flip is
   *                      approved by Decision and V1 is retired.
   *   - "v1-only"      — everything else. The conservative default: the
   *                      ratchet only prevents the count from *increasing*,
   *                      so tagging v1-only is always safe.
   *
   * Authority: D-V1-REMOVAL-PHASE-1 (CEO-approved 2026-06-15).
   */
  readonly v2Status: V2CutoverStatus;
  /**
   * The CURRENT payload schema version for this event type
   * (D-EVENT-ENVELOPE-SCHEMA-VERSION). The registry is the authority for
   * "what version do new events of this type carry"; the go-forward V2 envelope
   * stamps this number, and version-explicit upcaster dispatch switches on it.
   *
   * **Optional**: a row without this field is version 1 by convention (a single,
   * never-changed payload shape). Set it to an integer >1 ONLY when the payload
   * shape has changed — and when it is >1 the type MUST declare a version-keyed
   * upcaster, asserted (fail-closed) by `recon:v2-multi-version-type-upcaster`.
   * This replaces inferring version from incidental payload shape.
   */
  readonly schemaVersion?: number;
}
