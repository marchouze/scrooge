// tests/fleet-registration.test.ts
//
// Unit tests for S8 §3.1 + A4 — fleet rollout (`scripts/register-fleet.ts`).
//
// Asserts:
//   - All personas in the test roster register on first run; a triple
//     of (AgentRegistered + IdentityKeyRotated + PermissionPolicyPublished)
//     events appears per persona, in the tmp event store.
//   - Re-running the driver against the unchanged roster + persona
//     files emits zero new events.
//   - A persona file with malformed §6 cadence raises a typed error
//     and skips that persona without aborting the whole rollout. The
//     failure is recorded as a `SubstrateAlert` (alertClass: integrity)
//     and the rest of the roster registers cleanly.
//   - Per-agent `PermissionPolicyPublished` event paired with each
//     `AgentRegistered` (1:1).
//
// The tests run against tmp directories, not against the real
// `/Team/_team-roster.json` — the fleet driver accepts roster + team
// directory paths in its config, which is the test seam.
//
// Author: Atlas (S8 §3.1 + A4)

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { LocalAgentIdentityIssuer } from "../platform/agent-identity/issuer";
import { LocalPermissionPolicyPublisher } from "../platform/agent-identity/permission-policy";
import { LocalAgentRegistry } from "../platform/agent-runtime/registry";
import { EventStore } from "../platform/event-store/store";
import { type FleetRegistrationConfig, registerFleet } from "../scripts/register-fleet";

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

/**
 * Build a minimal but parseable persona spec. The parser requires
 * §1, §6, §7, §9, §11, §12 to be present; §10 / §13 may be empty.
 */
function specMarkdown(args: {
  name: string;
  role: string;
  reportsTo: string;
  cadenceMode?: string;
  trigger?: string;
  capability?: string;
  emit?: string;
}): string {
  const cadenceMode = args.cadenceMode ?? "Scheduled.";
  const trigger = args.trigger ?? "Test trigger";
  const capability = args.capability ?? "@platform/event-store";
  const emit = args.emit ?? "TestEvent";
  return `# ${args.name}

## 1. Identity

- **Name:** ${args.name}
- **Role:** ${args.role}
- **Reports to:** ${args.reportsTo}

## 2. Persona

Test persona.

## 3. Mandate

Test mandate.

## 4. Areas of expertise

- Testing.

## 5. Working style

- Deterministic.

## 6. Cadence

- **Mode:** ${cadenceMode}
- **Schedule:** Test schedule.
- **Inactivity SLA:** Nil.

## 7. Triggers

| Trigger | Source | Response SLA |
|---|---|---|
| ${trigger} | Test runner | 0s |

## 8. Inputs

- Test inputs.

## 9. Decisions in scope

| Decision | Criteria | Output |
|---|---|---|
| Approve test | Pass | \`TestApproved\` event |

## 10. Decisions that escalate

| Decision | Escalation criterion | Target overseer | Channel | Deadline |
|---|---|---|---|---|

## 11. Outputs

- **Events emitted:** \`${emit}\`.

## 12. System capabilities called

- \`${capability}\` — test.

## 13. Procedures owned

- None.

## 14. Data contracts

- **Produces:** \`${emit}\`.

## 15. Independence / conflicts

None.

## 16. Substrate gaps

- None.

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-10 | Test | Initial. |
`;
}

interface Fixture {
  workDir: string;
  teamDir: string;
  rosterPath: string;
  keyDir: string;
  store: EventStore;
}

function setupFixture(personas: Array<{ name: string; role: string; reportsTo: string }>): Fixture {
  const workDir = mkdtempSync(join(tmpdir(), "fleet-rollout-"));
  const teamDir = join(workDir, "Team");
  const keyDir = join(workDir, "keys");
  mkdirSync(teamDir, { recursive: true });
  mkdirSync(keyDir, { recursive: true });

  for (const p of personas) {
    writeFileSync(
      join(teamDir, `${p.name}.md`),
      specMarkdown({ name: p.name, role: p.role, reportsTo: p.reportsTo }),
      "utf8",
    );
  }
  const rosterPath = join(teamDir, "_team-roster.json");
  writeFileSync(
    rosterPath,
    JSON.stringify({ personas: personas.map((p) => ({ name: p.name, role: p.role })) }, null, 2),
    "utf8",
  );

  const store = new EventStore();
  return { workDir, teamDir, rosterPath, keyDir, store };
}

function buildConfig(fix: Fixture, now: () => string): FleetRegistrationConfig {
  return {
    eventStore: fix.store,
    registry: new LocalAgentRegistry({ eventStore: fix.store, now }),
    identity: new LocalAgentIdentityIssuer({
      eventStore: fix.store,
      keyDir: fix.keyDir,
      now,
    }),
    publisher: new LocalPermissionPolicyPublisher({ eventStore: fix.store, now }),
    rosterPath: fix.rosterPath,
    teamDir: fix.teamDir,
    now,
  };
}

