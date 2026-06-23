// platform/markets/products/fx-npa-consolidated-doc.ts
//
// Pure renderer for the consolidated FX OTC Vanilla NPA document. The markdown
// it produces is a RENDER of the event-store state (Principle 1) — the
// canonical artefact is the `RecordFiled` event the driver emits; this string
// is the heavy-bytes body it cites by hash. No side effects, no store access:
// the caller passes the already-folded register row + gate result.
//
// Content:
//   - lifecycle state (derived from npaStatus — internal-test approved /
//     withheld / pending),
//   - one short paragraph per NPA dimension (current result + tracked gaps),
//   - the accounting/prudential/tax → treatment-module map (id@version),
//   - the consolidated deferred-gap register (owner + target trigger + citations).
//
// Authority: D-FX-NPA-RESTART (CEO-approved 2026-06-17); D-NEW-PRODUCT-APPROVAL-
//            POLICY-V2; D-NPA-GATE-POLICY-REDESIGN; D-FX-OTC-NPA-SCOPE-EXPANSION;
//            D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Saskia (Head of Global Markets, governance), NPA cycle owner.

import { formatVersion } from "../../../v2-core/fil-core/urn";
import { FX_TREATMENT_MODULES } from "../../../v2-core/reporting-treatments/fx-modules";
import type { ProductRegisterRow } from "../../projections/products/product-register";
import type { NpaGateResult } from "./npa-gate";

/**
 * Dimension → treatment-module id, for the three module-backed dimensions.
 * The version is sourced from the module declarations at render time (never
 * hardcoded), so the doc and the attestation citations always agree.
 */
const DIMENSION_TREATMENT_MODULE: Readonly<Record<string, string>> = {
  accounting: "ifrs-classification:fx-fvtpl",
  capital: "prudential-treatment:fx-trading-book",
  tax: "tax-treatment:fx",
};

/** Governance-owner attribution per dimension (identity discipline). */
const DIMENSION_OWNER: Readonly<Record<string, string>> = {
  "market-risk":
    "Rohan (Market risk quantitative engineer, engineering) / Helena (Chief Risk Officer, governance)",
  "credit-risk": "Helena (Chief Risk Officer, governance)",
  "liquidity-risk": "Eitan (Treasurer, governance)",
  "operational-risk":
    "Tomas (Operations & payments engineer, engineering) / Devon (Chief Operating Officer, governance)",
  "operational-readiness":
    "Tomas (Operations & payments engineer, engineering) / Devon (Chief Operating Officer, governance)",
  accounting: "Bea (Financial Accountant, finance) / Camille (Chief Financial Officer, governance)",
  capital:
    "Camille (Chief Financial Officer, governance) / Helena (Chief Risk Officer, governance)",
  conduct: "Zara (Chief Compliance Officer, governance)",
  aml: "Zara (Chief Compliance Officer, governance)",
  "model-risk": "Nadia (Independent-validation engineer, second line)",
  legal: "Imani (Legal-as-code engineer, engineering)",
  infosec: "Rashida (Chief Information Security Officer, governance)",
  privacy: "Iris (Information Officer, governance)",
  tax: "Yael (Tax engineer, engineering)",
  "data-quality": "Anya (Data & analytics engineer, engineering)",
};

/** Resolve `treatmentId@version` from the canonical module declarations. */
function moduleVersionLabel(treatmentId: string): string {
  const decl = FX_TREATMENT_MODULES.find((m) => m.treatmentId === treatmentId);
  if (!decl) {
    throw new Error(`FX treatment module "${treatmentId}" not found — cannot render the NPA doc.`);
  }
  return `${decl.treatmentId}@${formatVersion(decl.version)}`;
}

function ownerFor(dimension: string): string {
  return DIMENSION_OWNER[dimension] ?? "(owner unattributed)";
}

export interface RenderFxNpaConsolidatedDocInput {
  readonly row: ProductRegisterRow;
  readonly gate: NpaGateResult;
  /**
   * Approval status derived from the dashboard NPA view (latest
   * ProductApproved / ProductWithheld). Drives the lifecycle prose so the doc
   * states "withheld" independent of the raw register stage string
   * (a ProductWithheld maps the register stage to `under-review`).
   */
  readonly npaStatus: "approved" | "withheld" | "pending";
  /** ISO-8601 logical instant the doc is filed as. */
  readonly asOf: string;
}

/**
 * Render the consolidated FX NPA markdown. Deterministic: same store state +
 * asOf → byte-identical output (so re-runs hit the content-addressed store
 * idempotently).
 */
