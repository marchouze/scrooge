// dashboard/taxonomy-view.ts
//
// Read-side view builder for GET /api/taxonomies.
// Builds the response object from the canonical taxonomy module.
// Parallel structure to regulatory-view.ts.
//
// Author: Atlas (Core banking platform architect, engineering)

import { nowUtc } from "../platform/core/types";
import {
  ACTIVITY_CODES,
  ACTIVITY_GROUPS,
  ACTIVITY_LABELS,
  DOMAIN_TAXONOMY,
  PRODUCT_SCOPE,
  RISK_TAXONOMY,
} from "../platform/taxonomies";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface RiskTaxonomyNodeView {
  readonly code: string;
  readonly label: string;
  readonly parent: string | null;
  readonly level: number;
  readonly description: string;
  readonly owner: string;
}

export interface ActivityNodeView {
  readonly code: string;
  readonly label: string;
  readonly group: string;
}

export interface DomainNodeView {
  readonly code: string;
  readonly label: string;
  readonly description: string;
}

export interface ProductScopeNodeView {
  readonly code: string;
  readonly label: string;
  readonly description: string;
}

export interface TaxonomiesView {
  readonly asOf: string;
  readonly taxonomies: {
    readonly risk: {
      readonly name: string;
      readonly description: string;
      readonly nodeCount: number;
      readonly nodes: readonly RiskTaxonomyNodeView[];
    };
    readonly activity: {
      readonly name: string;
      readonly description: string;
      readonly nodeCount: number;
      readonly groups: Record<string, string[]>;
      readonly nodes: readonly ActivityNodeView[];
    };
    readonly domain: {
      readonly name: string;
      readonly description: string;
      readonly nodeCount: number;
      readonly nodes: readonly DomainNodeView[];
    };
    readonly productScope: {
      readonly name: string;
      readonly description: string;
      readonly nodeCount: number;
      readonly nodes: readonly ProductScopeNodeView[];
    };
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build the full taxonomies view from the canonical taxonomy module.
 * Pure function — no event store dependency; taxonomies are static
 * registered data (Principle 1: they originate from code as canonical source).
 *
 * Author: Atlas (Core banking platform architect, engineering)
 */
export function buildTaxonomiesView(): TaxonomiesView {
  // ── Risk taxonomy ──────────────────────────────────────────────────────────
  const riskNodes: RiskTaxonomyNodeView[] = RISK_TAXONOMY.map((n) => ({
    code: n.code,
    label: n.name,
    parent: n.parent,
    level: n.level,
    description: n.definition,
    owner: n.owner,
  }));

  // ── Activity taxonomy ──────────────────────────────────────────────────────
  // Build a reverse map: code → group name.
  const codeToGroup: Record<string, string> = {};
  for (const [group, codes] of Object.entries(ACTIVITY_GROUPS)) {
    for (const code of codes) {
      codeToGroup[code] = group;
    }
  }

  const activityNodes: ActivityNodeView[] = ACTIVITY_CODES.map((code) => ({
    code,
    label: ACTIVITY_LABELS[code],
    group: codeToGroup[code] ?? "Other",
  }));

  // Groups for the response — values are arrays of code strings.
  const activityGroupsView: Record<string, string[]> = {};
  for (const [group, codes] of Object.entries(ACTIVITY_GROUPS)) {
    activityGroupsView[group] = [...codes];
  }

  // ── Domain taxonomy ────────────────────────────────────────────────────────
  const domainNodes: DomainNodeView[] = DOMAIN_TAXONOMY.map((n) => ({
    code: n.code,
    label: n.label,
    description: n.description,
  }));

  // ── Product scope ──────────────────────────────────────────────────────────
  const productScopeNodes: ProductScopeNodeView[] = PRODUCT_SCOPE.map((n) => ({
    code: n.code,
    label: n.label,
    description: n.description,
  }));

  return {
    asOf: nowUtc(),
    taxonomies: {
      risk: {
        name: "Risk Taxonomy",
        description:
          "Hierarchical risk classification (L1/L2/L3). Owner: Helena (Chief Risk Officer, governance).",
        nodeCount: riskNodes.length,
        nodes: riskNodes,
      },
      activity: {
        name: "Activity Taxonomy",
        description:
          "Activity codes classifying bank operations. Owner: Atlas (Core banking platform architect, engineering).",
        nodeCount: activityNodes.length,
        groups: activityGroupsView,
        nodes: activityNodes,
      },
      domain: {
        name: "Obligation Domain Taxonomy",
        description:
          "Ten regulatory domain codes for the obligations register. Owner: Mira (Compliance / RegTech engineer, engineering).",
        nodeCount: domainNodes.length,
        nodes: domainNodes,
      },
      productScope: {
        name: "Product Scope Taxonomy",
        description:
          "Product classifications for obligation scope. Owner: Atlas (Core banking platform architect, engineering).",
        nodeCount: productScopeNodes.length,
        nodes: productScopeNodes,
      },
    },
  };
}
