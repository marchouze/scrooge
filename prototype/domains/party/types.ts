// domains/party/types.ts
//
// D-PARTY-REGISTER (CEO-approved 2026-05-11) — unified Party event family.
// D-PARTY-RELATIONSHIP-KINDS-V0 (CEO-approved 2026-05-11) — closed v0 enum
// of typed graph edges between Parties.
//
// PR 1 of D-PARTY-REGISTER ships the substrate only — types, factories,
// schemas, registry rows. Backfill, projection, and register markdown ship
// in PR 2 (Imani, Legal-as-code engineer).
//
// Pure type module. No runtime imports. Discriminated-union payloads carry
// kind-specific attributes; the matching Zod schemas in `./schemas.ts`
// validate at the append boundary.
//
// Author: Atlas (Core banking platform architect; substrate)

// ===========================================================================
// PartyKind + PartyId
// ===========================================================================

/**
 * The three intrinsic actor kinds the bank deals with. The kind is
 * **intrinsic** — "what is this actor?" — and stable for the lifetime of
 * the Party. The role an actor plays toward another Party (signatory-of,
 * director-of, acts-on-behalf-of, counterparty-of, …) is a **relationship
 * edge**, not a change of kind.
 *
 * Note: "counterparty" is NOT a kind — it describes a *relationship*
 * between two Parties (the bank's trading/business relationship with an
 * external organisation). Institutional clients are registered as
 * `"legal-entity"` with a `counterparty-of` relationship edge to Hoz Bank.
 * Per D-PARTY-REGISTER correction (CEO-approved 2026-05-12).
 */
export type PartyKind = "natural-person" | "legal-entity" | "agent";

/**
 * The closed enum at value-level — used by schemas + the constraint
 * table in `./schemas.ts`. Mirrors `PartyKind` exactly.
 */
export const PARTY_KINDS = [
  "natural-person",
  "legal-entity",
  "agent",
] as const satisfies readonly PartyKind[];

/**
 * Stable surface key for a Party. Branded template-literal type — the
 * `<kind>` slot must match a `PartyKind` and the `<slug>` slot is a
 * URL-safe identifier (no whitespace, no `:` separators inside).
 *
 * Examples:
 *   - `urn:party:natural-person:marc-houze`
 *   - `urn:party:legal-entity:hoz-bank-limited`
 *   - `urn:party:legal-entity:acme-am` (institutional client — counterparty is a relationship, not a kind)
 *   - `urn:party:agent:scrooge`
 *
 * The schema-side validator in `./schemas.ts` enforces both the URN
 * shape and that the `<kind>` slot matches one of the four `PartyKind`
 * values.
 */
export type PartyId = `urn:party:${PartyKind}:${string}`;

// ===========================================================================
// Citation alias
// ===========================================================================

/**
 * Citation strings carried at the payload level, in addition to the
 * envelope `citations` array (P2). Per-payload citations target the
 * specific *purpose* of the event — e.g. a `PartyRelationshipAsserted`
 * with `kind: "ubo-of"` cites FIC Act s.21B; a `PartyRegistered` with
 * `kind: "legal-entity"` cites Companies Act + Banks Act s.7. The
 * envelope citations remain the P2 floor.
 */
export type Citation = string;

// ===========================================================================
// Kind-attribute discriminated unions
// ===========================================================================

/**
 * Kind-attributes for a `PartyKind = "natural-person"` registration.
 *
 * PII discipline (Principle 4 + POPIA s.19–22): only minimisation-safe
 * fields appear here. PII-grade fields (date of birth, ID number,
 * residential address, ID-document scan, source-of-funds documentation)
 * live in the BLAKE3 document store, referenced by hash via
 * `piiDocumentRef` (a single hash bundling all PII docs for this
 * person, or a ref into a manifest at the document-store layer).
 */
