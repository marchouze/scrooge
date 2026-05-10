// tests/xml-render.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 — generic XML render
// layer tests. Asserts well-formedness, escape correctness, attribute
// determinism, structural validation.
//
// Authors: Atlas + Bea + Anya.

import { describe, expect, it } from "bun:test";

import {
  type SarbXmlReportPayload,
  XmlRenderError,
  renderSarbXml,
  validateSarbXmlStructural,
} from "../platform/reporting";

const NS = "https://example.test/ns/v1";
const XSD = "https://example.test/xsd/v1.xsd";

function makePayload(formId: string, body: Record<string, unknown>): SarbXmlReportPayload {
  return {
    formId,
    formVersion: "v0.1-test",
    xsdUri: XSD,
    namespaceUri: NS,
    body: body as SarbXmlReportPayload["body"],
  };
}

describe("xml-render — basic rendering", () => {
  it("emits XML declaration + root with sorted attributes", () => {
    const xml = renderSarbXml(makePayload("TEST", { Hello: "world" }), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    expect(xml.split("\n")[0]).toBe('<?xml version="1.0" encoding="UTF-8"?>');
    // Attributes are sorted alphabetically.
    const rootLine = xml.split("\n")[1] ?? "";
    const attrOrder = rootLine.match(/\s(\w+)=/g)?.map((s) => s.trim().replace("=", ""));
    expect(attrOrder).toEqual([...(attrOrder ?? [])].sort());
    expect(rootLine).toContain(`xmlns="${NS}"`);
    expect(rootLine).toContain('formVersion="v0.1-test"');
    expect(rootLine).toContain('renderedAt="2026-05-10T15:00:00.000Z"');
  });

  it("escapes &, <, > in text content", () => {
    const xml = renderSarbXml(makePayload("TEST", { Note: "a & b < c > d" }), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    expect(xml).toContain("<Note>a &amp; b &lt; c &gt; d</Note>");
  });

  it('escapes & < " \\r \\n \\t in attribute values', () => {
    const xml = renderSarbXml(
      makePayload("TEST", {
        Item: { _attrs: { label: 'a&b<c"d\re\nf\tg' }, _text: "x" },
      }),
      { renderedAt: "2026-05-10T15:00:00.000Z" },
    );
    expect(xml).toContain('label="a&amp;b&lt;c&quot;d&#13;e&#10;f&#9;g"');
  });

  it("repeats element names for arrays of sections", () => {
    const xml = renderSarbXml(
      makePayload("TEST", {
        Items: { Row: [{ Value: "1" }, { Value: "2" }, { Value: "3" }] },
      }),
      { renderedAt: "2026-05-10T15:00:00.000Z" },
    );
    expect((xml.match(/<Row>/g) ?? []).length).toBe(3);
    expect((xml.match(/<\/Row>/g) ?? []).length).toBe(3);
  });

  it("emits self-closing tags for empty sections", () => {
    const xml = renderSarbXml(makePayload("TEST", { Empty: {} }), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    expect(xml).toContain("<Empty />");
  });

  it("renders numbers and booleans as scalar children", () => {
    const xml = renderSarbXml(makePayload("TEST", { Count: 42, Flag: true }), {
      renderedAt: "2026-05-10T15:00:00.000Z",
    });
    expect(xml).toContain("<Count>42</Count>");
    expect(xml).toContain("<Flag>true</Flag>");
  });

  it("rejects invalid element names", () => {
    expect(() =>
      renderSarbXml(makePayload("BAD NAME", { x: "1" }), {
        renderedAt: "2026-05-10T15:00:00.000Z",
      }),
    ).toThrow(XmlRenderError);
    expect(() =>
      renderSarbXml(makePayload("TEST", { "1bad": "x" }), {
        renderedAt: "2026-05-10T15:00:00.000Z",
      }),
    ).toThrow(XmlRenderError);
  });
});

describe("xml-render — determinism", () => {
  it("byte-identical across two renders of the same input", () => {
    const payload = makePayload("TEST", {
      A: { B: "1", C: { D: "2" } },
      E: { Item: [{ V: "x" }, { V: "y" }] },
    });
    const a = renderSarbXml(payload, { renderedAt: "2026-05-10T15:00:00.000Z" });
    const b = renderSarbXml(payload, { renderedAt: "2026-05-10T15:00:00.000Z" });
    expect(a).toBe(b);
  });
});

describe("xml-render — structural validation", () => {
  it("ok when root present + namespace declared + required elements present", () => {
    const payload = makePayload("TEST", { Hello: "world", Goodbye: "moon" });
    const xml = renderSarbXml(payload, { renderedAt: "2026-05-10T15:00:00.000Z" });
    const result = validateSarbXmlStructural({
      xml,
      formId: "TEST",
      namespaceUri: NS,
      requiredElements: ["Hello", "Goodbye"],
    });
    expect(result.ok).toBe(true);
  });

  it("flags missing required element", () => {
    const payload = makePayload("TEST", { Hello: "world" });
    const xml = renderSarbXml(payload, { renderedAt: "2026-05-10T15:00:00.000Z" });
    const result = validateSarbXmlStructural({
      xml,
      formId: "TEST",
      namespaceUri: NS,
      requiredElements: ["Hello", "Missing"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.includes("Missing"))).toBe(true);
    }
  });

  it("flags wrong namespace", () => {
    const payload = makePayload("TEST", { Hello: "world" });
    const xml = renderSarbXml(payload, { renderedAt: "2026-05-10T15:00:00.000Z" });
    const result = validateSarbXmlStructural({
      xml,
      formId: "TEST",
      namespaceUri: "https://wrong/",
      requiredElements: [],
    });
    expect(result.ok).toBe(false);
  });
});
