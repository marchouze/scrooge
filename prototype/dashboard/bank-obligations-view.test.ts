// dashboard/bank-obligations-view.test.ts
//
// Tests for footnote separation on the obligation detail view
// (D-OBLIGATION-FOOTNOTE-REPRESENTATION, CEO-approved 2026-06-08).
// Author: Mira (Compliance / RegTech engineer, engineering)

import { describe, expect, it } from "bun:test";

import { parseFootnotes } from "./bank-obligations-view";

describe("parseFootnotes", () => {
  it("returns the body unchanged and no footnotes when there is no apparatus", () => {
    const { body, footnotes } = parseFootnotes("Banks must hold capital.");
    expect(body).toBe("Banks must hold capital.");
    expect(footnotes).toEqual([]);
  });

  it("separates a single trailing footnote, keeping the inline marker in the body (CRE40.95)", () => {
    const raw =
      "At the portfolio cut-off date, the aggregated value of all exposures to a single obligor shall not exceed 1%25 of the aggregated outstanding exposure value of all exposures in the portfolio. Footnotes 25 In jurisdictions with structurally concentrated corporate loan markets the threshold could be increased to 2%.";
    const { body, footnotes } = parseFootnotes(raw);
    expect(body.endsWith("in the portfolio.")).toBe(true);
    expect(body).toContain("1%25"); // inline superscript marker retained
    expect(body).not.toContain("Footnotes");
    expect(footnotes).toHaveLength(1);
    expect(footnotes[0].marker).toBe("25");
    expect(footnotes[0].text.startsWith("In jurisdictions")).toBe(true);
  });

  it("splits sequential footnotes in one apparatus block without splitting on digits inside footnote bodies (CRE30.20)", () => {
    const raw =
      "Small business loans extended through or guaranteed by an individual are subject to the same exposure threshold. Footnotes 1 Loans that meet the conditions set out in the second footnote to CRE20. 71 of the standardised approach are eligible to be included in the IRB retail residential mortgage sub-class. 2 At national discretion, supervisors may exclude certain loans.";
    const { body, footnotes } = parseFootnotes(raw);
    expect(body).not.toContain("Footnotes");
    expect(footnotes.map((f) => f.marker)).toEqual(["1", "2"]);
    // the "71" inside footnote 1's body must NOT have started a new footnote
    expect(footnotes[0].text).toContain("CRE20. 71");
    expect(footnotes[1].text.startsWith("At national discretion")).toBe(true);
  });

  it("handles interleaved Footnotes blocks without duplicating markers (CRE30.36)", () => {
    const raw =
      "The other risk components are LGD, EAD and M.5 Footnotes 5 As noted in CRE32.44, some supervisors may require banks to calculate M. Under the advanced approach, banks must calculate the effective maturity (M)6 and provide their own estimates. Footnotes 6 At the discretion of the national supervisor, certain domestic exposures may be exempt.";
    const { body, footnotes } = parseFootnotes(raw);
    expect(body).not.toContain("Footnotes");
    // markers 5 and 6, each introduced by its own Footnotes token — no dup 6
    expect(footnotes.map((f) => f.marker)).toEqual(["5", "6"]);
    expect(footnotes[1].text.startsWith("At the discretion")).toBe(true);
  });
});
