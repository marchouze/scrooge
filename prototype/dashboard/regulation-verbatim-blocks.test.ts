// dashboard/regulation-verbatim-blocks.test.ts
//
// Unit tests for the verbatim-block parser. Because the input is regulation
// text (law), the binding property under test is CONTENT FIDELITY: a table is
// detected and rendered as structured cells, but nothing is dropped or
// reordered, and prose that merely contains a stray pipe is never misdetected
// as a broken table.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import { parseVerbatimBlocks } from "./regulation-verbatim-blocks";

describe("parseVerbatimBlocks", () => {
  it("(a) parses a standalone markdown table into one table block", () => {
    const text = [
      "| Claim | 0-1 | 2 |",
      "| --- | --- | --- |",
      "| Sovereigns | 0% | 20% |",
      "| Banks | 20% | 50% |",
    ].join("\n");

    const blocks = parseVerbatimBlocks(text);
    expect(blocks).toHaveLength(1);
    const t = blocks[0];
    expect(t.kind).toBe("table");
    if (t.kind !== "table") throw new Error("expected table");
    expect(t.headers).toEqual(["Claim", "0-1", "2"]);
    expect(t.rows).toEqual([
      ["Sovereigns", "0%", "20%"],
      ["Banks", "20%", "50%"],
    ]);
  });

  it("(b) keeps a table sandwiched between paragraphs in order", () => {
    const text = [
      "Directive 1: the following risk weights apply.",
      "",
      "| Asset | Weight |",
      "| --- | --- |",
      "| Cash | 0% |",
      "",
      "These weights are subject to subregulation (3).",
    ].join("\n");

    const blocks = parseVerbatimBlocks(text);
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "table", "paragraph"]);
    expect(blocks[0]).toMatchObject({
      kind: "paragraph",
      text: "Directive 1: the following risk weights apply.",
    });
    expect(blocks[2]).toMatchObject({
      kind: "paragraph",
      text: "These weights are subject to subregulation (3).",
    });
    const t = blocks[1];
    if (t.kind !== "table") throw new Error("expected table");
    expect(t.headers).toEqual(["Asset", "Weight"]);
    expect(t.rows).toEqual([["Cash", "0%"]]);
  });

  it("(c) plain text with no table is preserved across paragraphs (no loss)", () => {
    const text = [
      "(1) A bank shall maintain capital as required.",
      "(2) The minimum is set out in subregulation (1)(a).",
      "",
      "(3) This applies to all banks.",
    ].join("\n");

    const blocks = parseVerbatimBlocks(text);
    expect(blocks.every((b) => b.kind === "paragraph")).toBe(true);
    expect(blocks).toHaveLength(2);
    // Every source line survives somewhere, in order, unmangled.
    const joined = blocks.map((b) => (b.kind === "paragraph" ? b.text : "")).join("\n");
    expect(joined).toContain("(1) A bank shall maintain capital as required.");
    expect(joined).toContain("(2) The minimum is set out in subregulation (1)(a).");
    expect(joined).toContain("(3) This applies to all banks.");
  });

  it("(d) a header without a separator is paragraph text, not a broken table", () => {
    const text = ["| Asset | Weight |", "| Cash is zero weighted here |"].join("\n");
    const blocks = parseVerbatimBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("paragraph");
    // Content is preserved verbatim, pipes and all.
    if (blocks[0].kind !== "paragraph") throw new Error("expected paragraph");
    expect(blocks[0].text).toContain("| Asset | Weight |");
    expect(blocks[0].text).toContain("| Cash is zero weighted here |");
  });

  it("(e) prose pipes that aren't a table are not misdetected", () => {
    const text =
      "A bank shall report assets | liabilities | equity on a quarterly basis without exception.";
    const blocks = parseVerbatimBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("paragraph");
    if (blocks[0].kind !== "paragraph") throw new Error("expected paragraph");
    expect(blocks[0].text).toBe(text);
  });

  it("handles alignment-variant separators (:--- / ---: / :---:)", () => {
    const text = ["| Left | Centre | Right |", "| :--- | :---: | ---: |", "| a | b | c |"].join(
      "\n",
    );
    const blocks = parseVerbatimBlocks(text);
    expect(blocks).toHaveLength(1);
    const t = blocks[0];
    if (t.kind !== "table") throw new Error("expected table");
    expect(t.headers).toEqual(["Left", "Centre", "Right"]);
    expect(t.rows).toEqual([["a", "b", "c"]]);
  });

  it("accepts tables without outer pipes", () => {
    const text = ["Asset | Weight", "--- | ---", "Cash | 0%"].join("\n");
    const blocks = parseVerbatimBlocks(text);
    const t = blocks[0];
    if (t.kind !== "table") throw new Error("expected table");
    expect(t.headers).toEqual(["Asset", "Weight"]);
    expect(t.rows).toEqual([["Cash", "0%"]]);
  });

  it("pads short body rows to header width without dropping cells", () => {
    const text = [
      "| 0-1 | 2 | 3 | 4 to 6 | 7 |",
      "| --- | --- | --- | --- | --- |",
      "| a | b |",
    ].join("\n");
    const blocks = parseVerbatimBlocks(text);
    const t = blocks[0];
    if (t.kind !== "table") throw new Error("expected table");
    expect(t.rows).toEqual([["a", "b", "", "", ""]]);
  });

  it("preserves overflow cells into the last column (no loss on ragged rows)", () => {
    const text = ["| A | B |", "| --- | --- |", "| x | y | z |"].join("\n");
    const blocks = parseVerbatimBlocks(text);
    const t = blocks[0];
    if (t.kind !== "table") throw new Error("expected table");
    expect(t.rows).toEqual([["x", "y | z"]]);
  });

  it("returns no blocks for empty / whitespace text", () => {
    expect(parseVerbatimBlocks("")).toEqual([]);
    expect(parseVerbatimBlocks("   \n  ")).toEqual([]);
  });
});
