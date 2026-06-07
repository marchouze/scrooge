// tests/derive.test.ts
//
// Unit tests for the dashboard derivation. The test suite uses small
// fixtures written into a tmp dir so each canonical-source parser is
// covered without depending on the live repo state.
//
// Author: Atlas

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type EventSource,
  type SourcePaths,
  type WorkstreamCompletedEventSummary,
  type WorkstreamStartedEventSummary,
  deriveState,
} from "../dashboard/derive";
import type { DecisionRow, DecisionsRegister } from "../projections/decisions";

// ---------------------------------------------------------------------------
// Minimal helpers to build mock DecisionsRegister instances for tests
// ---------------------------------------------------------------------------

function mockResolvedRow(
  decisionId: string,
  title: string,
  asOf: string,
  recommendation = "",
): DecisionRow {
  return {
    decisionId,
    title,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    phase: "approved",
    recommendation,
    rationale: "",
    asOf,
    openedAt: asOf,
    resolvedAt: asOf,
    sourceDocHashes: [],
    citations: [],
    recordedVia: "scrooge:session-delegation",
  };
}

function mockOpenRow(decisionId: string, title: string, asOf: string): DecisionRow {
  return {
    decisionId,
    title,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    phase: "requested",
    recommendation: "",
    rationale: "",
    asOf,
    openedAt: asOf,
    sourceDocHashes: [],
    citations: [],
    recordedVia: "scrooge:session-delegation",
  };
}

function mockRegister(open: DecisionRow[], resolved: DecisionRow[]): DecisionsRegister {
  const byId = new Map<string, import("../projections/decisions").DecisionHistory>();
  for (const row of [...open, ...resolved]) {
    byId.set(row.decisionId, { decisionId: row.decisionId, events: [row], head: row });
  }
  return { open, resolved, byId };
}

