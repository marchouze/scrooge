// domains/party/schemas.ts
//
// D-PARTY-REGISTER + D-PARTY-RELATIONSHIP-KINDS-V0 (CEO-approved 2026-05-11).
//
// Zod payload schemas for the 10 Party event types declared in `./types.ts`.
//
// Boundary enforcement:
//   - `partyIdSchema` validates the `urn:party:<kind>:<slug>` shape AND that
//     the `<kind>` slot matches an allowed `PartyKind`.
//   - `partyRegisteredPayloadSchema` is a discriminated union on `kind`;
//     the outer `kind` and the inner `kindAttributes.kind` are bound by
//     `z.discriminatedUnion`.
//   - `partyRelationshipAssertedPayloadSchema` enforces the source-kind /
//     target-kind constraint table at parse time via a `.refine(...)` that
//     looks up `RELATIONSHIP_KIND_CONSTRAINTS` (single source of truth for
//     the v0 enum's source/target groups per the
//     `D-PARTY-RELATIONSHIP-KINDS-V0` decision record).
//
// Author: Atlas (Core banking platform architect; substrate)

import { z } from "zod";

import {
  PARTY_KINDS,
  type PartyId,
  type PartyKind,
  RELATIONSHIP_KINDS,
  type RelationshipKind,
} from "./types";

// ===========================================================================
// Building-block schemas
// ===========================================================================

/**
 * BLAKE3 document-hash format. Mirrors the shared shape used elsewhere
 * in the substrate (RMS Phase 1, kept private to the module to avoid
 * cross-package coupling at this stage).
 */
const documentHashSchema = z
  .string()
  .regex(/^blake3:[0-9a-f]{64}$/, "documentHash must match `blake3:<64-hex-chars>`");

/**
 * ISO 3166-1 alpha-2 country code (two upper-case letters). Matches
 * the shape used in `LegalEntityRegistered`.
 */
const iso3166Alpha2Schema = z
  .string()
  .regex(/^[A-Z]{2}$/, "country code must be ISO 3166-1 alpha-2 (two upper-case letters)");

/**
 * `PartyKind` schema — closed enum.
 */
export const partyKindSchema = z.enum(PARTY_KINDS);

/**
 * `PartyId` schema. Validates both the `urn:party:<kind>:<slug>` shape
 * AND that `<kind>` matches one of the three `PartyKind` values. The
 * `<slug>` is constrained to URL-safe chars (lower-case alphanumerics,
 * hyphens, dots, underscores) — anything else (including additional
 * `:`s) is rejected so parsing the URN back into its parts is
 * unambiguous.
 */
export const partyIdSchema = z
  .string()
  .regex(
    /^urn:party:(natural-person|legal-entity|agent):[a-z0-9][a-z0-9._-]*$/,
    "partyId must match `urn:party:<kind>:<slug>` where <kind> is one of natural-person|legal-entity|agent and <slug> is a URL-safe identifier",
  )
  .transform((s) => s as PartyId);

/**
 * Helper — extract the `kind` slot from a validated `PartyId`. Used by
 * the relationship-kind constraint check below.
 */
function partyIdKind(id: string): PartyKind {
  // The schema regex guarantees this split shape.
  const parts = id.split(":");
  return parts[2] as PartyKind;
}

/**
 * `RelationshipKind` schema — closed enum.
 */
export const relationshipKindSchema = z.enum(RELATIONSHIP_KINDS);

/**
 * Per-payload citation list. Non-empty (each Party event must carry at
 * least one purpose-specific citation in addition to the envelope
 * citations).
 */
const citationsSchema = z.array(z.string().min(1)).min(1, {
  message: "Party events must carry at least one purpose-specific citation in the payload (P2).",
});

// ===========================================================================
// Kind-attribute schemas (discriminated by `kind`)
// ===========================================================================

const naturalPersonAttrsSchema = z.object({
  kind: z.literal("natural-person"),
  nationalities: z.array(iso3166Alpha2Schema).min(1, {
    message: "natural-person must declare at least one nationality",
  }),
  purposeRoles: z
    .array(
      z.enum([
        "director",
        "ubo",
        "signatory",
        "authorised-trader",
        "key-individual",
        "employee",
        "contractor",
        "external-counsel",
        "auditor",
        "ceo",
        "mlro",
        "information-officer",
        "cae",
        "other",
      ]),
    )
    .min(1, { message: "natural-person must declare at least one purpose role" }),
  piiDocumentRef: documentHashSchema.optional(),
  dobHashRef: documentHashSchema.optional(),
});

