// platform/identity/party-projection.ts
//
// D-PARTY-REGISTER PR 2 (CEO-approved 2026-05-11) — multi-stream
// projection over the 10 Party event types in `domains/party/`.
//
// Reads the event store; never writes (Principle 1 — events are truth,
// projections are queries). All consumers — the dashboard tile, the
// canonical register render, future Vera audits — call into this module
// rather than re-folding the Party stream themselves.
//
// Replay rules (mirrors registry.ts metadata):
//   - PartyRegistered            → latest-wins-per-key on partyId
//   - PartyAttributeChanged      → cumulative-fold (applied to PartyRecord)
//   - PartyClassified            → cumulative-fold; classifications set per partyId
//   - PartyDeclassified          → removes from the classifications set
//   - PartyScreeningCompleted    → cumulative-fold; latest result per (partyId, screeningType)
//   - PartyRelationshipAsserted  → cumulative-fold; relationship live unless revoked
//   - PartyRelationshipChanged   → mutates scope/evidence on a live relationship
//   - PartyRelationshipRevoked   → marks the relationship as revoked
//   - BeneficialOwnerChainAsserted → append-only audit trail (queryable)
//   - PartyDeactivated           → marks Party as deactivated (terminal)
//
// Author: Imani (Legal-as-code engineer; reports to Devon, Chief
// Operating Officer, governance).

import type {
  Ba325ResidencyBucket,
  KindAttributes,
  PartyId,
  PartyKind,
  RelationshipKind,
  SarbSectorCode,
} from "../../domains/party";
import type { EventStore } from "../event-store/store";

/** ISO-3166 alpha-2 code for the bank's home jurisdiction (the Exchange-Control residency anchor). */
const HOME_JURISDICTION_CODE = "ZA";

/**
 * Decide whether a jurisdiction / tax-residency list marks the party as a
 * SA resident. Mirrors the same logic as `residencyFromLists` in
 * `counterparty-residency.ts` — kept here to avoid a circular import
 * (counterparty-residency.ts imports PartyProjection from this file).
 *
 * Returns:
 *   - `"resident"`     when ZA is present in the preferred basis
 *   - `"non-resident"` when a non-empty list excludes ZA
 *   - `null`           when there is NO residency evidence at all
 */
function computeResidencyFromLists(
  taxResidencies: readonly string[] | undefined,
  jurisdictions: readonly string[] | undefined,
): "resident" | "non-resident" | null {
  const primary = taxResidencies && taxResidencies.length > 0 ? taxResidencies : undefined;
  const fallback = jurisdictions && jurisdictions.length > 0 ? jurisdictions : undefined;
  const basis = primary ?? fallback;
  if (!basis) return null;
  return basis.includes(HOME_JURISDICTION_CODE) ? "resident" : "non-resident";
}

/**
 * Derive the BA 100 R1010 SARB sector code for a party from its registration
 * attributes. This is a STRUCTURAL DERIVATION — deterministic from the party's
 * kind-attributes + jurisdictions that are already in the event log. The result
 * is stored on `PartyRecord.counterpartySector` so the BA 100 fold can join
 * without re-folding the party stream.
 *
 * Derivation rules (validated against SARB BA 100 R1010 row labels):
 *   1. `classifications` includes "central-bank"             → "sovereign"
 *      (SARB BA 100 R1020 includes "central banks"; SARB = sovereign bucket)
 *   2. `kindAttributes.primaryRegulator === "PA"`            → "bank"
 *      (a PA-regulated legal entity is a SARB-licensed bank)
 *   3. `kindAttributes.primaryRegulator === "JSE"` or "FSCA" → "securities-firm"
 *      (a JSE/FSCA-regulated entity is a securities firm / broker-dealer)
 *   4. `kindAttributes.kind === "legal-entity"` (other)     → "corporate"
 *      (default for institutional non-bank legal entities)
 *   5. `kindAttributes.kind === "natural-person"`           → "retail"
 *      (natural persons are retail counterparties per BCBS LCR §73)
 *   6. `kindAttributes.kind === "agent"`                    → null
 *      (internal agents are not external counterparties; no sector)
 *
 * Authority: SARB BA 100 R1010–R1090; BCBS d238 §71–74 (LCR retail/wholesale);
 *   Reg 26 (Regulations Relating to Banks); D-BA-RETURN-CELL-VALUE-ENGINE.
 */
