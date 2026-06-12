// scripts/file-vera-v2-s5-released-surface-gate-design-note.ts
//
// One-shot RMS Phase 3 filing for Vera's V2 S5 design note: the released-surface
// gate and K/R/C clean-core boundary. Emits a RecordFiled event so the Documents
// register holds the canonical design note. Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Author: Vera (Internal Audit Engineer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:vera:v2-s5-released-surface-gate-design-note:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-vera-v2-s5-released-surface-gate-design-note] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# V2 S5 — Released-surface gate: K/R/C clean-core boundary (design note)

**Author:** Vera (Internal Audit Engineer, governance)
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Brief:** brief:vera:v2-s5-released-surface-gate-clean-core-boundary-:2026-06-12

## What S5 delivers

S5 establishes the **clean-core boundary**: a statically enforced manifest of
what \`v2-core\` exposes to each tier (K-anchor, R-regulated tenant, C-commercial
SaaS), plus a recon gate that FAILS CI if internal types bleed into the R/C
surface. This is the governance control that makes the K/R/C tier structure
(D-V2-BBAAS-TIER-STRUCTURE) enforceable at the code level.

## Files added

| File | Purpose |
|---|---|
| \`v2-core/released-surface.ts\` | RELEASED_SURFACE manifest — canonical K/R/C surface declaration |
| \`v2-core/index.ts\` (amended) | \`@tier K\|R\|C\` JSDoc annotations on all 9 exports |
| \`platform/recon/v2-released-surface-gate.ts\` | \`recon:v2-released-surface-clean-core\` gate |
| \`platform/recon/v2-released-surface-gate.test.ts\` | 12 tests: violation + clean + real manifest |
| \`scripts/run-recon-suite.ts\` (amended) | Gate wired into \`ci:recon:infra\` suite |

## Tier structure (D-V2-BBAAS-TIER-STRUCTURE)

| Tier | Identity | Access |
|---|---|---|
| K | Anchor bank (Scrooge's own institution) | Full internal access to all v2-core exports |
| R | Regulated tenant | FIL-mediated surface: primitives, taxonomy, URN, composition, lifecycle, type-definition, facets, models registry |
| C | Commercial SaaS tenant | Constrained: primitives, taxonomy, URN, facets only |

## Gate logic (\`recon:v2-released-surface-clean-core\`)

The gate performs two checks on every CI pass:

**(a) Tier-leak check:** Scans every \`export * from\` line in \`v2-core/index.ts\`
for a \`@tier K\` annotation. If that export token appears in \`RELEASED_SURFACE.R.exports\`
or \`RELEASED_SURFACE.C.exports\`, the gate FAILS with severity \`fail\`.

**(b) Unannotated-export check:** Every \`export * from\` line in \`v2-core/index.ts\`
must have a \`@tier K|R|C\` JSDoc tag in the immediately preceding comment block.
Missing annotations are reported as \`fail\` violations.

## Token convention

Tokens in \`RELEASED_SURFACE\` are the relative path from \`v2-core/index.ts\`
with the leading \`./\` stripped:
\`\`\`
export * from "./fil-core/primitives" → token: "fil-core/primitives"
export * from "./fil-facets/facets"   → token: "fil-facets/facets"
\`\`\`

## S0 export classification (baseline)

| Export | Token | Tier |
|---|---|---|
| \`./fil-core/primitives\` | \`fil-core/primitives\` | C (all tiers) |
| \`./fil-core/taxonomy\` | \`fil-core/taxonomy\` | C (all tiers) |
| \`./fil-core/urn\` | \`fil-core/urn\` | C (all tiers) |
| \`./fil-core/composition\` | \`fil-core/composition\` | R (regulated + anchor) |
| \`./fil-core/lifecycle\` | \`fil-core/lifecycle\` | R (regulated + anchor) |
| \`./fil-core/type-definition\` | \`fil-core/type-definition\` | R (regulated + anchor) |
| \`./fil-facets/facets\` | \`fil-facets/facets\` | C (all tiers) |
| \`./fil-models/declaration\` | \`fil-models/declaration\` | R (regulated + anchor) |
| \`./fil-models/registry\` | \`fil-models/registry\` | R (regulated + anchor) |

No K-only exports exist in the S0 baseline; the manifest is ready to receive them
as Wave-1 slices (S1 control-plane store, S2 tenant axis) add K-internal write paths.

## Test strategy

1. **Synthetic K-leak in R surface** → gate fails, message cites token and "R-tier surface"
2. **Synthetic K-leak in C surface** → gate fails, message cites token and "C-tier surface"
3. **Unannotated export** → gate fails, message cites "no @tier annotation"
4. **Clean synthetic manifest** → gate passes, asserted > 0
5. **Real v2-core/index.ts + RELEASED_SURFACE** → gate passes

## Note for subsequent slices (S1–S4)

This manifest is a living document. Each Wave-1 slice that adds exports to
\`v2-core/index.ts\` must:
1. Add a \`@tier K|R|C\` annotation to the new export block.
2. If the export is in the R or C surface, add its token to \`RELEASED_SURFACE.R.exports\`
   or \`RELEASED_SURFACE.C.exports\` respectively.
3. If the export is K-only, do NOT add it to R or C surfaces (the gate enforces this).

The gate remains green as long as all exports are annotated — it does not require
advance knowledge of the full manifest.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-TIER-STRUCTURE", "D-V2-BBAAS-BLUEPRINT-SYNTHESIS"],
    actor: {
      type: "service",
      id: "agent:vera:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S5 — Released-surface gate: K/R/C clean-core boundary (design note)",
      path: "2026-06-12_vera_v2-s5-released-surface-gate-design-note.md",
      category: "engineering-design",
      author: "Vera (Internal Audit Engineer, governance)",
      date: "2026-06-12",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
