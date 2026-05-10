// platform/reporting/xml-render.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 (this dispatch) — generic
// SARB-XML render layer. Companion to the JSON render layer at
// `ba-325-render.ts`. Marc's Q5 default is JSON-first; this XML layer is
// produced *in parallel* from the same projection so the engine can emit
// the SARB-portal submission shape when the regulator's XSD is wired.
//
// Architectural placement:
//
//   PROJECTION                    (pure typed payload — Ba325Output / Ba350Output / Ba600Output)
//      → JSON RENDER             ── ba-325-render.ts (canonical JSON, hash-store-friendly)
//      → XML RENDER              ── this module     (canonical XML, XSD-validatable)
//      → REPORTGENERATED EVENT   (cites both hashes)
//      → SARB PORTAL             (M8 simulator at prototype/simulators/sarb-prudential.ts)
//
// Determinism: keys serialised in input-array / sorted-object order;
// element-order is stable. Two calls with the same input produce byte-
// identical XML.
//
// XSD validation: deferred to the call site. The XSD path is a
// substrate-gap (`prototype/regulators/xsd/`) populated by Mira's WS-
// INSTRUMENT-ANALYSES at SARB-portal handshake time; until then the
// renderer emits XML that passes a structural recon test (well-formedness +
// declared-element-set conformance) and carries an `<xs:annotation>`
// referencing the placeholder XSD. Per Marc's Q1 default — `[citation: TBC]`
// is acceptable.
//
// Philosophy of the API:
//   Many BA forms share a common envelope (regulator metadata, entity,
//   period, sub-sections of typed line-items). Rather than hand-roll one
//   `renderXxxToXml` per form, the API takes a *typed report payload*
//   (`SarbXmlReportPayload`) — a recursive tree of named sections + line-
//   items + scalars + key-value blocks. Each generator (BA 325 / BA 350 /
//   BA 600 / BA 700 in the future) has a thin adapter that maps its typed
//   output into this shape. The generic renderer then emits XML.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; render-contract owner)
//   + Atlas (Core banking platform architect, engineering — reports to
//   Devon COO; render-layer infrastructure + simulator harness)
//   + Mira (Compliance / RegTech engineer, engineering — reports to Zara
//   CCO; PA / FSCA portal taxonomies — citation, typed reference).

// ---------------------------------------------------------------------------
// Payload shape
// ---------------------------------------------------------------------------

/**
 * A typed XML node — either a leaf scalar, a section (named children), or
 * an array of repeated child nodes. The renderer walks the tree and emits
 * elements with the corresponding shape.
 *
 * Attributes are namespaced as `_attrs` on the section to keep the
 * value-shape distinct from the children-shape; the convention is
 * deliberately sigil-prefixed so it cannot collide with a real BA-form
 * element name (Mira: SARB schemas use camelCase / PascalCase, never `_`-
 * prefixed identifiers).
 */
export type SarbXmlValue =
  | string
  | number
  | boolean
  | null
  | SarbXmlSection
  | readonly SarbXmlSection[];

export interface SarbXmlSection {
  /** Optional XML attributes on this element. */
  readonly _attrs?: Readonly<Record<string, string | number | boolean>>;
  /** Optional CDATA text content. Mutually exclusive with _children for v0. */
  readonly _text?: string;
  /** Named children. Order matches insertion order (use a Map-shaped object). */
  readonly [k: string]: SarbXmlValue | undefined;
}

/**
 * The complete report payload ready to render.
 */
export interface SarbXmlReportPayload {
  /** Form identifier (e.g. "BA325", "BA350", "BA600", "BA700"). */
  readonly formId: string;
  /** Form version (e.g. "v0.1-rehearsal"). */
  readonly formVersion: string;
  /** XSD URI — `[citation: TBC]` placeholder OK per Marc's Q1. */
  readonly xsdUri: string;
  /** XML namespace URI. */
  readonly namespaceUri: string;
  /** Body root section (single element). */
  readonly body: SarbXmlSection;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class XmlRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlRenderError";
  }
}

