// scripts/register-fleet.ts
//
// S8 §3.1 + A4 — fleet rollout. Drive `Team/_team-roster.json` through
// the agent spec parser and emit the substrate-genesis triple per
// persona:
//
//   1. `AgentRegistered`         (via LocalAgentRegistry.register)
//   2. `IdentityKeyRotated`      (via LocalAgentIdentityIssuer.issue —
//                                  reason: "initial" on first issuance)
//   3. `PermissionPolicyPublished` (via LocalPermissionPolicyPublisher.publish)
//
// Idempotent end-to-end: re-running on an unchanged roster + unchanged
// persona files emits zero new events. Each step short-circuits on its
// own idempotency key (specHash for register / issue, policyHash for
// publish).
//
// Degraded-but-progressing semantics: a persona file that fails to parse
// (malformed §6 cadence, missing §7 trigger table, etc.) does NOT abort
// the whole run. Instead the failure is recorded as a typed
// `SubstrateAlert` (alertClass: integrity, severity: medium, agentUrn
// scoped to the offending persona) and the loop continues with the next
// persona. The human exit code distinguishes:
//   - 0 — every persona registered cleanly OR a clean idempotent re-run.
//   - 1 — at least one persona failed (the alerts in the event log carry
//          the per-persona detail).
//
// Invocation: `bun run register-fleet` (npm script in `package.json`).
//
// Authors: Atlas (S8 §3.1 + A4 fleet rollout); composes on top of
// A1.1 (registry + spec-parser) and A1.2 (issuer + permission-policy).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { LocalAgentIdentityIssuer } from "../platform/agent-identity/issuer";
import { LocalPermissionPolicyPublisher } from "../platform/agent-identity/permission-policy";
import { LocalAgentRegistry } from "../platform/agent-runtime/registry";
import { parseSpecFile } from "../platform/agent-runtime/spec-parser";
import { eventStore, logger } from "../platform/composition";
import { makeSubstrateAlert } from "../platform/event-store/event-types";
import type { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";

import type { AgentIdentityIssuer } from "../platform/agent-identity/issuer";
import type { PermissionPolicyPublisher } from "../platform/agent-identity/permission-policy";
import type { AgentRegistry } from "../platform/agent-runtime/registry";

/** Roster-JSON shape we depend on. Narrow to the fields we read. */
interface RosterPersona {
  readonly name: string;
  readonly role: string;
  readonly type?: string;
  readonly reportsTo?: string;
  readonly buildPhaseStatus?: string;
}
interface Roster {
  readonly personas: readonly RosterPersona[];
}

/** Result rows we surface in the per-persona summary. */
export type RegistrationOutcome =
  | "registered" // first time AgentRegistered emitted
  | "updated" // spec changed → new AgentRegistered + (possibly) new policy
  | "unchanged" // no event emitted on any of the three steps
  | "partial" // one step emitted, one or more skipped (e.g. spec-change re-issue but identical capability set)
  | "failed"; // parse failure — SubstrateAlert emitted, persona skipped

export interface PersonaRegistrationResult {
  readonly personaName: string;
  readonly position: string;
  readonly specPath: string;
  readonly specPresent: boolean;
  readonly parsedCleanly: boolean;
  readonly outcome: RegistrationOutcome;
  readonly registerEventEmitted: boolean;
  readonly identityEventEmitted: boolean;
  readonly policyEventEmitted: boolean;
  readonly detail: string;
}

export interface FleetRegistrationSummary {
  readonly total: number;
  readonly registered: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly partial: number;
  readonly failed: number;
  readonly emitted: number;
  readonly results: readonly PersonaRegistrationResult[];
}

/**
 * Default actor stamped on the per-persona SubstrateAlert when a parse
 * failure is encountered. The fleet-rollout driver is itself a
 * substrate component ("agent:atlas:fleet-rollout") — the alert points
 * back at the responsible substrate, not at the persona.
 */
const FLEET_ROLLOUT_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:fleet-rollout",
};

const FLEET_ROLLOUT_CITATIONS: readonly string[] = [
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-2-2024",
  "ORG-CY-09",
];

const DEFAULT_ENTITY = "LE-ZA-HOZ-BANK";

/** Inputs the driver needs from the composition root. */
export interface FleetRegistrationConfig {
  readonly eventStore: EventStore;
  readonly registry: AgentRegistry;
  readonly identity: AgentIdentityIssuer;
  readonly publisher: PermissionPolicyPublisher;
  /** Absolute path to `Team/_team-roster.json`. */
  readonly rosterPath: string;
  /** Absolute path to the `Team/` directory (where `<Name>.md` lives). */
  readonly teamDir: string;
  /** Stamped on emitted SubstrateAlert events. Defaults match the registry's. */
  readonly entity?: string;
  readonly actor?: Actor;
  readonly citations?: readonly string[];
  readonly now?: () => string;
}

