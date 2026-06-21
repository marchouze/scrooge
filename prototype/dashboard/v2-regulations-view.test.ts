// dashboard/v2-regulations-view.test.ts
//
// View-level assertion that the RRB detail DTO now carries parsed render
// blocks — specifically that a known table-heavy section ("Regulation 23",
// Credit risk) surfaces at least one `table` block, so the reader renders real
// <table>s instead of raw `| ... |` pipes. Reads the real structured doc + an
// in-memory event store (no graph mutation, no events emitted — pure read-side
// per Principle 1).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import {
  buildV2RegulationDetailView,
  parseRegulators,
  regulatorDisplay,
} from "./v2-regulations-view";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

describe("parseRegulators — canonicalisation + joint splitting", () => {
  it("collapses Prudential Authority aliases to one canonical name", () => {
    expect(parseRegulators("Prudential Authority")).toEqual(["SARB Prudential Authority"]);
    expect(parseRegulators("SARB Prudential Authority")).toEqual(["SARB Prudential Authority"]);
  });

  it("splits joint labels into every constituent regulator", () => {
    expect(parseRegulators("FSCA and Prudential Authority (joint)")).toEqual([
      "SARB Prudential Authority",
      "FSCA",
    ]);
    expect(parseRegulators("SARB PA / FSCA")).toEqual(["SARB Prudential Authority", "FSCA"]);
  });

  it("does not surface the Reserve Bank's concurrence as a regulator", () => {
    const regs = parseRegulators(
      "FSCA and Prudential Authority (joint), with concurrence of the Reserve Bank",
    );
    expect(regs).toEqual(["SARB Prudential Authority", "FSCA"]);
  });

  it("keeps standalone regulators distinct and falls back on unknowns", () => {
    expect(parseRegulators("FSCA")).toEqual(["FSCA"]);
    expect(parseRegulators("Basel Committee on Banking Supervision")).toEqual([
      "Basel Committee on Banking Supervision",
    ]);
    expect(parseRegulators("SARB Financial Surveillance")).toEqual(["SARB Financial Surveillance"]);
    expect(parseRegulators("Some Future Regulator")).toEqual(["Some Future Regulator"]);
  });

  it("renders a joint display label but a bare name for single regulators", () => {
    expect(regulatorDisplay("Prudential Authority")).toBe("SARB Prudential Authority");
    expect(regulatorDisplay("FSCA and Prudential Authority (joint)")).toBe(
      "SARB Prudential Authority & FSCA (joint)",
    );
  });
});

describe("buildV2RegulationDetailView — verbatim blocks", () => {
  it("threads parsed blocks onto sections and surfaces tables for table-heavy RRB regs", () => {
    const store = new EventStore(":memory:");
    const d = buildV2RegulationDetailView(REPO_ROOT, "rrb", store);
    expect(d).not.toBeNull();
    if (!d) return;

    // Every section carries a (possibly empty) blocks array — never undefined.
    for (const ch of d.chapters) {
      for (const s of ch.sections) {
        expect(Array.isArray(s.blocks)).toBe(true);
        // text is retained alongside blocks (client search filter + back-compat).
        expect(typeof s.text).toBe("string");
      }
    }

    const allSections = d.chapters.flatMap((c) => c.sections);
    const reg23 = allSections.find((s) => s.number === "Regulation 23");
    expect(reg23).toBeDefined();
    if (!reg23) return;

    const tables = reg23.blocks.filter((b) => b.kind === "table");
    expect(tables.length).toBeGreaterThan(0);
    // A real table has headers and at least one body row.
    const first = tables[0];
    if (first.kind !== "table") throw new Error("expected table block");
    expect(first.headers.length).toBeGreaterThan(0);
    expect(first.rows.length).toBeGreaterThan(0);

    // At least one other table-heavy reg (38/43/26/28) also surfaces a table.
    const otherTabled = allSections.some(
      (s) => s.number !== "Regulation 23" && s.blocks.some((b) => b.kind === "table"),
    );
    expect(otherTabled).toBe(true);
  });
});
