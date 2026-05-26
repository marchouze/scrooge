// scripts/run-npa-model-risk-upgrade.ts
//
// Slice 7 — Upgrade model-risk attestation to implementation-attested for
// products where no pricing model is used (listed equity, repo).
//
// Listed equity (prd:bank:equity:jse-equity-cash): JSE-quoted prices;
// no mark-to-model. Model-risk tier: N/A (no model). SR 11-7 §I: model
// definition requires a quantitative method applied to produce an output;
// exchange-quoted prices satisfy the price-discovery requirement directly.
//
// Open repo (prd:bank:bond:open-repo-gmra): negotiated repo rate; no
// pricing model. Collateral valuation uses quoted bond prices (see equity
// attestation above for the same logic on the collateral leg).
//
// These two products meet the "no-model-used" threshold for
// implementation-attested model-risk. The remaining products (bond, IRS,
// FX swap) require Nadia's methodology library + model registry before
// upgrading — see model-risk-substrate-gaps.ts.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 7
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";

import { makeProductDimensionAttested } from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import { logger } from "../platform/observability/logger";

const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../.local/event.db");

const store = new EventStore(DB_PATH);

const ACTOR = { type: "service" as const, id: "agent:atlas:npa-model-risk-upgrade" };
const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-26T19:00:00.000Z";
const CITATIONS = [
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
];

const UPGRADES: Array<{ productId: string; notes: string }> = [
  {
    productId: "prd:bank:equity:jse-equity-cash",
    notes:
      "No pricing model used. JSE-quoted prices satisfy price-discovery directly. SR 11-7 §I model definition not met — no quantitative method applied to produce an output. Tier classification: N/A (no-model). Slice 7 implementation-attested per D-PRODUCT-CONSTRUCTION-SUBSTRATE.",
  },
  {
    productId: "prd:bank:bond:open-repo-gmra",
    notes:
      "No pricing model used. Repo rate is negotiated bilaterally. Collateral (SAGB) valued at quoted market prices. SR 11-7 model definition not met for the repo leg. Tier classification: N/A (no-model). Slice 7 implementation-attested per D-PRODUCT-CONSTRUCTION-SUBSTRATE.",
  },
];

let emitted = 0;
let skipped = 0;

for (const { productId, notes } of UPGRADES) {
  // Check if an implementation-attested model-risk event already exists for this product.
  const existing = Array.from(store.replay()).filter(
    (ev) =>
      ev.type === "ProductDimensionAttested" &&
      (ev.payload as Record<string, unknown>).productId === productId &&
      (ev.payload as Record<string, unknown>).dimension === "model-risk" &&
      (ev.payload as Record<string, unknown>).result === "implementation-attested",
  );

  if (existing.length > 0) {
    logger.info({ productId }, "model-risk already implementation-attested — skipping");
    skipped++;
    continue;
  }

  const ev = makeProductDimensionAttested({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      productId,
      dimension: "model-risk",
      result: "implementation-attested",
      citationChain: [
        "D-NEW-PRODUCT-APPROVAL-POLICY",
        "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
        "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
      ],
    },
  });

  // Attach notes via a second payload key accepted by the Zod schema.
  // The schema does not include a `notes` field — log it instead.
  logger.info({ productId, notes }, "emitting model-risk upgrade");
  store.append(ev);
  emitted++;
}

console.log(`npa-model-risk-upgrade: ${emitted} emitted, ${skipped} already upgraded`);