/**
 * Read the roster JSON. Throws if missing / malformed — without the
 * roster the driver has no input set, which is a hard failure (the
 * canonical-source rule means we don't fall back to filesystem
 * discovery).
 */
export function readRoster(rosterPath: string): Roster {
  if (!existsSync(rosterPath)) {
    throw new Error(`fleet-rollout: roster not found at ${rosterPath}`);
  }
  const raw = readFileSync(rosterPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { personas?: unknown }).personas)
  ) {
    throw new Error(`fleet-rollout: roster at ${rosterPath} is missing 'personas' array`);
  }
  return parsed as Roster;
}

/**
 * Per-persona registration. Returns the outcome row. Side effects:
 * up to three events into the event store (one each from registry,
 * issuer, publisher) on a fresh persona; zero on an idempotent re-run;
 * one SubstrateAlert on a parse failure.
 */
export function registerOnePersona(
  persona: RosterPersona,
  config: FleetRegistrationConfig,
): PersonaRegistrationResult {
  const { registry, identity, publisher, eventStore: store, teamDir } = config;
  const specPath = resolve(teamDir, `${persona.name}.md`);
  const position = persona.role;

  if (!existsSync(specPath)) {
    emitParseFailureAlert(
      `agent:${persona.name.toLowerCase()}`,
      `persona spec not found at ${specPath}`,
      config,
      store,
    );
    return {
      personaName: persona.name,
      position,
      specPath,
      specPresent: false,
      parsedCleanly: false,
      outcome: "failed",
      registerEventEmitted: false,
      identityEventEmitted: false,
      policyEventEmitted: false,
      detail: "spec file missing",
    };
  }

  const parse = parseSpecFile(specPath);
  if (!parse.ok) {
    emitParseFailureAlert(`agent:${persona.name.toLowerCase()}`, parse.reason, config, store);
    return {
      personaName: persona.name,
      position,
      specPath,
      specPresent: true,
      parsedCleanly: false,
      outcome: "failed",
      registerEventEmitted: false,
      identityEventEmitted: false,
      policyEventEmitted: false,
      detail: parse.reason,
    };
  }

  const spec = parse.spec;

  // Step 1 — register. May emit AgentRegistered.
  const reg = registry.register(spec);

  // Step 2 — issue identity. May emit IdentityKeyRotated (initial / spec-change).
  let identityEventEmitted = false;
  let identityStatus = "unchanged";
  try {
    const result = identity.issue(spec);
    identityEventEmitted = result.eventEmitted;
    identityStatus = result.status;
  } catch (e) {
    emitParseFailureAlert(
      spec.agentUrn,
      `identity-issue error: ${(e as Error).message}`,
      config,
      store,
    );
    return {
      personaName: persona.name,
      position,
      specPath,
      specPresent: true,
      parsedCleanly: true,
      outcome: "failed",
      registerEventEmitted: reg.eventEmitted,
      identityEventEmitted: false,
      policyEventEmitted: false,
      detail: `identity-issue error: ${(e as Error).message}`,
    };
  }

  // Step 3 — publish permission policy. May emit PermissionPolicyPublished.
  let policyEventEmitted = false;
  let policyStatus = "unchanged";
  try {
    const result = publisher.publish(spec);
    policyEventEmitted = result.eventEmitted;
    policyStatus = result.status;
  } catch (e) {
    emitParseFailureAlert(
      spec.agentUrn,
      `permission-publish error: ${(e as Error).message}`,
      config,
      store,
    );
    return {
      personaName: persona.name,
      position,
      specPath,
      specPresent: true,
      parsedCleanly: true,
      outcome: "failed",
      registerEventEmitted: reg.eventEmitted,
      identityEventEmitted,
      policyEventEmitted: false,
      detail: `permission-publish error: ${(e as Error).message}`,
    };
  }

  const anyEmit = reg.eventEmitted || identityEventEmitted || policyEventEmitted;
  let outcome: RegistrationOutcome;
  if (!anyEmit) {
    outcome = "unchanged";
  } else if (reg.status === "registered") {
    outcome = "registered";
  } else if (reg.status === "updated") {
    outcome = "updated";
  } else {
    // Registry unchanged but identity or policy changed — treat as partial
    // re-issue (e.g. an out-of-band identity rotation alongside a
    // policy refresh).
    outcome = "partial";
  }

  return {
    personaName: persona.name,
    position,
    specPath,
    specPresent: true,
    parsedCleanly: true,
    outcome,
    registerEventEmitted: reg.eventEmitted,
    identityEventEmitted,
    policyEventEmitted,
    detail: `register=${reg.status} identity=${identityStatus} policy=${policyStatus}`,
  };
}

