// platform/recon/npa-coverage.ts
//
// Vera recon: npa-coverage (ADVISORY).
//
// The attestation evidence base for the umbrella OTC vanilla FX product
// (D-FX-OTC-NPA-SCOPE-EXPANSION). A broadened NPA must not be attested by
// assertion: each NPA dimension is gated against the Principle-2 single-graph
// chain Obligation/Objective → Policy → Procedure → Capability → Outcome → UI.
// This scanner walks that chain for the FX scope using the existing graph query
// surface and reports, per axis, the gaps that the Part-D roadmap closes:
//
//   a) reg-horizon  — FX/Excon/Domain-M obligations with no CLOSES policy edge
//                     (findUnimplementedObligations), + objective coverage gaps.
//   b) policy       — dimensions whose policy hint set is empty / unmapped.
//   c) procedure    — orphan procedures (no incoming GOVERNS).
//   d) capability   — orphan capabilities (no incoming REALISES).
//   e) ui-surfacing — domains whose FX metric is not yet live (curated).
//
// A dimension is implementation-ready only when none of these axes flag it; the
// FX umbrella NPA therefore attests at DESIGN level at v1.0 (this gate is the
// evidence that justifies that). Mode: ADVISORY (ok:true regardless) — it never
// blocks CI; it surfaces the worklist.
//
// Self-contained: seeds a FRESH graph into an isolated tmp DB (truncate-and-
// rebuild projection, Principle 1) so it is deterministic on a clean CI runner.
//
// Authority: D-FX-OTC-NPA-SCOPE-EXPANSION (CEO session-delegation 2026-06-10);
//            D-NEW-PRODUCT-APPROVAL-POLICY §5 (14 dimensions);
//            D-PRINCIPLE-2-CAPABILITY-LAYER (Procedure→Capability hop).
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "npa-coverage";

if (!process.env.BANK_GRAPH_DB) {
  process.env.BANK_GRAPH_DB = join(mkdtempSync(join(tmpdir(), "recon-npa-cov-")), "graph.db");
}

// The 14 NPA dimensions and their policy-hint anchors. Source of truth:
// DIMENSION_METADATA in dashboard/products-detail.ts (mirrored here to keep the
// recon module self-contained per the house pattern). Empty hint set = the
// dimension is not yet graph-traceable to a policy — a Part-D mapping gap.
const DIMENSION_POLICY_HINTS: Record<string, readonly string[]> = {
  "market-risk": ["market-risk-policy-v1.md"],
  "credit-risk": ["credit-risk-policy-v1.md", "counterparty-onboarding-policy-v1.md"],
  "liquidity-funding": ["liquidity-risk-management-policy-v1.md", "irrbb-policy-v1.md"],
  "operational-risk": ["operational-risk-policy-v1.md", "operational-resilience-policy-v1.md"],
  "operational-readiness": [],
  accounting: ["accounting-policies-ifrs-v1.md"],
  capital: ["capital-management-policy-v1.md"],
  "conduct-suitability": ["conduct-of-business-tcf-policy-v1.md", "fais-compliance-policy-v1.md"],
  "aml-sanctions-pep": ["aml-cft-policy-v1.md"],
  "model-risk": ["model-risk-policy-v1.md"],
  "legal-documentation": ["document-execution-policy-v1.md"],
  "information-security": ["information-security-it-governance-policy-v1.md"],
  privacy: ["popia-privacy-policy-v1.md"],
  tax: [],
};

// UI surfacing per domain (curated from the dashboard inventory). `false` =
// not-yet-live (a Part-D (e) item). The FX NPA badge strip is re-pointed onto
// the umbrella product (markets-fx-npa.ts); BA-RETURN/NOP returns surfacing is
// demo-only (returns-submission layer dark).
const UI_DOMAIN_LIVE: Record<string, boolean> = {
  "trading-positions": true,
  "market-risk-var": true,
  pnl: true,
  "accounting-gl": true,
  "capital-rwa": true,
  "liquidity-lcr-nsfr": true,
  "counterparty-exposure": true,
  "products-npa": true,
  "regulatory-returns-ba-nop": false, // demo-only — returns-submission layer dark
};

