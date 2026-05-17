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
  displayTitleFor,
  ownerInboxFeedSort,
  ownerInboxKindFromFilename,
  ownerInboxToOpenDecisions,
  parseOwnerInbox,
  parseOwnerInboxFile,
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
    expect(state.bank.metrics.proceduresPopulated).toBe(2);
    expect(state.bank.metrics.proceduresPlanned).toBe(3);
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

describe("Owner Inbox feed — parseOwnerInboxFile", () => {
  it("parses full frontmatter and uses every field", () => {
    const item = parseOwnerInboxFile(
      "2026-05-07_demo.md",
      [
        "---",
        "title: Demo title",
        "author: Atlas",
        "date: 2026-05-07",
        "summary: Demo summary line.",
        "decision-required: true",
        "decision-id: D-DEMO-1",
        "decision-category: near-term",
        "decision-for-ceo: Approve the demo.",
        "decision-recommendation: Approve as drafted.",
        "decision-owner: Atlas (build) · Devon (governance)",
        "---",
        "",
        "# Demo title",
        "",
        "Body content.",
        "",
      ].join("\n"),
    );
    expect(item.filename).toBe("2026-05-07_demo.md");
    expect(item.path).toBe("Owner Inbox/2026-05-07_demo.md");
    expect(item.date).toBe("2026-05-07");
    expect(item.title).toBe("Demo title");
    expect(item.author).toBe("Atlas");
    expect(item.summary).toBe("Demo summary line.");
    expect(item.decisionRequired).toBe(true);
    expect(item.decisionId).toBe("D-DEMO-1");
    expect(item.decisionCategory).toBe("near-term");
    expect(item.decisionForCEO).toBe("Approve the demo.");
    expect(item.decisionRecommendation).toBe("Approve as drafted.");
    expect(item.decisionOwner).toBe("Atlas (build) · Devon (governance)");
  });

  it("falls back to filename + first H1 + Author line when no frontmatter is present", () => {
    const item = parseOwnerInboxFile(
      "2026-05-06_no-frontmatter.md",
      [
        "# Heading from body",
        "",
        "**Author:** Iris (Information Officer)",
        "**Date:** 2026-05-06",
        "",
        "First substantive paragraph that should become the summary.",
        "",
        "Second paragraph after a blank line is ignored.",
      ].join("\n"),
    );
    expect(item.title).toBe("Heading from body");
    expect(item.author).toBe("Iris");
    expect(item.date).toBe("2026-05-06");
    expect(item.summary).toContain("First substantive paragraph");
    expect(item.decisionRequired).toBe(false);
    expect(item.decisionId).toBeUndefined();
  });

  it("auto-generates a decision-id from the filename when decision-required: true and no id given", () => {
    const item = parseOwnerInboxFile(
      "2026-05-07_atlas_runtime-spec.md",
      ["---", "title: T", "decision-required: true", "---", "", "# T"].join("\n"),
    );
    expect(item.decisionRequired).toBe(true);
    expect(item.decisionId).toBe("D-OI-ATLAS-RUNTIME-SPEC");
  });

  it("ignores unknown frontmatter keys (forward-compat)", () => {
    const item = parseOwnerInboxFile(
      "2026-05-07_x.md",
      [
        "---",
        "title: T",
        "future-key: should-not-break-parser",
        "decision-required: false",
        "---",
        "",
        "# T",
      ].join("\n"),
    );
    expect(item.title).toBe("T");
    expect(item.decisionRequired).toBe(false);
  });
});

