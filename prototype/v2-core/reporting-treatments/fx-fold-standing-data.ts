// v2-core/reporting-treatments/fx-fold-standing-data.ts
//
// SINGLE SOURCE for the FX modular-fold standing data — the one
// `V2ProductRegistered` (FX OTC Vanilla) plus the FX `ReportingTreatmentDeclared`
// module menu it picks. Both the v2-anchor standing-data seed
// (`scripts/seed-v2-anchor-bank-standing-data.ts`) and the FIL-booking-store
// co-location seed (`scripts/seed-fx-product-treatment-fold-colocation.ts`)
// render THESE declarations, so the product+modules the modular fold resolves
// are byte-identical wherever they are seeded — the two stores cannot drift.
//
// WHY a second seed exists. PR #1455 (FX S0d) stamps `productId`
// `v2:prd:bank:fx:otc-vanilla` onto FX FIL instances at booking and makes
// `resolveInstanceTreatment` resolve treatment from that binding. The FX modular
// fold (`platform/accounting/posting-rules-v2/fx-fold.ts`) and the equivalence
// gate (`recon:gl-v2-fold-equivalence-fx`) read the MAIN FIL-booking event store
// (`composition.eventStore`). But the product + its treatment modules were only
// ever seeded into the SEPARATE v2-anchor store — so every bound FX instance
// fail-closed `product-not-registered` and the FX fold produced zero legs.
// Co-locating the SAME declarations into the FIL-booking store (FU1) lets the
// fold resolve treatment and produce real FX GL postings, while the fail-closed
// path stays intact for any genuinely-unregistered product.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — it imports ONLY the FX
// treatment-module constant from this package and the `V2ProductRegistered`
// payload TYPE from the v2-core banking events; nothing from `platform/` /
// `runtime/` (enforced by `recon:v2-no-v1-import`).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17);
//   D-FX-OTC-CLOSURE-BACKLOG (CEO scope-extension 2026-06-19). Principle 1;
//   Principle 2.
// Author: Bea (Financial Accountant, finance).

import type { z } from "zod";
import type { v2ProductRegisteredSchema } from "../banking/events";
import { FX_TREATMENT_MODULES, FX_TREATMENT_MODULE_IDS } from "./fx-modules";

/**
 * The DECLARATION INPUT shape — `z.input` of the product schema, i.e. the
 * plain-string form BEFORE the schema's brand transforms (`filTypeScopes` is
 * `string[]` here, branded to `FilScopePattern[]` only on parse). Authoring the
 * canonical product at the input type keeps it a plain literal; the seeds
 * re-parse it fail-closed (via `makeV2ProductRegistered`), producing the branded
 * values. Mirrors `FxTreatmentModuleInput` in `./fx-modules`.
 */
export type FxProductInput = z.input<typeof v2ProductRegisteredSchema>;

/**
 * The FX OTC Vanilla product registration — the single product the FX modular
 * fold binds to via the booking-time `productId` `v2:prd:bank:fx:otc-vanilla`.
 *
 * Its `reportingTreatmentModuleIds` is the single-source FX menu id set
 * (`FX_TREATMENT_MODULE_IDS`); the modules themselves are
 * `FX_TREATMENT_MODULES`, re-exported below so a seed renders product+modules
 * together. The product literal MUST match the FX entry in the v2-anchor seed's
 * `PRODUCTS` array byte-for-byte (the anchor seed imports THIS constant).
 */
export const FX_OTC_VANILLA_PRODUCT: FxProductInput = {
  kind: "V2ProductRegistered",
  productId: "v2:prd:bank:fx:otc-vanilla",
  name: "FX OTC Vanilla (spot + forward)",
  ifrs9Family: "fx-spot",
  filTypeScopes: ["fil:type:fx:spot:*", "fil:type:fx:forward:*"],
  v1ProductId: "prd:bank:fx:otc-vanilla",
  currencies: ["ZAR", "USD", "EUR", "GBP", "JPY", "CHF", "AUD"],
  legalEntityIds: ["LE-ZA-HOZ-BANK"],
  jurisdictions: ["ZA"],
  franchiseScope: "institutional",
  // Modular-composed-fold treatment menu pick (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD):
  // one module per treatment dimension, all scoped fil:type:fx:*. The id set is
  // the single-source constant from v2-core/reporting-treatments/fx-modules.ts.
  reportingTreatmentModuleIds: [...FX_TREATMENT_MODULE_IDS],
  citations: [
    "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    "D-FX-OTC-NPA-SCOPE-EXPANSION",
    "D-MARKETS-SCHEMA-FOUNDATION",
    "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
  ],
};

/**
 * Re-export the FX treatment-module declarations so a single import gives a seed
 * the complete FX fold standing-data set (product + modules).
 */
export { FX_TREATMENT_MODULES, FX_TREATMENT_MODULE_IDS };
