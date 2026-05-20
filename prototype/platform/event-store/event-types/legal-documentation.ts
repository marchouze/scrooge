// platform/event-store/event-types/legal-documentation.ts
//
// Legal-documentation event-payload schemas.
//
// Covers:
//   - LegalDocumentationSigned         — counterparty signs a master
//                                        agreement (ISDA, GMRA, GMSLA, or
//                                        an FX-bilateral form).
//   - JurisdictionalOpinionRefreshed   — annual refresh of a jurisdictional
//                                        netting opinion (e.g. ISDA's
//                                        South Africa opinion).
//
// Authority:
//   - Imani's G-9 decision (PR #637, 2026-05-20):
//     `2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md` §5 —
//     identifies the `JurisdictionalOpinionRefreshed` gap and the
//     `LegalDocumentationSigned.agreementType` enum gap (`"fx-bilateral"`
//     variant required for schema completeness).
//   - Helena's FX-spot-only market-risk scope review (PR #631):
//     `2026-05-20_helena_fx-spot-only-market-risk-scope-review.md` §6 G-9.
//   - ISDA 2002 Master Agreement §6 — Events of Default and Termination
//     Events; close-out netting only enforceable where a current
//     jurisdictional netting opinion supports it.
//
// Author: Atlas (Core banking platform architect, engineering) — schema
//   completeness pack on behalf of Imani (Legal-as-code engineer,
//   engineering) and Helena (Chief Risk Officer, governance).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// LegalDocumentationSigned
//
// Emitted when a counterparty signs the master-agreement form for one or
// more product classes. The `agreementType` enum is intentionally additive
// — every prospective master-agreement form must be representable even if
// the form is not currently whitelisted for trading (Imani's G-9 rejected
// `"fx-bilateral"` for the controlled-launch counterparties but the schema
// must still be able to record the form for future use).
//
// `masterAgreement` (in `markets/products/types.ts::legalDocumentationSchema`)
// is the *product-class* enum (what forms a product family accepts);
// `LegalDocumentationSigned.agreementType` is the *instance* enum (what
// form a specific counterparty has signed). The two enums are kept in
// sync by recon (Vera Wave-4 backlog).
// ---------------------------------------------------------------------------

/**
 * Agreement-type enum for `LegalDocumentationSigned` events.
 *
 * Variants:
 *   - "isda-2002"     ISDA 2002 Master Agreement (the controlled-launch
 *                     default per Imani G-9, with SA Schedule and
 *                     close-out netting).
 *   - "isda-2025"     ISDA 2025 Master Agreement (post-LIBOR successor;
 *                     not yet in scope at controlled-launch).
 *   - "gmra-2011"     GMRA 2011 (repo).
 *   - "gmsla-2018"    GMSLA 2018 (securities lending).
 *   - "fx-bilateral"  A bilateral FX-only master form (e.g. an in-house
 *                     spot-only contract or an ISDA-derived FX-only
 *                     schedule). Rejected by Imani G-9 for the
 *                     controlled-launch whitelist but representable for
 *                     schema completeness and future use.
 *   - "none-listed"   No master form on file (account-mandate / SLA only).
 */
export const legalDocumentationAgreementTypeSchema = z.enum([
  "isda-2002",
  "isda-2025",
  "gmra-2011",
  "gmsla-2018",
  "fx-bilateral",
  "none-listed",
]);

export type LegalDocumentationAgreementType = z.infer<
  typeof legalDocumentationAgreementTypeSchema
>;