describe("Owner Inbox feed — kind / displayTitle (presentation)", () => {
  it("classifies ceo-decision-record filenames as 'decision-record'", () => {
    expect(
      ownerInboxKindFromFilename(
        "2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md",
      ),
    ).toBe("decision-record");
  });

  it("classifies ceo-decision-pack filenames as 'decision-pack'", () => {
    expect(
      ownerInboxKindFromFilename("2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md"),
    ).toBe("decision-pack");
  });

  it("treats other filenames as 'deliverable'", () => {
    expect(ownerInboxKindFromFilename("2026-05-10_atlas_event-store-scaling-design.md")).toBe(
      "deliverable",
    );
    expect(ownerInboxKindFromFilename("2026-05-09_zara_tcf-substrate-plan-v0.md")).toBe(
      "deliverable",
    );
  });

  it("collapses verbose ceo-decision-record titles to 'Decision record · D-XXX'", () => {
    const filename = "2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md";
    const verbose =
      "Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-PRODUCT-CONSTRUCTION-SUBSTRATE, 2026-05-10";
    expect(displayTitleFor(verbose, filename, "decision-record")).toBe(
      "Decision record · D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    );
  });

  it("collapses ceo-decision-pack titles to 'Decision pack · D-XXX'", () => {
    const filename = "2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md";
    expect(
      displayTitleFor(
        "CEO decision pack — D-HIRE × 6 (thin-human-layer recruitment, batched)",
        filename,
        "decision-pack",
      ),
    ).toBe("Decision pack · D-HIRE-SIX-SEATS");
  });

  it("returns the original title when no shortening rule applies", () => {
    expect(
      displayTitleFor(
        "Event-store scaling design — snapshots, partitioning, archival, compaction",
        "2026-05-10_atlas_event-store-scaling-design.md",
        "deliverable",
      ),
    ).toBe("Event-store scaling design — snapshots, partitioning, archival, compaction");
  });

  it("populates kind + displayTitle on parseOwnerInboxFile", () => {
    const filename = "2026-05-10_scrooge_ceo-decision-record_d-foo.md";
    const item = parseOwnerInboxFile(
      filename,
      [
        "---",
        "title: Scrooge (CoS) — CEO decision record: D-FOO, 2026-05-10",
        "decision-required: false",
        "---",
        "",
        "# Scrooge (CoS) — CEO decision record: D-FOO, 2026-05-10",
      ].join("\n"),
    );
    expect(item.kind).toBe("decision-record");
    expect(item.displayTitle).toBe("Decision record · D-FOO");
    // Raw title is preserved for audit / graph linkage.
    expect(item.title).toBe("Scrooge (CoS) — CEO decision record: D-FOO, 2026-05-10");
  });

  it("sets group='informational' for non-decision items at parse time", () => {
    const item = parseOwnerInboxFile(
      "2026-05-10_atlas_design-note.md",
      ["---", "title: Design note", "decision-required: false", "---", "", "# Design note"].join(
        "\n",
      ),
    );
    expect(item.group).toBe("informational");
  });

  it("sets group='decision-open' for decision-required items at parse time", () => {
    // `parseOwnerInboxFile` cannot know yet whether the decision is resolved
    // (that needs the CeoDecision event stream); deriveState upgrades to
    // 'decision-resolved' when applicable.
    const item = parseOwnerInboxFile(
      "2026-05-10_zara_decision.md",
      [
        "---",
        "title: Zara decision",
        "decision-required: true",
        "decision-id: D-ZARA-1",
        "---",
        "",
        "# Zara decision",
      ].join("\n"),
    );
    expect(item.group).toBe("decision-open");
  });
});

describe("Owner Inbox feed — ownerInboxFeedSort (grouping)", () => {
  function mkItem(overrides: Partial<ReturnType<typeof parseOwnerInboxFile>>) {
    const base = parseOwnerInboxFile(
      "2026-05-01_x_seed.md",
      ["---", "title: Seed", "decision-required: false", "---", "# Seed"].join("\n"),
    );
    return { ...base, ...overrides };
  }

  it("places open decisions first, informational second, resolved last", () => {
    const items = [
      mkItem({ filename: "a.md", date: "2026-05-01", group: "informational" }),
      mkItem({ filename: "b.md", date: "2026-05-10", group: "decision-resolved" }),
      mkItem({ filename: "c.md", date: "2026-05-05", group: "decision-open" }),
      mkItem({ filename: "d.md", date: "2026-05-08", group: "decision-open" }),
    ];
    const sorted = [...items].sort(ownerInboxFeedSort);
    expect(sorted.map((i) => i.filename)).toEqual([
      "d.md", // open, latest
      "c.md", // open
      "a.md", // informational
      "b.md", // resolved
    ]);
  });

  it("sorts by date desc within a group, with filename desc as a stable tie-break", () => {
    const items = [
      mkItem({ filename: "a.md", date: "2026-05-05", group: "decision-open" }),
      mkItem({ filename: "z.md", date: "2026-05-05", group: "decision-open" }),
      mkItem({ filename: "m.md", date: "2026-05-10", group: "decision-open" }),
    ];
    const sorted = [...items].sort(ownerInboxFeedSort);
    expect(sorted.map((i) => i.filename)).toEqual(["m.md", "z.md", "a.md"]);
  });
});

describe("Owner Inbox feed — ownerInboxToOpenDecisions", () => {
  // The decision-recommendation recon (`platform/recon/decision-recommendation-recon.ts`)
  // reads `OpenDecision.recommendation?.stance`. Earlier this lift wrote the
  // recommendation into a `note: "Recommendation: …"` string, which the
  // recon could not see — every Owner-Inbox-lifted decision warned. The
  // shape now matches what the recon expects.
  function liftItem(decisionRecommendation?: string) {
    const item = parseOwnerInboxFile(
      "2026-05-09_demo.md",
      [
        "---",
        "title: Demo decision",
        "decision-required: true",
        "decision-id: D-DEMO-1",
        ...(decisionRecommendation ? [`decision-recommendation: ${decisionRecommendation}`] : []),
        "---",
        "",
        "# Demo decision",
      ].join("\n"),
    );
    return ownerInboxToOpenDecisions([item], new Set<string>());
  }

  it("lifts decision-recommendation into structured { stance, reasoning }", () => {
    const [open] = liftItem(
      "Approve as drafted. Phase 1 is reversible inside one commit and Phase 2 has named gating.",
    );
    if (!open) throw new Error("unreachable: liftItem returned no open decision");
    expect(open.recommendation).toEqual({
      stance: "Approve as drafted.",
      reasoning: "Phase 1 is reversible inside one commit and Phase 2 has named gating.",
    });
    expect(open.note).toBeUndefined();
  });

  it("uses the whole string as stance when there is no sentence break", () => {
    const [open] = liftItem("Approve as drafted");
    if (!open) throw new Error("unreachable: liftItem returned no open decision");
    expect(open.recommendation).toEqual({ stance: "Approve as drafted", reasoning: "" });
  });

  it("omits recommendation when frontmatter has no decision-recommendation", () => {
    const [open] = liftItem(undefined);
    if (!open) throw new Error("unreachable: liftItem returned no open decision");
    expect(open.recommendation).toBeUndefined();
    expect(open.note).toBeUndefined();
  });

  it("excludes items already resolved via CeoDecision", () => {
    const item = parseOwnerInboxFile(
      "2026-05-09_resolved.md",
      [
        "---",
        "title: Resolved",
        "decision-required: true",
        "decision-id: D-DEMO-RESOLVED",
        "---",
        "",
        "# Resolved",
      ].join("\n"),
    );
    expect(ownerInboxToOpenDecisions([item], new Set(["D-DEMO-RESOLVED"]))).toEqual([]);
  });
});

describe("Owner Inbox feed — parseOwnerInbox (directory scan)", () => {
  it("returns items most-recent-first, skips underscore and dotfiles, caps at limit", () => {
    const f = makeFixture();
    const dir = f.sources.ownerInboxDir;
    writeFileSync(
      join(dir, "2026-05-05_old.md"),
      ["---", "title: Old item", "decision-required: false", "---", "# Old item"].join("\n"),
    );
    writeFileSync(
      join(dir, "2026-05-07_new.md"),
      ["---", "title: New item", "decision-required: false", "---", "# New item"].join("\n"),
    );
    writeFileSync(join(dir, "_hidden.md"), "# Hidden\n");
    writeFileSync(join(dir, ".dotfile.md"), "# Dot\n");
    const items = parseOwnerInbox(dir);
    const titles = items.map((i) => i.title);
    expect(titles[0]).toBe("New item");
    expect(titles).not.toContain("Hidden");
    expect(titles).not.toContain("Dot");
  });

  it("returns [] for a non-existent directory", () => {
    expect(parseOwnerInbox(join(f0().sources.ownerInboxDir, "does-not-exist"))).toEqual([]);
  });
});

function f0() {
  return makeFixture();
}

describe("deriveState — Owner Inbox decision lift", () => {
  it("no longer lifts decision-required Owner Inbox items into decisionsOpen (Slice A: events-only)", () => {
    // D-DECISIONS-FRAMEWORK-REDESIGN Slice A: Owner Inbox markdown is no
    // longer an authoring channel for open decisions. The feed item still
    // renders with `decisionStatus: "open"` for visual continuity until
    // Slice C backfills any historical D-* ids that lived only in markdown.
    const f = makeFixture();
    writeFileSync(
      join(f.sources.ownerInboxDir, "2026-05-07_decision-needed.md"),
      [
        "---",
        "title: Decision needed",
        "author: Atlas",
        "date: 2026-05-07",
        "summary: Authorise the build.",
        "decision-required: true",
        "decision-id: D-OI-DECISION-NEEDED",
        "decision-category: near-term",
        "decision-for-ceo: Authorise the substrate build.",
        "decision-recommendation: Approve.",
        "---",
        "",
        "# Decision needed",
      ].join("\n"),
    );
    const state = deriveState({ sources: f.sources, events: f.setEvents() });
    expect(state.decisionsOpen.find((d) => d.id === "D-OI-DECISION-NEEDED")).toBeUndefined();
    const feed = state.ownerInboxFeed.find((i) => i.filename === "2026-05-07_decision-needed.md");
    expect(feed?.decisionStatus).toBe("open");
  });

  it("marks Owner Inbox decision-required items as resolved when the decisions register says so", () => {
    const f = makeFixture();
    writeFileSync(
      join(f.sources.ownerInboxDir, "2026-05-07_already-decided.md"),
      [
        "---",
        "title: Already decided",
        "decision-required: true",
        "decision-id: D-OI-ALREADY",
        "---",
        "",
        "# Already decided",
      ].join("\n"),
    );
    const register = mockRegister(
      [],
      [mockResolvedRow("D-OI-ALREADY", "Already decided", "2026-05-07T09:00:00.000Z", "Approved.")],
    );
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([], [], register),
    });
    expect(state.decisionsOpen.find((d) => d.id === "D-OI-ALREADY")).toBeUndefined();
    const feed = state.ownerInboxFeed.find((i) => i.filename === "2026-05-07_already-decided.md");
    expect(feed?.decisionStatus).toBe("resolved");
  });

  it("non-decision Owner Inbox files appear in the feed but not in decisionsOpen", () => {
    const f = makeFixture();
    writeFileSync(
      join(f.sources.ownerInboxDir, "2026-05-07_just-info.md"),
      ["---", "title: Info only", "decision-required: false", "---", "", "# Info only"].join("\n"),
    );
    const state = deriveState({ sources: f.sources, events: f.setEvents() });
    expect(state.ownerInboxFeed.some((i) => i.filename === "2026-05-07_just-info.md")).toBe(true);
    expect(state.decisionsOpen.some((d) => d.title === "Info only")).toBe(false);
  });

  it("groups Owner Inbox feed: open first, informational second, resolved last", () => {
    // Three items, three groups, deliberately authored in date order so a
    // pure date-sort would interleave them. The grouping must dominate.
    const f = makeFixture();
    writeFileSync(
      join(f.sources.ownerInboxDir, "2026-05-09_resolved-decision.md"),
      [
        "---",
        "title: Resolved",
        "decision-required: true",
        "decision-id: D-OI-RESOLVED",
        "---",
        "# Resolved",
      ].join("\n"),
    );
    writeFileSync(
      join(f.sources.ownerInboxDir, "2026-05-08_info-deliverable.md"),
      ["---", "title: Info", "decision-required: false", "---", "# Info"].join("\n"),
    );
    writeFileSync(
      join(f.sources.ownerInboxDir, "2026-05-07_open-decision.md"),
      [
        "---",
        "title: Open decision",
        "decision-required: true",
        "decision-id: D-OI-OPEN",
        "---",
        "# Open decision",
      ].join("\n"),
    );
    const register = mockRegister(
      [],
      [mockResolvedRow("D-OI-RESOLVED", "Resolved", "2026-05-09T09:00:00.000Z", "Approved.")],
    );
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([], [], register),
    });
    // The makeFixture seeds an additional informational policy-register note;
    // filter to the three we just authored so the assertion is local.
    const ours = state.ownerInboxFeed.filter((i) =>
      [
        "2026-05-09_resolved-decision.md",
        "2026-05-08_info-deliverable.md",
        "2026-05-07_open-decision.md",
      ].includes(i.filename),
    );
    const groups = ours.map((i) => i.group);
    // Open decisions first, informational second, resolved last —
    // independent of authoring date.
    expect(groups).toEqual(["decision-open", "informational", "decision-resolved"]);
    // Resolved item carries the resolved-decision marker fields too.
    const resolved = state.ownerInboxFeed.find((i) => i.decisionId === "D-OI-RESOLVED");
    expect(resolved?.group).toBe("decision-resolved");
    expect(resolved?.decisionStatus).toBe("resolved");
  });

  it("derives displayTitle for ceo-decision-record items in the feed", () => {
    const f = makeFixture();
    writeFileSync(
      join(f.sources.ownerInboxDir, "2026-05-10_scrooge_ceo-decision-record_d-foo-bar.md"),
      [
        "---",
        "title: Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-FOO-BAR, 2026-05-10",
        "decision-required: false",
        "---",
        "# Scrooge — CEO decision record: D-FOO-BAR",
      ].join("\n"),
    );
    const state = deriveState({ sources: f.sources, events: f.setEvents() });
    const item = state.ownerInboxFeed.find((i) =>
      i.filename.includes("ceo-decision-record_d-foo-bar"),
    );
    expect(item?.kind).toBe("decision-record");
    expect(item?.displayTitle).toBe("Decision record · D-FOO-BAR");
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