/**
 * Drive the whole roster. Returns a structured summary; the caller
 * (CLI / dashboard server boot) decides logging cadence.
 */
export function registerFleet(config: FleetRegistrationConfig): FleetRegistrationSummary {
  const roster = readRoster(config.rosterPath);
  const results: PersonaRegistrationResult[] = [];

  for (const persona of roster.personas) {
    results.push(registerOnePersona(persona, config));
  }

  const counts = {
    registered: results.filter((r) => r.outcome === "registered").length,
    updated: results.filter((r) => r.outcome === "updated").length,
    unchanged: results.filter((r) => r.outcome === "unchanged").length,
    partial: results.filter((r) => r.outcome === "partial").length,
    failed: results.filter((r) => r.outcome === "failed").length,
  };
  const emitted = results.reduce(
    (n, r) =>
      n +
      (r.registerEventEmitted ? 1 : 0) +
      (r.identityEventEmitted ? 1 : 0) +
      (r.policyEventEmitted ? 1 : 0),
    0,
  );
  return {
    total: results.length,
    ...counts,
    emitted,
    results,
  };
}

/**
 * Emit a degraded-but-progressing alert. Callers continue past a
 * failure rather than aborting the run; the alert in the event log is
 * the canonical record (P1) that Vera's recon (Wave-4 #13) drives to
 * zero.
 */
function emitParseFailureAlert(
  agentUrn: string,
  reason: string,
  config: FleetRegistrationConfig,
  store: EventStore,
): void {
  const slugSource = agentUrn.replace(/^agent:/, "").replace(/[^a-z0-9-]/g, "-");
  const alertId = `alert:integrity:fleet-rollout-${slugSource || "unknown"}`;
  store.append(
    makeSubstrateAlert({
      asOf: (config.now ?? (() => new Date().toISOString()))(),
      entity: config.entity ?? DEFAULT_ENTITY,
      actor: config.actor ?? FLEET_ROLLOUT_ACTOR,
      citations: [...(config.citations ?? FLEET_ROLLOUT_CITATIONS)],
      payload: {
        alertId,
        alertClass: "integrity",
        agentUrn,
        details: `fleet-rollout: ${reason}`,
        severity: "medium",
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// CLI entry point — composes against the prototype's local composition root.
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const TEAM_DIR = resolve(REPO_ROOT, "Team");
const ROSTER_PATH = resolve(TEAM_DIR, "_team-roster.json");

async function main(): Promise<number> {
  const registry = new LocalAgentRegistry({ eventStore });
  const issuer = new LocalAgentIdentityIssuer({
    eventStore,
    keyDir: process.env.BANK_AGENT_KEY_DIR ?? resolve(".local/keys"),
  });
  const publisher = new LocalPermissionPolicyPublisher({ eventStore });

  let summary: FleetRegistrationSummary;
  try {
    summary = registerFleet({
      eventStore,
      registry,
      identity: issuer,
      publisher,
      rosterPath: ROSTER_PATH,
      teamDir: TEAM_DIR,
    });
  } catch (e) {
    logger.error(
      { err: (e as Error).message },
      "register-fleet — fatal: roster missing or unreadable",
    );
    return 1;
  }

  for (const r of summary.results) {
    if (r.outcome === "failed") {
      logger.error(
        {
          persona: r.personaName,
          position: r.position,
          specPresent: r.specPresent,
          parsedCleanly: r.parsedCleanly,
          detail: r.detail,
        },
        `register-fleet — ${r.personaName} failed`,
      );
    } else {
      logger.info(
        {
          persona: r.personaName,
          position: r.position,
          outcome: r.outcome,
          registerEvent: r.registerEventEmitted,
          identityEvent: r.identityEventEmitted,
          policyEvent: r.policyEventEmitted,
          detail: r.detail,
        },
        `register-fleet — ${r.personaName} ${r.outcome}`,
      );
    }
  }

  logger.info(
    {
      total: summary.total,
      registered: summary.registered,
      updated: summary.updated,
      unchanged: summary.unchanged,
      partial: summary.partial,
      failed: summary.failed,
      emitted: summary.emitted,
    },
    `register-fleet — done: registered=${summary.registered} updated=${summary.updated} unchanged=${summary.unchanged} partial=${summary.partial} failed=${summary.failed} emitted=${summary.emitted} (total=${summary.total})`,
  );

  return summary.failed === 0 ? 0 : 1;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