const legalEntityAttrsSchema = z.object({
  kind: z.literal("legal-entity"),
  entityForm: z.enum(["Ltd", "RF", "Pty"]),
  parentPartyId: partyIdSchema.nullable(),
  primaryRegulator: z.enum(["PA", "JSE", "FSCA", "none-companies-act-only", "other"]),
  regimeAnchor: z
    .array(z.string().min(1))
    .min(1, { message: "legal-entity must declare at least one regime anchor" }),
  // ISO 17442 LEI — 20-char uppercase alphanumeric. Optional until the
  // bank holds its own LEI and operates with EU-counterparty OTC derivatives
  // (matches the field in `LegalEntityAttrs` in `./types.ts`). First load-
  // bearing emission is the 2026-05-20 institutional-counterparty backfill
  // for the FX-spot controlled-launch (Standard Bank + Investec) — Helena
  // (Chief Risk Officer, governance) PR #634 + Imani (Chief Legal Counsel,
  // governance) PR #637.
  lei: z
    .string()
    .regex(/^[A-Z0-9]{20}$/, "lei must be a 20-char uppercase alphanumeric ISO 17442 identifier")
    .optional(),
  bic: z.string().optional(),
  authorisedProducts: z.array(z.string()).optional(),
  eligibleFxPairs: z.array(z.string()).optional(),
  buildPhaseStatus: z.enum(["active", "sim"]).optional(),
});

const agentAttrsSchema = z.object({
  kind: z.literal("agent"),
  personaSpecPath: z.string().min(1).nullable(),
  mandate: z.string().min(1),
  reportsToPartyId: partyIdSchema.optional(),
});

/**
 * `kindAttributes` discriminated union. The discriminator is the
 * inner `kind` field; the outer `PartyRegisteredPayload.kind` is
 * bound to it via `.superRefine` on `partyRegisteredPayloadSchema`.
 */
export const kindAttributesSchema = z.discriminatedUnion("kind", [
  naturalPersonAttrsSchema,
  legalEntityAttrsSchema,
  agentAttrsSchema,
]);

// ===========================================================================
// Source-kind / target-kind constraint table
// (D-PARTY-RELATIONSHIP-KINDS-V0)
// ===========================================================================

/**
 * Single source-of-truth constraint table for the v0 relationship-kind
 * enum. Each kind maps to the allowed source-kinds and target-kinds.
 * Mirrors the source/target groups in
 * `Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-
 * relationship-kinds-v0.md` exactly.
 *
 * The append-time enforcement is the `.refine(...)` on
 * `partyRelationshipAssertedPayloadSchema` — an attempt to assert
 * `director-of` from an `agent` source, or `parent-of` between two
 * `counterparty` Parties, is rejected at the boundary.
 *
 * The `allowedSourceKinds` / `allowedTargetKinds` lists are non-empty
 * — an empty list would mean "no Party may take that end of the
 * edge", which is never the intent for a registered relationship kind.
 */
export const RELATIONSHIP_KIND_CONSTRAINTS: Readonly<
  Record<
    RelationshipKind,
    {
      readonly allowedSourceKinds: readonly PartyKind[];
      readonly allowedTargetKinds: readonly PartyKind[];
    }
  >
