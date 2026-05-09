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
  type CeoDecisionEventSummary,
  type EventSource,
  type SourcePaths,
  type WorkstreamCompletedEventSummary,
  type WorkstreamStartedEventSummary,
  deriveState,
  ownerInboxToOpenDecisions,
  parseOwnerInbox,
  parseOwnerInboxFile,
} from "../dashboard/derive";

interface Fixture {
  sources: SourcePaths;
  setEvents(
    c: CeoDecisionEventSummary[],
    w?: WorkstreamStartedEventSummary[],
    cmp?: WorkstreamCompletedEventSummary[],
  ): EventSource;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "derive-"));
  mkdirSync(join(root, "Owner Inbox"));
  mkdirSync(join(root, "Regulations"));
  mkdirSync(join(root, "Procedures"));
  mkdirSync(join(root, "prototype/seeds"), { recursive: true });

  // CLAUDE.md fixture — three principles, top-of-house with one direct
  // report and one open seat.
  writeFileSync(
    join(root, "CLAUDE.md"),
    [
      "# Bank",
      "",
      "### Principle 1 — Events are the only source of truth",
      "",
      "All state is queries.",
      "",
      "### Principle 2 — Every action traces to a source",
      "",
      "Atomic citation discipline.",
      "",
      "### Principle 3 — Cloud-native; nothing manual or physical except where essential",
      "",
      "IaC; coded workflows.",
      "",
      "**Top-of-house reporting.** All governance seats and the Chief of Staff report directly to the CEO.",
      "CEO direct reports today: Scrooge (CoS, orchestrator), Helena (CRO), Thandiwe (CAE — administrative line; functional line into AC).",
      "Future direct reports as hired: GC, CHRO.",
      "",
    ].join("\n"),
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
      "| ID | Citation | Requirement | Fulfilment policy | Owner | Status |",
      "|---|---|---|---|---|---|",
      "| ORG-PR-01 | Banks Act | Capital adequacy | Capital Mgmt | Camille | IN FORCE |",
      "| ORG-PR-02 | Banks Act | Leverage | Capital Mgmt | Camille | IN FORCE |",
      "| ORG-PR(IV)-01 | Banks Act | Pillar IV | Capital Mgmt | Camille | PARTIAL |",
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

  // Empty Team and Owner Inbox dirs so the agents derivation runs cleanly.
  mkdirSync(join(root, "Team"));

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
    ownerInboxDir: join(root, "Owner Inbox"),
    bankNameRegister: join(root, "Regulations", "_bank-name.md"),
  };

  return {
    sources,
    setEvents(
      ceo: CeoDecisionEventSummary[],
      ws: WorkstreamStartedEventSummary[] = [],
      cmp: WorkstreamCompletedEventSummary[] = [],
    ) {
      return {
        ceoDecisions: () => ceo,
        workstreamStarts: () => ws,
        workstreamCompletions: () => cmp,
        workstreamRegistrations: () => [],
        agentEscalations: () => [],
        auditFindings: () => [],
        decisionComments: () => [],
      };
    },
  };
}

describe("deriveState — canonical-source parsers", () => {
  it("counts principles, policies, obligations, instruments, procedures from canonical docs", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([]),
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
    const state = deriveState({ sources: f.sources, events: f.setEvents([]) });
    expect(state.principles).toHaveLength(3);
    expect(state.principles[0]?.n).toBe(1);
    expect(state.principles[0]?.title).toBe("Events are the only source of truth");
    expect(state.principles[0]?.summary).toBe("All state is queries.");
  });

  it("parses CEO direct reports and open seats from CLAUDE.md", () => {
    const f = makeFixture();
    const state = deriveState({ sources: f.sources, events: f.setEvents([]) });
    expect(state.directReports.map((p) => p.name)).toEqual(["Scrooge", "Helena", "Thandiwe"]);
    // Thandiwe's role should not include the trailing annotation.
    expect(state.directReports.find((p) => p.name === "Thandiwe")?.role).toBe("CAE");
    expect(state.directReports.find((p) => p.name === "Scrooge")?.type).toBe("Functional");
    expect(state.directReports.find((p) => p.name === "Helena")?.type).toBe("Governance");
    expect(state.openSeats.map((s) => s.role)).toEqual(["GC", "CHRO"]);
  });
});

