// platform/accounting/sla/rules/all-rules.ts
//
// The canonical, complete SLA rule registry — every posting rule across every
// product family and every representation, version-stamped. This is the SINGLE
// source the versioning recon (`recon:sla-rule-versioning`, spec §6 / §10) reads
// to assert window-integrity (gap-free + overlap-free per (representation,
// rule_id) lineage) and to validate that every `ruleVersion` stamped on a
// `SubLedgerPostingEmitted` exists in the registry.
//
// Keeping ONE aggregate (rather than the recon re-listing the per-family
// registries) means a new family or a v2 supersession is picked up
// automatically: add the rule to its family index, and it flows here.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4b, CEO-approved 2026-06-06).

import type { SlaRule } from "../generated/sla-types";
import { FX_IFRS_RULES, FX_SARB_BA_RULES } from "./index";
import { IRD_IFRS_RULES } from "./ird-index";
import { PAYMENTS_IFRS_RULES } from "./payments-index";
import { SECURITIES_IFRS_RULES } from "./securities-index";
import { TREASURY_IFRS_RULES } from "./treasury-index";

/**
 * Every SLA posting rule in the registry, across all families + representations.
 * The IFRS rules are the live production basis; the SARB-BA-RETURN rules are the
 * first secondary representation (NOT activated — Phase-4c gate). The recon
 * partitions by (representation, rule_id) so the bases never cross-contaminate.
 */
export const ALL_SLA_RULES: readonly SlaRule[] = [
  ...FX_IFRS_RULES,
  ...TREASURY_IFRS_RULES,
  ...SECURITIES_IFRS_RULES,
  ...IRD_IFRS_RULES,
  ...PAYMENTS_IFRS_RULES,
  // Secondary representation (parallel basis; not activated in production).
  ...FX_SARB_BA_RULES,
];
