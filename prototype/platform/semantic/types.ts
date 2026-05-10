// platform/semantic/types.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 1 — semantic-layer registry types.
//
// The semantic layer is the bank's typed business-vocabulary above the
// event log. Per `Owner Inbox/2026-05-10_bea-atlas_reporting-capability-
// m2-m3-build-proposal.md` §3.1 + §4 + §6 Slice 1, every named quantity
// the bank reports — Balance, Exposure, RWA, CET1, LCR, NSFR, ECL stage —
// has exactly one definition, exactly one citation chain, and one
// projection-derived computation. The same number reaches the BA return,
// the AFS note, the BRC pack, and the regulator submission.
//
// Architectural placement (per pack §3.1 ASCII pipeline):
//   EVENT LOG                         (P1 — sole truth)
//      → PROJECTION RUNTIME           (pure folds)
//      → SEMANTIC LAYER               (this module — typed quantity registry)
//      → REPORT GENERATORS            (pure functions over semantic queries)
//      → RENDER + STORE               (RMS doc store)
//
// Slice 1 lands the registry types + the in-memory registry + three worked
// entries (Slice 1 §6 exit criterion: `Balance`, `Exposure`,
// `CashAndBalancesAtSARB`). Slice 2 (period-close events) and Slice 3 (BA
// 325 LCR generator harness) are downstream consumers that read from this
// substrate; this slice does not implement either.
//
// Principles bound:
//   - P1 (events are truth): every entry's `projection` field names the
//     projection that produces the value. The registry stores the
//     definition; the value is always recomputed by replay.
//   - P2 (citation discipline): every entry MUST carry at least one
//     citation. The recon pipeline `recon:semantic-layer-citation-
//     coverage` (Vera Wave-N follow-on, surfaced in pack §8.5) asserts
//     coverage and resolvability against the obligations register.
//   - P5 (multi-currency, multi-entity): every entry declares its
//     dimensions; entity / currency / IFRS-classification / regulatory-
//     cell are all first-class.
//   - P6 (single-graph): every entry IS a node in the upward graph
//     (Regulation → Policy → Procedure → System Capability) — the
//     `citations` array carries the upward anchors, the `projection` and
//     `formula` carry the downward derivation.
//   - P7 (autonomous-by-default): the registry is curated by Anya (Data /
//     analytics engineer, engineering — reports to Devon COO; semantic-
//     layer + projection-runtime curator) on a continuous cadence; new
//     entries land via PRs that pass `recon:semantic-layer-citation-
//     coverage`.
//
// Author: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)

/**
 * A `SemanticEntryId` is a stable, human-readable identifier for a named
 * quantity. Convention: PascalCase, no separators (e.g. `Balance`,
 * `Exposure`, `CashAndBalancesAtSARB`, `CET1`, `LCR`). The id MUST be
 * unique across the registry; collision is a registry-construction error.
 */
export type SemanticEntryId = string;

/**
 * The unit of a quantity. The semantic layer is unit-aware so that
 * downstream generators cannot accidentally add a percentage to a money
 * amount, or compare a ratio to a count. Currency-amount entries carry
 * the currency on the entry's dimensions, not in the unit string itself
 * (per Principle 5 — currency at the type level, on the dimension axis,
 * never baked into the unit name).
 */
export type SemanticUnit =
  /** Money amount in the currency named by the `currency` dimension; minor units (cents). */
  | "money-minor"
  /** Dimensionless ratio (0..N). Reported as a fraction; render layer multiplies by 100 for percentage display. */
  | "ratio"
  /** Counted quantity (e.g. instrument units, headcount). */
  | "count"
  /** Percentage already expressed as 0..100 (rare; ratios are preferred). */
  | "percent"
  /** Pure number with no unit (e.g. an internal-rating notch). */
  | "scalar";

/**
 * IFRS classification dimension. Mirrors `chart-of-accounts.schema.json`'s
 * `ifrsClassification` enum — when an entry maps to a balance, it inherits
 * the underlying account's classification; the semantic layer makes this
 * explicit so a single quantity can be sliced by classification (e.g.
 * "FVTPL Balance for entity X as-of date Y").
 */
export type IfrsClassification =
  | "amortised-cost"
  | "fvoci-debt"
  | "fvoci-equity"
  | "fvtpl"
  | "non-financial"
  | "equity"
  | "n-a";

/**
 * Citation attached to a semantic-layer entry. Mirrors the shape used in
 * `chart-of-accounts.schema.json` so the same citation discipline binds
 * across both registers (Principle 2). The recon pipeline resolves the
 * `regulationId` form against `Regulations/_obligations-register.md` and
 * the `ifrsRef` / `statuteRef` / `policyRef` forms against the appropriate
 * upstream registers.
 */
