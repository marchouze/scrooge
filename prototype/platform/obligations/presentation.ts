// platform/obligations/presentation.ts
//
// Read-side PRESENTATION helpers for the bank-obligation register — derived,
// stateless display projections shared by the list view (bank-obligations.html)
// and the drill-down (obligation.html) so both agree. No events, no schema
// change (Principle 1: these are queries over the obligation projection, never
// stored state).
//
// Three concerns:
//   - domainDescription : domain code (A..J + extended/composite) → human label.
//   - deriveRegulator   : URN-prefix-primary, citation-keyword-fallback mapping
//     to the administering regulator (for the Regulator filter).
//   - obligationTitle   : the obligation's short NAME (not its requirement
//     prose), lifted from the formerly-inline derivation in obligation.html.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

/**
 * Canonical domain code → human-readable description. Codes are the `domain`
 * values folded onto `BankObligation` from `ObligationAdopted`. The A..J base
 * set + the extended/composite codes that appear in real register data are
 * sourced verbatim from the section headers in
 * `Regulations/_obligations-register.md`.
 *
 * Composite/sub-domain codes (e.g. `A-SACCR`, `GV-FNP`, `PR-LCR`) that are not
 * listed explicitly fall back to their base-letter description via
 * `domainDescription` so a new sub-domain renders sensibly without a code edit.
 */
export const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  A: "Prudential (capital, liquidity, large exposures, leverage)",
  B: "Financial crime, AML / CFT, sanctions",
  C: "Conduct, FAIS, TCF",
  D: "FAIS Act conduct obligations",
  E: "Cyber and operational resilience",
  F: "Governance, board, corporate; privacy and data protection",
  G: "Accounting and financial reporting",
  H: "Tax",
  I: "Labour and HR",
  J: "Markets, trading, market conduct",
  K: "ECTA, electronic transactions, document execution",
  L: "Whistleblowing, ethics, anti-bribery (cross-cutting)",
  M: "OTC Derivative Provider (FMA / FSCA / Joint Standards)",
  N: "Markets-foundation citation URNs",
  O: "Thin human-layer obligations",
  P: "FAIS Posture A binding",
  Q: "Group-entity Companies Act + PA look-through (consolidated)",
  RM: "Internal-policy citation handles (records management, retention)",
  FX: "FinSurv reporting (cross-border flows, Authorised Dealer)",
};

/**
 * Format one domain code for display: `"code — label"` when the code (or its
 * base letter) is known, else the bare code. Empty / unset codes render `"—"`.
 *
 * Resolution: exact code → base letter before the first `-` (so `A-SACCR`,
 * `PR-LCR` etc. inherit a base description) → bare code.
 */
export function domainDescription(code: string): string {
  const trimmed = (code ?? "").replace(/^Domain\s+/i, "").trim();
  if (!trimmed) return "—";
  const exact = DOMAIN_DESCRIPTIONS[trimmed];
  if (exact) return `${trimmed} — ${exact}`;
  const base = trimmed.split("-")[0] ?? "";
  const baseLabel = DOMAIN_DESCRIPTIONS[base];
  if (baseLabel) return `${trimmed} — ${baseLabel}`;
  return trimmed;
}

/**
 * Parse a register `section` string ("Domain G — Accounting and financial
 * reporting", optionally `##`-prefixed) into a `{ code, description }`. Returns
 * null when the string isn't a "Domain <code> — <label>" header.
 *
 * The authored `section` is the TRUTHFUL domain for an obligation: the event-
 * folded `domain` CODE has drifted from the register sections for many rows
 * (e.g. ORG-AC-* accounting obligations carry code "H" yet are authored under
 * "Domain G — Accounting"), so the section — not the code — is the source for
 * the domain label and the Domain filter.
 */
