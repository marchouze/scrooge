// v2-core/fil-models/ir/money-market/types/mm-type-definitions.ts
//
// Formal FilTypeDefinition registrations for Phase 3b money-market instruments
// (asset class `ir`). All three are atomic (no legs).
//
// URN GRAMMAR NOTE. The brief sketches the deposit type as
// `fil:type:ir:money-market:deposit:fixed-term@1.0` (colon-delimited). The
// W9-canonical FIL URN grammar (`v2-core/fil-core/urn.ts`, the design the brief
// names as canonical) specialises the family path with DOTS, not extra colons —
// a type URN is exactly `fil:type:<asset-class>:<family-path>:<type-slug>@maj.min`
// with ONE family-path segment (dots allowed inside it) and ONE type-slug
// segment. We therefore realise the brief's three types as:
//   unsecured        → fil:type:ir:money-market:unsecured@1.0
//   fixed-term deposit→ fil:type:ir:money-market.deposit:fixed-term@1.0
//   classic repo     → fil:type:ir:money-market.repo:classic@1.0
// honouring the brief's taxonomy intent within the canonical grammar (Charter
// cmd 6 — respect the type contract, do not bend it).
//
// Authority: D-V1-REMOVAL-PHASE-3B; D-ENGINEERING-INTEGRITY-CHARTER;
//   brief:atlas:v1-removal-phase-3b-alm-liquidity-on-v2-money-ma:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import { ATOMIC_COMPOSITION } from "../../../../fil-core/composition.ts";
import type { FilTypeDefinition } from "../../../../fil-core/type-definition.ts";
import type { FilTypeUrn } from "../../../../fil-core/urn.ts";
import {
  MM_DEPOSIT_LIFECYCLE,
  MM_REPO_LIFECYCLE,
  MM_UNSECURED_LIFECYCLE,
} from "./mm-lifecycles.ts";

// ---------------------------------------------------------------------------
// Unsecured money-market — IBL placement (asset) OR funding-line drawdown
// (liability). ONE type, direction carried on the position.
// ---------------------------------------------------------------------------
export const MM_UNSECURED_TYPE_URN = "fil:type:ir:money-market:unsecured@1.0" as FilTypeUrn;

export const MM_UNSECURED_TYPE: FilTypeDefinition = {
  urn: MM_UNSECURED_TYPE_URN,
  assetClass: "ir",
  familyPath: "money-market",
  composition: ATOMIC_COMPOSITION,
  lifecycle: MM_UNSECURED_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Valuable", "Performable", "RegulatoryClassifiable"],
  minting: "kernel",
};

// ---------------------------------------------------------------------------
// Fixed-term deposit (bank as taker) — liability. Distinct type because the
// NSFR/LCR ASF treatment differs from interbank.
// ---------------------------------------------------------------------------
export const MM_DEPOSIT_TYPE_URN = "fil:type:ir:money-market.deposit:fixed-term@1.0" as FilTypeUrn;

export const MM_DEPOSIT_TYPE: FilTypeDefinition = {
  urn: MM_DEPOSIT_TYPE_URN,
  assetClass: "ir",
  familyPath: "money-market.deposit",
  composition: ATOMIC_COMPOSITION,
  lifecycle: MM_DEPOSIT_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Valuable", "Performable", "RegulatoryClassifiable"],
  minting: "kernel",
};

// ---------------------------------------------------------------------------
// Classic repo — secured borrowing/lending; direction asset/liability.
// ---------------------------------------------------------------------------
export const MM_REPO_TYPE_URN = "fil:type:ir:money-market.repo:classic@1.0" as FilTypeUrn;

export const MM_REPO_TYPE: FilTypeDefinition = {
  urn: MM_REPO_TYPE_URN,
  assetClass: "ir",
  familyPath: "money-market.repo",
  composition: ATOMIC_COMPOSITION,
  lifecycle: MM_REPO_LIFECYCLE,
  implementsFacets: ["Lifecycled", "Valuable", "Performable", "RegulatoryClassifiable"],
  minting: "kernel",
};

export const MM_TYPE_DEFINITIONS_PHASE3B = [
  MM_UNSECURED_TYPE,
  MM_DEPOSIT_TYPE,
  MM_REPO_TYPE,
] as const;
