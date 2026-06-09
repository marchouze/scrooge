// platform/returns/ba400/xml.ts
//
// M3 Slice 5 — BA 300 XML serialiser entry point.
//
// Re-exports the XML adapter and render utilities from the reporting package
// as the canonical BA 300 XML surface. This thin wrapper keeps the
// `returns/ba400/` API self-contained (callers can import from here rather
// than reaching into `reporting/`).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 5.
//
// TODO: validate against SARB XSD once Mira's WS-INSTRUMENT-ANALYSES
// schema ingestion lands (prototype/regulators/xsd/).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; render-contract owner)
//   + Atlas (Core banking platform architect, engineering — reports to
//   Devon COO; render-layer infrastructure).

export {
  BA_300_NAMESPACE,
  BA_300_REQUIRED_ELEMENTS,
  BA_300_XSD_URI,
  ba300ToXmlPayload,
} from "../../reporting/ba-400-xml-adapter";

export {
  type RenderXmlOptions,
  type SarbXmlReportPayload,
  XmlRenderError,
  renderSarbXml,
  validateSarbXmlStructural,
} from "../../reporting/xml-render";

export type { Ba300Output } from "../../reporting/ba-400-op-risk";
