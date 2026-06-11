// platform/regulatory/structured-source-schema.ts
//
// Canonical TypeScript types for the `*-structured.json` files under
// `Regulations/*/source-docs/`. These files are the hand-curated (or
// extraction-generated) structured representations of regulatory source texts.
//
// The `goldenSourceHash` field (added by WS-REGULATORY-LIBRARY-V1 Slice 2)
// links each structured document to the content-addressed binary filed via
// `recordRegulatorySource()` (D-REGULATORY-LIBRARY-V1). Seed-projection
// Step 5b propagates this hash onto every Provision node built from the doc.
//
// Authority: D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11).
// Author: Mira (Compliance / RegTech engineer, engineering).

export interface StructuredSection {
  id: string;
  number?: string;
  sectionNumber?: string; // legacy alias
  heading?: string;
  title?: string; // legacy alias
  text?: string;
  verbatim?: boolean;
  /** PDF page range this section spans, e.g. "12–14". */
  pages?: string;
  footnotes?: Array<{ marker: string; text: string }>;
  subsections?: StructuredSection[];
  excerpts?: Array<{
    id: string;
    kind: "table" | "diagram" | "formula";
    hash?: string;
    pages?: string;
    caption?: string;
  }>;
}

export interface StructuredSourceDocument {
  slug: string;
  title: string;
  shortTitle?: string;
  regulator?: string;
  jurisdiction?: string;
  year?: number;
  sourceNote?: string;
  citationPatterns?: string[];
  priority?: number;
  /**
   * BLAKE3 hash of the source PDF filed via `recordRegulatorySource()`
   * (D-REGULATORY-LIBRARY-V1). Set by `extract:structured --hash <blake3:...>`.
   * Seed-projection Step 5b propagates this onto every Provision node built
   * from this document, enabling content-addressed traceability from an
   * obligation node back to the regulator's published binary.
   */
  goldenSourceHash?: string;
  chapters: Array<{
    id?: string;
    number?: string;
    heading?: string;
    sections: StructuredSection[];
  }>;
}