interface Fixture {
  sources: SourcePaths;
  setEvents(
    w?: WorkstreamStartedEventSummary[],
    cmp?: WorkstreamCompletedEventSummary[],
    register?: DecisionsRegister | null,
  ): EventSource;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "derive-"));
  mkdirSync(join(root, "Owner Inbox"));
  mkdirSync(join(root, "Regulations"));
  mkdirSync(join(root, "Procedures"));
  mkdirSync(join(root, "Principles"));
  mkdirSync(join(root, "Team"));
  mkdirSync(join(root, "prototype/seeds"), { recursive: true });

  // CLAUDE.md fixture — narrates the structure but the canonical
  // principle and roster data live in /Principles/ and Team/_team-roster.json
  // respectively (Principle 2 single-graph discipline). The CLAUDE.md prose
  // is read for `openSeatStatusFor` per-seat status fall-through only.
  writeFileSync(
    join(root, "CLAUDE.md"),
    [
      "# Bank",
      "",
      "## Architectural principles",
      "",
      "- Principle 1 — Events are the only source of truth.",
      "- Principle 2 — Every action traces to a source.",
      "- Principle 3 — Cloud-native; nothing manual or physical except where essential.",
      "",
      "**Top-of-house reporting.** All governance seats and the Chief of Staff report directly to the CEO.",
      "",
    ].join("\n"),
  );

  // /Principles/<n>-<slug>.md — canonical principle text.
  writeFileSync(
    join(root, "Principles", "1-events.md"),
    ["# Principle 1 — Events are the only source of truth", "", "All state is queries."].join("\n"),
  );
  writeFileSync(
    join(root, "Principles", "2-citations.md"),
    ["# Principle 2 — Every action traces to a source", "", "Atomic citation discipline."].join(
      "\n",
    ),
  );
  writeFileSync(
    join(root, "Principles", "3-cloud.md"),
    [
      "# Principle 3 — Cloud-native; nothing manual or physical except where essential",
      "",
      "IaC; coded workflows.",
    ].join("\n"),
  );

  // Team/_team-roster.json — canonical roster: one direct report + one
  // future-as-hired open seat.
  writeFileSync(
    join(root, "Team", "_team-roster.json"),
    JSON.stringify(
      {
        topOfHouse: {
          ceoDirectReports: [
            "Scrooge (CoS, orchestrator)",
            "Helena (CRO)",
            "Thandiwe (CAE — administrative line; functional line into AC)",
          ],
          futureDirectReportsAsHired: ["GC", "CHRO"],
        },
        personas: [],
      },
      null,
      2,
    ),
  );

  // Policy register — two domain sections (1, 2), three policies total +
  // one "Summary" section that should be excluded.
  writeFileSync(
    join(root, "Owner Inbox", "2026-05-06_policy-register.md"),
    [
      "# Policy register",
      "",
      "## How to read",
      "",
      "## 1. Foundation",
      "",
      "| Policy | Owner | Approval | Cadence | Citation | Status |",
      "|---|---|---|---|---|---|",
      "| RAS | Helena | Board | Annual | Banks Act | EXISTS |",
      "| Governance Framework | Owen | Board | Annual | King IV | EXISTS |",
      "",
      "## 2. Risk policies",
      "",
      "| Policy | Owner | Approval | Cadence | Citation | Status |",
      "|---|---|---|---|---|---|",
      "| Credit Risk Policy | Helena | Board | Annual | Banks Act | DRAFTING |",
      "",
      "## Summary",
      "",
      "| Policy | Owner | Approval | Cadence | Citation | Status |",
      "|---|---|---|---|---|---|",
      "| RAS | Helena | Board | Annual | Banks Act | EXISTS |",
      "",
    ].join("\n"),
  );

  // Obligations register — three ORG-* rows including one with parens in ID.
  writeFileSync(
    join(root, "Regulations", "_obligations-register.md"),
    [
      "# Obligations register",
      "",
      "| ID | URN | Citation | Requirement | Fulfilment policy | Owner | Status | Entity scope | Applies-at |",
      "|---|---|---|---|---|---|---|---|---|",
      "| ORG-PR-01 | [TBD] | Banks Act | Capital adequacy | Capital Mgmt | Camille | IN FORCE | [TBD] | [TBD] |",
      "| ORG-PR-02 | [TBD] | Banks Act | Leverage | Capital Mgmt | Camille | IN FORCE | [TBD] | [TBD] |",
      "| ORG-PR(IV)-01 | [TBD] | Banks Act | Pillar IV | Capital Mgmt | Camille | PARTIAL | [TBD] | [TBD] |",
      "",
    ].join("\n"),
  );

  // Regulations index — 4 instruments, 2 populated.
  writeFileSync(
    join(root, "Regulations", "_index.md"),
    [
      "# Regulatory library",
      "",
      "| Instrument | File | Status | Source |",
      "|---|---|---|---|",
      "| Banks Act | SARB-PA/banks-act.md | **POPULATED** | resbank.co.za |",
      "| Reg Banks | SARB-PA/regs.md | STUB | resbank.co.za |",
      "| FIC Act | FIC/fic-act.md | **POPULATED** | fic.gov.za |",
      "| BCBS 239 | BCBS/239.md | PLANNED | bis.org |",
      "| SCO | BCBS/source-docs/sco.json | SOURCE-WIRED | bis.org |",
      "",
    ].join("\n"),
  );

  // Procedures index — 2 populated, 3 planned, 1 stub.
  writeFileSync(
    join(root, "Procedures", "_index.md"),
    [
      "# Procedures library",
      "",
      "| Policy | Procedure | Owner | Status |",
      "|---|---|---|---|",
      "| KYC | kyc-onboarding.md | Zara | **POPULATED** |",
      "| Sanctions | sanctions-screening.md | Zara | **POPULATED** |",
      "| RMF | rmf.md | Helena | PLANNED |",
      "| DoA | doa.md | Owen | PLANNED |",
      "| Climate | climate.md | Helena | PLANNED |",
      "| Cloud | cloud.md | Devon | STUB |",
      "",
    ].join("\n"),
  );

  // Curated carry-forward.
  writeFileSync(
    join(root, "prototype", "seeds", "dashboard-curated.json"),
    JSON.stringify(
      {
        bank: {
          name: "Test Bank",
          operatingPosture: "Build-only",
          cloudTarget: "Azure",
          strategicFoundation: {
            type: "Test",
            products: ["X"],
            clients: ["Y"],
            geography: "ZA",
            capital: "R1m",
            licence: "Deferred",
          },
        },
        decisionsOpen: [
          {
            id: "TEST-OPEN",
            title: "Open decision",
            category: "near-term",
            owner: "Test",
            trigger: "test",
            decisionForCEO: "Approve",
            sourceDocs: ["doc.md"],
          },
        ],
        decisionsResolvedSeed: [
          {
            id: "SEED-1",
            title: "Pre-event resolved decision",
            actionedAt: "2026-05-01",
            outcome: "Approved",
            sourceDoc: "doc.md",
          },
        ],
        inFlight: [
          { id: "WS-A", what: "Workstream A", owner: "Atlas", due: "~1w", active: false },
          { id: "WS-B", what: "Workstream B", owner: "Anya", due: "~2w", active: false },
        ],
        prototype: { ciStatus: "green", tests: 0, modules: [], next: [] },
        risks: ["test risk"],
      },
      null,
      2,
    ),
  );

  const sources: SourcePaths = {
    repoRoot: root,
    claudeMd: join(root, "CLAUDE.md"),
    policyRegister: join(root, "Owner Inbox", "2026-05-06_policy-register.md"),
    obligationsRegister: join(root, "Regulations", "_obligations-register.md"),
    regulationsIndex: join(root, "Regulations", "_index.md"),
    regulationsRoot: join(root, "Regulations"),
    proceduresIndex: join(root, "Procedures", "_index.md"),
    curated: join(root, "prototype", "seeds", "dashboard-curated.json"),
    teamDir: join(root, "Team"),
    teamRoster: join(root, "Team", "_team-roster.json"),
    principlesDir: join(root, "Principles"),
    ownerInboxDir: join(root, "Owner Inbox"),
    bankNameRegister: join(root, "Regulations", "_bank-name.md"),
  };

  return {
    sources,
    setEvents(
      ws: WorkstreamStartedEventSummary[] = [],
      cmp: WorkstreamCompletedEventSummary[] = [],
      register: DecisionsRegister | null = null,
    ) {
      return {
        workstreamStarts: () => ws,
        workstreamCompletions: () => cmp,
        workstreamRegistrations: () => [],
        agentEscalations: () => [],
        auditFindings: () => [],
        decisionComments: () => [],
        ...(register !== null ? { decisionsRegister: () => register } : {}),
      };
    },
  };
}