export interface NaturalPersonAttrs {
  readonly kind: "natural-person";
  /**
   * One or more ISO 3166-1 alpha-2 nationality codes. Multiple
   * permitted (dual citizens).
   */
  readonly nationalities: readonly string[];
  /**
   * Why this natural person is registered as a Party. Drives the
   * citation-coverage assertion (each role has a regulatory anchor —
   * `director` cites Companies Act s.69; `key-individual` cites FAIS;
   * `signatory` cites Companies Act s.66; etc.).
   *
   * `purposeRoles` is a *reason for registration* hint; the active
   * roles are the typed `PartyRelationshipAsserted` edges in the
   * relationships register.
   */
  readonly purposeRoles: readonly (
    | "director"
    | "ubo"
    | "signatory"
    | "authorised-trader"
    | "key-individual"
    | "employee"
    | "contractor"
    | "external-counsel"
    | "auditor"
    | "ceo"
    | "mlro"
    | "information-officer"
    | "cae"
    | "other"
  )[];
  /**
   * BLAKE3 hash referencing the PII bundle in the document store
   * (DOB, ID number, residential address, ID-doc scan, source-of-funds).
   * Per RMS Phase 1 doc-store pattern; format `blake3:<64-hex-chars>`.
   * Optional pre-licence-day for substrate-only Parties (e.g. Marc as
   * CEO seat); required from licence-day onward when Niko's customer
   * onboarding activates.
   */
  readonly piiDocumentRef?: string;
  /**
   * Hash-only date-of-birth (BLAKE3 hash of ISO date string). Permits
   * minimum-necessary equality checks (e.g. age verification, screening
   * de-duplication) without storing the cleartext DOB in the event log.
   * Optional for the same reason as `piiDocumentRef`.
   */
  readonly dobHashRef?: string;
}

/**
 * Kind-attributes for a `PartyKind = "legal-entity"` registration.
 *
 * Aliases the legal-entity-tree shape — the unified Party register
 * projects from `LegalEntityRegistered` events; `entityForm` /
 * `parentPartyId` / `primaryRegulator` mirror the existing
 * `LegalEntityRegistered` payload shape so the backfill in PR 2 is a
 * pure shape-mapping.
 */
export interface LegalEntityAttrs {
  readonly kind: "legal-entity";
  /**
   * Companies Act registered form. Mirrors `LegalEntityRegistered.
   * registeredForm` exactly — `Ltd` (public), `RF` (ring-fenced),
   * `Pty` (private). Banks Act s.11 requires the bank entity to be
   * `Ltd`; downstream registry checks assert that.
   */
  readonly entityForm: "Ltd" | "RF" | "Pty";
  /**
   * Parent legal-entity Party URN, or null for the top-of-tree group.
   * Encoded as a `parent-of` `PartyRelationshipAsserted` edge in
   * addition (the edge is canonical for graph queries; this field is
   * a convenience for projection seeding).
   */
  readonly parentPartyId: PartyId | null;
  /**
   * Primary regulator seat. Mirrors `LegalEntityRegistered.
   * regulatoryRegime.primaryRegulator`.
   */
  readonly primaryRegulator: "PA" | "JSE" | "FSCA" | "none-companies-act-only" | "other";
  /**
   * Ordered list of statutory / regulatory anchors that bind the
   * entity. Mirrors `LegalEntityRegistered.regulatoryRegime.regimeAnchor`.
   */
  readonly regimeAnchor: readonly string[];
  /**
   * Legal Entity Identifier (ISO 17442, 20-char alphanumeric). Required for
   * EMIR/SFTR reporting with EU counterparties. Optional until the bank holds
   * its own LEI and operates with EU-counterparty OTC derivatives.
   */
  readonly lei?: string;
  /**
   * SWIFT BIC-11 for the entity. Populated for institutional counterparties
   * the bank trades with (interbank FX, correspondent banking). Absent for
   * own-group entities and non-bank counterparties.
   */
  readonly bic?: string;
  /**
   * Product / service codes this entity is authorised to transact in with
   * the bank. Examples: "fx-spot", "fx-forward", "repo", "mmd", "ibl",
   * "bond", "equity", "irs". Canonical list — downstream eligibility checks
   * gate on this field. Absent = not yet authorised for any products.
   */
  readonly authorisedProducts?: readonly string[];
  /**
   * FX pair eligibility (major-first per ACI Model Code hierarchy, e.g.
   * "USD/ZAR", "EUR/ZAR"). Drives the FX sim engine's pair picker and the
   * FX desk counterparty picker. Empty = all available pairs permitted.
   */
  readonly eligibleFxPairs?: readonly string[];
  /**
   * Build-phase classification. "sim" marks a fictitious build-phase
   * counterparty that exists in the register for substrate testing only.
   * Absent or "active" = real production counterparty.
   */
  readonly buildPhaseStatus?: "active" | "sim";
}

