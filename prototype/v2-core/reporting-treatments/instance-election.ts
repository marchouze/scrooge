// v2-core/reporting-treatments/instance-election.ts
//
// PER-INSTANCE ACCOUNTING ELECTION — the `FilInstanceTreatmentElected` event
// payload SHAPE (FX3, D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD).
//
// WHY THIS EXISTS
// ---------------
// The product treatment (resolved via the reporting-treatment menu, S0c) is the
// DEFAULT measurement basis for every instance of a product. But IFRS leaves a
// SMALL set of genuine TRADE-LEVEL accounting choices open that the product
// default cannot pre-decide — they are facts about a SPECIFIC instance, recorded
// at booking by the accounting agent with a citation:
//
//   - FVOCI per-instrument election (IFRS 9 §5.7.5) — an irrevocable, per-equity-
//     instrument election to present fair-value movements in OCI rather than P&L.
//   - Hedge designation (IFRS 9 §6.1 / §6.2.1) — designating an instrument into a
//     hedging relationship changes its accounting (cash-flow / fair-value hedge).
//   - Business-model override (IFRS 9 §4.1.1) — the holding's business model is a
//     judgement that, where it diverges from the product default, drives a
//     different classification.
//
// Each is a RECORDED DECISION — a typed, append-only event carrying its required
// statutory citation — NOT a rule-engine re-derivation. An election WITHOUT its
// required citation is REJECTED at the schema level (fail-closed; Engineering
// Charter cmd 2). The fold (FX3, `posting-rules-v2/fx-fold.ts`) joins elections
// to instances BY INSTANCE URN: an election overrides that instance's
// product-default treatment for the elected facet. Absent an election, the
// product treatment binds (fail-closed; no silent default).
//
// This is the IRREDUCIBLE input the log must hold: an election is a PRIMARY fact
// (a human/agent choice), not something the fold can reproduce from other
// primaries — so it is a stored event, distinct from the DERIVED postings the
// fold reproduces from the FIL events (D-DERIVED-EVENT-IRREDUCIBILITY-TEST).
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — NO imports from `platform/`,
// `runtime/`, `domains/` (enforced by `recon:v2-no-v1-import`). The v1-side
// event-type registry row is wired OUTSIDE this package
// (`platform/event-store/event-types/instance-election.ts`).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. Principle 1; Principle 2.
// Author: Atlas (Substrate Architect, engineering).

import { z } from "zod";
import { citationRefSchema, instantSchema } from "../fil-core/primitives";
import { filInstanceUrnSchema } from "../fil-core/urn";
import { ifrsClassificationCategorySchema } from "./declaration";

// ---------------------------------------------------------------------------
// Election facet — WHICH treatment dimension this election overrides for the
// instance. One election overrides exactly one facet; an instance may carry
// more than one election (latest-wins per facet, P1).
// ---------------------------------------------------------------------------

export const instanceElectionFacetSchema = z.enum([
  "ifrs-classification", // FVOCI per-instrument election etc. — overrides the IFRS classification
  "hedge-designation", // designates the instance into a hedging relationship
  "business-model-override", // overrides the IFRS 9 business model for the holding
]);

export type InstanceElectionFacet = z.infer<typeof instanceElectionFacetSchema>;

// ---------------------------------------------------------------------------
// Hedge designation — the typed value of a `hedge-designation` election.
// ---------------------------------------------------------------------------

export const hedgeDesignationSchema = z.enum([
  "cash-flow-hedge", // IFRS 9 §6.5.2(b)
  "fair-value-hedge", // IFRS 9 §6.5.2(a)
  "net-investment-hedge", // IFRS 9 §6.5.2(c)
]);

export type HedgeDesignation = z.infer<typeof hedgeDesignationSchema>;

// ---------------------------------------------------------------------------
// Business model — the typed value of a `business-model-override` election.
// Mirrors the menu's `businessModelSchema` value set (declaration.ts) so an
// override composes against the same dimension the product default occupies.
// ---------------------------------------------------------------------------

export const electedBusinessModelSchema = z.enum([
  "held-to-collect",
  "held-to-collect-and-sell",
  "other-trading",
]);

export type ElectedBusinessModel = z.infer<typeof electedBusinessModelSchema>;

// ---------------------------------------------------------------------------
// The `FilInstanceTreatmentElected` payload. Required `cites` (≥1) carries the
// statutory authority for the election; an election lacking it is REJECTED.
// ---------------------------------------------------------------------------