export type SemanticCitation =
  | { readonly type: "regulation"; readonly regulationId: string; readonly note?: string }
  | {
      readonly type: "policy";
      readonly policyRef: string;
      readonly section?: string;
      readonly note?: string;
    }
  | { readonly type: "ifrs"; readonly ifrsRef: string; readonly note?: string }
  | { readonly type: "statute"; readonly statuteRef: string; readonly note?: string }
  /**
   * Placeholder citation per pack §9 Q1 (rehearsal-grade with
   * placeholders). Mira's instrument analyses back-fill; the recon
   * pipeline tracks placeholder density and warns above threshold.
   */
  | { readonly type: "tbc"; readonly note: string };

/**
 * Dimensions describe the axes a semantic entry varies along. Every
 * dimension a generator wants to slice by must be declared here; the
 * registry rejects queries that filter by an undeclared dimension.
 *
 * `entity` and `asOf` are implicit on every entry (the bank is multi-
 * entity from day one per Principle 5; every projection is replayable
 * to an as-of point per Principle 1). `currency` is implicit when the
 * unit is `money-minor`. The other dimensions are entry-specific.
 */
export type SemanticDimension =
  /** ISO 4217 currency. Implicit when unit = money-minor. */
  | "currency"
  /** GL account ID from chart-of-accounts (`ACC-NNNN-NNN`). */
  | "account"
  /** Counterparty ID (LEI or internal `CP-…`). */
  | "counterparty"
  /** Exposure kind (e.g. `loan`, `deposit`, `derivative`, `repo`). */
  | "exposureKind"
  /** RWA approach (`standardised`, `irb-foundation`, `irb-advanced`). */
  | "rwaApproach"
  /** Capital tier (`cet1`, `at1`, `t2`). */
  | "capitalTier"
  /** ECL stage (`stage-1`, `stage-2`, `stage-3`). */
  | "eclStage"
  /** IFRS classification slice — see `IfrsClassification`. */
  | "ifrsClassification"
  /** Portfolio identifier (free-form, governed by Anya's master-data registry). */
  | "portfolio"
  /** HQLA tier (`level-1`, `level-2a`, `level-2b`). */
  | "hqlaLevel";

/**
 * Regulatory-cell mapping declared on the entry. A semantic entry that
 * feeds a BA-return cell (or an AFS line) declares the mapping here so
 * the report generator (Slice 3+) can enumerate every cell that depends
 * on a given quantity. Mirrors the `baReturnLines` shape on the chart-of-
 * accounts schema for consistency.
 */
export interface RegulatoryCellMapping {
  /** BA-form identifier, e.g. `BA 100`, `BA 325`, `BA 700`. */
  readonly form: string;
  /** Line / cell identifier within the form. */
  readonly line: string;
  /** Sign on the cell — positive contribution, negative, or memo (informational). */
  readonly side: "positive" | "negative" | "memo";
  /** Free-form note. */
  readonly note?: string;
}

/**
 * IFRS / AFS-line mapping declared on the entry. Mirror of
 * `RegulatoryCellMapping` but for the IFRS AFS skeleton (Slice 8).
 */
export interface IfrsLineMapping {
  /** Statement, e.g. `SoFP`, `P&L`, `OCI`, `SoCE`, `SCF`. */
  readonly statement: "SoFP" | "P&L" | "OCI" | "SoCE" | "SCF" | "notes";
  /** Line label, e.g. `Cash and balances at SARB` or `Note 7 — Financial instruments`. */
  readonly line: string;
  /** Sign on the line. */
  readonly side: "positive" | "negative" | "memo";
  /** Free-form note. */
  readonly note?: string;
}

/**
 * The signer dimension records which governance accountable signs off
 * the entry's outputs. Mirrors the dispatch-discipline rule that every
 * report's `ReportApproved` event is signed by the accountable seat
 * (e.g. BA-100 capital → Camille CFO; BA-325 LCR → Camille CFO with
 * Eitan Treasurer methodology; market-risk BA-700 → Helena CRO).
 *
 * Multiple signers permitted (e.g. methodology + accounting accountable).
 */
export type SemanticSigner =
  /** "Anya" for Anya (Data / analytics engineer, engineering — reports to Devon COO). */
  | "Anya"
  /** "Bea" for Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO). */
  | "Bea"
  /** "Camille" for Camille (Chief Financial Officer, governance — reports to CEO). */
  | "Camille"
  /** "Helena" for Helena (Chief Risk Officer, governance — reports to CEO). */
  | "Helena"
  /** "Eitan" for Eitan (Treasurer, governance — reports to Camille CFO). */
  | "Eitan"
  /** "Mira" for Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO). */
  | "Mira";