/**
 * Kind-attributes for a `PartyKind = "agent"` registration.
 *
 * Both in-house agents (the 27 personas under `Team/`) and external
 * agents (a counterparty's trading-bot dispatched to interact with the
 * bank) share this kind. They are distinguished by the `acts-on-behalf-of`
 * relationship edge: in-house agents point at bank legal-entity Parties
 * (Hoz Bank, Hoz Securities, Hoz Group); external agents point at
 * counterparty Parties.
 */
export interface AgentAttrs {
  readonly kind: "agent";
  /**
   * Path to the persona spec file. For in-house agents this is
   * `Team/<Name>.md`; for external agents this is a counterparty-
   * provided spec ref or `null` if none exists.
   */
  readonly personaSpecPath: string | null;
  /** One-line mandate summary — the agent's seat purpose. */
  readonly mandate: string;
  /**
   * Reports-to Party URN — an in-house agent's manager Party (typically
   * another agent or the CEO seat). Encoded as a `reports-to`
   * `PartyRelationshipAsserted` edge in addition; this field is
   * convenience for projection seeding.
   */
  readonly reportsToPartyId?: PartyId;
}

/**
 * Closed discriminated union. The `kind` discriminator matches the
 * outer `PartyRegisteredPayload.kind` exactly — the schema enforces
 * the binding via `z.discriminatedUnion`.
 */
export type KindAttributes = NaturalPersonAttrs | LegalEntityAttrs | AgentAttrs;

// ===========================================================================
// Relationship kinds (D-PARTY-RELATIONSHIP-KINDS-V0)
// ===========================================================================

/**
 * Closed v0 enum of relationship kinds, grouped by semantics. New kinds
 * beyond this v0 require a follow-up CEO decision because each encodes
 * regulatory semantics (and therefore citation requirements).
 *
 * Source: `Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-
 * relationship-kinds-v0.md`.
 *
 * The source-kind / target-kind constraint table is defined in
 * `./schemas.ts` as `RELATIONSHIP_KIND_CONSTRAINTS` and enforced at
 * append time via `partyRelationshipAssertedPayloadSchema`'s `.refine(...)`.
 */
export const RELATIONSHIP_KINDS = [
  // Authority / representation
  // (source: natural-person OR agent; target: any party)
  "acts-on-behalf-of",
  "signatory-of",
  "authorised-trader-for",
  "key-individual-of",
  "employee-of",
  "contractor-of",
  // Governance / control
  // (source: natural-person; target: legal-entity — includes institutional counterparties registered as legal-entity)
  "director-of",
  "ubo-of",
  // Service / commercial
  // (source: any party; target: any party)
  "sponsor-bank-for",
  "correspondent-bank-for",
  "intermediary-for",
  "external-counsel-to",
  "auditor-of",
  "intra-group-counterparty-of",
  // Org structure
  // (source: legal-entity; target: legal-entity)
  "parent-of",
  // Workforce / oversight
  // (source: agent; target: agent OR natural-person)
  "reports-to",
  "subject-to-oversight-of",
  // Personal network — PEP-relevant
  // (source: natural-person; target: natural-person)
  "spouse-of",
  "parent-of-natural",
  "business-associate-of",
] as const;

export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

// ===========================================================================
// Event payload interfaces
// ===========================================================================

/**
 * 1 — `PartyRegistered`. Birth of a Party. Discriminated by `kind`;
 * the kind-specific attributes live under `kindAttributes` and the
 * outer `kind` must equal `kindAttributes.kind` (schema enforces).
 */
export interface PartyRegisteredPayload {
  readonly partyId: PartyId;
  readonly kind: PartyKind;
  readonly displayName: string;
  readonly legalName?: string;
  /** ISO 3166-1 alpha-2 country codes (e.g. "ZA", "GB"). */
  readonly jurisdictions: readonly string[];
  /** ISO 3166-1 alpha-2 — FATCA/CRS-relevant for nat persons + orgs. */
  readonly taxResidencies?: readonly string[];
  readonly kindAttributes: KindAttributes;
  /** Per-payload registration-justification citations (in addition to envelope P2). */
  readonly citations: readonly Citation[];
}