let fixtures: Fixture[];
beforeEach(() => {
  fixtures = [];
});
afterEach(() => {
  for (const f of fixtures) {
    try {
      f.store.close();
    } catch {
      /* noop */
    }
    try {
      rmSync(f.workDir, { recursive: true, force: true });
    } catch {
      /* noop */
    }
  }
});

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe("fleet rollout — registerFleet", () => {
  it("registers every persona on first run with a triple of events per persona", () => {
    const fix = setupFixture([
      { name: "Alpha", role: "Alpha role", reportsTo: "CEO" },
      { name: "Beta", role: "Beta role", reportsTo: "CEO" },
      { name: "Gamma", role: "Gamma role", reportsTo: "CEO" },
    ]);
    fixtures.push(fix);

    const summary = registerFleet(buildConfig(fix, () => "2026-05-10T00:00:00.000Z"));

    expect(summary.total).toBe(3);
    expect(summary.registered).toBe(3);
    expect(summary.failed).toBe(0);
    // Each persona emits AgentRegistered + IdentityKeyRotated + PermissionPolicyPublished → 9 total.
    expect(summary.emitted).toBe(9);

    const types = [...fix.store.replay()].map((e) => e.type);
    const agentRegistered = types.filter((t) => t === "AgentRegistered").length;
    const identityKeyRotated = types.filter((t) => t === "IdentityKeyRotated").length;
    const policyPublished = types.filter((t) => t === "PermissionPolicyPublished").length;
    expect(agentRegistered).toBe(3);
    expect(identityKeyRotated).toBe(3);
    expect(policyPublished).toBe(3);
  });

  it("re-running the driver is a no-op (zero new events)", () => {
    const fix = setupFixture([
      { name: "Alpha", role: "Alpha role", reportsTo: "CEO" },
      { name: "Beta", role: "Beta role", reportsTo: "CEO" },
    ]);
    fixtures.push(fix);
    const config = buildConfig(fix, () => "2026-05-10T00:00:00.000Z");

    const first = registerFleet(config);
    expect(first.emitted).toBe(6);
    const countAfterFirst = fix.store.count();

    const second = registerFleet(config);
    expect(second.total).toBe(2);
    expect(second.unchanged).toBe(2);
    expect(second.registered).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.failed).toBe(0);
    expect(second.emitted).toBe(0);
    expect(fix.store.count()).toBe(countAfterFirst);
  });

  it("PermissionPolicyPublished is paired 1:1 with AgentRegistered", () => {
    const fix = setupFixture([
      { name: "Alpha", role: "Alpha role", reportsTo: "CEO" },
      { name: "Beta", role: "Beta role", reportsTo: "CEO" },
      { name: "Gamma", role: "Gamma role", reportsTo: "CEO" },
      { name: "Delta", role: "Delta role", reportsTo: "CEO" },
    ]);
    fixtures.push(fix);

    registerFleet(buildConfig(fix, () => "2026-05-10T00:00:00.000Z"));

    const events = [...fix.store.replay()];
    const registered = events.filter((e) => e.type === "AgentRegistered");
    const policies = events.filter((e) => e.type === "PermissionPolicyPublished");
    expect(registered.length).toBe(4);
    expect(policies.length).toBe(4);

    const registeredUrns = new Set(
      registered.map((e) => (e.payload as { agentUrn: string }).agentUrn),
    );
    const policyUrns = new Set(policies.map((e) => (e.payload as { agentUrn: string }).agentUrn));
    // Every registered urn has a policy and vice versa.
    expect([...registeredUrns].sort()).toEqual([...policyUrns].sort());
  });

  it("malformed persona file emits SubstrateAlert and the rest continue (degraded-but-progressing)", () => {
    const fix = setupFixture([
      { name: "Alpha", role: "Alpha role", reportsTo: "CEO" },
      { name: "Gamma", role: "Gamma role", reportsTo: "CEO" },
    ]);
    fixtures.push(fix);

    // Add a malformed persona alongside the clean ones — missing §6 Cadence.
    writeFileSync(
      join(fix.teamDir, "Beta.md"),
      `# Beta

## 1. Identity

- **Name:** Beta
- **Role:** Broken role
- **Reports to:** CEO

## 2. Persona

Broken.
`,
      "utf8",
    );
    // Update the roster to include Beta in the middle so we test ordering.
    writeFileSync(
      fix.rosterPath,
      JSON.stringify(
        {
          personas: [
            { name: "Alpha", role: "Alpha role" },
            { name: "Beta", role: "Broken role" },
            { name: "Gamma", role: "Gamma role" },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const summary = registerFleet(buildConfig(fix, () => "2026-05-10T00:00:00.000Z"));

    expect(summary.total).toBe(3);
    expect(summary.registered).toBe(2);
    expect(summary.failed).toBe(1);
    // 2 clean × 3 events = 6, plus 1 SubstrateAlert for the failure.
    expect(summary.emitted).toBe(6);

    const events = [...fix.store.replay()];
    const alerts = events.filter((e) => e.type === "SubstrateAlert");
    expect(alerts.length).toBe(1);
    const alertPayload = alerts[0]?.payload as {
      alertClass: string;
      severity: string;
      agentUrn?: string;
      details: string;
    };
    expect(alertPayload.alertClass).toBe("integrity");
    expect(alertPayload.severity).toBe("medium");
    expect(alertPayload.agentUrn).toBe("agent:beta");
    expect(alertPayload.details).toContain("§6 Cadence");

    // The clean personas registered.
    const registered = events
      .filter((e) => e.type === "AgentRegistered")
      .map((e) => (e.payload as { agentUrn: string }).agentUrn)
      .sort();
    expect(registered).toEqual(["agent:alpha", "agent:gamma"]);
  });

  it("a missing persona spec file is reported as failed without aborting the run", () => {
    const fix = setupFixture([{ name: "Alpha", role: "Alpha role", reportsTo: "CEO" }]);
    fixtures.push(fix);

    // Roster lists Beta but no Beta.md file exists.
    writeFileSync(
      fix.rosterPath,
      JSON.stringify(
        {
          personas: [
            { name: "Alpha", role: "Alpha role" },
            { name: "Beta", role: "Missing role" },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const summary = registerFleet(buildConfig(fix, () => "2026-05-10T00:00:00.000Z"));
    expect(summary.total).toBe(2);
    expect(summary.registered).toBe(1);
    expect(summary.failed).toBe(1);
    const beta = summary.results.find((r) => r.personaName === "Beta");
    expect(beta?.specPresent).toBe(false);
    expect(beta?.outcome).toBe("failed");

    const alerts = [...fix.store.replay()].filter((e) => e.type === "SubstrateAlert");
    expect(alerts.length).toBe(1);
  });
});

describe("fleet rollout — parser triggerSubscriptions (Path A / Gap #2 closure)", () => {
  it("captures backticked typed-event tokens from §7's first column", () => {
    // Use a hand-rolled spec with a multi-row trigger table to exercise
    // the parser's first-column extraction.
    const fix = setupFixture([{ name: "Sigma", role: "Sigma role", reportsTo: "CEO" }]);
    fixtures.push(fix);
    writeFileSync(
      join(fix.teamDir, "Sigma.md"),
      `# Sigma

## 1. Identity

- **Name:** Sigma
- **Role:** Sigma role
- **Reports to:** CEO

## 2. Persona

T.

## 3. Mandate

T.

## 4. Areas of expertise

- T.

## 5. Working style

- T.

## 6. Cadence

- **Mode:** Event-driven.

## 7. Triggers

| Trigger | Source | Response SLA |
|---|---|---|
| \`TransactionPosted\` event | Event store | 60s |
| \`PepListPublished\` / \`AdverseMediaPublished\` | Daily 05:00 UTC scheduler | 4h |
| Scheduled wake-up — daily 04:00 UTC | Runtime scheduler | 4h |
| PR opened on \`prototype/platform/*\` | Git substrate | 1 working day |
| \`CeoDecision\` event | Event store | 1h |

## 8. Inputs

T.

## 9. Decisions in scope

| Decision | Criteria | Output |
|---|---|---|
| T | T | \`TestApproved\` |

## 10. Decisions that escalate

| Decision | Escalation criterion | Target overseer | Channel | Deadline |
|---|---|---|---|---|

## 11. Outputs

- **Events emitted:** \`SigmaEmitted\`.

## 12. System capabilities called

- \`@platform/event-store\` — t.

## 13. Procedures owned

- None.

## 14. Data contracts

- T.

## 15. Independence / conflicts

None.

## 16. Substrate gaps

- None.

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-10 | T | Initial. |
`,
      "utf8",
    );

    const summary = registerFleet(buildConfig(fix, () => "2026-05-10T00:00:00.000Z"));
    expect(summary.failed).toBe(0);

    const policies = [...fix.store.replay()].filter((e) => e.type === "PermissionPolicyPublished");
    const sigma = policies.find(
      (e) => (e.payload as { agentUrn: string }).agentUrn === "agent:sigma",
    );
    expect(sigma).toBeDefined();
    const subscribe = (sigma?.payload as { eventSubscribeAllowList: string[] })
      .eventSubscribeAllowList;
    // Typed event tokens from the first column only — scheduled wake-up
    // and the PR-source row contribute nothing (their first columns
    // have no backticked typed-event token). Source-column tokens
    // (e.g. `prototype/platform/*`) must NOT appear.
    expect(subscribe.sort()).toEqual(
      ["AdverseMediaPublished", "CeoDecision", "PepListPublished", "TransactionPosted"].sort(),
    );
  });
});
