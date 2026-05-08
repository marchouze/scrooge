// tests/recon-cron-map-drift.test.ts
//
// Unit tests for Vera Wave-4 #12 — cron-map drift integrity.
//
// Smoke: pipeline runs against current state and surfaces drift findings
// when present (or passes when not). The smoke test deliberately does
// NOT assert the live state is green — surfacing real drift is the
// operational signal Marc cares about.
//
// Synthetic: synthetic mismatches feed `run({ cronMap, workflowFiles })`
// and assert each drift class is detected.
//
// Author: Vera

import { describe, expect, it } from "bun:test";

import {
  deriveKeyFromFilename,
  extractCronFromWorkflow,
  extractCronMapFromSource,
  run as cronMapDrift,
} from "../platform/recon/cron-map-drift";

const WF_DAILY_VERA = `name: Vera overnight recon

on:
  schedule:
    - cron: "13 2 * * *"
  workflow_dispatch: {}

permissions:
  contents: write
`;

const WF_WEEKLY_ATLAS = `name: Atlas substrate-state

on:
  schedule:
    - cron: "19 6 * * 1"
  workflow_dispatch: {}
`;

const WF_DISPATCH_ONLY_MIRA = `name: Mira citation gate

on:
  workflow_dispatch: {}

permissions:
  contents: write
`;

describe("cron-map drift pipeline (Vera Wave-4 #12)", () => {
  it("smoke: runs against the live repo and returns a structured result", () => {
    const r = cronMapDrift();
    expect(r.pipeline).toBe("cron-map-drift-integrity");
    // Surface drift findings to test output for visibility — drift in the
    // current state IS the operational signal, not a test failure.
    if (!r.ok) {
      console.log(
        `[Vera Wave-4 #12] cron-map drift findings (${r.violations.length}):`,
        r.violations.map((v) => `${v.subject}: ${v.message}`).join("\n  "),
      );
    }
    expect(r.asserted).toBeGreaterThan(0);
  });

  it("ok when cron map and workflows agree", () => {
    const r = cronMapDrift({
      cronMap: {
        "vera:overnight-recon": "13 2 * * *",
        "atlas:substrate-state": "19 6 * * 1",
      },
      workflowFiles: {
        "agent-runtime-vera-overnight-recon.yml": WF_DAILY_VERA,
        "agent-runtime-atlas-substrate-state.yml": WF_WEEKLY_ATLAS,
      },
    });
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("detects cron-map entry with no matching workflow file", () => {
    const r = cronMapDrift({
      cronMap: {
        "phantom:trigger": "0 0 * * *",
      },
      workflowFiles: {},
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "phantom:trigger" &&
          v.message.includes("no matching workflow file"),
      ),
    ).toBe(true);
  });

  it("detects workflow with cron but no cron-map entry", () => {
    const r = cronMapDrift({
      cronMap: {},
      workflowFiles: {
        "agent-runtime-bea-accounting-readiness.yml": `name: Bea
on:
  schedule:
    - cron: "47 5 * * *"
  workflow_dispatch: {}
`,
      },
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "bea:accounting-readiness" &&
          v.message.includes("SCHEDULER_CRON_MAP has no"),
      ),
    ).toBe(true);
  });

  it("detects a cron mismatch between map and workflow", () => {
    const r = cronMapDrift({
      cronMap: {
        "vera:overnight-recon": "13 2 * * *",
      },
      workflowFiles: {
        "agent-runtime-vera-overnight-recon.yml": `name: Vera
on:
  schedule:
    - cron: "30 2 * * *"
`,
      },
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "vera:overnight-recon" &&
          v.message.includes("Cron drift"),
      ),
    ).toBe(true);
  });

  it("treats workflow_dispatch-only workflows as exempt (not a finding)", () => {
    const r = cronMapDrift({
      cronMap: {},
      workflowFiles: {
        "agent-runtime-mira-citation-gate.yml": WF_DISPATCH_ONLY_MIRA,
      },
    });
    expect(r.ok).toBe(true);
    // Asserted at least once for the workflow-direction sweep, but no
    // failures because dispatch-only is exempt.
    expect(r.asserted).toBeGreaterThan(0);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
  });

  it("flags cron-map entry whose workflow is dispatch-only (no schedule.cron)", () => {
    const r = cronMapDrift({
      cronMap: {
        "mira:citation-gate": "0 0 * * *",
      },
      workflowFiles: {
        "agent-runtime-mira-citation-gate.yml": WF_DISPATCH_ONLY_MIRA,
      },
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "mira:citation-gate" &&
          v.message.includes("workflow_dispatch-only"),
      ),
    ).toBe(true);
  });

  it("treats `MON` and `1` (Mon=1) as equivalent crons (parseCron normalisation)", () => {
    const r = cronMapDrift({
      cronMap: {
        "atlas:substrate-state": "19 6 * * 1",
      },
      workflowFiles: {
        "agent-runtime-atlas-substrate-state.yml": `name: Atlas
on:
  schedule:
    - cron: "19 6 * * MON"
`,
      },
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
  });

  it("surfaces a substrate-shape finding when the cron map cannot be located", () => {
    // No cronMap override and a synthetic schedulerPath pointing at a
    // file with no SCHEDULER_CRON_MAP. Use an obviously absent path.
    const r = cronMapDrift({
      schedulerPath: "/nonexistent/path/to/scheduler.ts",
      workflowFiles: {},
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });
});

describe("cron-map drift helpers", () => {
  it("deriveKeyFromFilename — single-token trigger", () => {
    expect(deriveKeyFromFilename("agent-runtime-vera-overnight.yml")).toBe("vera:overnight");
  });

  it("deriveKeyFromFilename — multi-token trigger", () => {
    expect(deriveKeyFromFilename("agent-runtime-mira-citation-gate.yml")).toBe(
      "mira:citation-gate",
    );
    expect(deriveKeyFromFilename("agent-runtime-iris-popia-controls-snapshot.yml")).toBe(
      "iris:popia-controls-snapshot",
    );
  });

  it("deriveKeyFromFilename — rejects non-agent-runtime files", () => {
    expect(deriveKeyFromFilename("ci.yml")).toBeUndefined();
    expect(deriveKeyFromFilename("agent-runtime-only.yml")).toBeUndefined();
    expect(deriveKeyFromFilename("agent-runtime-foo-.yml")).toBeUndefined();
  });

  it("extractCronFromWorkflow — picks up first cron in schedule block", () => {
    expect(extractCronFromWorkflow(WF_DAILY_VERA)).toBe("13 2 * * *");
    expect(extractCronFromWorkflow(WF_WEEKLY_ATLAS)).toBe("19 6 * * 1");
  });

  it("extractCronFromWorkflow — returns undefined for dispatch-only", () => {
    expect(extractCronFromWorkflow(WF_DISPATCH_ONLY_MIRA)).toBeUndefined();
  });

  it("extractCronMapFromSource — extracts a typical map literal", () => {
    const src = `
      export const SCHEDULER_CRON_MAP: Readonly<Record<string, string>> = {
        "vera:overnight-recon": "13 2 * * *",
        "atlas:substrate-state": "19 6 * * 1",
      };
    `;
    const map = extractCronMapFromSource(src);
    expect(map).toEqual({
      "vera:overnight-recon": "13 2 * * *",
      "atlas:substrate-state": "19 6 * * 1",
    });
  });

  it("extractCronMapFromSource — returns undefined when constant absent", () => {
    expect(extractCronMapFromSource("// nothing here")).toBeUndefined();
  });
});
