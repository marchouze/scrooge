// platform/recon/gl-currency-dimension-integrity.ts
//
// recon:gl-currency-dimension-integrity — GL/finance-view currency-dimension gate.
//
// STATUS: ENFORCING (fail-closed). Wired into `bun run ci` (domain suite) + the
// recon inventory (package.json `recon:*` + scripts/run-recon-suite.ts domain).
//
// ## Why this gate exists (the near-miss it institutionalizes)
//
// The GL trial balance rendered a SHARED account (FX realised-P&L) with
// `currency: "multi"`, summing USD + ZAR minor units into one MEANINGLESS
// balance (USD cents + ZAR cents are not commensurable; Principle 5). The CEO
// caught it; the recon suite did not. The existing currency gates guard:
//   - the money TYPE (no-float-money-arithmetic, money-codec-no-float,
//     account-designated-currency — a leg's currency must match its account's
//     designation); and
//   - the FOLD (gl-v2-fold-equivalence-fx, gl-v2-parity — V1↔V2 byte parity).
// The bug lived in a derived VIEW (dashboard/v2-finance-gl-view.ts) that had
// dropped Money → raw `number` minor units behind a `"multi"` currency sentinel
// — a BLIND SPOT between the type gates and the fold gates. PR #1540 fixed the
// instance (one row per (account, currency)) + added a unit test. THIS gate
// hardens the CLASS so it can NEVER silently recur.
//
// ## What this gate asserts (fail-closed)
//
//   (1) DIMENSION PRESENCE. Drive the V2 GL/finance view builder
//       (buildGlView / GlView.rows) over a MULTI-CURRENCY fixture (a shared
//       account — realised-FX-P&L — posted in USD AND ZAR) and assert NO row's
//       currency is a sentinel ("multi"/"mixed"/"various"/"-"/empty/whitespace)
//       — every row carries a real ISO-4217 3-letter code (isKnownCurrency).
//
//   (2) NO NATIVE CROSS-CURRENCY SUMMATION. Assert the view's in-balance /
//       double-entry invariant is asserted in the FUNCTIONAL (reporting)
//       currency via explicit conversion (the zar*/functional fields), NEVER a
//       sum of native minor units across differing currencies. Operationalised:
//       a multi-currency fixture (≥2 distinct row currencies) MUST expose a
//       functional-currency in-balance check (zarTotalDebitMinor /
//       zarTotalCreditMinor populated and used for `inBalance`); and the native
//       presentation totals are NOT used for the invariant. Honest on a missing
//       rate: a currency with no production rate is surfaced unavailable
//       (zarRateAvailable=false / "rate n/a"), never a fake balanced zero.
//
//   (3) SOURCE-LEVEL SENTINEL BAN. A source scan of the GL/money/finance view
//       layer fails closed if a currency sentinel literal ("multi"/"mixed"/
//       "various") is reintroduced as a row/account currency *value*. The scan
//       is GL/finance-scoped (the surfaces a multi-currency book is rendered
//       through), not a global string search — legitimate unrelated uses are
//       allow-listed explicitly with a `[gl-currency-sentinel-ok]` comment.
//
// ## Scope honesty
//
// This gate is GL/FINANCE-VIEW-scoped. A general "no cross-currency native
// minor-unit sum ANYWHERE in the codebase" is not statically decidable (you
// cannot prove, by inspection, that two `number`s being added are minor units
// in different currencies). The gate therefore proves the property where the
// near-miss lived — the GL trial-balance / account-ledger / finance view
// builders — behaviourally (run the builder, inspect every row + the invariant)
// and bans the specific sentinel literals at the source level. The fold-level
// and type-level invariants remain the province of the existing gates.
//
// ## The gate BITES (negative tests)
//
// The companion test proves the checker is pointed the RIGHT way (the original
// #1540 unit test was pointed the WRONG way — it codified the bug as expected;
// this gate does NOT repeat that):
//   - a synthetic view with a "multi" row ⇒ assertViewCurrencyDimension FAILS;
//   - a synthetic view whose invariant is a cross-currency native minor sum ⇒
//     FAILS;
//   - the corrected per-(account, currency) buildGlView output ⇒ PASSES.
//
// Authority: CEO finding (2026-06-25); D-V2-UI-VISIBILITY-REMEDIATION (the GL
//   view's home); brief:vera:ws-finance-gl-trial-balance-mint-recon-gl-curren:2026-06-25.
// Citations: D-ENGINEERING-INTEGRITY-CHARTER (cmds 1 root-cause, 3 ratchets-
//   harden-only, 5 no-silent-deferral, 2 fail-closed); Principle 5 (multi-
//   currency at the type level — reporting currency is presentation, not data);
//   Principle 1 (events are truth — balances are queries).
// Author: Vera (Internal audit / continuous-assurance engineer, third-line).

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type GlView, buildGlView } from "../../dashboard/v2-finance-gl-view";
import { tenantIdSchema } from "../../v2-core/control-plane/tenant";
import { money } from "../core/decimal-money";
import { isKnownCurrency } from "../core/iso4217";
import { encodeMoney } from "../core/money-codec";
import type { Currency } from "../core/types";
import {
  type GlPostingEmittedPayload,
  makeGlPostingEmitted,
} from "../event-store/event-types/fx-accounting";
import { productionTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import { MarketDataStore } from "../market-data/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "gl-currency-dimension-integrity";

// ---------------------------------------------------------------------------
// Currency sentinels — the meaningless non-currency placeholders that a
// derived view must NEVER carry as a row's `currency`. "multi" is the exact
// value the #1540 near-miss rendered.
// ---------------------------------------------------------------------------

/** Sentinel literals that are NOT a real currency (the near-miss values). */
export const CURRENCY_SENTINELS: readonly string[] = ["multi", "mixed", "various"];

/** True iff `currency` is a sentinel / empty / whitespace — never a real code. */
function isSentinelCurrency(currency: string): boolean {
  const c = currency.trim();
  if (c === "" || c === "-") return true;
  return CURRENCY_SENTINELS.includes(c.toLowerCase());
}

// ---------------------------------------------------------------------------
// (1)+(2) Behavioural assertion over a GlView. PURE over the supplied view, so
// the negative tests can feed a deliberately-broken view and prove the gate
// FAILS (it BITES), and the real buildGlView output proves it PASSES.
// ---------------------------------------------------------------------------

/**
 * Assert the currency-dimension invariants over a built GL view.
 *   (1) every row carries a real ISO-4217 currency (no sentinel);
 *   (2) when the view spans ≥2 distinct currencies, the in-balance invariant is
 *       asserted on the FUNCTIONAL (ZAR-equivalent) totals — never a native
 *       cross-currency minor sum.
 * Returns the violation list (empty ⇒ the view honours the dimension).
 */
export function assertViewCurrencyDimension(view: GlView, label: string): ReconViolation[] {
  const violations: ReconViolation[] = [];

  // (1) Dimension presence — every row's currency is a real ISO-4217 code.
  for (const row of view.rows) {
    const cur = row.currency;
    if (isSentinelCurrency(cur)) {
      violations.push({
        subject: `${label}:sentinel-currency:${row.accountId}`,
        message: `GL/finance view row for account "${row.accountId}" carries a CURRENCY SENTINEL "${cur}" — not a real ISO-4217 currency. This is the #1540 near-miss class: a shared multi-currency account collapsed into one row with a "multi" currency, summing incommensurable native minor units. Emit ONE row per (account, currency) so every row carries its real native currency (Principle 5).`,
        severity: "fail",
      });
      continue;
    }
    if (!isKnownCurrency(cur as Currency)) {
      violations.push({
        subject: `${label}:non-iso-currency:${row.accountId}`,
        message: `GL/finance view row for account "${row.accountId}" carries currency "${cur}", which is not a known ISO-4217 code (platform/core/iso4217.ts). Every trial-balance row currency must be a real 3-letter ISO code (Principle 5).`,
        severity: "fail",
      });
    }
  }

  // (2) No native cross-currency summation — when the view spans ≥2 distinct
  // currencies, the in-balance invariant must be the FUNCTIONAL (ZAR-equivalent)
  // one. We assert the view exposes a populated functional in-balance basis and
  // that its `inBalance` flag agrees with the functional totals (not the native
  // presentation totals, which sum incommensurable minor units across
  // currencies and are presentation-only).
  const distinctCurrencies = new Set(
    view.rows.filter((r) => !r.offBalanceSheet).map((r) => r.currency),
  );
  if (distinctCurrencies.size >= 2) {
    // The headline invariant must be the functional one: `inBalance` must equal
    // (ZAR-equiv ΣDr == ZAR-equiv ΣCr). If `inBalance` were computed from the
    // native cross-currency totals it would be a meaningless coincidence.
    const functionalBalanced = view.zarTotalDebitMinor === view.zarTotalCreditMinor;
    if (view.inBalance !== functionalBalanced) {
      violations.push({
        subject: `${label}:non-functional-in-balance`,
        message: `The view spans ${distinctCurrencies.size} currencies but its in-balance flag (${view.inBalance}) does NOT agree with the FUNCTIONAL (ZAR-equivalent) totals (ΣDr ${view.zarTotalDebitMinor} ${view.zarTotalDebitMinor === view.zarTotalCreditMinor ? "==" : "!="} ΣCr ${view.zarTotalCreditMinor}). A multi-currency double-entry invariant MUST be asserted in the functional currency via explicit conversion — never on a native cross-currency minor-unit sum (USD cents + ZAR cents is meaningless; Principle 5).`,
        severity: "fail",
      });
    }
    // Honesty: a multi-currency view that claims to balance must have a
    // populated functional basis (non-zero ZAR-equiv totals) — a "balanced" view
    // whose functional totals are both zero while native rows carry value is the
    // fake-balanced-zero defect.
    const nativeHasValue = view.rows.some(
      (r) => !r.offBalanceSheet && (r.debitMinor !== 0 || r.creditMinor !== 0),
    );
    const functionalIsZero = view.zarTotalDebitMinor === 0 && view.zarTotalCreditMinor === 0;
    const allRatesAvailable = view.rows
      .filter((r) => !r.offBalanceSheet)
      .every((r) => r.zarRateAvailable);
    if (view.inBalance && nativeHasValue && functionalIsZero && allRatesAvailable) {
      violations.push({
        subject: `${label}:fake-balanced-zero`,
        message:
          "The view reports in-balance with native rows carrying value and all FX rates available, yet the FUNCTIONAL (ZAR-equivalent) totals are both zero — a fake balanced zero. The in-balance invariant must run on the populated functional totals (Engineering Charter cmd 2 fail-closed; honest-on-missing-rate).",
        severity: "fail",
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Multi-currency fixture — a SHARED account (realised-FX-P&L, ACC-2100-006)
// posted in BOTH USD and ZAR, each balanced by a same-currency counter-leg so
// every currency self-balances (⇒ the functional ZAR-equivalent totals balance).
// A USD/ZAR production mark is ingested so the USD leg has an honest ZAR
// equivalent. This is the SAME fixture shape the #1540 unit test uses; the gate
// re-derives it independently so the control owns its own evidence.
// ---------------------------------------------------------------------------

const FIXTURE_ACTOR: Actor = { type: "system", id: "vera:gl-currency-dimension-gate" };
const FIXTURE_ENTITY = "LE-ZA-HOZ-BANK";
const FIXTURE_CITES = ["Principle-5", "D-ENGINEERING-INTEGRITY-CHARTER"];
const FIXTURE_PROV = productionTag({ sourceLineage: "vera:gl-currency-dimension-gate" });
const FIXTURE_TENANT = tenantIdSchema.parse("tenant:za-bank");

function wire(amount: string, currency: string) {
  return encodeMoney(money(amount, currency as Currency));
}

function appendLeg(
  store: EventStore,
  leg: {
    accountCode: string;
    creditDebit: "debit" | "credit";
    amount: ReturnType<typeof wire>;
    postingDate: string;
  },
): void {
  const payload: GlPostingEmittedPayload = {
    creditDebit: leg.creditDebit,
    accountCode: leg.accountCode,
    amount: leg.amount,
    postingDate: leg.postingDate,
    tenantId: FIXTURE_TENANT,
    sourceEventId: "src:gl-currency-dimension-gate",
    iasRule: "IFRS 9 §3.1.1",
    // Non-FX rule id: the GlPostingEmitted read path serves NON-FX accounts (FX
    // is a pure fold over FIL events). A capital rule id exercises the generic
    // GlPostingEmitted projection mechanics for this fixture.
    postingRuleId: "PR-CAP-001-V2",
    description: "gl-currency-dimension-gate multi-currency shared-account fixture",
  };
  const ev = makeGlPostingEmitted({
    asOf: `${leg.postingDate}T00:00:00.000Z`,
    entity: FIXTURE_ENTITY,
    actor: FIXTURE_ACTOR,
    citations: FIXTURE_CITES,
    payload,
  });
  const tagged: Event = { ...ev, provenance: FIXTURE_PROV };
  store.append(tagged);
}

/**
 * Build the multi-currency fixture stores: realised-FX-P&L (ACC-2100-006) holds a
 * USD leg AND a ZAR leg, each balanced by a same-currency counter-leg. A USD/ZAR
 * production mark is ingested so the USD leg's ZAR equivalent is honest.
 */
export function multiCurrencyFixtureStores(): {
  eventStore: EventStore;
  marketDataStore: MarketDataStore;
} {
  const eventStore = new EventStore();
  const marketDataStore = new MarketDataStore(":memory:");

  marketDataStore.append({
    id: "tick:usdzar:gl-currency-dimension-gate",
    source: "gl-currency-dimension-gate",
    instrument: "USD/ZAR",
    dataType: "fx-quote",
    provenance: "production",
    asOf: "2026-06-10T00:00:00.000Z",
    payload: { mid: 18.5 },
  });

  // Shared account (realised FX P&L) — USD credit, balanced by a USD debit.
  appendLeg(eventStore, {
    accountCode: "ACC-2100-006",
    creditDebit: "credit",
    amount: wire("1000.00", "USD"),
    postingDate: "2026-06-10",
  });
  appendLeg(eventStore, {
    accountCode: "ACC-2100-027",
    creditDebit: "debit",
    amount: wire("1000.00", "USD"),
    postingDate: "2026-06-10",
  });
  // Same shared account — ZAR debit, balanced by a ZAR credit.
  appendLeg(eventStore, {
    accountCode: "ACC-2100-006",
    creditDebit: "debit",
    amount: wire("5000.00", "ZAR"),
    postingDate: "2026-06-10",
  });
  appendLeg(eventStore, {
    accountCode: "ACC-2100-027",
    creditDebit: "credit",
    amount: wire("5000.00", "ZAR"),
    postingDate: "2026-06-10",
  });

  return { eventStore, marketDataStore };
}

// ---------------------------------------------------------------------------
// (3) Source-level sentinel ban — GL/finance/money view layer scan.
//
// Scan a fixed set of GL/finance VIEW source files for a currency-sentinel
// literal assigned as a `currency` value. We look for the pattern
// `currency: "<sentinel>"` or `currency = "<sentinel>"` (the way a row/account
// currency would be set). Legitimate unrelated mentions (e.g. a doc comment
// explaining the sentinel ban, or this gate's own CURRENCY_SENTINELS list) are
// allow-listed by an inline `[gl-currency-sentinel-ok]` marker on the line.
// ---------------------------------------------------------------------------

/** GL/finance VIEW source files the sentinel ban scans (relative to prototype/). */
export const SCANNED_VIEW_FILES: readonly string[] = [
  "dashboard/v2-finance-gl-view.ts",
  "dashboard/gl-view.ts",
  "dashboard/v2-finance-view.ts",
  "platform/projections/gl-projection-v2.ts",
];

/** Inline marker that allow-lists a legitimate sentinel mention on a line. */
const ALLOWLIST_MARKER = "[gl-currency-sentinel-ok]";

function sentinelAssignmentRe(): RegExp {
  // `currency` (optionally `*Currency`) set to a sentinel string literal:
  //   currency: "multi"     |   currency = 'mixed'   |   nativeCurrency: "various"
  const alt = CURRENCY_SENTINELS.join("|");
  return new RegExp(`[Cc]urrency\\s*[:=]\\s*["'\`](?:${alt})["'\`]`);
}

function scanSourceSentinels(prototypeRoot: string): ReconViolation[] {
  const violations: ReconViolation[] = [];
  const re = sentinelAssignmentRe();
  for (const rel of SCANNED_VIEW_FILES) {
    const abs = resolve(prototypeRoot, rel);
    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      // A scanned file that no longer exists is not a violation (the view may be
      // retired); the behavioural assertion above carries the load-bearing proof.
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (re.test(line) && !line.includes(ALLOWLIST_MARKER)) {
        violations.push({
          subject: `${rel}:${i + 1}`,
          message: `${rel}:${i + 1} assigns a currency sentinel literal as a currency value: \`${line.trim()}\`. The GL/finance view layer must never set a row/account currency to "multi"/"mixed"/"various" — currency is a first-class ISO-4217 dimension (Principle 5; the #1540 near-miss). If this use is legitimately unrelated, append an inline ${ALLOWLIST_MARKER} comment to the line with a justification.`,
          severity: "fail",
        });
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Gate entry point.
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1)+(2) Behavioural assertion over the real builder on a multi-currency book.
  try {
    const { eventStore, marketDataStore } = multiCurrencyFixtureStores();
    const view = buildGlView({
      eventStore,
      marketDataStore,
      filter: { mode: "production-only" },
    });
    result.asserted += 1;
    // The fixture must actually exercise a multi-currency book — a green-by-
    // emptiness pass would be hollow (fail-closed: prove the gate ran).
    const currencies = new Set(view.rows.map((r) => r.currency));
    if (view.rows.length === 0 || currencies.size < 2) {
      violations.push({
        subject: `${PIPELINE}:fixture-not-multi-currency`,
        message: `The currency-dimension fixture did not produce a multi-currency GL view (rows=${view.rows.length}, distinct currencies=${currencies.size}). The gate cannot assert the no-sentinel / functional-in-balance invariants on an empty or single-currency book — this is a fixture/builder regression, not a clean pass. Authority: D-ENGINEERING-INTEGRITY-CHARTER cmd 2 (fail-closed).`,
        severity: "fail",
      });
    } else {
      violations.push(...assertViewCurrencyDimension(view, `${PIPELINE}:live`));
    }
  } catch (err) {
    result.asserted += 1;
    violations.push({
      subject: `${PIPELINE}:builder-threw`,
      message: `buildGlView threw while asserting the currency dimension: ${err instanceof Error ? err.message : String(err)}. Fail-closed: a view builder that cannot render a multi-currency book is a defect, not a pass.`,
      severity: "fail",
    });
  }

  // (3) Source-level sentinel ban over the GL/finance view layer.
  const here = dirname(fileURLToPath(import.meta.url));
  const prototypeRoot = resolve(here, "../..");
  result.asserted += SCANNED_VIEW_FILES.length;
  violations.push(...scanSourceSentinels(prototypeRoot));

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.asOf = `${PIPELINE}: ${failCount} fail violation(s) over ${result.asserted} assertion(s); scanned ${SCANNED_VIEW_FILES.length} GL/finance view file(s) in ${relative(process.cwd(), prototypeRoot) || "."} for currency sentinels.`;
  return result;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  if (!r.ok) {
    console.error(`\n❌ recon:${PIPELINE}: ${r.violations.length} violation(s)\n${r.asOf}`);
    process.exit(1);
  }
  console.log(`✅ recon:${PIPELINE}: no violations — ${r.asOf}`);
}
