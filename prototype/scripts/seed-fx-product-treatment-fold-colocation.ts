// scripts/seed-fx-product-treatment-fold-colocation.ts
//
// FU1 — co-locate the FX OTC Vanilla product + its FX reporting-treatment
// modules into the MAIN FIL-booking event store (`BANK_EVENT_DB`, via
// `composition.eventStore`) — the SAME store the FX modular fold and
// `recon:gl-v2-fold-equivalence-fx` read.
//
// WHY. PR #1455 (FX S0d) stamps the booking-time `productId`
// `v2:prd:bank:fx:otc-vanilla` onto FX FIL instances and makes
// `resolveInstanceTreatment` (platform/accounting/reporting-treatment-dispatcher.ts)
// resolve treatment from that binding. But the `V2ProductRegistered` product +
// its `ReportingTreatmentDeclared` modules were only ever seeded into the
// SEPARATE v2-anchor store (`scripts/seed-v2-anchor-bank-standing-data.ts`). The
// fold reads the MAIN store — so every bound FX instance fail-closed
// `product-not-registered` and the FX fold produced ZERO legs (FX=0 in the gate,
// passing only vacuously). This seed makes the product + modules present in the
// MAIN store so the fold resolves treatment and produces real FX GL legs.
//
// FAIL-CLOSED PRESERVED (Engineering Charter cmd 2). This seed registers ONLY the
// genuinely-registered FX OTC Vanilla product + its declared modules. An instance
// bound to any OTHER (unregistered) product still fail-closes
// `product-not-registered` — there is no silent default. The resolver path is
// unchanged; this seed only supplies the standing data it reads.
//
// SINGLE SOURCE. The product literal + treatment modules come from
// `v2-core/reporting-treatments/fx-fold-standing-data.ts` — the SAME constants
// the v2-anchor seed renders — so the two stores cannot drift.
//
// PROVENANCE. The product + modules are governance-class standing data, tagged
// `kind:"production"` (matching the FX FIL events that `backfill:fil-instances`
// writes) so they pass the fold's operating-book provenance filter. Explicit
// `productionTag(...)` here is legitimate: this is a one-shot seed under
// `scripts/`, which is out of `recon:provenance-emit-discipline` scan scope by
// design. `V2ProductRegistered` is policy-unmapped (would be hard-rejected at
// append without an explicit tag), so the explicit tag is REQUIRED, not optional.
//
// IDEMPOTENT. Skips a product / module already present in the store (by
// productId / treatmentId), so repeated `ci:migrate` runs add nothing.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17);
//   D-FX-OTC-CLOSURE-BACKLOG (CEO scope-extension 2026-06-19). Engineering
//   Charter (fail-closed; honesty; source-don't-hardcode). Principle 1; Principle 2.
// Author: Bea (Financial Accountant, finance).

import { eventStore } from "../platform/composition";
import { makeReportingTreatmentDeclared } from "../platform/event-store/event-types/reporting-treatments";
import { makeV2ProductRegistered } from "../platform/event-store/event-types/v2-banking";
import { productionTag } from "../platform/event-store/provenance";
import type { Actor, Event } from "../platform/event-store/types";
import {
  FX_OTC_VANILLA_PRODUCT,
  FX_TREATMENT_MODULES,
} from "../v2-core/reporting-treatments/fx-fold-standing-data";

// ---------------------------------------------------------------------------
// Constants — anchor identity. Mirrors the FIL-booking events the fold reads
// (entity LE-ZA-HOZ-BANK; governance-lineage production provenance).
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-06-12T00:00:00.000Z";
const ACTOR: Actor = {
  type: "service",
  id: "agent:bea:seed-fx-product-treatment-fold-colocation",
};
const CITATIONS = [
  "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
  "D-FX-OTC-CLOSURE-BACKLOG",
  "P1-EVENTS-AS-TRUTH",
];

// Governance-class standing data — production-tagged to match the FX FIL events
// (`backfill:fil-instances` writes `kind:"production", sourceLineage:"category:
// governance"`), so the modules pass the fold's operating-book provenance filter.
const PROVENANCE = productionTag({ sourceLineage: "category:governance" });

// ---------------------------------------------------------------------------
// Idempotency — does the MAIN store already carry this product / module?
// ---------------------------------------------------------------------------

function productAlreadyPresent(productId: string): boolean {
  for (const e of eventStore.replay({ type: "V2ProductRegistered" })) {
    const p = e.payload as { productId?: string };
    if (p.productId === productId) return true;
  }
  return false;
}

function treatmentAlreadyPresent(treatmentId: string): boolean {
  for (const e of eventStore.replay({ type: "ReportingTreatmentDeclared" })) {
    const p = e.payload as { treatmentId?: string };
    if (p.treatmentId === treatmentId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

let productsSeeded = 0;
let productsSkipped = 0;
let treatmentsSeeded = 0;
let treatmentsSkipped = 0;

// (1) The FX OTC Vanilla product.
if (productAlreadyPresent(FX_OTC_VANILLA_PRODUCT.productId)) {
  console.log(`  [SKIP] V2ProductRegistered ${FX_OTC_VANILLA_PRODUCT.productId}`);
  productsSkipped += 1;
} else {
  const ev: Event = {
    ...makeV2ProductRegistered({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: FX_OTC_VANILLA_PRODUCT,
    }),
    provenance: PROVENANCE,
  };
  eventStore.append(ev);
  console.log(`  [OK]   V2ProductRegistered ${FX_OTC_VANILLA_PRODUCT.productId}`);
  productsSeeded += 1;
}

// (2) The FX treatment modules the product picks.
for (const m of FX_TREATMENT_MODULES) {
  const treatmentId = (m as { treatmentId: string }).treatmentId;
  if (treatmentAlreadyPresent(treatmentId)) {
    console.log(`  [SKIP] ReportingTreatmentDeclared ${treatmentId}`);
    treatmentsSkipped += 1;
    continue;
  }
  const ev: Event = {
    ...makeReportingTreatmentDeclared({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: m as Parameters<typeof makeReportingTreatmentDeclared>[0]["payload"],
    }),
    provenance: PROVENANCE,
  };
  eventStore.append(ev);
  console.log(`  [OK]   ReportingTreatmentDeclared ${treatmentId}`);
  treatmentsSeeded += 1;
}

console.log(
  `\nFX fold standing-data co-location → MAIN store (${process.env.BANK_EVENT_DB ?? "(home default)"}):`,
);
console.log(`  Products: ${productsSeeded} seeded, ${productsSkipped} skipped.`);
console.log(
  `  Reporting-treatment modules: ${treatmentsSeeded} seeded, ${treatmentsSkipped} skipped.`,
);