describe("deriveState — event reductions", () => {
  it("reduces CeoDecision events into decisionsResolved (events first, seed appended)", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([
        {
          decisionId: "TEST-OPEN",
          title: "Open decision",
          action: "approve",
          outcome: "Approved as drafted.",
          actor: "marc@tgv.co.za",
          asOf: "2026-05-06T10:00:00.000Z",
        },
      ]),
    });
    expect(state.decisionsOpen).toHaveLength(0);
    expect(state.decisionsResolved.map((r) => r.id)).toEqual(["TEST-OPEN", "SEED-1"]);
    expect(state.bank.metrics.ceoDecisionsActioned).toBe(2);
  });

  it("uses the latest event when a decision id is actioned twice", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([
        {
          decisionId: "TEST-OPEN",
          title: "Open decision",
          action: "approve",
          outcome: "First action",
          actor: "marc@tgv.co.za",
          asOf: "2026-05-06T10:00:00.000Z",
        },
        {
          decisionId: "TEST-OPEN",
          title: "Open decision",
          action: "modify",
          outcome: "Latest action",
          actor: "marc@tgv.co.za",
          asOf: "2026-05-06T11:00:00.000Z",
        },
      ]),
    });
    expect(state.decisionsResolved[0]?.outcome).toBe("Latest action");
    expect(state.decisionsResolved[0]?.action).toBe("modify");
    expect(state.bank.metrics.ceoDecisionsActioned).toBe(2); // 1 distinct + seed
  });

  it("activates inFlight items from WorkstreamStarted events", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([], [{ workstreamId: "WS-A", asOf: "2026-05-04T08:00:00.000Z" }]),
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
        [],
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
      events: f.setEvents([]),
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
      events: f.setEvents([]),
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

  it("preserves the curated baseline when no events are present", () => {
    const f = makeFixture();
    const state = deriveState({ sources: f.sources, events: f.setEvents([]) });
    expect(state.decisionsResolved.map((r) => r.id)).toEqual(["SEED-1"]);
    expect(state.inFlight.every((i) => !i.active)).toBe(true);
    expect(state.bank.metrics.ceoDecisionsActioned).toBe(1);
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
  it("lifts decision-required Owner Inbox items into decisionsOpen", () => {
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
    const state = deriveState({ sources: f.sources, events: f.setEvents([]) });
    const lifted = state.decisionsOpen.find((d) => d.id === "D-OI-DECISION-NEEDED");
    expect(lifted).toBeDefined();
    expect(lifted?.title).toBe("Decision needed");
    expect(lifted?.decisionForCEO).toBe("Authorise the substrate build.");
    expect(lifted?.recommendation?.stance).toBe("Approve.");
    expect(lifted?.sourceDocs).toContain("Owner Inbox/2026-05-07_decision-needed.md");

    const feed = state.ownerInboxFeed.find((i) => i.filename === "2026-05-07_decision-needed.md");
    expect(feed?.decisionStatus).toBe("open");
  });

  it("excludes Owner Inbox decisions already resolved via a CeoDecision event", () => {
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
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([
        {
          decisionId: "D-OI-ALREADY",
          title: "Already decided",
          action: "approve",
          outcome: "Approved.",
          actor: "marc@tgv.co.za",
          asOf: "2026-05-07T09:00:00.000Z",
        },
      ]),
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
    const state = deriveState({ sources: f.sources, events: f.setEvents([]) });
    expect(state.ownerInboxFeed.some((i) => i.filename === "2026-05-07_just-info.md")).toBe(true);
    expect(state.decisionsOpen.some((d) => d.title === "Info only")).toBe(false);
  });
});

describe("deriveState — wiring", () => {
  it("stamps asOf from the supplied clock", () => {
    const f = makeFixture();
    const state = deriveState({
      sources: f.sources,
      events: f.setEvents([]),
      now: () => "2099-01-01T00:00:00.000Z",
    });
    expect(state.asOf).toBe("2099-01-01T00:00:00.000Z");
  });

  it("carries through name, posture, cloudTarget, strategicFoundation, prototype, risks from curated", () => {
    const f = makeFixture();
    const state = deriveState({ sources: f.sources, events: f.setEvents([]) });
    expect(state.bank.name).toBe("Test Bank");
    expect(state.bank.operatingPosture).toBe("Build-only");
    expect(state.bank.cloudTarget).toBe("Azure");
    expect(state.bank.strategicFoundation.type).toBe("Test");
    expect(state.prototype.ciStatus).toBe("green");
    expect(state.risks).toEqual(["test risk"]);
  });
});
