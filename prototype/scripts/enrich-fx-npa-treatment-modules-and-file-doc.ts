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

import { buildNpaView } from "../dashboard/markets-fx-npa";
import { clock, eventStore } from "../platform/composition";
import { makeProductWithheld } from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
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

// The lifecycle event types whose latest-by-as_of determines whether the
// product is currently approved or withheld.
const LIFECYCLE_DECISION_TYPES = new Set([
  "ProductApproved",
  "ProductWithheld",
  "ProductLaunched",
  "ProductRetired",
]);

/** Find the latest (by as_of) approval/withholding lifecycle event for the product. */
function latestLifecycleEvent(store: typeof eventStore): Event | undefined {
  let latest: Event | undefined;
  for (const ev of store.replay()) {
    if (!LIFECYCLE_DECISION_TYPES.has(ev.type)) continue;
    const p = ev.payload as { productId?: string };
    if (p.productId !== ENRICH_PRODUCT_ID) continue;
    if (!latest || ev.as_of > latest.as_of) latest = ev;
  }
  return latest;
}

// ---------------------------------------------------------------------------
// 1. Enrich the three module-backed dimensions (idempotent).
// ---------------------------------------------------------------------------

const enrichResult = runFxTreatmentModuleEnrichment(eventStore);
logger.info(
  { productId: ENRICH_PRODUCT_ID, ...enrichResult },
  `FX NPA treatment-module enrichment: enriched=[${enrichResult.enriched.join(", ")}] skipped=[${enrichResult.skipped.join(", ")}]`,
);

// ---------------------------------------------------------------------------
// 2. Enact the standing CEO withdrawal decision (events-first), idempotently.
//
// D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15) directs "Emit
// ProductWithheld for prd:bank:fx:otc-vanilla". The decision is on record but
// was never enacted as a typed lifecycle event — a no-silent-deferral gap: the
// register still derives `approved-conditional` from the stale ProductApproved.
// This is NOT a re-approval (the opposite). We emit the missing ProductWithheld
// only when the latest lifecycle event is still an approval, so re-runs are
// idempotent. No ProductApproved is ever emitted.
// ---------------------------------------------------------------------------

const WITHDRAWAL_DECISION = "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL";
const WITHHELD_AS_OF = "2026-06-15T10:00:00.000Z"; // matches the CEO decision instant.

const latestBefore = latestLifecycleEvent(eventStore);
if (latestBefore?.type === "ProductApproved") {
  const version =
    typeof (latestBefore.payload as { version?: string }).version === "string"
      ? (latestBefore.payload as { version: string }).version
      : "1.0.0";
  eventStore.append({
    ...makeProductWithheld({
      asOf: WITHHELD_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: [WITHDRAWAL_DECISION, "D-NPA-GATE-POLICY-REDESIGN"],
      payload: {
        productId: ENRICH_PRODUCT_ID,
        version,
        reason:
          "Enacting the standing CEO decision D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (2026-06-15): " +
          "the prior ProductApproved was issued under the design-attested-sufficient policy, now " +
          "superseded by D-NPA-GATE-POLICY-REDESIGN. The product is withheld pending re-gate; no " +
          "interim approval. Gap remediation is the workstream.",
      },
    }),
    provenance: buildPhaseFixtureTag({
      sourceLineage: "platform:npa-attestation-runner",
      variant: `npa-withhold:${ENRICH_PRODUCT_ID}:enact-withdrawal-decision`,
      tags: ["npa-gate", "product-withhold", ENRICH_PRODUCT_ID],
    }),
  });
  logger.info(
    { productId: ENRICH_PRODUCT_ID, decision: WITHDRAWAL_DECISION },
    "Enacted the standing CEO withdrawal decision — ProductWithheld emitted (events-first).",
  );
} else {
  logger.info(
    { productId: ENRICH_PRODUCT_ID, latest: latestBefore?.type },
    "Withdrawal already enacted (latest lifecycle event is not an approval) — skipped.",
  );
}

// ---------------------------------------------------------------------------
// 3. Fold the register + assert the product is NOT approved (still withheld).
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
const npaView = buildNpaView(eventStore, ENRICH_AS_OF);
const anyApproved = npaView.attestations.some((a) => a.status === "approved");
const latestAfter = latestLifecycleEvent(eventStore);
if (latestAfter?.type === "ProductApproved" || anyApproved) {
  throw new Error(
    `FX umbrella is still in an approved state after enrichment — this driver must leave it withheld. latestLifecycleEvent=${latestAfter?.type}; anyVariantApproved=${anyApproved}; aborting.`,
  );
}
logger.info(
  {
    lifecycleStage: row.lifecycleStage,
    latestLifecycleEvent: latestAfter?.type,
    npaStatuses: npaView.attestations.map((a) => `${a.productCode}:${a.status}`),
    gateReady: gate.ready,
    missing: gate.missing,
    openConditions: gate.openConditions,
  },
  "FX umbrella state verified — NOT approved (withheld, pending re-gate).",
);

// ---------------------------------------------------------------------------
// 4. Render + file the consolidated NPA document events-first (RecordFiled).
// ---------------------------------------------------------------------------

// Overall approval status for the umbrella: withheld if any in-scope variant is
// withheld; else pending (we already proved nothing is approved above).
const npaStatus: "approved" | "withheld" | "pending" = npaView.attestations.some(
  (a) => a.status === "withheld",
)
  ? "withheld"
  : "pending";

const FILE_AS_OF = ENRICH_AS_OF; // same logical instant as the enrichment.
const body = renderFxNpaConsolidatedDoc({ row, gate, npaStatus, asOf: FILE_AS_OF });

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
