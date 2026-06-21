// v2-core/fil-models/capital/types/capital-type-definitions.ts
//
// Formal FilTypeDefinition registration for the Capital FIL type family
// (D-CAPITAL-ASSET-CLASS-V1).
//
// `fil:type:capital:instrument:vanilla@1.0` — the bank's OWN qualifying
// regulatory-capital instrument-of-record, ATOMIC (no legs). The asset class is
// CURRENCY-AGNOSTIC: a ZAR ordinary-share subscription is held exactly as a
// foreign-currency AT1 instrument would be, so currency is an INSTANCE-level
// economic term and never part of the type identity (no currency marker in the
// slug — parallels `cash:balance:vanilla` and `fx:swap:vanilla`). The qualifying-
// capital TIER (CET1 / AT1 / Tier 2) and sub-category are likewise INSTANCE-level
// economic terms (`economicTerms.qualifyingCapital`), NOT separate types: one
// shared core capital type instantiated with a tier dimension, so the composition
// fold sums all three tiers off one taxonomy node. It implements:
//   - Lifecycled  — the capital-instrument lifecycle (active → terminated|matured|
//                   cancelled), `capital-lifecycles.ts`.
//   - Accountable — IAS 32 equity classification for CET1 (paid-up shares, share
//                   premium, retained earnings, OCI) + IFRS 9 financial-liability
//                   classification for liability-classified AT1 / Tier 2
//                   instruments; the posting rules (`posting-rules/capital.ts`)
//                   fire at fold time.
//   - Reportable  — the source of the BA-700 / BA-100 own-funds composition
//                   (Reg 38, Banks Act §70, BCBS CAP/RBC, SARB PA D5/2025).
//
// Capital is NOT a market exposure: it does NOT implement Valuable / RiskMeasurable
// (it is the bank's own funds — the capital-adequacy NUMERATOR, the complement of
// the RWA denominator — not a mark-to-market trading position). This is the
// deliberate difference from the `cash` model (which IS a market monetary item
// bearing standing-NOP FX risk).
//
// Authority: D-CAPITAL-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-ENGINEERING-INTEGRITY-CHARTER;
//   urn:reg:za:regs-relating-to-banks:reg38; Banks Act 94 of 1990 §70;
//   urn:reg:bcbs:rbc:20.2; D5/2025 §2.1.3 (form BA 100); IAS-32-§22; IFRS-9-§4.2.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { ATOMIC_COMPOSITION } from "../../../fil-core/composition.ts";
import type { FilTypeDefinition } from "../../../fil-core/type-definition.ts";
import type { FilTypeUrn } from "../../../fil-core/urn.ts";
import { CAPITAL_INSTRUMENT_LIFECYCLE } from "./capital-lifecycles.ts";

// ---------------------------------------------------------------------------
// Capital instrument — atomic, single currency, tier on the economic terms.
// ---------------------------------------------------------------------------
export const CAPITAL_INSTRUMENT_TYPE: FilTypeDefinition = {
  urn: "fil:type:capital:instrument:vanilla@1.0" as FilTypeUrn,
  assetClass: "capital",
  familyPath: "instrument",
  composition: ATOMIC_COMPOSITION,
  lifecycle: CAPITAL_INSTRUMENT_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Accountable", "Reportable"],
  minting: "kernel",
};

export const CAPITAL_TYPE_DEFINITIONS = [CAPITAL_INSTRUMENT_TYPE] as const;

/** The Capital FIL type URN string — the canonical reference for emitters. */
export const CAPITAL_INSTRUMENT_TYPE_URN = CAPITAL_INSTRUMENT_TYPE.urn;

/** Taxonomy prefix guard — `fil:type:capital:`. */
export const CAPITAL_TYPE_PREFIX = "fil:type:capital:";

/** True iff the FIL taxonomy type URN names a capital instrument. */
export function isCapitalInstance(typeUrn: string): boolean {
  return typeUrn.startsWith(CAPITAL_TYPE_PREFIX);
}