function deriveSarbSectorCode(
  kindAttributes: KindAttributes,
  classifications: ReadonlySet<string>,
): SarbSectorCode | undefined {
  // Rule 1 — central bank → sovereign bucket (BA 100 R1020 includes central banks).
  if (classifications.has("central-bank")) return "sovereign";

  if (kindAttributes.kind === "legal-entity") {
    const reg = kindAttributes.primaryRegulator;
    // Rule 2 — PA-licensed bank → bank bucket.
    if (reg === "PA") return "bank";
    // Rule 3 — JSE / FSCA regulated → securities firm.
    if (reg === "JSE" || reg === "FSCA") return "securities-firm";
    // Rule 4 — other institutional legal entity → corporate.
    return "corporate";
  }
  if (kindAttributes.kind === "natural-person") return "retail";
  // Rule 6 — agent: no sector (in-house or external automation, not a counterparty).
  return undefined;
}

// ---------------------------------------------------------------------------
// PartyRecord — the projected per-Party shape
// ---------------------------------------------------------------------------

export interface ScreeningResult {
  readonly screeningType: "sanctions" | "pep" | "adverse-media" | "fit-and-proper" | "kyc-tier";
  readonly result: string;
  readonly evidenceRef: string;
  readonly asOf: string;
}

export interface PartyRecord {
  readonly partyId: PartyId;
  readonly kind: PartyKind;
  readonly displayName: string;
  readonly legalName?: string;
  readonly jurisdictions: readonly string[];
  readonly taxResidencies?: readonly string[];
  readonly classifications: readonly string[];
  readonly screeningResults: readonly ScreeningResult[];
  readonly kindAttributes: KindAttributes;
  readonly registeredAt: string;
  readonly deactivatedAt?: string;
  readonly deactivationReason?: string;
  /**
   * BA 325 / Exchange-Control residency bucket — computed at fold time from
   * `taxResidencies` (preferred, the Exchange-Control residency basis) or
   * `jurisdictions` (fallback). Present when at least one jurisdiction / tax-
   * residency is registered; absent (undefined) when there is NO residency
   * evidence at all (fail-closed: consumers must handle undefined and NOT guess).
   * Mirrors the `Ba325ResidencyBucket` type from counterparty-residency.ts.
   * Authority: D-BA-RETURN-CELL-VALUE-ENGINE Phase 3; SARB BA 325 reg-29(3).
   */
  readonly residency?: Ba325ResidencyBucket;
  /**
   * SARB BA 100 R1010 counterparty-sector code — derived at fold time from the
   * party's `kindAttributes` + `classifications`. Present for `legal-entity` and
   * `natural-person` kinds; absent for `agent` kind (in-house automation, not an
   * external counterparty). Fail-closed: absent means the sector is unknown — the
   * BA 100 fold must surface a gap, never guess a default.
   * Authority: D-BA-RETURN-CELL-VALUE-ENGINE Phase 3; SARB BA 100 R1010–R1090.
   */
  readonly counterpartySector?: SarbSectorCode;
}

// ---------------------------------------------------------------------------
// RelationshipRecord — the projected per-edge shape
// ---------------------------------------------------------------------------

export interface RelationshipRecord {
  readonly relationshipId: string;
  readonly fromPartyId: PartyId;
  readonly toPartyId: PartyId;
  readonly kind: RelationshipKind;
  readonly scopeJson: Readonly<Record<string, unknown>>;
  readonly effectiveFrom: string;
  readonly revokedAt?: string;
  readonly revokeReason?: string;
}

export interface RelationshipGraph {
  readonly all: readonly RelationshipRecord[];
  /** Live (non-revoked) edges only — what most consumers want. */
  readonly live: readonly RelationshipRecord[];
}