export function parseSection(section: string): { code: string; description: string } | null {
  const m = (section ?? "")
    .replace(/^#+\s*/, "")
    .trim()
    .match(/^Domain\s+(\S+(?:\s+\S+)*?)\s*[—–-]\s*(.+)$/);
  if (!m) return null;
  const code = (m[1] ?? "").trim();
  const label = (m[2] ?? "").trim();
  if (!code || !label) return null;
  return { code, description: `${code} — ${label}` };
}

/**
 * Resolve the display domain for an obligation. Precedence:
 *   1. authored register `section` (truthful) → its `{ code, description }`.
 *   2. a descriptive (multi-word) event `domain` code — BCBS chapter families
 *      like "Credit Risk" / "Liquidity" are stored descriptively → used as-is.
 *   3. a bare letter/short code → `domainDescription` label map (last-resort;
 *      may be drifted — see `parseSection`).
 */
export function resolveDomain(input: {
  section?: string;
  domainCode?: string;
}): { code: string; description: string } {
  const sec = parseSection(input.section ?? "");
  if (sec) return sec;
  const code = (input.domainCode ?? "").replace(/^Domain\s+/i, "").trim();
  if (!code) return { code: "", description: "—" };
  if (/\s/.test(code)) return { code, description: code };
  return { code, description: domainDescription(code) };
}

/** The administering regulator for an obligation, for the Regulator filter. */
export type Regulator =
  | "SARB Prudential Authority"
  | "PA/FSCA Joint Standard"
  | "FSCA"
  | "FIC"
  | "Information Regulator"
  | "BCBS"
  | "IASB"
  | "SARS"
  | "SARB FinSurv"
  | "CIPC (Companies Act)"
  | "Dept of Employment & Labour"
  | "JSE"
  | "Other / unmapped";

/**
 * Derive the administering regulator from an obligation's `urn` + `citation`.
 *
 * Both fields are scanned together (one lowercased blob) because the two are
 * inconsistently populated across obligation families — BCBS rows, for example,
 * carry the `urn:reg:bcbs:…` handle in `citation` while `urn` holds the graph
 * node id (`OBL-BCBS-CRE20`). The ordered test list mirrors the precedence in
 * `regulatory/graph/serves-backfill-derivation.ts#classifyAdoptedObligation`
 * (FinSurv/SARS/FIC before PA-Banks-Act; Joint Standard before PA/FSCA; company
 * law last). Slug forms (`banks-d7-2020`, `cs-1-2018`, `urn:reg:bcbs:cre:20`)
 * are recognised alongside prose so `[TBD]`-urn tick-flow rows still resolve.
 */
export function deriveRegulator(urn: string, citation: string): Regulator {
  const blob = `${urn ?? ""} ${citation ?? ""}`.toLowerCase();

  // Exchange control — SARB FinSurv.
  if (/currency and exchanges manual|exchange control regulation|finsurv|:excon|excon-/.test(blob))
    return "SARB FinSurv";
  // Tax — SARS.
  if (
    /income tax act|vat act|tax admin|securities transfer tax|\bstt\b|fatca|\bcrs\b|skills development lev|:tax|sars/.test(
      blob,
    )
  )
    return "SARS";
  // AML/CFT — FIC (incl. PA directives issued under the FIC Act).
  if (/fic act|\bfica\b|fic-act|money laundering|pocdatara|\bpcc ?\d|issued under fic/.test(blob))
    return "FIC";
  // PA/FSCA Joint Standards / Joint Notices.
  if (
    /urn:reg:za:js-?\d|\bjs ?\d\/20\d\d|joint standard|joint-standard|joint notice 2\/2024|\bjn ?2\/2024\b/.test(
      blob,
    )
  )
    return "PA/FSCA Joint Standard";
  // Conduct / markets — FSCA.
  if (
    /\bfais\b|general code of conduct|fsca conduct standard|\bcs ?[123]\/2018|cs-[123]-2018|conduct standard [123] of 2018|financial markets act|financial-markets-act|\bfma\b|\bcofi\b|:fsca/.test(
      blob,
    )
  )
    return "FSCA";
  // PA — Banks Act / directives / circulars / guidance / RRB / slug forms.
  if (
    /banks act|banks-act|regulations? relating to banks|\brrb\b|prudential authority|pa directive|pa-directive|guidance note \d+ of \d{4}|\bbanks-[dcg]\w*\d|prudential communication|urn:reg:za:banks/.test(
      blob,
    )
  )
    return "SARB Prudential Authority";
  // Privacy — Information Regulator.
  if (/popia|paia|information regulator/.test(blob)) return "Information Regulator";
  // Accounting — IASB.
  if (/urn:reg:ifrs|urn:reg:iasb|\bifrs\b|\bias \d|\biasb\b/.test(blob)) return "IASB";
  // Basel originals — BCBS.
  if (/urn:reg:bcbs|:bcbs:|\bbcbs\b|\bbasel\b/.test(blob)) return "BCBS";
  // Exchange / SRO rule-sets — JSE.
  if (/\bjse\b/.test(blob)) return "JSE";
  // Labour — Dept of Employment & Labour.
  if (
    /labour relations|\blra\b|\bbcea\b|employment equity|\bee act\b|skills development|occupational health|b-bbee/.test(
      blob,
    )
  )
    return "Dept of Employment & Labour";
  // Company law — CIPC.
  if (/companies act|companies reg|company law|king iv/.test(blob)) return "CIPC (Companies Act)";

  return "Other / unmapped";
}

/**
 * The obligation's short NAME (not its requirement prose). Derivation order
 * lifted from the formerly-inline logic in obligation.html so the list and the
 * drill-down render the same title:
 *   1. tick-flow bank URN (`urn:obligation:bank:...:derivative-exposure-…`) —
 *      humanise the last segment.
 *   2. register citation with an em-dash tail (`… — Use of divisional names`) —
 *      the instrument's own short title.
 *   3. a short citation as-is (≤ 90 chars).
 *   4. the bare id.
 */
export function obligationTitle(o: { urn?: string; citation?: string; id: string }): string {
  const urn = o.urn ?? "";
  const citation = o.citation ?? "";
  if (urn.startsWith("urn:obligation:bank:")) {
    const seg = urn.split(":").pop() ?? "";
    if (seg) return seg.replace(/-/g, " ").replace(/^\w/, (ch) => ch.toUpperCase());
  }
  if (citation.includes("—")) {
    const tail = citation.split("—").pop()?.trim();
    if (tail) return tail;
  }
  // A urn-form citation (`urn:reg:bcbs:cre:20`) is a handle, not a readable
  // name — fall through to the id rather than show the urn as the title.
  const isUrnLike = /^urn:/i.test(citation);
  if (!isUrnLike && citation.length > 0 && citation.length <= 90) return citation;
  return o.id;
}