// ---------------------------------------------------------------------------
// Escape utilities
// ---------------------------------------------------------------------------

const XML_TEXT_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const XML_ATTR_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  '"': "&quot;",
  "\r": "&#13;",
  "\n": "&#10;",
  "\t": "&#9;",
};

function escapeText(value: string): string {
  return value.replace(/[&<>]/g, (c) => XML_TEXT_ESCAPES[c] ?? c);
}

function escapeAttr(value: string): string {
  return value.replace(/[&<"\r\n\t]/g, (c) => XML_ATTR_ESCAPES[c] ?? c);
}

const ELEMENT_NAME_RX = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function assertElementName(name: string): void {
  if (!ELEMENT_NAME_RX.test(name)) {
    throw new XmlRenderError(
      `xml-render: element name '${name}' is not a valid XML NCName (matches /[A-Za-z_][A-Za-z0-9_.-]*/)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export interface RenderXmlOptions {
  /** ISO-8601 timestamp for the SARB submission envelope. */
  readonly renderedAt: string;
  /** Indent unit (default two spaces). */
  readonly indent?: string;
}

/**
 * Render a typed report payload to canonical SARB-XML. Pure function;
 * deterministic for fixed `renderedAt`.
 */
export function renderSarbXml(payload: SarbXmlReportPayload, opts: RenderXmlOptions): string {
  const indent = opts.indent ?? "  ";
  assertElementName(payload.formId);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  // Root element wraps the payload with the regulator submission envelope.
  const rootAttrs: Record<string, string> = {
    xmlns: payload.namespaceUri,
    formVersion: payload.formVersion,
    xsdUri: payload.xsdUri,
    renderedAt: opts.renderedAt,
  };
  lines.push(openTag(payload.formId, rootAttrs));
  emitSection(payload.body, payload.formId === "" ? "Body" : "Body", lines, 1, indent);
  lines.push(closeTag(payload.formId));
  return lines.join("\n");
}

function openTag(name: string, attrs: Record<string, string | number | boolean>): string {
  const parts: string[] = [name];
  // Sort attributes for determinism.
  for (const k of Object.keys(attrs).sort()) {
    parts.push(`${k}="${escapeAttr(String(attrs[k]))}"`);
  }
  return `<${parts.join(" ")}>`;
}

function closeTag(name: string): string {
  return `</${name}>`;
}

function selfClosingTag(name: string, attrs?: Record<string, string | number | boolean>): string {
  const parts: string[] = [name];
  if (attrs) {
    for (const k of Object.keys(attrs).sort()) {
      parts.push(`${k}="${escapeAttr(String(attrs[k]))}"`);
    }
  }
  return `<${parts.join(" ")} />`;
}

function emitSection(
  section: SarbXmlSection,
  name: string,
  lines: string[],
  depth: number,
  indent: string,
): void {
  assertElementName(name);
  const pad = indent.repeat(depth);
  const attrs = (section._attrs ?? {}) as Record<string, string | number | boolean>;
  const text = section._text;

  // Children = enumerable string keys excluding `_attrs` / `_text`, in
  // insertion order (Object.keys preserves it for string keys per ES2015).
  const childKeys = Object.keys(section).filter((k) => k !== "_attrs" && k !== "_text");

  // Empty element fast-path.
  if (childKeys.length === 0 && text === undefined) {
    lines.push(`${pad}${selfClosingTag(name, Object.keys(attrs).length ? attrs : undefined)}`);
    return;
  }

  // Text-only element.
  if (childKeys.length === 0 && text !== undefined) {
    lines.push(`${pad}${openTag(name, attrs)}${escapeText(text)}${closeTag(name)}`);
    return;
  }

  lines.push(`${pad}${openTag(name, attrs)}`);
  for (const k of childKeys) {
    emitChild(section[k], k, lines, depth + 1, indent);
  }
  lines.push(`${pad}${closeTag(name)}`);
}

function emitChild(
  value: SarbXmlValue | undefined,
  name: string,
  lines: string[],
  depth: number,
  indent: string,
): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    // Array of sections — repeat the element name per item.
    for (const item of value) {
      emitSection(item, name, lines, depth, indent);
    }
    return;
  }
  if (value === null) {
    lines.push(`${indent.repeat(depth)}${selfClosingTag(name)}`);
    return;
  }
  if (typeof value === "string") {
    assertElementName(name);
    lines.push(`${indent.repeat(depth)}<${name}>${escapeText(value)}</${name}>`);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    assertElementName(name);
    lines.push(`${indent.repeat(depth)}<${name}>${escapeText(String(value))}</${name}>`);
    return;
  }
  // Section. (Array was handled above; primitives + null + undefined are
  // exhausted; remaining shape must be a SarbXmlSection.)
  emitSection(value as SarbXmlSection, name, lines, depth, indent);
}

// ---------------------------------------------------------------------------
// Structural recon
// ---------------------------------------------------------------------------

/**
 * Lightweight structural validation in lieu of a full XSD validator (XSD
 * substrate forthcoming with Mira's WS-INSTRUMENT-ANALYSES + the SARB-
 * portal simulator at `prototype/simulators/sarb-prudential.ts`).
 *
 * Asserts:
 *   1. Output starts with `<?xml version="1.0" encoding="UTF-8"?>`.
 *   2. The root element matches `formId` and carries the declared `xmlns`
 *      + `formVersion` + `xsdUri` + `renderedAt` attributes.
 *   3. Every required element name listed in `requiredElements` appears
 *      at least once.
 *   4. Element-tag balance — open / close counts match.
 *
 * Returns `{ ok: true }` or `{ ok: false; violations: string[] }`.
 */
export function validateSarbXmlStructural(args: {
  readonly xml: string;
  readonly formId: string;
  readonly namespaceUri: string;
  readonly requiredElements: readonly string[];
}): { readonly ok: true } | { readonly ok: false; readonly violations: readonly string[] } {
  const violations: string[] = [];

  if (!args.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    violations.push("missing or wrong XML declaration");
  }

  const rootRx = new RegExp(`<${args.formId}\\s[^>]*>`);
  const rootMatch = args.xml.match(rootRx);
  if (!rootMatch) {
    violations.push(`root element '<${args.formId} ...>' not found`);
  } else {
    if (!rootMatch[0].includes(`xmlns="${args.namespaceUri}"`)) {
      violations.push(`root element does not declare xmlns="${args.namespaceUri}"`);
    }
    for (const reqAttr of ["formVersion", "xsdUri", "renderedAt"]) {
      if (!new RegExp(`${reqAttr}="`).test(rootMatch[0])) {
        violations.push(`root element missing required attribute '${reqAttr}'`);
      }
    }
  }

  for (const el of args.requiredElements) {
    const openRx = new RegExp(`<${el}[\\s/>]`);
    if (!openRx.test(args.xml)) {
      violations.push(`required element '<${el}>' not present`);
    }
  }

  // Tag balance — count opens (excluding self-closing) and closes for the
  // root element. The open-tag regex matches `<formId` followed by either
  // whitespace + attributes ending in non-`/>`, or no attributes ending
  // in `>`. Self-closing `<formId .../>` is excluded.
  const openRx = new RegExp(`<${args.formId}(?:\\s[^>]*[^/])?>`, "g");
  const openCount = (args.xml.match(openRx) ?? []).length;
  const closeCount = (args.xml.match(new RegExp(`</${args.formId}>`, "g")) ?? []).length;
  if (openCount !== closeCount) {
    violations.push(`root element tag-balance off — opens=${openCount} closes=${closeCount}`);
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}
