// platform/recon/npa-return-data-obligation-integrity.ts
//
// Vera/Atlas recon: npa-return-data-obligation-integrity — the BINDING gate for
// the L3 return-cell data contract (D-BA-RETURN-DATA-CONTRACT, Phase B → C).
//
// Asserts, for every CURRENTLY-EFFECTIVE product (resolved via the shared
// supersession-aware resolver `resolveEffectiveApprovals` — NOT raw
// `ProductApproved`, which still includes withdrawn/retired/superseded
// products), that the product captures — or tracks as a deferred gap on its
// accounting dimension — every PRODUCT-SPECIFIC required product-attribute the
// L3 inverse index says it owes (`returnDataObligationsForProduct`).
//
//   - product captures the attribute in its declared scope         → ok
//   - not captured, but a tracked ProductDeferredGap names it       → ok (info,
//     "approved subject to tracked gap", D-NPA-GATE-POLICY-REDESIGN)
//   - not captured and not tracked                                  → FAIL
//
// HONEST SCOPE (Engineering Charter cmd 3 + 5 — no green by concealment, no
// silent deferral): only BA 100's contract is live, and a balance-sheet return
// is mostly GL-/projection-derived. The set of PRODUCT-SPECIFIC required
// product-attributes today is legitimately ZERO (every product owes one BARE
// trade-level designation `tradingBookDesignation` — product-agnostic, out of
// this gate's scope per the npa-return-data-gate boundary — plus an OPTIONAL
// `<productId>#balanceSheetClassification`). The gate therefore passes the one
// currently-effective product cleanly and SAYS SO in its output. The MECHANISM
// is the deliverable; it auto-tightens the instant Phase C marks any
// `<productId>#attr` requirement `required: true`. The gate logs, per product,
// how many product-specific required attributes it found so the "small today"
// scope is transparent, never hidden.
//
// Mode: blocking (non-zero exit on any FAIL). Wired into `bun run ci:recon:domain`
//       via `bun run recon:npa-return-data-obligation-integrity`.
//
// Authority:
//   - D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-delegation)
//   - D-NPA-GATE-POLICY-REDESIGN (CEO-approved 2026-06-15)
//   - D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION (CEO-approved 2026-06-18)
//
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { ba100Contract } from "../../v2-core/regulatory-returns/ba100-contract";
import type { ReturnContract } from "../../v2-core/regulatory-returns/cell-contract";
import { returnDataObligationsForProduct } from "../../v2-core/regulatory-returns/inverse-index";
import { PRODUCT_TYPED_EVENT_TYPES } from "../event-store/event-types/product";
import type { Event } from "../event-store/types";
import { checkReturnDataObligations } from "../markets/products/npa-return-data-gate";
import { buildProductRegisterView } from "../projections/products/product-register";
import { resolveEffectiveApprovals } from "./product-approval-attestation-integrity";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "npa-return-data-obligation-integrity";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  /** Path to the SQLite event store. Defaults to BANK_EVENT_DB env or repo fallback. */
  dbPath?: string;
  /**
   * Override event inputs for unit tests (bypasses the SQLite store entirely).
   * When provided, `dbPath` is ignored.
   */
  events?: Iterable<Event>;
  /** Override the loaded return contracts for unit tests (defaults to [BA100]). */
  contracts?: readonly ReturnContract[];
}

/**
 * Core assertion over pre-loaded events — pure, so unit tests pass synthetic
 * in-memory fixtures without touching the file system.
 *
 * The full event list is needed for the register fold (which folds the whole
 * product lifecycle, not just approvals); the supersession resolver picks out
 * the currently-effective approvals from the same list. `Event` is structurally
 * a superset of the resolver's `MinimalEvent`, so no remap/cast is needed.
 */