/**
 * Status of an entry on the standard append-only-versioned lifecycle.
 *
 * - `draft` — entry is registered but not yet fit for downstream
 *   consumers. Generators may opt in to draft entries for development;
 *   recon pipelines warn (do not fail) on draft entries cited by an
 *   in-force generator.
 * - `in-force` — entry is the canonical definition for the named quantity
 *   at this version. Downstream consumers (BA-return generators, AFS
 *   generators, BRC packs) cite by `(id, version)`.
 * - `superseded` — entry was once in-force but a newer version is now
 *   in-force. The entry remains queryable for as-of replay before the
 *   supersession date (per P1).
 * - `deprecated` — entry is retired; new consumers MUST NOT cite it.
 *   Existing consumers receive a recon warning at audit time.
 */
export type SemanticEntryStatus = "draft" | "in-force" | "superseded" | "deprecated";

/**
 * The semantic-layer entry — one definition per named quantity per
 * version per entity-scope. Append-only-versioned: a change to any field
 * other than `status` requires a new entry with an incremented `version`.
 *
 * Field map (mirrors pack §3.1 "Each definition: { id, citation,
 * projection, formula, units }" plus the explicit signers / dimensions
 * scaffolding):
 *
 *   id            — stable PascalCase identifier
 *   version       — semver-ish `vN.M`; bumped on any non-status change
 *   description   — one-paragraph human-readable definition
 *   units         — see `SemanticUnit`
 *   dimensions    — declared axes the entry can be sliced by
 *   projection    — names the projection that produces the underlying state
 *                   (must exist in `@platform/projections`; the registry
 *                   stores the name only — the projection is wired by the
 *                   consumer via the projection-runtime contract)
 *   formula       — short algebraic / lambda-shape expression of how the
 *                   entry derives from the projection state. Documented
 *                   for human reviewers; not executed by the registry.
 *                   Slice 3+ generators carry the executable form.
 *   regulatoryCells — BA-form cells this entry feeds (optional)
 *   ifrsLines       — AFS / IFRS lines this entry feeds (optional)
 *   citations       — at least one citation per P2; mixed forms allowed
 *   signers         — accountable governance seat(s) for outputs that
 *                     consume this entry
 *   entityScope     — legal-entity URNs the entry is defined for. The
 *                     URN form (`urn:legal-entity:hoz:hoz-bank:v1`)
 *                     is canonical per `Regulations/_legal-entity-tree.md`.
 *                     A consolidated entry uses the group URN.
 *   ifrsClassifications — explicit IFRS-9 classification slices the entry
 *                         supports. Empty array = entry is classification-
 *                         agnostic (e.g. a pure count).
 *   status        — see `SemanticEntryStatus`
 *   supersededBy  — the (id, version) that supersedes this entry, when
 *                   `status === "superseded"`. Omitted otherwise.
 *   firstAuthored — ISO timestamp the entry was first authored.
 *   notes         — optional free-form note for reviewers.
 */
export interface SemanticEntry {
  readonly id: SemanticEntryId;
  readonly version: string; // `vN.M`
  readonly description: string;
  readonly units: SemanticUnit;
  readonly dimensions: readonly SemanticDimension[];
  readonly projection: string;
  readonly formula: string;
  readonly regulatoryCells?: readonly RegulatoryCellMapping[];
  readonly ifrsLines?: readonly IfrsLineMapping[];
  readonly citations: readonly SemanticCitation[];
  readonly signers: readonly SemanticSigner[];
  readonly entityScope: readonly string[];
  readonly ifrsClassifications?: readonly IfrsClassification[];
  readonly status: SemanticEntryStatus;
  readonly supersededBy?: { readonly id: SemanticEntryId; readonly version: string };
  readonly firstAuthored: string; // ISO-8601
  readonly notes?: string;
}

/**
 * Lookup key for resolving an entry. Either a bare id (resolves to the
 * single in-force version) or an explicit (id, version) pair (resolves
 * the named version regardless of status — used for as-of replay).
 */
export type SemanticEntryRef =
  | { readonly id: SemanticEntryId }
  | { readonly id: SemanticEntryId; readonly version: string };

/**
 * The shape returned when a recon-pipeline asks for a citation-coverage
 * snapshot. Every entry surfaces here once; aggregated counts let the
 * recon pipeline compute placeholder density (Q1) without re-walking
 * the registry.
 */
export interface CitationCoverageRow {
  readonly id: SemanticEntryId;
  readonly version: string;
  readonly status: SemanticEntryStatus;
  readonly citationCount: number;
  readonly resolvedCount: number;
  readonly placeholderCount: number;
  readonly citations: readonly SemanticCitation[];
}