/** Heuristic: is this obligation FX / OTC-derivative / Excon in scope? */
function isFxScoped(meta: Record<string, unknown>, id: string, label: string): boolean {
  const productScope = String(meta.productScope ?? "");
  const activityScope = String(meta.activityScope ?? "");
  if (productScope.includes("fx-instruments")) return true;
  if (activityScope.includes("ACT-TRADE-FX")) return true;
  const hay = `${id} ${label}`.toLowerCase();
  return /\bfx\b|foreign[- ]exchange|excon|exchange[- ]control|otc[- ]deriv|cs-?1|cs-?2|js-?2/.test(
    hay,
  );
}

export async function run(): Promise<ReconResult> {
  const { runSeed } = await import("../regulatory/graph/seed-projection");
  const {
    findObligationsByApplicability,
    findUnimplementedObligations,
    findObjectiveCoverageGaps,
    findOrphanProcedures,
    findOrphanCapabilities,
  } = await import("../regulatory/graph/query");
  await runSeed();

  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // ---- a) regulatory horizon -------------------------------------------------
  const directObls = [
    ...findObligationsByApplicability("direct"),
    ...findObligationsByApplicability("transposed"),
  ];
  const fxObls = directObls.filter((n) => isFxScoped(n.metadata ?? {}, n.id, n.label ?? ""));
  const unimplemented = findUnimplementedObligations(undefined, ["direct", "transposed"]);
  const unimplementedFx = unimplemented.filter((n) =>
    isFxScoped(n.metadata ?? {}, n.id, n.label ?? ""),
  );
  for (const obl of unimplementedFx) {
    violations.push({
      subject: obl.id,
      message: `(a) reg-horizon: FX-scoped obligation "${obl.label ?? obl.id}" has no CLOSES policy edge — unaddressed by the policy estate`,
      severity: "warn",
    });
  }

  // objective coverage gaps (purpose axis)
  const objGaps = findObjectiveCoverageGaps();
  for (const o of objGaps) {
    violations.push({
      subject: o.id,
      message: `(a) reg-horizon: objective "${o.label ?? o.id}" has no ALIGNS_TO policy — purpose-coverage gap`,
      severity: "info",
    });
  }

  // ---- b) policy completeness per dimension ---------------------------------
  for (const [dim, hints] of Object.entries(DIMENSION_POLICY_HINTS)) {
    if (hints.length === 0) {
      violations.push({
        subject: `dimension:${dim}`,
        message: `(b) policy: dimension "${dim}" has no policy hint — not yet graph-traceable to a policy`,
        severity: "warn",
      });
    }
  }

  // ---- c) procedure coverage ------------------------------------------------
  const orphanProcs = findOrphanProcedures();
  for (const p of orphanProcs) {
    violations.push({
      subject: p.id,
      message: `(c) procedure: "${p.label ?? p.id}" is orphan (no incoming GOVERNS edge)`,
      severity: "info",
    });
  }

  // ---- d) capability substrate ----------------------------------------------
  const orphanCaps = findOrphanCapabilities();
  for (const c of orphanCaps) {
    violations.push({
      subject: c.id,
      message: `(d) capability: "${c.label ?? c.id}" is orphan (no incoming REALISES edge)`,
      severity: "info",
    });
  }

  // ---- e) UI surfacing ------------------------------------------------------
  for (const [domain, live] of Object.entries(UI_DOMAIN_LIVE)) {
    if (!live) {
      violations.push({
        subject: `ui:${domain}`,
        message: `(e) ui-surfacing: domain "${domain}" has no live FX metric surfaced (demo-only / dark)`,
        severity: "warn",
      });
    }
  }

  result.asserted =
    fxObls.length + Object.keys(DIMENSION_POLICY_HINTS).length + Object.keys(UI_DOMAIN_LIVE).length;
  result.violations = violations;
  result.ok = true; // advisory
  result.asOf = `fx-obls=${fxObls.length} unimplemented-fx=${unimplementedFx.length} objective-gaps=${objGaps.length} orphan-proc=${orphanProcs.length} orphan-cap=${orphanCaps.length}`;
  return result;
}

if (import.meta.main) {
  const result = await run();
  for (const v of result.violations) {
    console.log(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  console.log(
    `\nrecon:${PIPELINE} OK (advisory) — ${result.asOf}; ${result.violations.length} coverage gap(s) across axes a–e`,
  );
}
