// v2-core/regulatory-returns/return-data-capture.ts
//
// THE D SCHEMA — declared overrides. The C engine (`capture-capability-map.ts`)
// derives capture from composition; but some return-data attributes are NOT
// reachable from composition — they are sourced at the INSTANCE or CHART-OF-
// ACCOUNTS level (e.g. `hqlaLevel`, a CoA classification of the specific asset
// held, not determined by the product type). For those, a product DECLARES a
// bounded capture: "I supply attribute X, from source Y, at ref Z, and here is
// why it is NOT C-derivable".
//
// THE GUARDRAILS (so D never becomes a second self-warranty list):
//   - `outOfCompositionJustification` is REQUIRED and non-empty: the author must
//     state WHY the attribute is not composition-derivable. An empty/whitespace
//     justification is a recon failure.
//   - `recon:product-return-capture-coherence` asserts that a declared override
//     is GENUINELY NOT C-derivable (if the C engine already derives X for this
//     product, declaring X is a redundant two-sources-of-truth finding), that the
//     attributeKey resolves to a real authored-contract requirement, and that the
//     declared `source`/`ref` is structurally sound.
//
// This is the PAYLOAD SHAPE for the bounded declaration event
// `ProductReturnDataCaptureDeclared` (platform/event-store/event-types/product.ts).
// It lives in `v2-core/` so the recon (which validates declarations against the
// L2 contracts, also in `v2-core/`) shares one schema with the event.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-
//   delegation).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { returnAttributeKeySchema } from "./return-attribute";

/**
 * The shape of the value the declared attribute carries. Mirrors the L2 cell
 * `valueType` family so the gate can check a declaration's shape against the
 * cell requirement it satisfies (a `money` cell wants a `money`/`decimal`
 * declaration, not a `boolean`).
 */
export const captureValueShapeSchema = z.enum([
  "enum",
  "decimal",
  "money",
  "string",
  "date",
  "boolean",
]);
export type CaptureValueShape = z.infer<typeof captureValueShapeSchema>;

/**
 * Where the declared datum is sourced from — the honest provenance of a non-
 * composition-derivable attribute. NOT `product-attribute` (that is the C path —
 * an attribute the product TYPE determines); these are the genuinely external
 * sources composition cannot reach.
 *   - "product-attribute": an instance-level attribute carried on the trade /
 *     product instance (NOT type-determined — e.g. a per-instance override).
 *   - "event-field": a field captured on a domain event at posting time.
 *   - "gl-account": a chart-of-accounts classification (e.g. hqlaLevel from the
 *     CoA the held asset is booked into).
 *   - "projection": a derived register/projection supplies the value.
 */
export const captureSourceSchema = z.enum([
  "product-attribute",
  "event-field",
  "gl-account",
  "projection",
]);
export type CaptureSource = z.infer<typeof captureSourceSchema>;

export const returnDataCaptureSchema = z
  .object({
    /** The return-data attribute key this declaration supplies (grounded by recon). */
    attributeKey: returnAttributeKeySchema,
    /** The shape of the supplied value (checked against the L2 cell requirement). */
    valueShape: captureValueShapeSchema,
    /** Where the value is sourced from (the non-composition provenance). */
    source: captureSourceSchema,
    /**
     * The concrete reference into the named source (e.g. for `gl-account` a
     * `chart-of-accounts#hqlaLevel` ref; for `event-field` an `EventType.field`).
     * Non-empty — a declaration without a concrete source ref is unverifiable.
     */
    ref: z.string().min(1),
    /**
     * REQUIRED: why this attribute is NOT derivable from the product's
     * composition (and therefore legitimately needs a declaration). The coherence
     * recon also independently verifies the attribute is not C-derivable; this
     * field is the author's stated basis. Non-empty, non-whitespace.
     */
    outOfCompositionJustification: z.string().min(1),
    /** Principle-2 citations anchoring the declaration. At least one. */
    citations: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type ReturnDataCapture = z.infer<typeof returnDataCaptureSchema>;
