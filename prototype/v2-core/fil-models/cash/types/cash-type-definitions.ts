// v2-core/fil-models/cash/types/cash-type-definitions.ts
//
// Formal FilTypeDefinition registration for the Cash FIL type
// (D-CASH-ASSET-CLASS-V1).
//
// `fil:type:cash:balance:vanilla@1.0` — a monetary cash balance, ATOMIC (no
// legs). The asset class is CURRENCY-AGNOSTIC: it holds the reporting/domestic
// currency (ZAR) exactly as it holds USD/EUR, so currency is an INSTANCE-level
// economic term and never part of the type identity (no `fcy`/currency marker in
// the slug — parallels `fx:swap:vanilla`). It implements:
//   - Lifecycled  — the cash-balance lifecycle (held → drawn-down|swept|closed).
//   - Valuable    — value = balance × closing rate (IAS-21 §23 monetary item);
//                   the SAME lifecycle-free arithmetic as the FX position, which
//                   is what makes settlement structurally continuous.
//   - Accountable — IFRS-9 amortised-cost monetary item, IAS-21 retranslation.
//   - RiskMeasurable — the standing-NOP FX risk contribution post-settlement
//                   (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP): a foreign cash
//                   balance still bears FX risk on the <CCY>/<reporting> pair.
//
// The cash asset is SEPARATE from `fx`: an FX trade maturing INTO a cash asset
// is a PRODUCT/NPA fact (the FX OTC NPA declares the materialisation), read by
// the settlement path — NOT a kernel dependency between the `fx` and `cash`
// classes.
//
// Authority: D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   IAS-21-§23; IFRS-9-§3.2; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP;
//   D-ENGINEERING-INTEGRITY-CHARTER.
// brief: brief:atlas:cash-as-a-first-class-fil-asset-class-fx-maturit:2026-06-17
// Author: Atlas (Core banking platform architect, engineering).

import { ATOMIC_COMPOSITION } from "../../../fil-core/composition.ts";
import type { FilTypeDefinition } from "../../../fil-core/type-definition.ts";
import type { FilTypeUrn } from "../../../fil-core/urn.ts";
import { CASH_BALANCE_LIFECYCLE } from "./cash-lifecycles.ts";

// ---------------------------------------------------------------------------
// Cash balance — atomic, single currency.
// ---------------------------------------------------------------------------
export const CASH_BALANCE_TYPE: FilTypeDefinition = {
  urn: "fil:type:cash:balance:vanilla@1.0" as FilTypeUrn,
  assetClass: "cash",
  familyPath: "balance",
  composition: ATOMIC_COMPOSITION,
  lifecycle: CASH_BALANCE_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Valuable", "Accountable", "RiskMeasurable"],
  minting: "kernel",
};

export const CASH_TYPE_DEFINITIONS = [CASH_BALANCE_TYPE] as const;

/** The Cash FIL type URN string — the canonical reference for emitters. */
export const CASH_BALANCE_TYPE_URN = CASH_BALANCE_TYPE.urn;
