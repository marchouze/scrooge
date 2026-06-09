// prototype/scripts/clean-obligations-identity-fields.ts
//
// One-time authored-origin transform (D-OBLIGATIONS-REGISTER-CLEANUP P2/P3):
// rewrite the three identity fields of Regulations/_obligations.seed.json in
// place — URN (minted), domain (A..J), owner (seat vocabulary). The corrected
// seed then flows into events through the single payload-aware
// backfill-obligations.ts pipeline (later-dated ObligationAdopted per changed
// ID). The markdown register is regenerated in lockstep by a separate sync step
// (recon:obligations-seed-parity guards owner/fulfilment-policy parity).
//
// URN minting reuses the SAME extractor the graph seeder uses
// (extractSectionIdsFromCitation + the INSTRUMENT_ID_TO_SLUG / normSectionRef
// recipe from seed-projection.ts), so minted urn:reg:za:<slug>:s<section> URNs
// align with the PROV-<SLUG>-s<section> provision-node IDs. Unparseable
// citations (framework names, multi-instrument "+"-joins, internal RAS lines)
// are left [TBD] and printed in the residual report.
//
// domain is derived from the obligation ID prefix per the A..J review vocabulary
// (obligation-review.ts obligationReviewDomainSchema), consistent with
// deriveDomain(id) in obligation-review-status.ts for every prefix that
// function knows, extended to a complete A..J table for the rest.
//
// owner is normalised to the reviewer-seat vocabulary (cco|cfo|cro|coo|treasurer
// |company-secretary|information-officer|head-of-global-markets|ciso|cae), taking
// the primary (lead) named agent in the existing free-text owner cell and
// mapping it to its governance seat (engineering reports map through reportsTo).
//
// Run with --write to mutate the seed; default is a dry-run report.
//   bun run scripts/clean-obligations-identity-fields.ts          # report only
//   bun run scripts/clean-obligations-identity-fields.ts --write  # mutate seed
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { extractSectionIdsFromCitation } from "../platform/regulatory/obligation-linker";

const SEED_PATH = resolve(import.meta.dir, "../../Regulations/_obligations.seed.json");