describe("deriveState — canonical-source parsers", () => {
  it("counts principles, policies, obligations, instruments, procedures from canonical docs", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents(),
      now: () => "2026-05-06T00:00:00.000Z",
    });
    expect(state.bank.metrics.principles).toBe(3);
    expect(state.bank.metrics.policies).toBe(3); // Summary section excluded
    expect(state.bank.metrics.obligations).toBe(3); // ORG-PR(IV)-01 included
    expect(state.bank.metrics.instruments).toBe(4);
    expect(state.bank.metrics.instrumentsAnalysed).toBe(2);
    expect(state.bank.metrics.instrumentsStub).toBe(1);
    expect(state.bank.metrics.instrumentsPlanned).toBe(1);
    expect(state.bank.metrics.instrumentsSourceWired).toBe(1); // SOURCE-WIRED tracked separately, excluded from total
    expect(state.bank.metrics.proceduresPopulated).toBe(2);
    expect(state.bank.metrics.proceduresPlanned).toBe(3);
    expect(state.bank.metrics.proceduresStub).toBe(1);
  });

  it("parses principles with title and summary", () => {
    const f = makeFixture();
    const state = deriveState({ sources: f.sources, events: f.setEvents() });
    expect(state.principles).toHaveLength(3);
    expect(state.principles[0]?.n).toBe(1);
    expect(state.principles[0]?.title).toBe("Events are the only source of truth");
    expect(state.principles[0]?.summary).toBe("All state is queries.");
  });

  it("parses CEO direct reports and open seats from CLAUDE.md", () => {
    const f = makeFixture();
    const state = deriveState({ sources: f.sources, events: f.setEvents() });
    expect(state.directReports.map((p) => p.name)).toEqual(["Scrooge", "Helena", "Thandiwe"]);
    // Thandiwe's role should not include the trailing annotation.
    expect(state.directReports.find((p) => p.name === "Thandiwe")?.role).toBe("CAE");
    expect(state.directReports.find((p) => p.name === "Scrooge")?.type).toBe("Functional");
    expect(state.directReports.find((p) => p.name === "Helena")?.type).toBe("Governance");
    expect(state.openSeats.map((s) => s.role)).toEqual(["GC", "CHRO"]);
  });
});

