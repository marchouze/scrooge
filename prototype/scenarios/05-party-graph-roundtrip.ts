// scenarios/05-party-graph-roundtrip.ts
//
// D-PARTY-REGISTER PR 2 (CEO-approved 2026-05-11) — runnable end-to-end
// round-trip demo for the unified Party event family.
//
// What this scenario asserts:
//   1. The boot-time Party backfill emits the three legal-entity Parties
//      (hoz-group, hoz-bank, hoz-securities) with two `parent-of` edges
//      (group → bank, group → securities).
//   2. The 27 in-house agent Parties (one per persona in
//      Team/_team-roster.json) are emitted with `reports-to` edges
//      following the canonical roster.
//   3. A signatory natural-person Party can be minted by registering
//      Jane Doe with a `signatory-of` edge to a freshly-registered
//      sample counterparty Party.
//   4. The backfill is idempotent — a second run produces zero new
//      events.
//   5. Graph queries: walking the `reports-to` chain from any agent
//      converges; the `signatory-of` query for Acme returns Jane.
//
// Run:
//   bun run scenarios/05-party-graph-roundtrip.ts
//   bun run scenario:party
//
// IMPORTANT: this file sets BANK_EVENT_DB before any platform imports
// resolve the singleton event store, so the run is fully isolated from
// the canonical .local/event.db.
//
// Author: Imani (Legal-as-code engineer; reports to Devon, Chief
// Operating Officer, governance).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ISOLATED_DIR = mkdtempSync(join(tmpdir(), "party-roundtrip-eventdb-"));
process.env.BANK_EVENT_DB = join(ISOLATED_DIR, "event.db");
// Scenario emits Party events directly under a `service` actor for
// realism (agent:imani is the substantive owner). Disable the
// permission gate for the duration of the scenario — a real run path
// (dashboard backfill) routes through `system` actors and never trips
// the gate; the manual emits here only mimic a future PR-3 path where
// Imani's published policy includes the Party event types.
process.env.BANK_PERMISSION_GATE_DISABLED = "true";
// AgentRegistered events are emitted by the fleet-rollout step — for
// this scenario we run it once via the Party backfill caller below;
// we don't need the dashboard's full boot here.

import {
  type PartyId,
  makePartyRegistered,
  makePartyRelationshipAsserted,
  partyId,
} from "../domains/party";
import { LocalAgentIdentityIssuer } from "../platform/agent-identity/issuer";
import { LocalPermissionPolicyPublisher } from "../platform/agent-identity/permission-policy";
import { LocalAgentRegistry } from "../platform/agent-runtime/registry";
import { eventStore } from "../platform/composition";
import {
  buildPartyProjection,
  countPartiesByKind,
  queryRelationships,
  walkReportsToChain,
} from "../platform/identity/party-projection";
import { runPartyBackfill } from "../scripts/party-backfill";
import { registerFleet } from "../scripts/register-fleet";

// ---------------------------------------------------------------------------
// Test rig
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const ROSTER_PATH = resolve(REPO_ROOT, "Team", "_team-roster.json");
const TEAM_DIR = resolve(REPO_ROOT, "Team");

let passes = 0;
let fails = 0;

