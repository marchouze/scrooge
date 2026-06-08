// platform/regulatory/graph/capability-infra.ts
//
// Infrastructure capabilities + the published orphan-exemption allowlist.
//
// Most Capability nodes are seeded from procedure `system-capability:`
// frontmatter and therefore always carry an incoming REALISES edge. A small set
// of cross-cutting INFRASTRUCTURE capabilities (the agent substrate: scheduler,
// dispatch, identity, runtime, trigger bus, observability) underpin the bank but
// are not the subject of any single business procedure. The Principle-2 finding
// F2 (record:documents:scrooge:principle-2-capability-to-procedure-review) flags
// these as candidate orphans.
//
// This module resolves F2 DELIBERATELY and in the open:
//   - The six infra capabilities are seeded as Capability nodes so they exist in
//     the graph (else recon:orphan-capability could not see them at all).
//   - Each is EITHER bound to a PROC-* procedure via that procedure's
//     `system-capability:` frontmatter (so it earns a real REALISES edge and is
//     NOT orphan), OR listed in ORPHAN_CAPABILITY_ALLOWLIST below with a typed,
//     cited rationale. Silence is not permitted — every one is decided.
//
// Authority: D-PRINCIPLE-2-CAPABILITY-LAYER (CEO-approved 2026-06-08).
// Author: Atlas (Core banking platform architect, engineering).

/** The six F2 infrastructure capability slugs (canonical-path-slug form). */
export const INFRA_CAPABILITY_SLUGS = [
  "platform/scheduler",
  "platform/dispatch",
  "platform/agent-identity",
  "platform/agent-runtime",
  "platform/event-trigger",
  "platform/observability",
] as const;

export type InfraCapabilitySlug = (typeof INFRA_CAPABILITY_SLUGS)[number];

/**
 * Published infrastructure-exemption allowlist for recon:orphan-capability.
 *
 * A capability slug listed here is exempt from the "no incoming REALISES"
 * FAIL — it is cross-cutting infrastructure that no single business procedure
 * realises. Each entry MUST carry a one-line cited rationale (typed, not
 * silence). Entries are removed once a governing procedure binds the capability.
 *
 * F2 resolution (2026-06-08):
 *   - platform/scheduler      → PROCEDURE-BOUND  (PROC-OPS-AR-01 agent-runtime-deploy)
 *   - platform/dispatch       → PROCEDURE-BOUND  (PROC-OPS-AR-01 agent-runtime-deploy)
 *   - platform/agent-identity → PROCEDURE-BOUND  (PROC-OPS-AR-01 agent-runtime-deploy)
 *   - platform/agent-runtime  → PROCEDURE-BOUND  (PROC-OPS-AR-01 agent-runtime-deploy)
 *   - platform/event-trigger  → PROCEDURE-BOUND  (PROC-OPS-AR-01 agent-runtime-deploy)
 *   - platform/observability  → ALLOWLISTED      (telemetry substrate; see below)
 */
export const ORPHAN_CAPABILITY_ALLOWLIST: ReadonlyMap<string, string> = new Map([
  [
    "platform/observability",
    "Cross-cutting telemetry/logging substrate underpinning every procedure; not realised by a single business procedure. Governed by Information Security Policy + Secure SDLC (PROC-OPS-AR-01 release gate covers its deploy). D-PRINCIPLE-2-CAPABILITY-LAYER F2.",
  ],
]);

/** True when a capability slug is exempt from the orphan-capability FAIL. */
export function isOrphanAllowlisted(slug: string): boolean {
  return ORPHAN_CAPABILITY_ALLOWLIST.has(slug);
}