export const filInstanceTreatmentElectedSchema = z
  .object({
    kind: z.literal("FilInstanceTreatmentElected"),
    /** The FIL instance this election attaches to (`fil:inst:<tenant>:<id>`). */
    instance: filInstanceUrnSchema,
    /** The treatment facet this election overrides. */
    facet: instanceElectionFacetSchema,
    /** When the election was made (the recognition act). */
    electedAt: instantSchema,
    // --- typed elected value (exactly the one for `facet` is required) ---
    /** Elected IFRS classification (for `facet: "ifrs-classification"`), e.g. `fvoci`. */
    ifrsCategory: ifrsClassificationCategorySchema.optional(),
    /** Elected hedge designation (for `facet: "hedge-designation"`). */
    hedgeDesignation: hedgeDesignationSchema.optional(),
    /** Elected business model (for `facet: "business-model-override"`). */
    businessModel: electedBusinessModelSchema.optional(),
    /**
     * cites: the statutory authority for THIS election (≥1). Required —
     * fail-closed: an election without a citation is not a legitimate accounting
     * choice (Engineering Charter cmd 2). IMPLEMENTED_BY edge targets (P2).
     */
    cites: z.array(citationRefSchema).min(1),
  })
  .superRefine((v, ctx) => {
    // Fail-closed: the elected value for the named facet MUST be present, and the
    // OTHER facets' values MUST be absent (one election = one facet).
    const present = {
      "ifrs-classification": v.ifrsCategory !== undefined,
      "hedge-designation": v.hedgeDesignation !== undefined,
      "business-model-override": v.businessModel !== undefined,
    } as const;
    if (!present[v.facet]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `facet "${v.facet}" requires its elected value to be present`,
      });
    }
    for (const [facet, isPresent] of Object.entries(present)) {
      if (facet !== v.facet && isPresent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `facet "${v.facet}" must not carry the elected value of facet "${facet}"`,
        });
      }
    }
  });

export type FilInstanceTreatmentElected = z.infer<typeof filInstanceTreatmentElectedSchema>;

// ---------------------------------------------------------------------------
// Election register — latest-wins per (instance, facet). Folded from the
// `FilInstanceTreatmentElected` events; consumed by the FX fold to override an
// instance's product-default treatment for the elected facet.
// ---------------------------------------------------------------------------

export interface InstanceElectionRow {
  readonly instance: string;
  readonly facet: InstanceElectionFacet;
  readonly ifrsCategory: FilInstanceTreatmentElected["ifrsCategory"];
  readonly hedgeDesignation: HedgeDesignation | undefined;
  readonly businessModel: ElectedBusinessModel | undefined;
  readonly electedAt: string;
  readonly cites: readonly string[];
}

export interface InstanceElectionRegister {
  /** Latest election per (instance, facet). */
  readonly rows: readonly InstanceElectionRow[];
}

export const EMPTY_INSTANCE_ELECTION_REGISTER: InstanceElectionRegister = Object.freeze({
  rows: Object.freeze([]) as readonly InstanceElectionRow[],
});

function electionKey(instance: string, facet: InstanceElectionFacet): string {
  return `${instance}::${facet}`;
}

/**
 * Fold raw `FilInstanceTreatmentElected` payloads into the election register.
 * Latest-wins per (instance, facet) — the latest `electedAt` for a given
 * (instance, facet) supersedes earlier ones (P1: latest declaration wins).
 *
 * Invalid payloads (missing citation, wrong facet/value pairing) are REJECTED
 * by the schema parse and contribute NOTHING — fail-closed, surfaced by the
 * caller (the parse throws), never silently dropped.
 */
export function foldInstanceElectionRegister(
  payloads: readonly unknown[],
): InstanceElectionRegister {
  const latest = new Map<string, InstanceElectionRow>();
  for (const raw of payloads) {
    const p = filInstanceTreatmentElectedSchema.parse(raw);
    const key = electionKey(p.instance, p.facet);
    const row: InstanceElectionRow = {
      instance: p.instance,
      facet: p.facet,
      ifrsCategory: p.ifrsCategory,
      hedgeDesignation: p.hedgeDesignation,
      businessModel: p.businessModel,
      electedAt: p.electedAt,
      cites: p.cites,
    };
    const existing = latest.get(key);
    if (existing === undefined || row.electedAt >= existing.electedAt) {
      latest.set(key, row);
    }
  }
  const rows = [...latest.values()].sort((a, b) => {
    if (a.instance !== b.instance) return a.instance < b.instance ? -1 : 1;
    return a.facet < b.facet ? -1 : a.facet > b.facet ? 1 : 0;
  });
  return { rows };
}

/** Find the latest election for (instance, facet), or undefined if none. */
export function findInstanceElection(
  register: InstanceElectionRegister,
  instance: string,
  facet: InstanceElectionFacet,
): InstanceElectionRow | undefined {
  return register.rows.find((r) => r.instance === instance && r.facet === facet);
}
