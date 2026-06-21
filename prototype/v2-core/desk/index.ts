// v2-core/desk/index.ts
//
// Barrel export for the FRTB trading-desk register sub-package (born V2).
//
// Public surface:
//   events     — DeskKind / DeskBookType / DeskId, the typed desk-definition
//                shape (MAR12 compliance-by-construction), and the three event
//                payloads (DeskRegistered / DeskAttributeChanged / DeskRetired).
//   projection — Desk, DeskRegister, emptyDeskRegister, foldDeskRegister.
//   store-read — buildDeskRegister(controlPlaneStore).
//   roster     — CANONICAL_DESKS, DEFAULT_SIM_DESK_ID, SIM_TRADING_BOOK_DESK_IDS,
//                canonicalDeskBookType, isCanonicalDesk.
//
// Authority: D-FRTB-TRADING-DESK-STRUCTURE (CEO-approved 2026-06-21);
//   D-FX-BOOK-BOUNDARY; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Atlas (Core banking platform architect, engineering).

export * from "./events";
export * from "./projection";
export * from "./store-read";
export * from "./roster";