interface SeedRow {
  id: string;
  urn?: string;
  citation?: string;
  owner?: string;
  section?: string;
  domain?: string;
  [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// URN minting — same recipe as platform/regulatory/graph/seed-projection.ts.
// ---------------------------------------------------------------------------

/** Maps canonical instrument IDs to the slug used in Provision node IDs. */
const INSTRUMENT_ID_TO_SLUG: Record<string, string> = {
  "BANKS-ACT-94-1990": "banks-act",
  "REGS-RELATING-TO-BANKS": "rrb",
  "REGULATIONS-RELATING-TO-BANKS": "rrb",
  "FAIS-ACT-37-2002": "fais-act",
  "FIC-ACT-38-2001": "fic-act",
  "POPIA-4-2013": "popia",
  "FAIS-GCC": "fais-gcc",
  "JS-2-2024": "js2",
  EXCON: "excon",
  "CS-1-2018": "cs-1-2018",
  "CS-2-2018": "cs-2-2018",
  "CS-3-2018": "cs-3-2018",
  "JS-2-2020": "js-2-2020",
  "JN-2-2024": "jn-2-2024",
};

/** Normalise a section reference: lowercase + dots stripped (seed-projection.ts). */
const normSectionRef = (raw: string) => raw.toLowerCase().replace(/\./g, "");

function isMissingUrn(urn: string | undefined): boolean {
  const u = (urn ?? "").trim();
  return u === "" || u === "[TBD]";
}

/**
 * Mint `urn:reg:za:<slug>:s<section>` from citation prose, aligned with the
 * provision-node ID minted by the graph seeder. Returns null when the citation
 * carries no enumerable instrument+section the shared extractor can parse.
 */
function mintUrn(citation: string): string | null {
  const ids = extractSectionIdsFromCitation(citation);
  if (ids.length === 0) return null;
  const first = ids[0] ?? "";
  const [rawInstr, rawSect] = first.split(":");
  const sectNum = (rawSect ?? "").replace(/^s/i, "");
  if (!rawInstr || !sectNum) return null;
  const slug = INSTRUMENT_ID_TO_SLUG[rawInstr] ?? rawInstr.toLowerCase();
  return `urn:reg:za:${slug}:s${normSectionRef(sectNum)}`;
}

// ---------------------------------------------------------------------------
// Domain — A..J review vocabulary, consistent with deriveDomain(id).
// ---------------------------------------------------------------------------
//
// obligation-review.ts vocabulary: A=Prudential, B=AML/CFT, C=Excon,
// D=Conduct/FAIS, E=Cyber, F=Governance, G=Tax, H=Markets/IFRS(accounting),
// I=HR, J=Markets/exchange-rule. The table below is a complete superset of
// deriveDomain(id) (obligation-review-status.ts) — identical letters for every
// prefix that function maps (PR→A, FC→B, EXCON/FX→C, CY→E, GV→F, MK/JSE→J,
// FAIS→D), extended to A..J for the remaining register prefixes.
const PREFIX_TO_DOMAIN: Record<string, string> = {
  // A — Prudential (capital / liquidity / large-exposure / op-resilience / risk-data / group)
  PR: "A",
  OR: "A",
  BNK: "A",
  GRP: "A",
  RM: "A",
  // B — Financial crime / AML / CFT / sanctions
  FC: "B",
  // C — Exchange control / FX
  EXCON: "C",
  FX: "C",
  // D — Conduct / FAIS / TCF / OTC-derivative-provider conduct standards
  FAIS: "D",
  CD: "D",
  ODP: "D",
  CS1: "D",
  CS2: "D",
  CS3: "D",
  // E — Cyber / operational resilience (cyber)
  CY: "E",
  // F — Governance / legal / privacy / whistleblowing / e-transactions
  GV: "F",
  WB: "F",
  EL: "F",
  "PR(IV)": "F",
  // G — Tax
  TX: "G",
  // H — Markets / IFRS / accounting
  AC: "H",
  // I — HR / employment
  HR: "I",
  // J — Markets / exchange-rule / margin-reporting / joint-standards-markets
  MK: "J",
  JSE: "J",
  JS2: "J",
  JN2: "J",
  FMA: "J",
};

function prefixOf(id: string): string {
  return id.replace(/^ORG-/, "").split("-")[0] ?? "";
}

function deriveCleanDomain(id: string): string {
  return PREFIX_TO_DOMAIN[prefixOf(id)] ?? "Z";
}

// ---------------------------------------------------------------------------
// Owner — normalise to the reviewer-seat vocabulary.
// ---------------------------------------------------------------------------
//
// Reuses the seat tokens carried by ObligationReviewCompleted.reviewerSeat
// (cco|cfo|cro|company-secretary|…). Each named agent maps to its governance
// seat per Team/_team-roster.json (engineering personas map through reportsTo).
// No new seats are invented.
const NAME_TO_SEAT: Record<string, string> = {
  // CFO line (finance / accounting / tax)
  Camille: "cfo",
  Bea: "cfo",
  Yael: "cfo",
  // CRO line (risk)
  Helena: "cro",
  Rohan: "cro",
  Nadia: "cro",
  // CCO line (compliance / RegTech / MLRO)
  Zara: "cco",
  Mira: "cco",
  // Company Secretary
  Owen: "company-secretary",
  // Information Officer
  Iris: "information-officer",
  // COO line (operations / platform / data / customer / legal-ops)
  Devon: "coo",
  Tomas: "coo",
  Sade: "coo",
  Niko: "coo",
  Atlas: "coo",
  Anya: "coo",
  Imani: "coo",
  Linnea: "coo",
  Env: "coo",
  PAX: "coo",
  Nolan: "coo",
  // CISO line (security)
  Senna: "ciso",
  Rashida: "ciso",
  // Treasurer line (funding / liquidity / ALM)
  Eitan: "treasurer",
  Ravi: "treasurer",
  // Head of Global Markets
  Saskia: "head-of-global-markets",
  Kai: "head-of-global-markets",
  // CAE line (audit — third line)
  Thandiwe: "cae",
  Vera: "cae",
  // CEO
  Marc: "ceo",
};

/** Map the lead named agent in a free-text owner cell to its seat token. */
function normaliseOwner(owner: string): string | null {
  const tokens = owner.match(/[A-Z][a-zA-Z]+/g) ?? [];
  for (const t of tokens) {
    const seat = NAME_TO_SEAT[t];
    if (seat) return seat;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  const write = process.argv.includes("--write");
  const raw = readFileSync(SEED_PATH, "utf8");
  const rows = JSON.parse(raw) as SeedRow[];

  let minted = 0;
  const residualTbd: Array<{ id: string; citation: string }> = [];
  let domainSet = 0;
  let ownerNormalised = 0;
  const ownerUnmapped: string[] = [];
  const nonAjDomains = new Set<string>();

  for (const row of rows) {
    // URN
    if (isMissingUrn(row.urn)) {
      const urn = mintUrn(row.citation ?? "");
      if (urn) {
        row.urn = urn;
        minted++;
      } else {
        residualTbd.push({ id: row.id, citation: (row.citation ?? "").slice(0, 90) });
        if (write) row.urn = "[TBD]"; // normalise empty → explicit [TBD]
      }
    }

    // domain (A..J)
    const dom = deriveCleanDomain(row.id);
    if (!/^[A-J]$/.test(dom)) nonAjDomains.add(dom);
    if (row.domain !== dom) {
      row.domain = dom;
      domainSet++;
    }

    // owner (seat vocabulary)
    const seat = normaliseOwner(row.owner ?? "");
    if (seat) {
      if (row.owner !== seat) {
        row.owner = seat;
        ownerNormalised++;
      }
    } else {
      ownerUnmapped.push(`${row.id} :: ${row.owner ?? ""}`);
    }
  }

  // Report.
  console.log("clean-obligations-identity-fields —", write ? "WRITE" : "dry-run");
  console.log(`  rows: ${rows.length}`);
  console.log(`  URN minted: ${minted}; residual [TBD]: ${residualTbd.length}`);
  console.log(`  domain set/changed: ${domainSet}`);
  console.log(`  owner normalised: ${ownerNormalised}; owner unmapped: ${ownerUnmapped.length}`);
  if (nonAjDomains.size > 0) {
    console.log(`  WARNING — non-A..J domains assigned: ${[...nonAjDomains].join(", ")}`);
  }
  if (ownerUnmapped.length > 0) {
    console.log("  --- owner unmapped (need seat mapping) ---");
    for (const u of ownerUnmapped) console.log(`    ${u}`);
  }
  console.log("  --- residual [TBD] URNs (unparseable citations — allowlist these) ---");
  for (const r of residualTbd) console.log(`    ${r.id} :: ${r.citation}`);

  if (write) {
    writeFileSync(SEED_PATH, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
    console.log(`  wrote ${SEED_PATH}`);
  }
  return 0;
}

process.exit(main());
