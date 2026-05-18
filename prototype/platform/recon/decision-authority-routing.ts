// platform/recon/decision-authority-routing.ts
//
// Validates that each Decision event's authority field is consistent with the
// canonical decision-authority routing table (CLAUDE.md §"Decision authority routing").
//
// Slice A: warn-only. A future Slice B may flip category misroutes to errors
// once all governance seats are fully activated.
//
// Authority: brief:atlas:gateway-scenario-d-cfo-coo-cco-authority-operati:2026-05-18
// Canonical routing table: CLAUDE.md §"Decision authority routing"
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";
import type { DecisionAuthority } from "../event-store/event-types/decision";
import { EventStore } from "../event-store/store";
import { applyBaselineToResult, loadBaseline } from "./decisions-baseline";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const PIPELINE = "decision-authority-routing";

// ---------------------------------------------------------------------------
// Routing table — maps canonical DECISION_CATEGORIES to expected authority.
// Derived from CLAUDE.md §"Decision authority routing".
// ---------------------------------------------------------------------------

// Categories where CEO is the valid/normal authority (build-phase norm or strategic)
const CEO_VALID_CATEGORIES = new Set(["engineering", "strategic", "build", "product", "other"]);

// Canonical category → expected authority (governance seat) mapping.
// Only categories that have a named governance seat are listed.
// "other", "product", "engineering", "people" are CEO/Agent territory during build phase.
const CATEGORY_TO_AUTHORITY: Partial<Record<string, DecisionAuthority>> = {
  finance: "CFO",
  governance: "CoSec",
  risk: "CRO",
  compliance: "CCO",
};

// Governance seat authorities — used to detect mis-routed seat attributions.
const GOVERNANCE_SEAT_AUTHORITIES = new Set<DecisionAuthority>([
  "CFO",
  "COO",
  "CISO",
  "CAE",
  "CRO",
  "CCO",
  "CoSec",
  "IO",
]);

// Collective / multi-seat bodies — skip routing validation for these.
const COLLECTIVE_AUTHORITIES = new Set<DecisionAuthority>(["Board", "AC", "BRC", "ALCO"]);

export interface RunOpts {
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");
  const result: ReconResult = emptyResult(PIPELINE);
  if (!existsSync(dbPath)) return result;

  const store = new EventStore(dbPath);
  const register = buildDecisionsRegister(decisionsSourceFromStore(store));

  const violations: ReconViolation[] = [];

  for (const history of register.byId.values()) {
    const head = history.head;
    const { authority, category, decisionId } = head;
    result.asserted++;

    // Skip collective bodies — they have their own routing logic.
    if (COLLECTIVE_AUTHORITIES.has(authority)) continue;

    // Skip Agent authority — autonomous decisions are not seat-routed.
    if (authority === "Agent") continue;

    const expectedAuthority = CATEGORY_TO_AUTHORITY[category];

    if (expectedAuthority !== undefined) {
      // Category has a canonical governance seat.
      if (GOVERNANCE_SEAT_AUTHORITIES.has(authority) && authority !== expectedAuthority) {
        // A governance seat is attributed, but it's the wrong one.
        violations.push({
          subject: decisionId,
          message:
            `decision \`${decisionId}\` has category \`${category}\` (natural authority: \`${expectedAuthority}\`) ` +
            `but is attributed to \`${authority}\`. Expected \`${expectedAuthority}\` for this category. ` +
            `Check whether the decision was routed to the correct seat.`,
          severity: "warn",
        });
      } else if (authority === "CEO" && !CEO_VALID_CATEGORIES.has(category)) {
        // CEO is attributed for a category that has a delegable governance seat.
        // Valid during build phase when that seat may not yet be active.
        violations.push({
          subject: decisionId,
          message:
            `decision \`${decisionId}\` has category \`${category}\` (natural authority: \`${expectedAuthority}\`) ` +
            `but is attributed to CEO. Consider delegating to \`${expectedAuthority}\` once that seat is active. ` +
            `This is expected during the build phase when governance seats are not yet fully operational.`,
          severity: "warn",
        });
      }
    }
  }

  const baseline = loadBaseline(repoRoot, PIPELINE);
  applyBaselineToResult(result, violations, baseline);
  return result;
}

if (import.meta.main) {
  const result = run();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
