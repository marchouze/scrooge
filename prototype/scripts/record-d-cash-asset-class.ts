// scripts/record-d-cash-asset-class.ts
//
// Records D-CASH-ASSET-CLASS-V1 — Marc's in-session approval (2026-06-17)
// that CASH is a first-class FIL asset class, SEPARATE from `fx`, and that
// the coupling "an FX trade maturing materialises a (valued) cash asset" is
// declared at the PRODUCT / NPA level — NOT hardwired as a kernel `fx`→`cash`
// dependency between asset classes.
//
// Scope approved:
//   (1) `"cash"` joins the closed FIL asset-class set (taxonomy.ts) alongside
//       ir/fx/equity/credit/commodity/funding/hybrid. A Cash FIL type
//       (`fil:type:cash:balance:vanilla@1.0`) is minted — atomic, with a minimal
//       lifecycle (`held → {drawn-down | swept | closed}`). The slug is
//       currency-agnostic (no `fcy`/currency marker — currency is an
//       instance-level term, parallel to `fx:swap:vanilla`). It implements
//       Valuable (and the standing-NOP RiskMeasurable contribution), reusing
//       the existing cash Valuable arithmetic.
//   (2) The orphan cash Valuable model — whose scope pointed at the never-minted
//       `fil:type:fx:cash:*` — is re-pointed onto the new `fil:type:cash:*`
//       scope, and its `modelId` is renamed `fcy-cash` → `cash` (currency-
//       agnostic; replay-safe — no filed model-declaration event pins the old
//       id).
//   (3) On FX spot `SettlementConfirmed`, the settlement path materialises the
//       settled cash leg(s) as a real Cash FIL instance (`FilInstrumentCreated`)
//       in addition to terminating the spot — driven by a product-level rule on
//       the FX OTC NPA (`prd:bank:fx:otc-vanilla`), read by the settlement code.
//       The kernel stays asset-class-agnostic; `fx`→`cash` is a PRODUCT fact.
//   (4) The settlement-continuity proof re-bases on the REAL Cash FIL instance
//       (instrument-of-record) instead of the phantom projection-time
//       `FcyCashPosition`. A new recon gate fails closed on any `cash` instance
//       without an originating-instrument back-ref, and on any settled FX trade
//       whose NPA declares cash materialisation but lacks a matching Cash
//       instance.
//
// Idempotent on (decisionId, phase, as_of) with a FIXED `asOf` so the
// ci:migrate replay is byte-stable. Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing
// principal. Engineering build decision in the build phase → CEO authority,
// `engineering` category (decision-authority-routing table).
//
// Authority: CLAUDE.md §"Session delegation"; D-FIL-FRAMEWORK-UNIFICATION;
//   prd:bank:fx:otc-vanilla; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-ENGINEERING-INTEGRITY-CHARTER.
// brief: brief:atlas:cash-as-a-first-class-fil-asset-class-fx-maturit:2026-06-17
// Author: Atlas (Core banking platform architect, engineering).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision } from "../runtime/decisions/record";

const APPROVED = "2026-06-17T12:00:00.000Z";

const r = recordDecision(
  {
    decisionId: "D-CASH-ASSET-CLASS-V1",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Cash as a first-class FIL asset class; FX maturity materialises a Cash asset (NPA-linked)",
    category: "engineering",
    recommendation:
      "Add `cash` to the closed FIL asset-class set and mint a Cash FIL type (fil:type:cash:balance:vanilla@1.0 — currency-agnostic slug, currency is an instance-level term) — atomic, lifecycle held → {drawn-down | swept | closed}, implementing Valuable and the standing-NOP RiskMeasurable. Re-point the orphan cash Valuable model (scope was the never-minted fil:type:fx:cash:*) onto the new fil:type:cash:* scope, and rename its modelId `fcy-cash` → `cash` (currency-agnostic; replay-safe). On FX spot SettlementConfirmed, materialise the settled cash leg(s) as real Cash FIL instances (FilInstrumentCreated) in addition to terminating the spot — the trigger declared by a product-level rule on the FX OTC NPA (prd:bank:fx:otc-vanilla) and read by the settlement path, so the kernel stays asset-class-agnostic and fx→cash is a product fact, not a kernel dependency. Re-base recon:fx-settlement-continuity on the real Cash FIL instance (instrument-of-record) and add a fail-closed recon gate: every cash instance carries an originating-instrument back-ref, and every settled FX trade whose NPA declares cash materialisation has matching Cash instance(s). Cash terms use decimal-native MAJOR-unit Money (never minorUnits).",
    rationale:
      "Today a settled FX spot only transitions active→settled (FilInstrumentTerminated) — no successor instrument is created. The resulting cash holding exists only as a transient projection-time FcyCashPosition plus GL/nostro postings: no FIL URN, no lifecycle, no citable single-graph node. That under-serves Principle 1 (a real cash holding not event-sourced as an instrument of record) and Principle 2 (nothing to trace to). The existing FCY_CASH_MODEL already declares a Valuable scoped at fil:type:fx:cash:* — a model waiting for a type that was never minted. Marc directed that cash be its own first-class asset class, decoupled from fx, with the maturity→cash coupling expressed at the product/NPA level rather than hardwired between asset classes, so other products (deposits, settlement of any asset class) can materialise cash the same way without a kernel change.",
    sourceDocHashes: [],
    citations: [
      "D-FIL-FRAMEWORK-UNIFICATION",
      "prd:bank:fx:otc-vanilla",
      "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
      "D-V2-CORE-MONEY-DECIMAL-NATIVE",
      "D-ENGINEERING-INTEGRITY-CHARTER",
      "Principles/1-events-are-truth.md",
      "Principles/2-single-graph-discipline.md",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  APPROVED,
);

console.log(
  JSON.stringify({ ok: true, eventId: r.eventId, decisionId: "D-CASH-ASSET-CLASS-V1" }, null, 2),
);