> = {
  // --- Authority / representation (source: natural-person OR agent; target: any party) ---
  "acts-on-behalf-of": {
    allowedSourceKinds: ["natural-person", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "signatory-of": {
    allowedSourceKinds: ["natural-person", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "authorised-trader-for": {
    allowedSourceKinds: ["natural-person", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "key-individual-of": {
    allowedSourceKinds: ["natural-person", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "employee-of": {
    allowedSourceKinds: ["natural-person", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "contractor-of": {
    allowedSourceKinds: ["natural-person", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  // --- Governance / control (source: natural-person; target: legal-entity OR counterparty) ---
  "director-of": {
    allowedSourceKinds: ["natural-person"],
    allowedTargetKinds: ["legal-entity"],
  },
  "ubo-of": {
    allowedSourceKinds: ["natural-person"],
    allowedTargetKinds: ["legal-entity"],
  },
  // --- Service / commercial (source: any party; target: any party) ---
  "sponsor-bank-for": {
    allowedSourceKinds: ["natural-person", "legal-entity", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "correspondent-bank-for": {
    allowedSourceKinds: ["natural-person", "legal-entity", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "intermediary-for": {
    allowedSourceKinds: ["natural-person", "legal-entity", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "external-counsel-to": {
    allowedSourceKinds: ["natural-person", "legal-entity", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "auditor-of": {
    allowedSourceKinds: ["natural-person", "legal-entity", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  "intra-group-counterparty-of": {
    allowedSourceKinds: ["natural-person", "legal-entity", "agent"],
    allowedTargetKinds: ["natural-person", "legal-entity", "agent"],
  },
  // --- Org structure (source: legal-entity; target: legal-entity) ---
  "parent-of": {
    allowedSourceKinds: ["legal-entity"],
    allowedTargetKinds: ["legal-entity"],
  },
  // --- Workforce / oversight (source: agent; target: agent OR natural-person) ---
  "reports-to": {
    allowedSourceKinds: ["agent"],
    allowedTargetKinds: ["agent", "natural-person"],
  },
  "subject-to-oversight-of": {
    allowedSourceKinds: ["agent"],
    allowedTargetKinds: ["agent", "natural-person"],
  },
  // --- Personal network — PEP-relevant (source: natural-person; target: natural-person) ---
  "spouse-of": {
    allowedSourceKinds: ["natural-person"],
    allowedTargetKinds: ["natural-person"],
  },
  "parent-of-natural": {
    allowedSourceKinds: ["natural-person"],
    allowedTargetKinds: ["natural-person"],
  },
  "business-associate-of": {
    allowedSourceKinds: ["natural-person"],
    allowedTargetKinds: ["natural-person"],
  },
};

// ===========================================================================
// Event payload schemas
// ===========================================================================

/**
 * 1 — `PartyRegistered`. Discriminated on `kind`; the outer `kind`
 * must equal `kindAttributes.kind` (enforced via `.superRefine`).
 */
export const partyRegisteredPayloadSchema = z
  .object({
    partyId: partyIdSchema,
    kind: partyKindSchema,
    displayName: z.string().min(1),
    legalName: z.string().min(1).optional(),
    jurisdictions: z.array(iso3166Alpha2Schema).min(1, {
      message: "PartyRegistered must declare at least one jurisdiction",
    }),
    taxResidencies: z.array(iso3166Alpha2Schema).optional(),
    kindAttributes: kindAttributesSchema,
    citations: citationsSchema,
  })
  .superRefine((p, ctx) => {
    // Outer `kind` must match the inner discriminator.
    if (p.kind !== p.kindAttributes.kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `PartyRegistered.kind (\`${p.kind}\`) must equal kindAttributes.kind (\`${p.kindAttributes.kind}\`)`,
        path: ["kindAttributes", "kind"],
      });
    }
    // The `partyId` URN's `<kind>` slot must also match `kind`.
    const urnKind = partyIdKind(p.partyId);
    if (urnKind !== p.kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `PartyRegistered.partyId URN kind slot (\`${urnKind}\`) must equal payload kind (\`${p.kind}\`)`,
        path: ["partyId"],
      });
    }
  });

/**
 * 2 — `PartyAttributeChanged`.
 */
export const partyAttributeChangedPayloadSchema = z.object({
  partyId: partyIdSchema,
  changeType: z.enum([
    "name",
    "address",
    "jurisdiction-added",
    "jurisdiction-removed",
    "tax-residency-added",
    "tax-residency-removed",
    "kind-attribute",
  ]),
  beforeRef: documentHashSchema,
  afterRef: documentHashSchema,
  citations: citationsSchema,
});

/**
 * 3 — `PartyClassified`.
 */
export const partyClassifiedPayloadSchema = z.object({
  partyId: partyIdSchema,
  classification: z.string().min(1),
  scopeJson: z.record(z.string(), z.unknown()),
  citations: citationsSchema,
});

/**
 * 4 — `PartyDeclassified`.
 */
export const partyDeclassifiedPayloadSchema = z.object({
  partyId: partyIdSchema,
  classification: z.string().min(1),
  reason: z.string().min(1),
  citations: citationsSchema,
});

/**
 * 5 — `PartyScreeningCompleted`.
 */
export const partyScreeningCompletedPayloadSchema = z.object({
  partyId: partyIdSchema,
  screeningType: z.enum(["sanctions", "pep", "adverse-media", "fit-and-proper", "kyc-tier"]),
  result: z.string().min(1),
  evidenceRef: documentHashSchema,
  citations: citationsSchema,
});

/**
 * 6 — `PartyRelationshipAsserted`. Source-kind / target-kind
 * enforcement via `.refine(...)` against `RELATIONSHIP_KIND_CONSTRAINTS`.
 */
export const partyRelationshipAssertedPayloadSchema = z
  .object({
    relationshipId: z.string().min(1),
    fromPartyId: partyIdSchema,
    toPartyId: partyIdSchema,
    kind: relationshipKindSchema,
    scopeJson: z.record(z.string(), z.unknown()),
    effectiveFrom: z.string().min(1),
    citations: citationsSchema,
  })
  .superRefine((p, ctx) => {
    const constraint = RELATIONSHIP_KIND_CONSTRAINTS[p.kind];
    const sourceKind = partyIdKind(p.fromPartyId);
    const targetKind = partyIdKind(p.toPartyId);
    if (!constraint.allowedSourceKinds.includes(sourceKind)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Relationship kind \`${p.kind}\` does not allow source kind \`${sourceKind}\`. Allowed source kinds: ${constraint.allowedSourceKinds.join(", ")}.`,
        path: ["fromPartyId"],
      });
    }
    if (!constraint.allowedTargetKinds.includes(targetKind)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Relationship kind \`${p.kind}\` does not allow target kind \`${targetKind}\`. Allowed target kinds: ${constraint.allowedTargetKinds.join(", ")}.`,
        path: ["toPartyId"],
      });
    }
  });

/**
 * 7 — `PartyRelationshipChanged`.
 */
export const partyRelationshipChangedPayloadSchema = z.object({
  relationshipId: z.string().min(1),
  changeType: z.enum(["scope-narrowed", "scope-widened", "evidence-refreshed"]),
  beforeRef: documentHashSchema,
  afterRef: documentHashSchema,
  citations: citationsSchema,
});

/**
 * 8 — `PartyRelationshipRevoked`.
 */
export const partyRelationshipRevokedPayloadSchema = z.object({
  relationshipId: z.string().min(1),
  reason: z.string().min(1),
  effectiveFrom: z.string().min(1),
});

/**
 * 9 — `BeneficialOwnerChainAsserted`. The chain must start with the
 * root counterparty and end at a natural-person Party. The
 * `piercedToNaturalPersonAt` index must be in range and the Party at
 * that index must have `kind = "natural-person"`.
 */
export const beneficialOwnerChainAssertedPayloadSchema = z
  .object({
    rootCounterpartyPartyId: partyIdSchema,
    chain: z.array(partyIdSchema).min(2, {
      message: "BeneficialOwnerChainAsserted.chain must have at least 2 entries (root + UBO)",
    }),
    piercedToNaturalPersonAt: z.number().int().nonnegative(),
    citations: citationsSchema,
  })
  .superRefine((p, ctx) => {
    // Root must be a legal-entity (institutional counterparties register as
    // legal-entity; "counterparty" was removed from PartyKind per
    // D-PARTY-REGISTER correction 2026-05-12 — kind is intrinsic, not relational).
    const rootKind = partyIdKind(p.rootCounterpartyPartyId);
    if (rootKind !== "legal-entity") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `BeneficialOwnerChainAsserted.rootCounterpartyPartyId must be a legal-entity Party (institutional counterparties register as legal-entity; got \`${rootKind}\`).`,
        path: ["rootCounterpartyPartyId"],
      });
    }
    // First chain entry must equal the root.
    if (p.chain[0] !== p.rootCounterpartyPartyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "BeneficialOwnerChainAsserted.chain[0] must equal rootCounterpartyPartyId.",
        path: ["chain", 0],
      });
    }
    // Pierce index must point at a natural-person within the chain.
    if (p.piercedToNaturalPersonAt >= p.chain.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `BeneficialOwnerChainAsserted.piercedToNaturalPersonAt (${p.piercedToNaturalPersonAt}) is out of range for chain of length ${p.chain.length}.`,
        path: ["piercedToNaturalPersonAt"],
      });
    } else {
      const piercedId = p.chain[p.piercedToNaturalPersonAt];
      if (piercedId === undefined) {
        // Unreachable given the bounds check above, but type-narrows the index.
        return;
      }
      const piercedKind = partyIdKind(piercedId);
      if (piercedKind !== "natural-person") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `BeneficialOwnerChainAsserted.chain[${p.piercedToNaturalPersonAt}] must be a natural-person Party (got \`${piercedKind}\`).`,
          path: ["chain", p.piercedToNaturalPersonAt],
        });
      }
    }
  });

/**
 * 10 — `PartyDeactivated`.
 */
export const partyDeactivatedPayloadSchema = z.object({
  partyId: partyIdSchema,
  reason: z.enum([
    "deceased",
    "deregistered-cipc",
    "offboarded",
    "agent-retired",
    "merged-into-other-party",
  ]),
  effectiveFrom: z.string().min(1),
  citations: citationsSchema,
});