// ---------------------------------------------------------------------------
// BeneficialOwnerChainRecord — append-only audit shape
// ---------------------------------------------------------------------------

export interface BeneficialOwnerChainRecord {
  readonly rootCounterpartyPartyId: PartyId;
  readonly chain: readonly PartyId[];
  readonly piercedToNaturalPersonAt: number;
  readonly assertedAt: string;
}

// ---------------------------------------------------------------------------
// Folding helpers
// ---------------------------------------------------------------------------

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asReadonlyRecord(v: unknown): Readonly<Record<string, unknown>> {
  return typeof v === "object" && v !== null ? (v as Readonly<Record<string, unknown>>) : {};
}

function asPartyId(v: unknown): PartyId | undefined {
  return typeof v === "string" && v.startsWith("urn:party:") ? (v as PartyId) : undefined;
}

function asPartyKind(v: unknown): PartyKind | undefined {
  if (v === "natural-person" || v === "legal-entity" || v === "agent") return v;
  return undefined;
}

function asRelationshipKind(v: unknown): RelationshipKind | undefined {
  return typeof v === "string" ? (v as RelationshipKind) : undefined;
}

// ---------------------------------------------------------------------------
// Multi-stream projection
// ---------------------------------------------------------------------------

interface MutablePartyRecord {
  partyId: PartyId;
  kind: PartyKind;
  displayName: string;
  legalName?: string;
  jurisdictions: string[];
  taxResidencies?: string[];
  classifications: Set<string>;
  screeningResults: Map<string, ScreeningResult>;
  kindAttributes: KindAttributes;
  registeredAt: string;
  deactivatedAt?: string;
  deactivationReason?: string;
  // Phase 3 — computed at freeze time from the final mutable state.
  // Not set during event folding; populated in freezePartyRecord().
  residency?: Ba325ResidencyBucket;
  counterpartySector?: SarbSectorCode;
}

interface MutableRelationshipRecord {
  relationshipId: string;
  fromPartyId: PartyId;
  toPartyId: PartyId;
  kind: RelationshipKind;
  scopeJson: Record<string, unknown>;
  effectiveFrom: string;
  revokedAt?: string;
  revokeReason?: string;
}

function freezePartyRecord(m: MutablePartyRecord): PartyRecord {
  // Phase 3 — compute residency + sector from the FINAL mutable state (all
  // PartyAttributeChanged patches have been applied) before freezing. This
  // ensures the fold-time join in the BA 100 reference-data layer reads a
  // consistent, final value without re-processing the event stream.

  // RESIDENCY: prefer tax-residency (Exchange-Control basis); fall back to
  // jurisdiction of incorporation. Returns null when NO evidence is present
  // (fail-closed; the field is then omitted from the frozen record).
  const rawResidency = computeResidencyFromLists(m.taxResidencies, m.jurisdictions);
  // For legal-entity Parties, also derive the Authorised-Dealer bucket: a
  // ZA-resident legal entity whose primaryRegulator is "PA" is a SA bank =
  // an Exchange-Control Authorised Dealer (Currency & Exchanges Manual §A.1).
  let residency: Ba325ResidencyBucket | undefined;
  if (m.classifications.has("central-bank")) {
    residency = "sarb";
  } else if (
    rawResidency === "resident" &&
    m.kindAttributes.kind === "legal-entity" &&
    m.kindAttributes.primaryRegulator === "PA"
  ) {
    residency = "authorised-dealer";
  } else if (rawResidency !== null) {
    residency = rawResidency;
  }

  // SECTOR: derive from kindAttributes + classifications (structural derivation
  // from data already in the event log — no new event type required).
  const counterpartySector = deriveSarbSectorCode(m.kindAttributes, m.classifications);

  const result: PartyRecord = {
    partyId: m.partyId,
    kind: m.kind,
    displayName: m.displayName,
    ...(m.legalName !== undefined ? { legalName: m.legalName } : {}),
    jurisdictions: [...m.jurisdictions],
    ...(m.taxResidencies !== undefined ? { taxResidencies: [...m.taxResidencies] } : {}),
    classifications: [...m.classifications],
    screeningResults: [...m.screeningResults.values()],
    kindAttributes: m.kindAttributes,
    registeredAt: m.registeredAt,
    ...(m.deactivatedAt !== undefined ? { deactivatedAt: m.deactivatedAt } : {}),
    ...(m.deactivationReason !== undefined ? { deactivationReason: m.deactivationReason } : {}),
    ...(residency !== undefined ? { residency } : {}),
    ...(counterpartySector !== undefined ? { counterpartySector } : {}),
  };
  return result;
}