/**
 * 2 — `PartyAttributeChanged`. Mutation of an existing Party's
 * identity-axis attributes. `beforeRef` / `afterRef` are document-store
 * hashes capturing the prior + new values for forensic reconstruction.
 */
export interface PartyAttributeChangedPayload {
  readonly partyId: PartyId;
  readonly changeType:
    | "name"
    | "address"
    | "jurisdiction-added"
    | "jurisdiction-removed"
    | "tax-residency-added"
    | "tax-residency-removed"
    | "kind-attribute";
  /** BLAKE3 hash of the prior value snapshot in the document store. */
  readonly beforeRef: string;
  /** BLAKE3 hash of the new value snapshot in the document store. */
  readonly afterRef: string;
  readonly citations: readonly Citation[];
}

/**
 * 3 — `PartyClassified`. Adds a typed classification to a Party
 * (e.g. natural-person becomes "director" of a legal entity;
 * counterparty becomes "PEP-linked" or "active"; agent becomes
 * "third-line-independent"). The `scopeJson` field carries
 * classification-specific scope (which entity, which products,
 * which limits) without forcing every classification to a separate
 * event type.
 */
export interface PartyClassifiedPayload {
  readonly partyId: PartyId;
  readonly classification: string;
  /** Free-form structured scope for the classification — JSON-serialisable. */
  readonly scopeJson: Readonly<Record<string, unknown>>;
  readonly citations: readonly Citation[];
}

/**
 * 4 — `PartyDeclassified`. Reverses a prior `PartyClassified`. The
 * `classification` value must match an active classification on the
 * Party (the projection enforces this).
 */
export interface PartyDeclassifiedPayload {
  readonly partyId: PartyId;
  readonly classification: string;
  /** Reason for declassification — free-form. */
  readonly reason: string;
  readonly citations: readonly Citation[];
}

/**
 * 5 — `PartyScreeningCompleted`. Records the result of a screening
 * run against a Party — sanctions, PEP, adverse-media, fit-and-proper,
 * KYC-tier. The `evidenceRef` is a BLAKE3 hash of the screening
 * provider's response in the document store.
 */
export interface PartyScreeningCompletedPayload {
  readonly partyId: PartyId;
  readonly screeningType: "sanctions" | "pep" | "adverse-media" | "fit-and-proper" | "kyc-tier";
  /** Free-form result code per screening type — e.g. "clear", "hit", "Tier-1". */
  readonly result: string;
  /** BLAKE3 hash of the provider's response in the document store. */
  readonly evidenceRef: string;
  readonly citations: readonly Citation[];
}

/**
 * 6 — `PartyRelationshipAsserted`. A typed graph edge from one Party
 * to another. The schema enforces source-kind / target-kind
 * constraints per `RELATIONSHIP_KIND_CONSTRAINTS` in `./schemas.ts`
 * — an attempt to assert `director-of` from an `agent` source, or
 * `parent-of` between two `counterparty` Parties, is rejected at
 * append time.
 */
export interface PartyRelationshipAssertedPayload {
  /** Stable identifier for the relationship — `relationship:<kind>:<slug>`. */
  readonly relationshipId: string;
  readonly fromPartyId: PartyId;
  readonly toPartyId: PartyId;
  readonly kind: RelationshipKind;
  /** Free-form structured scope (limits, products, mandate refs). */
  readonly scopeJson: Readonly<Record<string, unknown>>;
  /** ISO 8601 — when the relationship begins to bind. */
  readonly effectiveFrom: string;
  readonly citations: readonly Citation[];
}

/**
 * 7 — `PartyRelationshipChanged`. Scope or evidence refresh on an
 * existing relationship — does not change `fromPartyId`, `toPartyId`,
 * or `kind` (those would be a revoke + re-assert).
 */
export interface PartyRelationshipChangedPayload {
  readonly relationshipId: string;
  readonly changeType: "scope-narrowed" | "scope-widened" | "evidence-refreshed";
  /** BLAKE3 hash of the prior scope/evidence snapshot. */
  readonly beforeRef: string;
  /** BLAKE3 hash of the new scope/evidence snapshot. */
  readonly afterRef: string;
  readonly citations: readonly Citation[];
}

/**
 * 8 — `PartyRelationshipRevoked`. Terminal lifecycle event for a
 * relationship.
 */