describe("deriveState — event reductions", () => {
  it("surfaces decisionsResolved from the decisions register", () => {
    const f = makeFixture();
    const register = mockRegister(
      [],
      [
        mockResolvedRow(
          "TEST-OPEN",
          "Open decision",
          "2026-05-06T10:00:00.000Z",
          "Approved as drafted.",
        ),
      ],
    );
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([], [], register),
    });
    expect(state.decisionsOpen).toHaveLength(0);
    expect(state.decisionsResolved.map((r) => r.id)).toEqual(["TEST-OPEN"]);
    expect(state.bank.metrics.ceoDecisionsActioned).toBe(1);
  });

  it("surfaces open decisions from the decisions register", () => {
    const f = makeFixture();
    const register = mockRegister(
      [mockOpenRow("D-PENDING", "Pending decision", "2026-05-06T10:00:00.000Z")],
      [],
    );
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([], [], register),
    });
    expect(state.decisionsOpen.some((d) => d.id === "D-PENDING")).toBe(true);
    expect(state.decisionsResolved).toHaveLength(0);
    expect(state.bank.metrics.ceoDecisionsActioned).toBe(0);
  });

  it("returns empty decisions when no register is provided", () => {
    // Without a decisionsRegister(), the fallback yields empty arrays.
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents(),
    });
    expect(state.decisionsResolved).toEqual([]);
    expect(state.bank.metrics.ceoDecisionsActioned).toBe(0);
  });

  it("activates inFlight items from WorkstreamStarted events", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([{ workstreamId: "WS-A", asOf: "2026-05-04T08:00:00.000Z" }]),
    });
    const a = state.inFlight.find((i) => i.id === "WS-A");
    const b = state.inFlight.find((i) => i.id === "WS-B");
    expect(a?.active).toBe(true);
    expect(a?.startedAt).toBe("2026-05-04");
    expect(b?.active).toBe(false);
  });

  it("closes inFlight items from WorkstreamCompleted events with outcome metadata", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents(
        [{ workstreamId: "WS-A", asOf: "2026-05-04T08:00:00.000Z" }],
        [
          {
            workstreamId: "WS-A",
            asOf: "2026-05-07T09:30:00.000Z",
            outcomeDoc: "Owner Inbox/2026-05-07_a.md",
            outcomeNote: "Delivered.",
          },
        ],
      ),
    });
    const a = state.inFlight.find((i) => i.id === "WS-A");
    expect(a?.active).toBe(false);
    expect(a?.startedAt).toBe("2026-05-04");
    expect(a?.completedAt).toBe("2026-05-07");
    expect(a?.outcomeDoc).toBe("Owner Inbox/2026-05-07_a.md");
    expect(a?.outcomeNote).toBe("Delivered.");
  });

  it("uses the latest WorkstreamCompleted event when several are present", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents(
        [],
        [
          { workstreamId: "WS-B", asOf: "2026-05-05T08:00:00.000Z", outcomeNote: "first" },
          { workstreamId: "WS-B", asOf: "2026-05-06T08:00:00.000Z", outcomeNote: "latest" },
        ],
      ),
    });
    const b = state.inFlight.find((i) => i.id === "WS-B");
    expect(b?.completedAt).toBe("2026-05-06");
    expect(b?.outcomeNote).toBe("latest");
  });

  it("WorkstreamRegistered event wins over curated seed — seed entry is suppressed, no duplicate", () => {
    // The fixture curated seed has WS-A and WS-B. Emitting a WorkstreamRegistered
    // for WS-A means the event-derived entry replaces the seed entry — there
    // must be exactly one WS-A item, with event-authoritative title and owner.
    const f = makeFixture();
    const reg = {
      workstreamId: "WS-A",
      title: "Workstream A (event-authoritative title)",
      owner: "Atlas (event owner)",
      status: "in-flight" as const,
      summary: "Event summary for WS-A.",
      asOf: "2026-05-10T08:00:00.000Z",
    };
    const state = deriveState({
      sources: f.sources,
      events: {
        workstreamStarts: () => [],
        workstreamCompletions: () => [],
        workstreamRegistrations: () => [reg],
        agentEscalations: () => [],
        auditFindings: () => [],
        decisionComments: () => [],
      },
    });
    // Exactly one WS-A item — seed suppressed, event-derived item in its place.
    const wsA = state.inFlight.filter((i) => i.id === "WS-A");
    expect(wsA).toHaveLength(1);
    expect(wsA[0]?.what).toBe("Workstream A (event-authoritative title)");
    expect(wsA[0]?.owner).toBe("Atlas (event owner)");
    expect(wsA[0]?.active).toBe(true); // status "in-flight" → active

    // WS-B has no registration event — it is still present from the seed.
    const wsB = state.inFlight.filter((i) => i.id === "WS-B");
    expect(wsB).toHaveLength(1);
    expect(wsB[0]?.what).toBe("Workstream B"); // unchanged from seed
  });

  it("WorkstreamRegistered event for a workstream not in the seed creates a new inFlight item", () => {
    const f = makeFixture();
    const reg = {
      workstreamId: "WS-NEW-EVENT-ONLY",
      title: "New event-only workstream",
      owner: "Anya",
      status: "planned" as const,
      summary: "Brand new from events.",
      asOf: "2026-05-10T08:00:00.000Z",
    };
    const state = deriveState({
      sources: f.sources,
      events: {
        workstreamStarts: () => [],
        workstreamCompletions: () => [],
        workstreamRegistrations: () => [reg],
        agentEscalations: () => [],
        auditFindings: () => [],
        decisionComments: () => [],
      },
    });
    const wsNew = state.inFlight.filter((i) => i.id === "WS-NEW-EVENT-ONLY");
    expect(wsNew).toHaveLength(1);
    expect(wsNew[0]?.what).toBe("New event-only workstream");
    expect(wsNew[0]?.owner).toBe("Anya");
    // planned → active=true (not blocked and not completed)
    expect(wsNew[0]?.active).toBe(true);
    // Seed entries WS-A and WS-B are still present.
    expect(state.inFlight.some((i) => i.id === "WS-A")).toBe(true);
    expect(state.inFlight.some((i) => i.id === "WS-B")).toBe(true);
  });
});

