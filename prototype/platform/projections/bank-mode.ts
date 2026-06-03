// platform/projections/bank-mode.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR2 — query the current bank-wide
// provenance policy from the event log, and sync it to the process-local
// lifecycle-phase indicator at boot.
//
// The active policy is the most recent `BankModePolicySet` event
// (latest-wins-per-key). When no policy has been set, the default applies:
// bankMode "sim" with governance/build categories `production` and operational
// categories `simulated` — i.e. the build-phase status quo, made explicit.
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import type {
  BankMode,
  BankModePolicySetPayload,
  CategoryProvenance,
  ProvenanceCategory,
} from "../event-store/event-types/bank-mode";
import { PROVENANCE_CATEGORIES } from "../event-store/event-types/bank-mode";
import { setActiveCategoryPolicy, setBankLifecyclePhaseOverride } from "../event-store/provenance";
import type { CategoryProvenanceMap } from "../event-store/provenance-category";
import type { EventStore } from "../event-store/store";

export type { BankMode, ProvenanceCategory, CategoryProvenance };

/**
 * Default per-category provenance under bank mode "sim" (build phase):
 *   - governance + build/substrate = production (real commitments, real code)
 *   - everything the bank operates on (trading, accounting, counterparty,
 *     messaging, settlement, market-data) = simulated.
 * Generalises the legacy hardcoded PRODUCTION_CARVE_OUTS.
 */
export const DEFAULT_CATEGORY_POLICY: readonly CategoryProvenance[] = PROVENANCE_CATEGORIES.map(
  (category): CategoryProvenance => ({
    category,
    provenance: category === "governance" || category === "build" ? "production" : "simulated",
  }),
);

export const DEFAULT_BANK_MODE: BankMode = "sim";

export interface BankModePolicy {
  readonly bankMode: BankMode;
  readonly categoryPolicy: readonly CategoryProvenance[];
  readonly note?: string;
  readonly setBy?: string;
  readonly setAt?: string;
  /** True when this is the built-in default (no BankModePolicySet event found). */
  readonly isDefault: boolean;
}

export const DEFAULT_BANK_MODE_POLICY: BankModePolicy = {
  bankMode: DEFAULT_BANK_MODE,
  categoryPolicy: DEFAULT_CATEGORY_POLICY,
  isDefault: true,
};

/**
 * Resolve the current bank-mode policy: the most recent `BankModePolicySet`
 * event, or the built-in default when none has been recorded.
 */
export function currentBankModePolicy(store: EventStore): BankModePolicy {
  let latest: { payload: BankModePolicySetPayload; as_of: string } | null = null;
  for (const ev of store.replay({ type: "BankModePolicySet" })) {
    const payload = ev.payload as unknown as BankModePolicySetPayload;
    // Latest-wins by append order (replay is append-ordered); as_of carried for display.
    latest = { payload, as_of: ev.as_of };
  }
  if (!latest) return DEFAULT_BANK_MODE_POLICY;
  return {
    bankMode: latest.payload.bankMode,
    categoryPolicy: latest.payload.categoryPolicy,
    ...(latest.payload.note !== undefined ? { note: latest.payload.note } : {}),
    setBy: latest.payload.setBy,
    setAt: latest.as_of,
    isDefault: false,
  };
}

/** Map a category to its default provenance under `policy` (falls back to simulated). */
export function provenanceForCategory(
  policy: BankModePolicy,
  category: ProvenanceCategory,
): "production" | "simulated" {
  return policy.categoryPolicy.find((c) => c.category === category)?.provenance ?? "simulated";
}

/** The lifecycle phase implied by a bank mode (sim → build-phase, prod → commencement). */
export function lifecyclePhaseForBankMode(mode: BankMode): "build-phase" | "commencement" {
  return mode === "prod" ? "commencement" : "build-phase";
}

/** Project the per-category policy array into the Record the provenance layer consumes. */
export function categoryPolicyMap(policy: BankModePolicy): CategoryProvenanceMap {
  const map = {} as Record<ProvenanceCategory, "production" | "simulated">;
  for (const cat of PROVENANCE_CATEGORIES) map[cat] = "simulated";
  for (const row of policy.categoryPolicy) map[row.category] = row.provenance;
  return map;
}

/**
 * Boot-sync: pin the process-local lifecycle-phase override AND the active
 * per-category provenance policy from the event-sourced bank-mode policy, so the
 * canonical operating-book filter, all `bankLifecyclePhase()` consumers, and
 * `defaultProvenanceFor` reflect the policy without coupling the low-level
 * provenance module to the event store. Call once at process boot (dashboard
 * server, runtime daemons). Cheap — replays only BankModePolicySet.
 */
export function syncBankModeToLifecyclePhase(store: EventStore): BankModePolicy {
  const policy = currentBankModePolicy(store);
  setBankLifecyclePhaseOverride(lifecyclePhaseForBankMode(policy.bankMode));
  setActiveCategoryPolicy(categoryPolicyMap(policy));
  return policy;
}
