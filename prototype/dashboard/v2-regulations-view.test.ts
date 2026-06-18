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
import { buildV2RegulationDetailView } from "./v2-regulations-view";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

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
