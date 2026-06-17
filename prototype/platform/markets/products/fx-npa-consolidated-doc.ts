// platform/markets/products/fx-npa-consolidated-doc.ts
//
// Pure renderer for the consolidated FX OTC Vanilla NPA document. The markdown
// it produces is a RENDER of the event-store state (Principle 1) — the
// canonical artefact is the `RecordFiled` event the driver emits; this string
// is the heavy-bytes body it cites by hash. No side effects, no store access:
// the caller passes the already-folded register row + gate result.
//
// Content:
//   - lifecycle state (withheld, pending re-gate),
//   - one short paragraph per NPA dimension (current result + tracked gaps),
//   - the accounting/prudential/tax → treatment-module map (id@version),
//   - the consolidated deferred-gap register (owner + target trigger + citations).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17);
//            D-NPA-GATE-POLICY-REDESIGN; D-FX-OTC-NPA-SCOPE-EXPANSION;
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Bea (Financial Accountant, finance).

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
  "market-risk": "Rohan (Risk engineer, engineering) / Helena (Chief Risk Officer, governance)",
  "credit-risk": "Helena (Chief Risk Officer, governance)",
  "liquidity-risk": "Eitan (Treasurer, finance)",
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

  lines.push("# FX OTC Vanilla — Consolidated NPA (treatment-module enrichment)");
  lines.push("");
  lines.push(`- **Product:** \`${row.productId}\` (${row.family}), version ${row.version}`);
  lines.push(`- **Lifecycle state:** **${npaStatus}** (register stage: ${row.lifecycleStage})`);
  lines.push(`- **As of:** ${asOf}`);
  lines.push(
    "- **Authority:** D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17); " +
      "D-NPA-GATE-POLICY-REDESIGN; D-FX-OTC-NPA-SCOPE-EXPANSION; D-NEW-PRODUCT-APPROVAL-POLICY §5.",
  );
  lines.push("- **Author:** Bea (Financial Accountant, finance).");
  lines.push("");
  lines.push(
    `> This document records the enrichment of the accounting, capital/prudential and tax dimension attestations so each cites its versioned reporting-treatment module as the canonical source. It is a render of the event log (Principle 1); the \`RecordFiled\` event is the canonical artefact. **It does NOT re-approve the product — the umbrella remains **${npaStatus}** pending a separate re-gate; no \`ProductApproved\` is emitted.**`,
  );
  lines.push("");

  // -------------------------------------------------------------------------
  // Lifecycle + gate
  // -------------------------------------------------------------------------
  lines.push("## 1. Lifecycle & gate");
  lines.push("");
  lines.push(
    `The umbrella FX product is **${npaStatus}** (withheld 2026-06-15 per the standing CEO decision D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL; register stage ${row.lifecycleStage}; pending re-gate). The NPA gate (D-NPA-GATE-POLICY-REDESIGN) over the current attestations reports \`ready=${gate.ready}\`${gate.missing.length > 0 ? `, blocking dimensions: ${gate.missing.join(", ")}` : ""}${
      gate.openConditions.length > 0 ? `, open conditions: ${gate.openConditions.join("; ")}` : ""
    }. This enrichment changes neither the gate result nor the approval state.`,
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

  return `${lines.join("\n")}\n`;
}