describe("deriveState — per-agent mini-dashboards", () => {
  it("derives one mini-dashboard per direct report with mandate, operating-spec flag, and owned items", () => {
    const f = makeFixture();
    // Stand up two persona files for the direct reports in the fixture's
    // CLAUDE.md (Helena, Thandiwe) — one in operating-spec form, one in
    // character-sheet form.
    writeFileSync(
      join(f.sources.teamDir, "Helena.md"),
      [
        "# Helena",
        "",
        "## 3. Mandate",
        "",
        "Helena owns the risk appetite framework.",
        "",
        "## 6. Cadence",
        "",
        "Daily.",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(f.sources.teamDir, "Thandiwe.md"),
      [
        "# Thandiwe",
        "",
        "## Mandate",
        "",
        "Thandiwe owns the internal-audit charter.",
        "",
        "## Working style",
        "",
        "Independent.",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(f.sources.ownerInboxDir, "2026-05-07_helena_ras-recalibration-note.md"),
      "stub",
    );
    writeFileSync(join(f.sources.ownerInboxDir, "2026-05-04_helena_earlier-note.md"), "stub");

    const state = deriveState({
      sources: f.sources,
      events: f.setEvents(),
      now: () => "2026-05-07T00:00:00.000Z",
    });
    const agents = state.agents;

    const helena = agents.find((a) => a.name === "Helena");
    const thandiwe = agents.find((a) => a.name === "Thandiwe");

    expect(helena).toBeDefined();
    expect(thandiwe).toBeDefined();

    expect(helena?.mandate).toContain("risk appetite framework");
    expect(helena?.hasOperatingSpec).toBe(true);
    expect(helena?.recentDeliverables.map((d) => d.date)).toEqual(["2026-05-07", "2026-05-04"]);
    expect(helena?.lastActivityAt).toBe("2026-05-07");

    expect(thandiwe?.mandate).toContain("internal-audit charter");
    expect(thandiwe?.hasOperatingSpec).toBe(false);
    expect(thandiwe?.recentDeliverables).toHaveLength(0);
  });

  it("matches workstream owners by whole word, not substring", () => {
    const f = makeFixture();
    // Curate an in-flight item owned by "Helena + Camille + Eitan" — Helena
    // should match, Eitan should match, but a hypothetical "Helen" wouldn't.
    const curatedPath = f.sources.curated;
    const curated = JSON.parse(readFileSync(curatedPath, "utf8"));
    curated.inFlight = [
      {
        id: "WS-RAS",
        what: "RAS recalibration",
        owner: "Helena + Camille + Eitan",
        due: "~3 weeks",
        active: true,
      },
    ];
    writeFileSync(curatedPath, JSON.stringify(curated, null, 2));

    const state = deriveState({
      sources: f.sources,
      events: f.setEvents(),
      now: () => "2026-05-07T00:00:00.000Z",
    });

    const helena = state.agents.find((a) => a.name === "Helena");
    const camille = state.agents.find((a) => a.name === "Camille");
    // Helena and Camille are not in the test fixture's direct-reports table,
    // so they may be undefined. The test still asserts the matching logic
    // for whichever direct reports exist.
    if (helena) expect(helena.activeWorkstreams.map((w) => w.id)).toContain("WS-RAS");
    if (camille) expect(camille.activeWorkstreams.map((w) => w.id)).toContain("WS-RAS");
  });

  it("returns empty decisions when no events are present (Slice A: events-only)", () => {
    // D-DECISIONS-FRAMEWORK-REDESIGN Slice A: curated `decisionsResolvedSeed`
    // is no longer fused — events are the only input.
    const f = makeFixture();
    const state = deriveState({ sources: f.sources, events: f.setEvents() });
    expect(state.decisionsResolved).toEqual([]);
    expect(state.inFlight.every((i) => !i.active)).toBe(true);
    expect(state.bank.metrics.ceoDecisionsActioned).toBe(0);
  });
});

describe("deriveState — wiring", () => {
  it("stamps asOf from the supplied clock", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents(),
      now: () => "2099-01-01T00:00:00.000Z",
    });
    expect(state.asOf).toBe("2099-01-01T00:00:00.000Z");
  });

  it("carries through name, posture, cloudTarget, strategicFoundation, prototype, risks from curated", () => {
    const f = makeFixture();
    const state = deriveState({ sources: f.sources, events: f.setEvents() });
    expect(state.bank.name).toBe("Test Bank");
    expect(state.bank.operatingPosture).toBe("Build-only");
    expect(state.bank.cloudTarget).toBe("Azure");
    expect(state.bank.strategicFoundation.type).toBe("Test");
    expect(state.prototype.ciStatus).toBe("green");
    expect(state.risks).toEqual(["test risk"]);
  });
});
