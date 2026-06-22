// platform/recon/v2-client-onboarding-integrity.ts
//
// recon:v2-client-onboarding-integrity — the standing enforcement of the
// born-V2 client (counterparty) onboarding GATING INVARIANT
// (WS-V2-CLIENT-ONBOARDING; D-V1-REMOVAL-PHASE-1).
//
// THE INVARIANT: a counterparty MUST NOT reach `activated` without every event
// in `REQUIRED_GATING_PHASES` (KYC, sanctions, FAIS, beneficial-owner, FATCA/CRS,
// POPIA consent, credit assessment, accounts setup) AND a prospect registration.
// A concealed activation — events that jump to `ClientOnboardingActivated` with
// a gating phase missing — is a fail-closed compliance breach (FIC Act 38/2001
// CDD; FAIS Act 37/2002; POPIA s.11; IRC §1471–1474 / OECD CRS), not a migration
// artefact.
//
// HOW IT RUNS: replay the V1 canonical event store (where the seed + any runtime
// emissions land), fold the events through `foldClientOnboardingRegister` (the
// v2-core projection — the structural truth), and FAIL on any
// `register.violations`. The fold is tolerant (non-family events skipped), so
// the gate is keyed exclusively to the onboarding family.
//
// SEVERITY: ENFORCING from the start. The seed (`seed:v2-client-onboarding`)
// runs every one of its 15 clients through the FULL lifecycle, so a clean CI
// store has zero violations — there is no legacy backlog to drain. A violation
// is a real integrity breach.
//
// EMPTY-STATE CORRECTNESS: zero onboarding events → asserted=0, ok=true (no
// counterparty, no claim to assert).
//
// ARCHITECTURE NOTE: this gate lives on the v1 side (v1-side infra checks v2
// behaviour; the reverse is forbidden — `recon:v2-no-v1-import`). It imports the
// v2-core projection via the permitted v1→v2 direction, and the v1 event store
// via the v1 composition seam.
//
// Authority: D-V1-REMOVAL-PHASE-1; WS-V2-CLIENT-ONBOARDING;
//   brief:atlas:v2-client-onboarding-family-onboard-15-sim-clien:2026-06-22.
// Author: Atlas (Core banking platform architect, engineering).

import {
  CLIENT_ONBOARDING_EVENT_KINDS,
  type ClientOnboardingRegister,
  foldClientOnboardingRegister,
} from "../../v2-core/client-onboarding";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v2-client-onboarding-integrity";

/** ENFORCING from the start — the seed runs the full lifecycle; no backlog. */
const ENFORCING = true;

// ---------------------------------------------------------------------------
// Pure assertion core (exercised sabotage-proof in the test).
// ---------------------------------------------------------------------------

/**
 * Assert the folded register carries no structural violation. The projection
 * already accumulated every `activation-without-gate` / `activation-without-
 * prospect` / `orphan-phase` problem; this maps them onto recon violations at
 * the requested severity. Returns `asserted` = the number of distinct
 * counterparties reasoned about (each onboarding subject is an assertion).
 */
export function assertClientOnboardingIntegrity(
  register: ClientOnboardingRegister,
  severity: ReconViolation["severity"],
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];

  // One assertion per onboarded counterparty (the subjects the gate reasons
  // about). An empty register asserts nothing → ok=true (empty-state correct).
  const asserted = register.listClients().length;

  for (const v of register.violations) {
    violations.push({
      subject: `client-onboarding:${v.counterpartyId}`,
      severity,
      message: `${v.message} (WS-V2-CLIENT-ONBOARDING; D-V1-REMOVAL-PHASE-1; ${v.kind})`,
    });
  }

  return { asserted, violations };
}

// ---------------------------------------------------------------------------
// Live run() — reads the V1 canonical event store (onboarding family).
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";

  const register = foldClientOnboardingRegister(collectOnboardingEvents());
  const { asserted, violations } = assertClientOnboardingIntegrity(register, severity);

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

/**
 * Collect every client-onboarding family event from the V1 store, mapped onto
 * the projection's `{ kind, payload, asOf }` shape. Replays per-kind (the store
 * filters by a single `type`) and concatenates — the fold is order-tolerant
 * within a counterparty (it advances monotonically), but we replay in the
 * store's sequence order per kind, which preserves causal ordering of distinct
 * phase events for any given counterparty.
 */
function* collectOnboardingEvents(): Generator<{
  kind: string;
  payload: Record<string, unknown>;
  asOf: string;
}> {
  // Replay the full store ONCE in global sequence order and filter to the
  // family — this preserves the true causal order across phases for every
  // counterparty (a per-kind replay would group all KYC events before all
  // sanctions events, which is order-correct for the monotonic fold but loses
  // the real interleaving the audit trail records).
  const family = new Set<string>(CLIENT_ONBOARDING_EVENT_KINDS);
  for (const ev of eventStore.replay()) {
    if (!family.has(ev.type)) continue;
    yield { kind: ev.type, payload: ev.payload, asOf: ev.as_of };
  }
}

// ---------------------------------------------------------------------------
// CLI entry point — `bun run recon:v2-client-onboarding-integrity`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : ENFORCING ? "FAIL" : "ADVISORY";
  console.log(`recon:v2-client-onboarding-integrity [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
