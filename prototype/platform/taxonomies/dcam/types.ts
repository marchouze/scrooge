// platform/taxonomies/dcam/types.ts
//
// DCAM shared type definitions — extracted from taxonomies/index.ts to
// break the barrel ↔ layer1-conceptual / activities / risk circular imports.
//
// These types have no imports and no side-effects; safe to import from
// any depth of the taxonomy tree.
//
// Authority: Vera Wave-4 F-034 (circular-deps gate); Atlas (Core Banking
// Platform Architect, engineering) + Vera (Internal Audit Engineer).

export type SkosMatchType =
  | "exactMatch"
  | "closeMatch"
  | "broadMatch"
  | "narrowMatch"
  | "relatedMatch";

export type FiboModule =
  | "FND" // Foundations (amounts, dates, jurisdictions, parties)
  | "BE" // Business Entities (corporations, legal persons)
  | "FBC" // Financial Business and Commerce (market participants, services)
  | "SEC" // Securities (equities, debt, funds)
  | "DER" // Derivatives (IR, FX, credit, equity derivatives)
  | "IND" // Indices and Indicators (benchmarks, rates)
  | "BP" // Business Processes (trading, settlement, clearing)
  | "LOAN"; // Loans (credit facilities)

/** Layer 1 — Conceptual: FIBO ontological anchor. Defines what the concept IS. */
export interface ConceptualLayer {
  readonly fiboModule: FiboModule;
  readonly fiboIri: string;
  readonly fiboLabel: string;
  readonly skosMatch: SkosMatchType;
  readonly definition?: string;
  readonly notes?: string;
}

export type LogicalStandard =
  | "CDM" // ISDA/ICMA Common Domain Model — trade lifecycle data model
  | "ESMA-CFI" // ISO 10962 Classification of Financial Instruments
  | "ISO17442" // Legal Entity Identifier (LEI)
  | "BCBS" // Basel Committee on Banking Supervision
  | "FATF"; // Financial Action Task Force

/** Layer 2 — Logical: Industry data models and classification standards. */
export interface LogicalLayer {
  readonly standard: LogicalStandard;
  readonly ref: string;
  readonly label: string;
  readonly skosMatch: SkosMatchType;
  readonly notes?: string;
}

export type PhysicalStandard = "ISO20022";

/** Layer 3 — Physical: Message formats. The node's own `code` is also Layer 3. */
export interface PhysicalLayer {
  readonly standard: PhysicalStandard;
  readonly messageType: string;
  readonly label: string;
  readonly notes?: string;
}

/** DCAM three-layer alignment record for a taxonomy node. */
export interface DcamAlignment {
  readonly conceptual?: ConceptualLayer;
  readonly logical?: ReadonlyArray<LogicalLayer>;
  readonly physical?: ReadonlyArray<PhysicalLayer>;
}
