// scripts/run-fx-npa-dim-verification-pass-2.ts
//
// One-shot driver for the FX OTC umbrella NPA per-dimension verification pass
// v2 promotions. All data + logic live in the side-effect-free platform module
// platform/markets/products/npa-fx-verification-pass-2.ts; this script only
// resolves the SHARED canonical store and runs it. Idempotent.
//
// Run (resolve-event-db-boot shim resolves $HOME/.local/share/bank/event.db —
// do NOT set BANK_EVENT_DB):
//   bun run scripts/run-fx-npa-dim-verification-pass-2.ts
//
// Authority: D-FX-NPA-VERIFICATION-PASS-2-DISPATCH (CEO session-delegation
//            2026-06-11); D-FX-OTC-NPA-SCOPE-EXPANSION;
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Brief: brief:saskia:otc-vanilla-fx-per-dimension-verification-pass-v:2026-06-11
// Author: Saskia (Head of Global Markets, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  PASS2_AS_OF,
  PASS2_HELD_DIMENSIONS,
  PASS2_PRODUCT_ID,
  runFxNpaDimVerificationPass2,
} from "../platform/markets/products/npa-fx-verification-pass-2";
import { logger } from "../platform/observability/logger";

const result = runFxNpaDimVerificationPass2(eventStore);

logger.info(
  {
    productId: PASS2_PRODUCT_ID,
    promoted: result.promoted,
    skipped: result.skipped,
    heldDesignAttested: PASS2_HELD_DIMENSIONS,
    asOf: PASS2_AS_OF,
    at: clock.now(),
  },
  "verification pass v2: promotions emitted — held dimensions stay design-attested (grounded reasons in the filed verification record)",
);
process.exit(0);
