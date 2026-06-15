// scripts/decisions/record-d-v2-core-money-decimal-native.ts
//
// Records D-V2-CORE-MONEY-DECIMAL-NATIVE — Marc's in-session approval
// (2026-06-15) to migrate the v2-core FIL kernel `Money` primitive from
// minor-unit encoding (`minorUnits: bigint`) to decimal-native
// (canonical decimal string), kernel-wide.
//
// CONTEXT:
//   - The bank-wide decimal-native money migration (D-DECIMAL-NATIVE-MONEY-
//     ARITHMETIC, WS-DECIMAL-NATIVE-MONEY-ARITHMETIC, complete 2026-06-14)
//     converted the v1/platform side to `MoneyWire { amount: string }` and
//     stood up the `recon:no-float-money-arithmetic` / `recon:no-residual-
//     minor-encoding` gates. It did NOT reach the v2-core FIL kernel.
//   - v2-core has a hard no-v1-import boundary (`recon:v2-no-v1-import`), so it
//     cannot import `platform/core/decimal-engine` or `money-codec`. It defines
//     its own `Money { currency; minorUnits: bigint }` in fil-core/primitives.ts.
//   - The FIL FX Language Phase 1 build (PR #1370) was authored on that minor-
//     unit kernel and tripped the no-float gate (carry day-division). Marc's
//     directive: "do not further embed minor money — do what it takes to avoid
//     using minor money." On the scope fork (full kernel migration vs FX-only
//     + shim) Marc chose FULL KERNEL MIGRATION.
//
// DECISION:
//   Migrate v2-core `Money` to a decimal-native representation backed by a v2-
//   native decimal helper that wraps `decimal.js` (already pinned at 10.6.0)
//   DIRECTLY (an npm dependency, permitted inside the no-v1-import boundary —
//   the boundary forbids `platform/` imports only). Update ALL v2-core money
//   sites (~22 files) — FX Phase 1 + the already-merged SA-CCR and VaR models —
//   to the decimal-native Money. No minor-unit encoding remains in v2-core.
//
// Category: engineering build decision (substrate / platform / schema) —
//   CEO authority during the build phase per the decision-authority routing
//   table.
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Marc (CEO).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-15T12:10:00.000Z";
const ASOF = "2026-06-15T12:11:00.000Z";

const TITLE =
  "Migrate v2-core FIL kernel Money to decimal-native (eliminate minor-unit encoding kernel-wide)";

const CITATIONS = [
  "D-DECIMAL-NATIVE-MONEY-ARITHMETIC",
  "D-ENGINEERING-INTEGRITY-CHARTER",
  "Engineering-Charter.md",
  "v2-core/fil-core/primitives.ts",
  "platform/core/decimal-engine.ts",
];

const RECOMMENDATION =
  "Migrate the v2-core FIL kernel `Money` primitive (fil-core/primitives.ts) " +
  "from minor-unit encoding (`minorUnits: bigint`) to decimal-native (canonical " +
  "decimal string amount), introducing a v2-native decimal helper that wraps " +
  "decimal.js (10.6.0) directly inside the no-v1-import boundary. Update all ~22 " +
  "v2-core money sites — the FIL FX Language Phase 1 build (PR #1370) plus the " +
  "already-merged SA-CCR and VaR models, fx-valuation, fcy-cash, attribution " +
  "metrics, fil-instances and the SA-CCR exam set — so no minor-unit money " +
  "encoding (`*Minor`, `minorMoney`, `scaleMinorByRate`) remains anywhere in " +
  "v2-core. Retire the minor-unit helpers in favour of decimal arithmetic.";

const RATIONALE =
  "Minor-unit money was the legacy encoding the bank-wide decimal-native " +
  "migration eliminated on the v1/platform side; the v2-core FIL kernel was " +
  "never reached and remained minor-unit. Building the FX FIL language on that " +
  "kernel re-embedded exactly what was removed, surfacing via the no-float gate. " +
  "Because `Money` is a shared kernel type returned by `Valuable.value()`, the " +
  "FX language cannot be decimal-native while the kernel stays minor-unit — the " +
  "correct root-cause fix (Engineering Charter command 1) is to migrate the " +
  "kernel, not to patch around the gate or shim. Marc selected full kernel " +
  "migration over an FX-only-plus-shim approach. Approved by Marc in-session " +
  "2026-06-15.";

requestDecision(
  {
    decisionId: "D-V2-CORE-MONEY-DECIMAL-NATIVE",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale:
      "v2-core money-kernel decimal migration submitted for CEO approval; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-V2-CORE-MONEY-DECIMAL-NATIVE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, result }, null, 2));