export function renderFxNpaConsolidatedDoc(input: RenderFxNpaConsolidatedDocInput): string {
  const { row, gate, npaStatus, asOf } = input;
  const lines: string[] = [];

  // Derive the attestation-mix counts from the register row (never hardcode):
  // honest authoring may shift the implementation- vs design-attested split as
  // dimensions are re-checked against Amendment A liveness evidence.
  let implAttestedCount = 0;
  let designAttestedCount = 0;
  for (const [, record] of row.attestedDimensions) {
    if (record.result === "implementation-attested") implAttestedCount += 1;
    else if (record.result === "design-attested") designAttestedCount += 1;
  }

  const scopeNote =
    npaStatus === "approved"
      ? "INTERNAL-TEST scope (pre-licence rehearsal) — NOT a production approval"
      : npaStatus === "withheld"
        ? "withheld"
        : "pending";

  lines.push("# FX OTC Vanilla — Consolidated NPA (clean cycle)");
  lines.push("");
  lines.push(`- **Product:** \`${row.productId}\` (${row.family}), version ${row.version}`);
  lines.push(`- **Lifecycle state:** **${scopeNote}** (register stage: ${row.lifecycleStage})`);
  lines.push(`- **As of:** ${asOf}`);
  lines.push(
    "- **Authority:** D-FX-NPA-RESTART (CEO-approved 2026-06-17); D-NEW-PRODUCT-APPROVAL-POLICY-V2; " +
      "D-NPA-GATE-POLICY-REDESIGN; D-FX-OTC-NPA-SCOPE-EXPANSION; D-NEW-PRODUCT-APPROVAL-POLICY §5.",
  );
  lines.push("- **Author:** Saskia (Head of Global Markets, governance), NPA cycle owner.");
  lines.push("");
  lines.push(
    `> This document is the render of ONE clean, coherent FX OTC vanilla NPA cycle authored from scratch under D-FX-NPA-RESTART (Principle 1: append-only, latest-wins; the prior accreted attestations are superseded, not deleted). The accounting, capital/prudential and tax dimensions cite their versioned reporting-treatment module as the canonical source. It is a render of the event log; the \`RecordFiled\` event is the canonical artefact. ${
      npaStatus === "approved"
        ? `**The gate rule was RUN over the honest attestations and yielded an INTERNAL-TEST-scope \`ProductApproved\` (${implAttestedCount} implementation-attested + ${designAttestedCount} design-attested-with-tracked-gap dimensions); no PRODUCTION \`ProductApproved\` is emitted — production is gated on closing every tracked gap and on the real-counterparty / external-counsel triggers.**`
        : `**The gate rule was RUN over the honest attestations and did NOT yield an internal-test approval; the product is \`${npaStatus}\`.**`
    }`,
  );
  lines.push("");

  // -------------------------------------------------------------------------
  // Lifecycle + gate
  // -------------------------------------------------------------------------
  lines.push("## 1. Lifecycle & gate");
  lines.push("");
  lines.push(
    `The umbrella FX product is **${scopeNote}** (register stage ${row.lifecycleStage}). The NPA gate (D-NPA-GATE-POLICY-REDESIGN) over the clean cycle's attestations reports \`ready=${gate.ready}\`${gate.missing.length > 0 ? `, blocking dimensions: ${gate.missing.join(", ")}` : ""}${
      gate.openConditions.length > 0
        ? `, open conditions (design-attested-with-tracked-gap): ${gate.openConditions.join("; ")}`
        : ""
    }.${
      npaStatus === "approved"
        ? " The gate result is taken honestly: implementation-attested dimensions pass unconditionally and design-attested-with-tracked-gap dimensions pass with a recorded open condition — yielding an INTERNAL-TEST `ProductApproved`. No PRODUCTION approval is emitted."
        : ""
    }`,
  );
  lines.push("");

  // -------------------------------------------------------------------------
  // Treatment-module map
  // -------------------------------------------------------------------------
  lines.push("## 2. Treatment-module map (accounting / prudential / tax)");
  lines.push("");
  lines.push("| Dimension | Treatment module (id@version) | Owner |");
  lines.push("|---|---|---|");
  for (const dimension of ["accounting", "capital", "tax"]) {
    const treatmentId = DIMENSION_TREATMENT_MODULE[dimension];
    if (!treatmentId) continue;
    lines.push(
      `| ${dimension} | \`${moduleVersionLabel(treatmentId)}\` | ${ownerFor(dimension)} |`,
    );
  }
  lines.push("");
  lines.push(
    "Module declarations: `v2-core/reporting-treatments/fx-modules.ts`, seeded into the " +
      "v2-anchor store by `scripts/seed-v2-anchor-bank-standing-data.ts`. These modules are " +
      "now the canonical, versioned source for the FX accounting/prudential/tax treatment, " +
      "replacing the prior hardcoded inline determinations.",
  );
  lines.push("");

  // -------------------------------------------------------------------------
  // Per-dimension summary (one short paragraph each)
  // -------------------------------------------------------------------------
  lines.push("## 3. Dimension summary (14 dimensions)");
  lines.push("");

  const dimEntries = Array.from(row.attestedDimensions.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  for (const [dimension, record] of dimEntries) {
    const moduleId = DIMENSION_TREATMENT_MODULE[dimension];
    const moduleSuffix = moduleId
      ? ` Sourced from treatment module \`${moduleVersionLabel(moduleId)}\`.`
      : "";
    const gapSuffix =
      record.deferredGaps.length > 0
        ? ` ${record.deferredGaps.length} tracked deferred gap(s): ${record.deferredGaps
            .map((g) => g.gapId)
            .join(", ")}.`
        : " No tracked deferred gaps.";
    lines.push(
      `- **${dimension}** — ${record.result}. Owner: ${ownerFor(dimension)}.${moduleSuffix}${gapSuffix}`,
    );
  }
  if (row.pendingDimensions.length > 0) {
    lines.push("");
    lines.push(`Pending (not yet attested): ${row.pendingDimensions.join(", ")}.`);
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // Deferred-gap register
  // -------------------------------------------------------------------------
  lines.push("## 4. Deferred-gap register");
  lines.push("");
  lines.push("| Dimension | Gap | Owner | Target trigger | Citations |");
  lines.push("|---|---|---|---|---|");
  let gapCount = 0;
  for (const [dimension, record] of dimEntries) {
    for (const gap of record.deferredGaps) {
      gapCount++;
      lines.push(
        `| ${dimension} | \`${gap.gapId}\`: ${gap.title} | ${gap.owner} | ${gap.targetTrigger} | ${gap.citations.join("; ")} |`,
      );
    }
  }
  if (gapCount === 0) {
    lines.push("| — | (no tracked deferred gaps) | — | — | — |");
  }
  lines.push("");
  lines.push(`Total tracked deferred gaps: **${gapCount}**.`);
  lines.push("");

  // -------------------------------------------------------------------------
  // Post-approval findings + retrospective reviews (D-NPA-POST-APPROVAL-FINDING-
  // REVIEW). Rendered from the register row so the settlement-model refinement
  // (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, #1516/#1517) is visible as a governance
  // fact, not just a code comment. A render of the event log (Principle 1).
  // -------------------------------------------------------------------------
  lines.push("## 5. Post-approval findings & retrospective reviews");
  lines.push("");
  const findings = Array.from(row.postApprovalFindings.values()).sort((a, b) =>
    a.findingId.localeCompare(b.findingId),
  );
  if (findings.length === 0) {
    lines.push("None — no post-approval findings recorded for this product.");
  } else {
    lines.push(
      "| Finding | Severity | Title | Missed dimension | Discovered by | Reviewed? | Revised attestation |",
    );
    lines.push("|---|---|---|---|---|---|---|");
    for (const f of findings) {
      const review = row.retrospectiveReviews.get(f.findingId);
      const reviewed = review ? `yes (${review.reviewedBy}, ${review.reviewedAt})` : "**open**";
      lines.push(
        `| \`${f.findingId}\` | ${f.severity} | ${f.title} | ${f.missedDimension} | ${f.discoveredBy} | ${reviewed} | ${review?.revisedAttestation ?? "—"} |`,
      );
    }
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // Settlement model (Trade / Settlement / Product). The lifecycle event family
  // and CDM composition are carried on the latest ProductConceptualised, which
  // the register folds — but the register row does not expose them, so the doc
  // states the model from the canonical Decision. Render text only (no store
  // access here): the canonical facts are the ProductConceptualised +
  // ProductPostApprovalFinding events the cycle emits.
  // -------------------------------------------------------------------------
  lines.push("## 6. Settlement model (Trade / Settlement / Product)");
  lines.push("");
  lines.push(
    "Under **D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL** (CEO-approved 2026-06-23; landed by #1516/#1517) the FX OTC vanilla product follows three cleanly-separated constructs:",
  );
  lines.push("");
  lines.push(
    "- **Trade = the agreement** — one `FilInstrumentCreated` records the executory receivable/payable (terms; no holding yet).",
  );
  lines.push(
    "- **Settlement = the execution** — N uniform single-asset `TradeSettlementExecuted` events (the **settlement-of-record**; FX spot = 2: received-cash + paid-cash). Each materialises a holding **at cost** and executes a specific trade; booked-vs-settled drives derecognition + realised P&L (IAS 21 §28). This **replaces** the 2-leg `FilFxSettlementConfirmed` representation, which is retired to oracle/historical only.",
  );
  lines.push(
    "- **Product = the glue** — the type-level rulebook (trade-type → settlement obligations → holdings → accounting) plus the per-trade `tradeFamily` grouping (Create + its Settles + materialised holdings under the trade id).",
  );
  lines.push("");
  lines.push(
    "This is a representation refinement recorded post-approval; settlement and posting behaviour are unchanged (Slices 1–2 landed and balance-tested the trade-settlement fold). The one genuine follow-on — the FinSurv BoP per-transaction projection must also fold `TradeSettlementExecuted` at licence-day — is tracked as the conduct `fx-bop-projection-trade-settlement-source` deferred gap.",
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}
