// platform/regulatory/graph/obligation-policy-fold.ts
//
// Obligation → Policy implementation mapping (IMPLEMENTED_BY edges).
//
// Closes the Principle-2 chain hop between adopted obligations (OBL-ORG-*,
// seeded from Regulations/_obligations-register.md) and the Policy layer
// (POL-*, seeded from Policies/ frontmatter). The named NEXT step of
// D-OBLIGATIONS-REGISTER-CLEANUP.
//
// All edges here are DERIVED — Plane-A reference derivation per
// D-REGULATORY-ARCHITECTURE-TWO-PLANE (re-derivable from artefacts the bank
// already authors; no events, no hand-authored mapping table). Three sources,
// in provenance-precedence order (highest confidence wins per pair):
//
//   1. policy-frontmatter-obligations — the policy's explicit `obligations:`
//      frontmatter list (the policy's own statement of what it implements).
//   2. policy-summary-closes          — ORG-* ids harvested from the policy
//      summary "Closes obligations ORG-…" pattern (same source the CLOSES
//      Policy → Obligation edges use; IMPLEMENTED_BY is the obligation-side
//      reading of the same citation).
//   3. register-fulfilment-policy     — the obligations-register
//      "Fulfilment policy" column, fuzzy-resolved against policy titles.
//
// Pure module (no DB / IO) so unit tests can assert derivation, dedup, and
// provenance precedence directly; the seed projection owns node-existence
// checks and edge upserts.
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP (named next step); workstream
// WS-OBLIGATION-POLICY-MAPPING.
// Author: Mira (Compliance / RegTech engineer, engineering)

import type { GraphEdge } from "./types";

/** Provenance label for a derived Obligation → Policy pair. */
export type ObligationPolicySource =
  | "policy-frontmatter-obligations"
  | "policy-summary-closes"
  | "register-fulfilment-policy";

/** Confidence per source (frontmatter is the policy's own explicit statement). */
const SOURCE_CONFIDENCE: Record<ObligationPolicySource, number> = {
  "policy-frontmatter-obligations": 0.95,
  "policy-summary-closes": 0.95,
  "register-fulfilment-policy": 0.85,
};

/** Precedence when the same pair is derivable from multiple sources (lower = wins). */
const SOURCE_PRECEDENCE: Record<ObligationPolicySource, number> = {
  "policy-frontmatter-obligations": 0,
  "policy-summary-closes": 1,
  "register-fulfilment-policy": 2,
};

export interface ObligationPolicyPair {
  /** Bare register id, e.g. "ORG-FC-07" (node id is `OBL-${obligationId}`). */
  obligationId: string;
  /** Policy graph-node id, e.g. "POL-aml-cft-policy". */
  policyNodeId: string;
  source: ObligationPolicySource;
  confidenceScore: number;
}

export interface PolicyObligationCitations {
  /** Policy graph-node id (POL-*). */
  policyNodeId: string;
  /** ORG-* ids from the explicit `obligations:` frontmatter list. */
  obligationsImplemented: readonly string[];
  /** ORG-* ids from the summary "closes ORG-…" pattern. */
  obligationsClosed: readonly string[];
}

export interface RegisterFulfilmentRow {
  /** Bare register id, e.g. "ORG-PR-01". */
  obligationId: string;
  /** Raw "Fulfilment policy" cell (may carry markdown links, semicolons, "(planned)"). */
  fulfilmentPolicy: string;
}

/**
 * Split a register "Fulfilment policy" cell into candidate policy-name strings.
 *
 * Handles: semicolon separation, markdown links `[Name](path)` → Name,
 * backtick-quoted procedure paths (skipped — procedures are not policies),
 * and bare `Procedures/...` path fragments (skipped).
 */
export function splitFulfilmentPolicyCell(cell: string): string[] {
  return cell
    .split(";")
    .map((part) => part.trim())
    .map((part) => part.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim())
    .filter((part) => part.length > 0)
    .filter((part) => !part.startsWith("`"))
    .filter((part) => !/Procedures\//.test(part))
    .filter((part) => !/^\[?TBD\]?$/i.test(part))
    .filter((part) => !/^(n\/a|none|tbc)$/i.test(part.replace(/[[\]]/g, "")));
}

/**
 * Derive the full deduplicated Obligation → Policy pair set from the three
 * sources. `resolvePolicyNodeId` is the seed's fuzzy policy-title resolver
 * (free-form name → POL-* node id, or undefined when unresolvable — an
 * unresolvable fulfilment-policy name yields NO edge; the obligation surfaces
 * in the coverage gap instead of acquiring a guessed edge).
 *
 * Dedup rule: one pair per (obligationId, policyNodeId); when multiple sources
 * derive the same pair, the highest-precedence source (and its confidence) wins.
 */
export function deriveObligationPolicyPairs(input: {
  policies: readonly PolicyObligationCitations[];
  registerRows: readonly RegisterFulfilmentRow[];
  resolvePolicyNodeId: (freeFormName: string) => string | undefined;
}): ObligationPolicyPair[] {
  const byPairKey = new Map<string, ObligationPolicyPair>();

  const offer = (obligationId: string, policyNodeId: string, source: ObligationPolicySource) => {
    const key = `${obligationId}::${policyNodeId}`;
    const existing = byPairKey.get(key);
    if (existing && SOURCE_PRECEDENCE[existing.source] <= SOURCE_PRECEDENCE[source]) return;
    byPairKey.set(key, {
      obligationId,
      policyNodeId,
      source,
      confidenceScore: SOURCE_CONFIDENCE[source],
    });
  };

  for (const policy of input.policies) {
    for (const obligationId of policy.obligationsImplemented) {
      offer(obligationId, policy.policyNodeId, "policy-frontmatter-obligations");
    }
    for (const obligationId of policy.obligationsClosed) {
      offer(obligationId, policy.policyNodeId, "policy-summary-closes");
    }
  }

  for (const row of input.registerRows) {
    for (const name of splitFulfilmentPolicyCell(row.fulfilmentPolicy)) {
      const policyNodeId = input.resolvePolicyNodeId(name);
      if (!policyNodeId) continue;
      offer(row.obligationId, policyNodeId, "register-fulfilment-policy");
    }
  }

  // Deterministic order (stable seed output / stable test assertions).
  return [...byPairKey.values()].sort((a, b) =>
    `${a.obligationId}::${a.policyNodeId}`.localeCompare(`${b.obligationId}::${b.policyNodeId}`),
  );
}

/**
 * Build the typed IMPLEMENTED_BY edge for one derived pair. Pure — the caller
 * supplies the edge id and timestamp and owns persistence. The edge direction
 * is Obligation → Policy (`OBL-${obligationId}` → policyNodeId); provenance is
 * carried in `metadata.source` and `extractionMethod`.
 */
export function buildImplementedByEdge(
  pair: ObligationPolicyPair,
  edgeIdValue: string,
  extractedAt: string,
): GraphEdge {
  return {
    id: edgeIdValue,
    fromId: `OBL-${pair.obligationId}`,
    toId: pair.policyNodeId,
    edgeType: "IMPLEMENTED_BY",
    extractionMethod: pair.source === "register-fulfilment-policy" ? "register" : "frontmatter",
    confidenceScore: pair.confidenceScore,
    extractedAt,
    metadata: { source: pair.source },
  };
}