export const legalDocumentationSignedPayloadSchema = z.object({
  /** Counterparty Party URN (`party:<scheme>:<id>`). */
  counterpartyId: z.string().min(1),
  /** Master-agreement form signed. See `legalDocumentationAgreementTypeSchema`. */
  agreementType: legalDocumentationAgreementTypeSchema,
  /**
   * Free-form version label (e.g. "2002-MA + SA Schedule", "2011 + RSA
   * Annex"). Encoded as a string because the canonical form-versioning is
   * vendor-specific.
   */
  version: z.string().min(1),
  /** ISO 8601 date the counterparty executed the agreement. */
  signedDate: z.string().min(1),
  /**
   * BLAKE3 hash of the executed agreement document in the doc store, in
   * the canonical `blake3:<hex>` form. Optional during the build phase
   * (some legacy executions predate the doc store) — required from
   * commencement-of-trading.
   */
  documentHash: z
    .string()
    .regex(/^blake3:[0-9a-f]{64}$/)
    .optional(),
  /**
   * Whether this agreement carries a Credit Support Annex (CSA). For
   * `"isda-2002"` and `"isda-2025"`, this is the ISDA CSA; for `"gmra-2011"`,
   * the GMRA's equivalent margining annex. `false` is permitted for the
   * controlled-launch FX-spot whitelist (no CSA at spot-only) but a CSA
   * is mandatory once forward / IRD / repo is added (Imani G-9 §3).
   */
  csaPresent: z.boolean(),
  /**
   * Whether close-out netting is enforceable in the counterparty's
   * jurisdiction at the time of signing. The supporting jurisdictional
   * netting opinion is recorded separately via
   * `JurisdictionalOpinionRefreshed`.
   */
  nettingEnforceable: z.boolean(),
});

export type LegalDocumentationSignedPayload = z.infer<
  typeof legalDocumentationSignedPayloadSchema
>;

export function makeLegalDocumentationSigned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LegalDocumentationSignedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "LegalDocumentationSigned requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LegalDocumentationSigned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: legalDocumentationSignedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// JurisdictionalOpinionRefreshed
//
// Emitted when an annual jurisdictional netting opinion is refreshed.
// The canonical example is ISDA's South Africa netting opinion (most
// recently Bowmans 2024-04-15, cited in Imani's G-9 decision); the same
// event shape covers GMRA / GMSLA opinions and counterparty-specific
// opinions where the standard ISDA opinion does not cover the counterparty's
// form of incorporation.
//
// The annual-refresh recon pipeline (Vera Wave-4 backlog) consumes this
// event to assert that no enforceable-netting flag (on `LegalDocumentationSigned`
// or in the netting-set engine) has gone stale beyond a 12-month refresh
// window.
// ---------------------------------------------------------------------------

export const jurisdictionalOpinionRefreshedPayloadSchema = z.object({
  /** ISO-3166-1 alpha-2 country code the opinion covers. */
  jurisdiction: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/),
  /**
   * Opinion authority — the standard-setter or contracting body whose
   * form the opinion supports (e.g. "ISDA", "ICMA", "ISLA").
   */
  opinionAuthority: z.string().min(1),
  /** Law firm or in-house counsel that authored the opinion (e.g. "Bowmans"). */
  opinionAuthor: z.string().min(1),
  /** ISO 8601 date the opinion was issued / dated. */
  opinionDate: z.string().min(1),
  /**
   * BLAKE3 hash of the opinion document in the doc store, in the
   * canonical `blake3:<hex>` form. Required (no build-phase optionality —
   * an opinion without a doc-store anchor cannot be cited downstream).
   */
  opinionDocumentHash: z.string().regex(/^blake3:[0-9a-f]{64}$/),
  /**
   * Party URNs of the counterparties whose netting status this opinion
   * covers. Empty array is permitted at issue-time (the opinion may
   * apply to a class of counterparties — e.g. "all Banks-Act-registered
   * SA institutions" — and individual counterparties get linked to it
   * via the netting-set engine).
   */
  coversCounterparties: z.array(z.string().min(1)),
  /** ISO 8601 timestamp when the refresh was recorded. */
  refreshedAt: z.string().min(1),
  /**
   * ISO 8601 date of the previous opinion this refresh supersedes; `null`
   * if this is the first opinion on file for the jurisdiction + authority
   * + author tuple.
   */
  previousOpinionDate: z.string().nullable(),
});

export type JurisdictionalOpinionRefreshedPayload = z.infer<
  typeof jurisdictionalOpinionRefreshedPayloadSchema
>;

export function makeJurisdictionalOpinionRefreshed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: JurisdictionalOpinionRefreshedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "JurisdictionalOpinionRefreshed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "JurisdictionalOpinionRefreshed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: jurisdictionalOpinionRefreshedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Legal-documentation event-type registry
// ---------------------------------------------------------------------------

export const LEGAL_DOCUMENTATION_TYPED_EVENT_TYPES = [
  "LegalDocumentationSigned",
  "JurisdictionalOpinionRefreshed",
] as const;

export type LegalDocumentationEventType =
  (typeof LEGAL_DOCUMENTATION_TYPED_EVENT_TYPES)[number];
