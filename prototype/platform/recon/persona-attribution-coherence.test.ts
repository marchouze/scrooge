// platform/recon/persona-attribution-coherence.test.ts
//
// Tests for the persona-attribution-coherence recon pipeline.
// Author: Vera (Internal audit engineer, governance)

import { describe, expect, it } from "bun:test";

import { normalisePosition, run, scrapePairs } from "./persona-attribution-coherence";

const FIXTURE_ROSTER = {
  personas: [
    { name: "Helena", role: "Chief Risk Officer" },
    { name: "Rashida", role: "Chief Information Security Officer" },
    { name: "Senna", role: "Security engineer" },
    { name: "Zara", role: "Chief Compliance Officer" },
    { name: "Owen", role: "Company Secretary" },
    { name: "Thandiwe", role: "Chief Audit Executive" },
    { name: "Vera", role: "Internal audit / continuous-assurance engineer" },
  ],
};

describe("normalisePosition", () => {
  it("normalises canonical full role to lowercase", () => {
    expect(normalisePosition("Chief Risk Officer")).toBe("chief risk officer");
  });

  it("normalises abbreviation to canonical", () => {
    expect(normalisePosition("CRO")).toBe("chief risk officer");
    expect(normalisePosition("CCO")).toBe("chief compliance officer");
    expect(normalisePosition("CISO")).toBe("chief information security officer");
  });

  it("strips ', governance' suffix", () => {
    expect(normalisePosition("Chief Risk Officer, governance")).toBe("chief risk officer");
  });

  it("strips ', engineering' suffix", () => {
    expect(normalisePosition("Security engineer, engineering")).toBe("security engineer");
  });

  it("strips ' (governance)' suffix", () => {
    expect(normalisePosition("Chief Risk Officer (governance)")).toBe("chief risk officer");
  });

  it("strips em-dash trailing descriptors", () => {
    expect(normalisePosition("Chief Risk Officer — daily run")).toBe("chief risk officer");
  });
});

describe("scrapePairs", () => {
  it("extracts a canonical Name (Position) reference", () => {
    const pairs = scrapePairs(
      "Owner: Helena (Chief Risk Officer, governance) is responsible.",
      "test.md",
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.name).toBe("Helena");
    expect(pairs[0]?.position).toBe("Chief Risk Officer, governance");
  });

  it("extracts a bold-name reference", () => {
    const pairs = scrapePairs("**Helena** (Chief Risk Officer) signs off.", "test.md");
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.name).toBe("Helena");
  });

  it("skips prose parens that don't look like a role", () => {
    const pairs = scrapePairs("Rashida said she would (later).", "test.md");
    expect(pairs).toHaveLength(0);
  });

  it("captures the line number", () => {
    const content = "Line 1\nLine 2\nOwen (Company Secretary, governance) sat here.";
    const pairs = scrapePairs(content, "test.md");
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.line).toBe(3);
  });

  it("captures multiple references on a single line", () => {
    const pairs = scrapePairs(
      "Helena (Chief Risk Officer) and Zara (Chief Compliance Officer) jointly.",
      "test.md",
    );
    expect(pairs).toHaveLength(2);
  });
});

describe("recon:persona-attribution-coherence", () => {
  it("passes on a clean fixture", () => {
    const files = new Map<string, string>([
      [
        "Procedures/clean.md",
        "Owner: Helena (Chief Risk Officer, governance) and Owen (Company Secretary, governance).",
      ],
    ]);
    const r = run({ repoRoot: "/tmp/no-such-root", roster: FIXTURE_ROSTER, files });
    expect(r.asserted).toBe(2);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("flags a hard FAIL when name in roster but position drifts", () => {
    const files = new Map<string, string>([
      ["Procedures/drift.md", "Rashida (Chief Compliance Officer, governance) signed off."],
    ]);
    const r = run({ repoRoot: "/tmp/no-such-root", roster: FIXTURE_ROSTER, files });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.message).toContain("Rashida");
    expect(fails[0]?.message).toContain("Chief Information Security Officer");
  });

  it("emits a WARN advisory when name not in roster", () => {
    const files = new Map<string, string>([
      [
        "Procedures/external.md",
        "Coordinated with Bobalina (External Counsel Officer, advisor) today.",
      ],
    ]);
    const r = run({ repoRoot: "/tmp/no-such-root", roster: FIXTURE_ROSTER, files });
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0]?.message).toContain("Bobalina");
    // Advisory does NOT flip ok.
    expect(r.ok).toBe(true);
  });

  it("flags both Senna/CISO and Rashida/CCO drift in the same fixture", () => {
    const files = new Map<string, string>([
      [
        "Procedures/double-drift.md",
        "Senna (CISO, governance) and Rashida (Chief Compliance Officer, governance) co-own.",
      ],
    ]);
    const r = run({ repoRoot: "/tmp/no-such-root", roster: FIXTURE_ROSTER, files });
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(2);
    expect(fails.some((v) => v.message.includes("Senna"))).toBe(true);
    expect(fails.some((v) => v.message.includes("Rashida"))).toBe(true);
  });

  it("tolerates 'governance' / 'engineering' suffix variants", () => {
    const files = new Map<string, string>([
      ["Team/Helena.md", "Helena (Chief Risk Officer) — header\nHelena (CRO, governance) — footer"],
    ]);
    const r = run({ repoRoot: "/tmp/no-such-root", roster: FIXTURE_ROSTER, files });
    expect(r.asserted).toBe(2);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("returns asserted count, fail count, and ok independently", () => {
    const files = new Map<string, string>([
      [
        "Procedures/mixed.md",
        [
          "Helena (Chief Risk Officer) ok",
          "Rashida (Chief Compliance Officer) drift",
          "Bobalina (External Counsel Officer) advisory",
        ].join("\n"),
      ],
    ]);
    const r = run({ repoRoot: "/tmp/no-such-root", roster: FIXTURE_ROSTER, files });
    expect(r.asserted).toBe(3);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(1);
    expect(r.violations.filter((v) => v.severity === "warn")).toHaveLength(1);
    expect(r.ok).toBe(false); // fail-class drives ok
  });
});
