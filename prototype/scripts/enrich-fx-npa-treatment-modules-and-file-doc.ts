// scripts/enrich-fx-npa-treatment-modules-and-file-doc.ts
//
// FX OTC umbrella NPA enrichment driver (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD,
// CEO-approved 2026-06-17):
//
//   1. Re-emits the accounting (dim 6), capital/prudential (dim 7), and tax
//      (dim 14) ProductDimensionAttested events so each cites its matching
//      versioned reporting-treatment module (`treatment-module:<id>@<version>`)
//      while PRESERVING its current `result` and tracked `deferredGaps`
//      (platform/markets/products/npa-fx-treatment-module-enrichment.ts).
//
//   2. Folds the resulting store state into the consolidated FX NPA document —
//      a render of the events (Principle 1) — summarising all 14 dimensions,
//      mapping accounting/prudential/tax to their treatment modules, listing the
//      full deferred-gap register, and recording the lifecycle state
//      (ProductWithheld, pending re-gate). The document is filed events-first via
//      `recordFiled` (RMS-7): content-addressed BLAKE3 hash + RecordFiled event.
//
// This does NOT re-approve the product. No `ProductApproved` is emitted. The
// gate is asserted UNCHANGED (still withheld) before and after the enrichment.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/enrich-fx-npa-treatment-modules-and-file-doc.ts
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17);
//            D-NPA-GATE-POLICY-REDESIGN; D-FX-OTC-NPA-SCOPE-EXPANSION;
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Bea (Financial Accountant, finance).

import { clock, eventStore } from "../platform/composition";
import type { Event } from "../platform/event-store/types";
import { renderFxNpaConsolidatedDoc } from "../platform/markets/products/fx-npa-consolidated-doc";
import {
  ENRICH_AS_OF,
  ENRICH_PRODUCT_ID,
  FX_TREATMENT_MODULE_ENRICHMENTS,
  runFxTreatmentModuleEnrichment,
} from "../platform/markets/products/npa-fx-treatment-module-enrichment";
import { validateNpaGate } from "../platform/markets/products/npa-gate";
import { logger } from "../platform/observability/logger";
import { buildProductRegisterView } from "../platform/projections/products/product-register";
import { recordFiled } from "../platform/records/helpers";

// ---------------------------------------------------------------------------
// 1. Enrich the three module-backed dimensions (idempotent).
// ---------------------------------------------------------------------------

const enrichResult = runFxTreatmentModuleEnrichment(eventStore);
logger.info(
  { productId: ENRICH_PRODUCT_ID, ...enrichResult },
  `FX NPA treatment-module enrichment: enriched=[${enrichResult.enriched.join(", ")}] skipped=[${enrichResult.skipped.join(", ")}]`,
);

// ---------------------------------------------------------------------------
// 2. Fold the register and assert the gate is STILL withheld (not weakened).
// ---------------------------------------------------------------------------

const events: Event[] = Array.from(eventStore.replay());
const register = buildProductRegisterView(events);
const row = register.get(ENRICH_PRODUCT_ID);
if (!row) {
  throw new Error(
    `No register row for ${ENRICH_PRODUCT_ID} — cannot file the consolidated NPA doc.`,
  );
}

const gate = validateNpaGate(row);
if (row.lifecycleStage !== "withheld") {
  throw new Error(
    `FX umbrella lifecycle stage is "${row.lifecycleStage}", expected "withheld". This driver must not change the approval state; aborting.`,
  );
}
logger.info(
  {
    lifecycleStage: row.lifecycleStage,
    gateReady: gate.ready,
    missing: gate.missing,
    openConditions: gate.openConditions,
  },
  "FX umbrella gate evaluated — lifecycle UNCHANGED (withheld).",
);

// ---------------------------------------------------------------------------
// 3. Render + file the consolidated NPA document events-first (RecordFiled).
// ---------------------------------------------------------------------------

const FILE_AS_OF = ENRICH_AS_OF; // same logical instant as the enrichment.
const body = renderFxNpaConsolidatedDoc({ row, gate, asOf: FILE_AS_OF });

const filed = recordFiled(
  {
    recordId: `npa-doc:${ENRICH_PRODUCT_ID}:treatment-module-enrichment:${FILE_AS_OF.slice(0, 10)}`,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      // Companies Act §24 — board/management decisions & records (7 years).
      citationRef: "COMPANIES-ACT-71-2008-S24",
      minimumYears: 7,
      archivalTier: "cool",
    },
    metadata: {
      title: "FX OTC Vanilla — consolidated NPA (treatment-module enrichment)",
      path: `records/npa/${ENRICH_PRODUCT_ID}/treatment-module-enrichment.md`,
      category: "product-npa",
      author: "agent:bea:npa-treatment-module-enrichment",
      date: FILE_AS_OF,
    },
    citations: [
      "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
      "D-NPA-GATE-POLICY-REDESIGN",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-NEW-PRODUCT-APPROVAL-POLICY",
    ],
    actor: { type: "service", id: "agent:bea:npa-treatment-module-enrichment" },
  },
  FILE_AS_OF,
);

logger.info(
  {
    recordId: `npa-doc:${ENRICH_PRODUCT_ID}:treatment-module-enrichment:${FILE_AS_OF.slice(0, 10)}`,
    documentHash: filed.documentHash,
    eventId: filed.eventId,
    isNewDocument: filed.isNewDocument,
    modules: FX_TREATMENT_MODULE_ENRICHMENTS.map((e) => e.treatmentModuleId),
    at: clock.now(),
  },
  "Consolidated FX NPA document filed via RecordFiled (events-first).",
);

process.exit(0);