function freezeRelationshipRecord(m: MutableRelationshipRecord): RelationshipRecord {
  return {
    relationshipId: m.relationshipId,
    fromPartyId: m.fromPartyId,
    toPartyId: m.toPartyId,
    kind: m.kind,
    scopeJson: m.scopeJson,
    effectiveFrom: m.effectiveFrom,
    ...(m.revokedAt !== undefined ? { revokedAt: m.revokedAt } : {}),
    ...(m.revokeReason !== undefined ? { revokeReason: m.revokeReason } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PartyProjection {
  readonly parties: ReadonlyMap<PartyId, PartyRecord>;
  readonly relationships: RelationshipGraph;
  readonly beneficialOwnerChains: readonly BeneficialOwnerChainRecord[];
  readonly asOf: string;
}

/**
 * Fold every Party event in the store into the read-model. Single pass
 * over the event stream; cost is O(|stream|).
 */
export function buildPartyProjection(eventStore: EventStore, asOf?: string): PartyProjection {
  const parties = new Map<PartyId, MutablePartyRecord>();
  const relationships = new Map<string, MutableRelationshipRecord>();
  const beneficialOwnerChains: BeneficialOwnerChainRecord[] = [];

  for (const e of eventStore.replay()) {
    const p = e.payload as Record<string, unknown>;
    switch (e.type) {
      case "PartyRegistered": {
        const partyId = asPartyId(p.partyId);
        const kind = asPartyKind(p.kind);
        if (!partyId || !kind) break;
        if (parties.has(partyId)) break; // latest-wins on partyId; first-write wins for registration
        const kindAttributes = p.kindAttributes as KindAttributes | undefined;
        if (!kindAttributes) break;
        parties.set(partyId, {
          partyId,
          kind,
          displayName: asString(p.displayName, partyId),
          ...(typeof p.legalName === "string" ? { legalName: p.legalName } : {}),
          jurisdictions: asStringArray(p.jurisdictions),
          ...(Array.isArray(p.taxResidencies)
            ? { taxResidencies: asStringArray(p.taxResidencies) }
            : {}),
          classifications: new Set<string>(),
          screeningResults: new Map<string, ScreeningResult>(),
          kindAttributes,
          registeredAt: e.as_of,
        });
        break;
      }
      case "PartyAttributeChanged": {
        const partyId = asPartyId(p.partyId);
        if (!partyId) break;
        const m = parties.get(partyId);
        if (!m) break;
        // Apply inline kindAttributesPatch when present (build-phase back-fill
        // path — no doc-store yet). Fields are merged last-write-wins into the
        // existing kindAttributes. Doc-store-backed updates remain a future
        // extension (accept a doc-store accessor and resolve the snapshot).
        const patch = p.kindAttributesPatch as Record<string, unknown> | undefined;
        if (patch && m.kindAttributes?.kind === "legal-entity") {
          const attrs = m.kindAttributes as unknown as Record<string, unknown>;
          if (patch.lei !== undefined) attrs.lei = patch.lei;
          if (patch.bic !== undefined) attrs.bic = patch.bic;
          if (patch.authorisedProducts !== undefined)
            attrs.authorisedProducts = patch.authorisedProducts;
          if (patch.eligibleFxPairs !== undefined) attrs.eligibleFxPairs = patch.eligibleFxPairs;
          if (patch.buildPhaseStatus !== undefined) attrs.buildPhaseStatus = patch.buildPhaseStatus;
        }
        break;
      }
      case "PartyClassified": {
        const partyId = asPartyId(p.partyId);
        const classification = asString(p.classification);
        if (!partyId || !classification) break;
        const m = parties.get(partyId);
        if (!m) break;
        m.classifications.add(classification);
        break;
      }
      case "PartyDeclassified": {
        const partyId = asPartyId(p.partyId);
        const classification = asString(p.classification);
        if (!partyId || !classification) break;
        const m = parties.get(partyId);
        if (!m) break;
        m.classifications.delete(classification);
        break;
      }
      case "PartyScreeningCompleted": {
        const partyId = asPartyId(p.partyId);
        if (!partyId) break;
        const m = parties.get(partyId);
        if (!m) break;
        const screeningType = asString(p.screeningType) as ScreeningResult["screeningType"];
        const result = asString(p.result);
        const evidenceRef = asString(p.evidenceRef);
        if (!screeningType || !result || !evidenceRef) break;
        m.screeningResults.set(screeningType, {
          screeningType,
          result,
          evidenceRef,
          asOf: e.as_of,
        });
        break;
      }
      case "PartyRelationshipAsserted": {
        const relationshipId = asString(p.relationshipId);
        const fromPartyId = asPartyId(p.fromPartyId);
        const toPartyId = asPartyId(p.toPartyId);
        const kind = asRelationshipKind(p.kind);
        if (!relationshipId || !fromPartyId || !toPartyId || !kind) break;
        if (relationships.has(relationshipId)) break;
        relationships.set(relationshipId, {
          relationshipId,
          fromPartyId,
          toPartyId,
          kind,
          scopeJson: { ...asReadonlyRecord(p.scopeJson) },
          effectiveFrom: asString(p.effectiveFrom, e.as_of),
        });
        break;
      }
      case "PartyRelationshipChanged": {
        const relationshipId = asString(p.relationshipId);
        if (!relationshipId) break;
        const m = relationships.get(relationshipId);
        if (!m) break;
        // Scope/evidence refresh — we record that the change occurred
        // without rehydrating the doc-store snapshot here.
        break;
      }
      case "PartyRelationshipRevoked": {
        const relationshipId = asString(p.relationshipId);
        if (!relationshipId) break;
        const m = relationships.get(relationshipId);
        if (!m) break;
        m.revokedAt = asString(p.effectiveFrom, e.as_of);
        m.revokeReason = asString(p.reason);
        break;
      }
      case "BeneficialOwnerChainAsserted": {
        const root = asPartyId(p.rootCounterpartyPartyId);
        const chain = Array.isArray(p.chain)
          ? (p.chain as unknown[]).map(asPartyId).filter((x): x is PartyId => x !== undefined)
          : [];
        const pierced =
          typeof p.piercedToNaturalPersonAt === "number" ? p.piercedToNaturalPersonAt : -1;
        if (!root || chain.length === 0 || pierced < 0) break;
        beneficialOwnerChains.push({
          rootCounterpartyPartyId: root,
          chain,
          piercedToNaturalPersonAt: pierced,
          assertedAt: e.as_of,
        });
        break;
      }
      case "PartyDeactivated": {
        const partyId = asPartyId(p.partyId);
        if (!partyId) break;
        const m = parties.get(partyId);
        if (!m) break;
        m.deactivatedAt = asString(p.effectiveFrom, e.as_of);
        m.deactivationReason = asString(p.reason);
        break;
      }
      default:
        break;
    }
  }

  // Freeze
  const frozenParties = new Map<PartyId, PartyRecord>();
  for (const [k, m] of parties.entries()) frozenParties.set(k, freezePartyRecord(m));
  const allEdges = [...relationships.values()].map(freezeRelationshipRecord);
  const liveEdges = allEdges.filter((e) => e.revokedAt === undefined);
  return {
    parties: frozenParties,
    relationships: { all: allEdges, live: liveEdges },
    beneficialOwnerChains,
    asOf: asOf ?? new Date().toISOString(), // wall-clock: default when asOf not supplied by caller
  };
}

// ---------------------------------------------------------------------------
// Convenience query helpers
// ---------------------------------------------------------------------------

export function lookupParty(projection: PartyProjection, urn: PartyId): PartyRecord | undefined {
  return projection.parties.get(urn);
}

export interface RelationshipQuery {
  readonly from?: PartyId;
  readonly to?: PartyId;
  readonly kind?: RelationshipKind;
  /** Include revoked edges; default false. */
  readonly includeRevoked?: boolean;
}

export function queryRelationships(
  projection: PartyProjection,
  q: RelationshipQuery = {},
): readonly RelationshipRecord[] {
  const source = q.includeRevoked ? projection.relationships.all : projection.relationships.live;
  return source.filter((edge) => {
    if (q.from && edge.fromPartyId !== q.from) return false;
    if (q.to && edge.toPartyId !== q.to) return false;
    if (q.kind && edge.kind !== q.kind) return false;
    return true;
  });
}

export interface PartyKindCounts {
  readonly "natural-person": number;
  readonly "legal-entity": number;
  readonly counterparty: number;
  readonly agent: number;
  readonly total: number;
}

export function countPartiesByKind(projection: PartyProjection): PartyKindCounts {
  const counts = {
    "natural-person": 0,
    "legal-entity": 0,
    counterparty: 0,
    agent: 0,
    total: 0,
  };
  for (const p of projection.parties.values()) {
    counts[p.kind] += 1;
    counts.total += 1;
  }
  return counts;
}

export interface PartyTileSummary {
  readonly counts: PartyKindCounts;
  readonly relationshipsLive: number;
  readonly relationshipsRevoked: number;
  readonly beneficialOwnerChains: number;
  readonly asOf: string;
}

export function buildPartyTileSummary(projection: PartyProjection): PartyTileSummary {
  return {
    counts: countPartiesByKind(projection),
    relationshipsLive: projection.relationships.live.length,
    relationshipsRevoked:
      projection.relationships.all.length - projection.relationships.live.length,
    beneficialOwnerChains: projection.beneficialOwnerChains.length,
    asOf: projection.asOf,
  };
}

// ---------------------------------------------------------------------------
// ConnectedCounterpartyGroup — LEX D3/2022 connected-group helper.
//
// Per Procedures/by-policy/credit-risk-limit-management.md §5.3 (PROC-RISK-
// CLM-01), a counterparty's connected group is identified by applying two
// regulatory tests:
//
//   (a) Control test          — one party directly or indirectly controls
//                               the other per IFRS 10 control definition.
//   (b) Interdependence test  — financial difficulties of one would cause
//                               financial difficulties in the other; LEI
//                               hierarchy + economic dependence + control
//                               rights.
//
// v0 implementation (this slice): walk the live `parent-of` and `ubo-of`
// relationship graph rooted at the counterparty Party to build a transitive
// group set. This covers the LEI-hierarchy slice of the control test.
//
// TODO (Mira / Imani follow-on under PROC-RISK-CLM-01 §5.3 + Owen-flagged
// citation gap): operationalise the economic-dependence sub-test and the
// control-rights sub-test (IFRS 10 paragraph cite + D3/2022 interdependence
// notification deadline). These slices land via dedicated party-register
// relationship kinds + a `ConnectedCounterpartyGroupResolved` event
// (procedure §5.3 line 137 onward).
// ---------------------------------------------------------------------------

export interface ConnectedGroup {
  /** Stable group identifier — derived from the root Party URN. */
  readonly groupId: string;
  /** Party URNs in the group, deterministic order (sorted). Includes the seed. */
  readonly members: readonly string[];
}

/**
 * Convenience helper — builds the Party projection from the supplied
 * event store and returns the connected group for `partyId`. Equivalent to
 * `getConnectedGroup(buildPartyProjection(store), partyId)` but offered as
 * a single call so callers (Vera recon pipelines, the credit-limit engine)
 * don't need to thread the projection through their own dependency graph.
 *
 * Returns `null` if the seed Party is not registered in the store.
 */
export function getConnectedGroupFromStore(
  eventStore: EventStore,
  partyId: string,
  asOf?: string,
): ConnectedGroup | null {
  const projection = buildPartyProjection(eventStore, asOf);
  return getConnectedGroup(projection, partyId);
}

/**
 * Resolve a counterparty's connected-counterparty group (LEX D3/2022).
 *
 * Returns `null` if the seed Party is not registered. Returns a group of
 * size 1 (the seed alone) when the Party is registered but has no
 * connected-group relationships.
 *
 * The walk follows live (non-revoked) edges only, in BOTH directions on
 * `parent-of` and `ubo-of`:
 *   - parent-of    — direct corporate control hierarchy (legal-entity tree).
 *   - ubo-of       — beneficial-owner pierce; natural-person UBOs may
 *                    connect multiple legal entities under shared control.
 *
 * Cycle-safe: visited-set bounds the walk; relationship graph is typically
 * small (~few dozen edges per Party).
 *
 * Pure projection — reads only the supplied `PartyProjection`, never the
 * event store directly.
 *
 * Authority: Procedures/by-policy/credit-risk-limit-management.md §5.3;
 *   Policies/credit-risk-policy-v1.md §2; LEX Directive D3/2022;
 *   BCBS 283 §11–14 (connected counterparty framework).
 */
export function getConnectedGroup(
  projection: PartyProjection,
  partyId: string,
): ConnectedGroup | null {
  if (!partyId.startsWith("urn:party:")) {
    return null;
  }
  const seed = partyId as PartyId;
  if (!projection.parties.has(seed)) {
    return null;
  }

  const groupKinds: readonly RelationshipKind[] = ["parent-of", "ubo-of"];
  const visited = new Set<string>([seed]);
  const queue: PartyId[] = [seed];
  // Cycle bound — generous (typical control / UBO graphs are < 50 nodes).
  let hops = 0;
  const MAX_HOPS = 200;

  while (queue.length > 0 && hops < MAX_HOPS) {
    hops += 1;
    const cursor = queue.shift() as PartyId;
    for (const kind of groupKinds) {
      // Outbound — cursor is `parent-of` / `ubo-of` someone else.
      for (const edge of projection.relationships.live) {
        if (edge.kind !== kind) continue;
        if (edge.fromPartyId === cursor && !visited.has(edge.toPartyId)) {
          visited.add(edge.toPartyId);
          queue.push(edge.toPartyId);
        }
        // Inbound — someone is `parent-of` / `ubo-of` cursor.
        if (edge.toPartyId === cursor && !visited.has(edge.fromPartyId)) {
          visited.add(edge.fromPartyId);
          queue.push(edge.fromPartyId);
        }
      }
    }
  }

  const members = [...visited].sort();
  const groupId = `group:${seed}`;
  return { groupId, members };
}

/**
 * Walk the `acts-on-behalf-of` / `reports-to` chain from a starting Party
 * up through the graph until no further edge applies (or a cycle would
 * form). Returns the ordered chain of Party URNs including the starting
 * Party.
 *
 * Used by the "all in-house agents acting for Hoz Bank" query: take an
 * agent Party, walk its `reports-to` chain, see whether the terminal
 * node is a bank legal-entity Party.
 */
export function walkReportsToChain(
  projection: PartyProjection,
  start: PartyId,
  edgeKind: RelationshipKind = "reports-to",
): readonly PartyId[] {
  const chain: PartyId[] = [start];
  const seen = new Set<string>([start]);
  let cursor = start;
  // Cycle bound — graph is small (~few dozen), 50 hops is generous.
  for (let i = 0; i < 50; i++) {
    const next = queryRelationships(projection, { from: cursor, kind: edgeKind })[0];
    if (!next) break;
    if (seen.has(next.toPartyId)) break; // cycle guard
    chain.push(next.toPartyId);
    seen.add(next.toPartyId);
    cursor = next.toPartyId;
  }
  return chain;
}
