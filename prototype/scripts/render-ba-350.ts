// scripts/render-ba-350.ts
//
// CLI wrapper for the BA 350 (market-risk) generator + XML renderer.
//
// Usage:
//   bun run scripts/render-ba-350.ts \
//       --entity LE-ZA-HOZ-BANK \
//       --as-of 2026-05-31T23:59:59.999Z \
//       --period-id period:hoz-bank:month:2026-05 \
//       [--functional-currency ZAR] \
//       [--inputs path/to/inputs.json] \
//       [--out-xml path/to/ba-350.xml]
//
// Inputs JSON shape (free-form fixture for build-phase rehearsal):
//   {
//     "irGeneralMaturityLadder": [{band, weightedLongMinor, weightedShortMinor}],
//     "irSpecificRisk": [{issuerLabel, grossPositionMinor, specificRiskWeight}],
//     "equity": [{market, netLongMinusShortMinor, grossLongPlusShortMinor, liquidAndDiversified}],
//     "fxPositions": [{currency, netPositionFunctionalMinor}],
//     "commodity": [{commodity, netPositionMinor, grossPositionMinor}],
//     "irGeneralDisallowancesMinor": <number>          // optional
//   }
//
// If `--inputs` not supplied, a built-in minimal fixture is used (zero
// positions everywhere — exercises the engine + emits a correct
// `0` capital).
//
// This script is rehearsal-grade. The production form (Slice 7) emits a
// `ReportGenerated` event that hashes the rendered bytes into the RMS
// document store.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Helena (Chief Risk Officer, governance —
//   reports to CEO; market-risk methodology — citation) + Anya (Data /
//   analytics engineer, engineering — reports to Devon COO; semantic-
//   layer integration).

import { readFileSync, writeFileSync } from "node:fs";

import {
  type Ba350GeneratorInput,
  ba350ToXmlPayload,
  generateBa350MarketRisk,
  renderSarbXml,
} from "../platform/reporting";

interface CliArgs {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly inputsPath?: string;
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
      "render-ba-350: --entity, --as-of, --period-id are required. See script header for usage.",
    );
  }
  const functionalCurrency = get("--functional-currency") ?? "ZAR";
  const inputsPath = get("--inputs");
  const outXmlPath = get("--out-xml");
  return {
    entity,
    asOf,
    periodId,
    functionalCurrency,
    ...(inputsPath ? { inputsPath } : {}),
    ...(outXmlPath ? { outXmlPath } : {}),
  };
}

const EMPTY_FIXTURE = {
  irGeneralMaturityLadder: [],
  irSpecificRisk: [],
  equity: [],
  fxPositions: [],
  commodity: [],
};

function loadInputs(
  path: string | undefined,
): Omit<Ba350GeneratorInput, "entity" | "asOf" | "periodId" | "functionalCurrency"> {
  if (!path) return EMPTY_FIXTURE;
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  return {
    irGeneralMaturityLadder: parsed.irGeneralMaturityLadder ?? [],
    irSpecificRisk: parsed.irSpecificRisk ?? [],
    equity: parsed.equity ?? [],
    fxPositions: parsed.fxPositions ?? [],
    commodity: parsed.commodity ?? [],
    ...(parsed.irGeneralDisallowancesMinor !== undefined
      ? { irGeneralDisallowancesMinor: parsed.irGeneralDisallowancesMinor }
      : {}),
  };
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const inputs = loadInputs(args.inputsPath);
  const out = generateBa350MarketRisk({
    entity: args.entity,
    asOf: args.asOf,
    periodId: args.periodId,
    functionalCurrency: args.functionalCurrency,
    ...inputs,
  });
  const payload = ba350ToXmlPayload(out);
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