export function runOnEvents(events: Event[], contracts: readonly ReturnContract[]): ReconResult {
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Partition the lifecycle events the resolver needs. `Event` is a structural
  // superset of the resolver's `MinimalEvent`, so these slices pass straight in.
  const approvedEvents: Event[] = [];
  const supersessionEvents: Event[] = [];
  for (const ev of events) {
    if (ev.type === "ProductApproved") approvedEvents.push(ev);
    else if (ev.type === "ProductWithheld" || ev.type === "ProductRetired") {
      supersessionEvents.push(ev);
    }
  }

  if (approvedEvents.length === 0) {
    // No products approved → nothing to assert. Gate is correct: ok, 0 asserted.
    return result;
  }

  // CURRENTLY-EFFECTIVE products only — REUSE the shared resolver so this gate
  // never enforces on a dead approval (D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION).
  const { effective, superseded } = resolveEffectiveApprovals(approvedEvents, supersessionEvents);

  // Build the register over the FULL product lifecycle (scope + attestations +
  // deferred gaps). Passes real Events straight through — no remap, no cast.
  const productEventTypeSet = new Set<string>(PRODUCT_TYPED_EVENT_TYPES);
  const productEvents = events.filter((ev) => productEventTypeSet.has(ev.type));
  const register = buildProductRegisterView(productEvents);

  // Transparent skip rows for superseded products (no green by concealment).
  for (const [productId, sup] of [...superseded].sort((a, b) => a[0].localeCompare(b[0]))) {
    violations.push({
      subject: productId,
      message: `\`${productId}\` superseded by ${sup.type} at ${sup.as_of} — not effective; return-data obligations not enforced (authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION)`,
      severity: "info",
    });
  }

  for (const [productId] of [...effective].sort((a, b) => a[0].localeCompare(b[0]))) {
    result.asserted++;
    const row = register.get(productId);
    if (!row) {
      // An effective approval with no register row is itself an integrity bug.
      violations.push({
        subject: productId,
        message: `\`${productId}\` has a currently-effective ProductApproved but no register row — product-lifecycle integrity violation`,
        severity: "fail",
      });
      continue;
    }

    const obligations = returnDataObligationsForProduct(productId, contracts);
    const check = checkReturnDataObligations(row, obligations);

    if (!check.ready) {
      violations.push({
        subject: productId,
        message: `\`${productId}\` is return-incomplete — missing ${check.missing.length} required product-attribute(s) with no tracked deferred gap: ${check.missing
          .map((a) => `\`${a}\``)
          .join(
            ", ",
          )} (the cells they feed cannot populate; capture them or track a ProductDeferredGap on the accounting dimension) (authority: D-BA-RETURN-DATA-CONTRACT)`,
        severity: "fail",
      });
      continue;
    }

    if (check.openConditions.length > 0) {
      violations.push({
        subject: productId,
        message: `\`${productId}\` — return-data obligations met WITH condition(s): ${check.openConditions.join(
          ", ",
        )} (approved subject to tracked deferred gap; D-NPA-GATE-POLICY-REDESIGN)`,
        severity: "info",
      });
    } else {
      const checkedCount = check.checks.length;
      violations.push({
        subject: productId,
        message: `\`${productId}\` — return-data obligations met (${checkedCount} product-specific required attribute(s) checked, all captured)`,
        severity: "info",
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;
  return result;
}

export function run(opts: RunOpts = {}): ReconResult {
  const contracts: readonly ReturnContract[] = opts.contracts ?? [ba100Contract()];

  if (opts.events !== undefined) {
    return runOnEvents([...opts.events], contracts);
  }

  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");

  if (!existsSync(dbPath)) {
    // No event store — nothing to assert. Return ok.
    return emptyResult(PIPELINE);
  }

  const store = new EventStore(dbPath);
  const events: Event[] = [...store.replay()];
  return runOnEvents(events, contracts);
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  const warns = result.violations.filter((v) => v.severity === "warn");
  const infos = result.violations.filter((v) => v.severity === "info");

  for (const v of infos) {
    console.log(`  info  [${v.subject}] ${v.message}`);
  }
  for (const v of warns) {
    console.warn(`  warn  [${v.subject}] ${v.message}`);
  }
  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  console.log(
    `\nrecon:${PIPELINE} — ${result.asserted} effective product(s) asserted, ` +
      `${fails.length} fail, ${warns.length} warn, ${infos.length} info`,
  );
  console.log(
    "  note: enforces PRODUCT-SPECIFIC required product-attributes only; bare trade-level\n" +
      "        designations (e.g. tradingBookDesignation) and GL/projection sources are out of\n" +
      "        scope by design. Today that set is small (BA 100 only); it auto-tightens as Phase C\n" +
      "        marks `<productId>#attr` return requirements required:true.",
  );

  if (!result.ok) {
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} failure(s)`);
    process.exit(1);
  } else {
    console.log(`recon:${PIPELINE} OK`);
  }
}