export interface PartyRelationshipRevokedPayload {
  readonly relationshipId: string;
  readonly reason: string;
  /** ISO 8601 — when the relationship ceases to bind. */
  readonly effectiveFrom: string;
}

/**
 * 9 — `BeneficialOwnerChainAsserted`. Purpose-built for FIC Act s.21B
 * recursion — the natural-person UBO at the bottom of a corporate
 * chain. Distinct from `PartyRelationshipAsserted{kind: "ubo-of"}`
 * because the chain shape is more than an edge — it is the *path*
 * through intermediate counterparties / legal-entities to the
 * piercing-point natural person.
 *
 * The `chain` array starts with the root legal-entity (institutional
 * counterparty registered as `legal-entity` kind) and ends at the
 * natural-person UBO. `piercedToNaturalPersonAt` is the index in
 * `chain` of the first natural-person Party (typically the last entry).
 */
export interface BeneficialOwnerChainAssertedPayload {
  readonly rootCounterpartyPartyId: PartyId;
  readonly chain: readonly PartyId[];
  /** Index in `chain` of the first natural-person Party. */
  readonly piercedToNaturalPersonAt: number;
  readonly citations: readonly Citation[];
}

/**
 * 10 — `PartyDeactivated`. Terminal lifecycle event for a Party.
 * The sub-reason taxonomy distinguishes the four kind-specific
 * end-of-life cases plus a merge-into terminal.
 */
export interface PartyDeactivatedPayload {
  readonly partyId: PartyId;
  readonly reason:
    | "deceased"
    | "deregistered-cipc"
    | "offboarded"
    | "agent-retired"
    | "merged-into-other-party";
  /** ISO 8601 — when the Party ceases to be active. */
  readonly effectiveFrom: string;
  readonly citations: readonly Citation[];
}

// ===========================================================================
// PARTY_EVENT_TYPES — closed enumeration of the 10 event types
// ===========================================================================

export const PARTY_EVENT_TYPES = [
  "PartyRegistered",
  "PartyAttributeChanged",
  "PartyClassified",
  "PartyDeclassified",
  "PartyScreeningCompleted",
  "PartyRelationshipAsserted",
  "PartyRelationshipChanged",
  "PartyRelationshipRevoked",
  "BeneficialOwnerChainAsserted",
  "PartyDeactivated",
] as const;

export type PartyEventType = (typeof PARTY_EVENT_TYPES)[number];

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Build a typed `PartyId` from a kind + slug. Use sparingly — at
 * boundaries where a string lands from outside the type system.
 */
export function partyId(kind: PartyKind, slug: string): PartyId {
  return `urn:party:${kind}:${slug}`;
}

// ---------------------------------------------------------------------------
// DCAM assembly — Party kind
// ---------------------------------------------------------------------------

import {
  CONCEPTUAL_REGISTRY,
  PHYSICAL_PARTY_KIND,
  getLogicalMappings,
} from "../../platform/taxonomies/dcam/index";
import type { DcamAlignment } from "../../platform/taxonomies/index";

/**
 * Assemble the full DCAM three-layer alignment for a party kind.
 * Returns null for kinds with no industry-standard equivalent (e.g. "agent").
 */
export function getPartyKindDcamAlignment(kind: PartyKind): DcamAlignment | null {
  const physical = PHYSICAL_PARTY_KIND[kind];
  if (!physical) return null;
  const concept = CONCEPTUAL_REGISTRY.get(physical.conceptKey);
  if (!concept) return null;
  const logical = getLogicalMappings(physical.conceptKey);
  const conceptual = {
    fiboModule: concept.fiboModule,
    fiboIri: concept.fiboIri,
    fiboLabel: concept.fiboLabel,
    skosMatch: concept.skosMatch,
    ...(concept.definition !== undefined ? { definition: concept.definition } : {}),
  };
  const logicalMapped =
    logical.length > 0
      ? logical.map((m) => ({
          standard: m.standard,
          ref: m.ref,
          label: m.label,
          skosMatch: m.skosMatch,
          ...(m.notes !== undefined ? { notes: m.notes } : {}),
        }))
      : undefined;

  return {
    conceptual,
    ...(logicalMapped !== undefined ? { logical: logicalMapped } : {}),
  };
}
