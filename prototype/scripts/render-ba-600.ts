// scripts/render-ba-600.ts
//
// CLI wrapper for the BA 600 (operational-risk) generator + XML renderer.
//
// Usage:
//   bun run scripts/render-ba-600.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --as-of 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       [--functional-currency ZAR] \
//       [--approach bia|tsa]                          # default bia
//       [--gross-income path/to/gi.json] \
//       [--out-xml path/to/ba-600.xml]
//
// Gross-income JSON shape (free-form fixture for build-phase rehearsal):
//   [
//     { "fiscalYear": "2024", "businessLine": "trading-and-sales", "grossIncomeMinor": 0 },
//     ...
//   ]
//
// If `--gross-income` not supplied, an empty fixture is used. Build-phase
// posture: Hoz Bank has no audited gross income yet (no commencement-of-
// trading); the engine produces `0` capital and surfaces placeholders.
//
// Authors: Bea + Helena + Anya (per script header convention).

import { readFileSync, writeFileSync } from "node:fs";

import {
  type OpRiskGrossIncomeRow,
  ba600ToXmlPayload,
  generateBa600OpRisk,
  renderSarbXml,
} from "../platform/reporting";

interface CliArgs {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly approach: "bia" | "tsa";
  readonly grossIncomePath?: string;
  readonly outXmlPath?: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const entity = get("--entity");
  const asOf = get("--as-of");
  const periodId = get("--period-id");
  if (!entity || !asOf || !periodId) {
    throw new Error(
      "render-ba-600: --entity, --as-of, --period-id are required. See script header for usage.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const approachRaw = get("--approach") ?? "bia";
  if (approachRaw !== "bia" && approachRaw !== "tsa") {
    throw new Error(`render-ba-600: --approach must be 'bia' or 'tsa', got '${approachRaw}'`);
  }
  const grossIncomePath = get("--gross-income");
  const outXmlPath = get("--out-xml");
  return {
    entity,
    asOf,
    periodId,
    functionalCurrency,
    approach: approachRaw,
    ...(grossIncomePath ? { grossIncomePath } : {}),
    ...(outXmlPath ? { outXmlPath } : {}),
  };
}

function loadGrossIncome(path: string | undefined): readonly OpRiskGrossIncomeRow[] {
  if (!path) return [];
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`render-ba-600: --gross-income file at ${path} must be a JSON array`);
  }
  return parsed as readonly OpRiskGrossIncomeRow[];
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const grossIncome = loadGrossIncome(args.grossIncomePath);
  const out = generateBa600OpRisk({
    entity: args.entity,
    asOf: args.asOf,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    grossIncome,
    approach: args.approach,
  });
  const payload = ba600ToXmlPayload(out);
  const xml = renderSarbXml(payload, { renderedAt: new Date().toISOString() });
  if (args.outXmlPath) {
    writeFileSync(args.outXmlPath, xml, "utf8");
  } else {
    process.stdout.write(xml);
    process.stdout.write("\n");
  }
  return 0;
}

const argv = process.argv.slice(2);
process.exit(main(argv));