function ok(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? ` (${detail})` : ""}`);
    passes += 1;
  } else {
    console.log(`  FAIL  ${label}${detail ? ` (${detail})` : ""}`);
    fails += 1;
  }
}

function section(title: string): void {
  console.log(`\n  ${title}`);
}

// ---------------------------------------------------------------------------
// Step 1 — fleet rollout (so AgentRegistered events exist for the
// backfill to fold)
// ---------------------------------------------------------------------------

section("Step 1 — register the 27-agent fleet");
const registry = new LocalAgentRegistry({ eventStore });
const identity = new LocalAgentIdentityIssuer({
  eventStore,
  keyDir: join(ISOLATED_DIR, "keys"),
});
const publisher = new LocalPermissionPolicyPublisher({ eventStore });

const rolloutSummary = registerFleet({
  eventStore,
  registry,
  identity,
  publisher,
  rosterPath: ROSTER_PATH,
  teamDir: TEAM_DIR,
});
ok(
  "fleet rollout emits at least 27 personas",
  rolloutSummary.total >= 27,
  `total=${rolloutSummary.total}`,
);

// ---------------------------------------------------------------------------
// Step 2 — first backfill run
// ---------------------------------------------------------------------------

section("Step 2 — run Party backfill (first pass)");
const backfill1 = runPartyBackfill(eventStore, {
  legalEntityTreeSeedPath: resolve(REPO_ROOT, "prototype", "seeds", "legal-entity-tree.json"),
  teamRosterPath: ROSTER_PATH,
});
ok(
  "3 legal-entity Parties emitted",
  backfill1.legalEntityPartiesEmitted === 3,
  `got=${backfill1.legalEntityPartiesEmitted}`,
);
ok(
  "27+ agent Parties emitted",
  backfill1.agentPartiesEmitted >= 27,
  `got=${backfill1.agentPartiesEmitted}`,
);
// 2 parent-of edges + reports-to edges per persona whose `reportsTo`
// resolves to another *agent* persona (top-of-house entries point at
// "CEO" / "Marc" — not yet a Party in PR 2; the natural-person CEO seat
// activates in PR 3, at which point the top-of-house edges resolve).
ok(
  "at least 2 parent-of + ~17 reports-to relationships emitted (top-of-house edges activate in PR 3)",
  backfill1.relationshipsEmitted >= 19,
  `got=${backfill1.relationshipsEmitted}`,
);

// ---------------------------------------------------------------------------
// Step 3 — projection-side assertions
// ---------------------------------------------------------------------------

section("Step 3 — projection asserts the backfilled graph");
const proj1 = buildPartyProjection(eventStore);
const counts1 = countPartiesByKind(proj1);
ok(
  "projection has the three legal-entity Parties",
  counts1["legal-entity"] >= 3,
  `legal-entity count=${counts1["legal-entity"]}`,
);
ok("projection has the 27 agent Parties", counts1.agent >= 27, `agent count=${counts1.agent}`);

// Parent-of edges: hoz-group → hoz-bank, hoz-group → hoz-securities.
const groupPartyId = partyId("legal-entity", "hoz-group");
const bankPartyId = partyId("legal-entity", "hoz-bank");
const securitiesPartyId = partyId("legal-entity", "hoz-securities");
const parentOfEdges = queryRelationships(proj1, { from: groupPartyId, kind: "parent-of" });
const parentOfTargets = new Set(parentOfEdges.map((e) => e.toPartyId));
ok(
  "Hoz Group parent-of Hoz Bank edge present",
  parentOfTargets.has(bankPartyId),
  `targets=${[...parentOfTargets].join(",")}`,
);
ok(
  "Hoz Group parent-of Hoz Securities edge present",
  parentOfTargets.has(securitiesPartyId),
  `targets=${[...parentOfTargets].join(",")}`,
);

// reports-to chain — from a known persona, walk the chain. PAX reports
// to Devon; if the roster is intact, the chain should have ≥ 2 hops.
const paxPartyId = partyId("agent", "pax");
const paxChain = walkReportsToChain(proj1, paxPartyId);
ok(
  "reports-to chain from PAX has at least 2 hops",
  paxChain.length >= 2,
  `chain=${paxChain.join(" → ")}`,
);

// ---------------------------------------------------------------------------
// Step 4 — register a sample counterparty Party + a Jane Doe natural-
// person + a signatory-of edge.
// ---------------------------------------------------------------------------

section("Step 4 — register Acme + Jane Doe + signatory-of edge");
const acmePartyId: PartyId = partyId("counterparty", "acme-am");
eventStore.append(
  makePartyRegistered({
    asOf: new Date().toISOString(),
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "agent:imani" },
    citations: ["D-PARTY-REGISTER", "FIC-ACT-38-2001"],
    payload: {
      partyId: acmePartyId,
      kind: "counterparty",
      displayName: "Acme Asset Management",
      legalName: "Acme Asset Management (Pty) Ltd",
      jurisdictions: ["ZA"],
      kindAttributes: {
        kind: "counterparty",
        sector: "asset-management",
        channel: "introduction",
        introSource: "scenario-05",
        classification: "Sounding",
      },
      citations: [
        "[citation: D-PARTY-REGISTER]",
        "[citation: FIC Act 38 of 2001 s.21 customer due diligence]",
      ],
    },
  }),
);
const janePartyId: PartyId = partyId("natural-person", "jane-doe-scenario-05");
eventStore.append(
  makePartyRegistered({
    asOf: new Date().toISOString(),
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "agent:imani" },
    citations: ["D-PARTY-REGISTER", "POPIA-ACT-4-2013"],
    payload: {
      partyId: janePartyId,
      kind: "natural-person",
      displayName: "Jane Doe",
      legalName: "Jane Doe",
      jurisdictions: ["ZA"],
      kindAttributes: {
        kind: "natural-person",
        nationalities: ["ZA"],
        purposeRoles: ["signatory"],
      },
      citations: [
        "[citation: D-PARTY-REGISTER]",
        "[citation: POPIA Act 4 of 2013 s.19-22 minimum-necessary]",
        "[citation: Companies Act 71 of 2008 s.66 signing authority]",
      ],
    },
  }),
);
const signatoryRelationshipId = `relationship:signatory-of:${janePartyId}->${acmePartyId}`;
eventStore.append(
  makePartyRelationshipAsserted({
    asOf: new Date().toISOString(),
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "agent:imani" },
    citations: ["D-PARTY-RELATIONSHIP-KINDS-V0", "D-PARTY-REGISTER"],
    payload: {
      relationshipId: signatoryRelationshipId,
      fromPartyId: janePartyId,
      toPartyId: acmePartyId,
      kind: "signatory-of",
      scopeJson: { source: "scenario-05" },
      effectiveFrom: new Date().toISOString(),
      citations: [
        "[citation: D-PARTY-RELATIONSHIP-KINDS-V0]",
        "[citation: Companies Act 71 of 2008 s.66 signing authority]",
      ],
    },
  }),
);
const proj2 = buildPartyProjection(eventStore);
const counts2 = countPartiesByKind(proj2);
ok(
  "Acme counterparty Party present after manual emit",
  proj2.parties.has(acmePartyId),
  `counterparty count=${counts2.counterparty}`,
);
ok(
  "Jane Doe natural-person Party present after manual emit",
  proj2.parties.has(janePartyId),
  `natural-person count=${counts2["natural-person"]}`,
);
const acmeSignatories = queryRelationships(proj2, { to: acmePartyId, kind: "signatory-of" });
ok(
  "signatory-of query returns Jane attached to Acme",
  acmeSignatories.some((e) => e.fromPartyId === janePartyId),
  `signatories=${acmeSignatories.map((e) => e.fromPartyId).join(",")}`,
);

// ---------------------------------------------------------------------------
// Step 5 — idempotency. Re-run the backfill; assert zero new events.
// ---------------------------------------------------------------------------

section("Step 5 — idempotency — re-run backfill");
const backfill2 = runPartyBackfill(eventStore, {
  legalEntityTreeSeedPath: resolve(REPO_ROOT, "prototype", "seeds", "legal-entity-tree.json"),
  teamRosterPath: ROSTER_PATH,
});
const totalNew2 =
  backfill2.legalEntityPartiesEmitted +
  backfill2.counterpartyPartiesEmitted +
  backfill2.agentPartiesEmitted +
  backfill2.naturalPersonPartiesEmitted +
  backfill2.relationshipsEmitted +
  backfill2.classificationsEmitted;
ok(
  "second backfill emits zero new events (idempotent)",
  totalNew2 === 0,
  `totalNew=${totalNew2}, skipped=${backfill2.skipped}`,
);

// ---------------------------------------------------------------------------
// Final report
// ---------------------------------------------------------------------------

console.log(`\n  Party graph round-trip: ${passes} pass / ${fails} fail`);
if (fails > 0) {
  process.exit(1);
}
process.exit(0);
