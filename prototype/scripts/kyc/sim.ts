#!/usr/bin/env bun
// scripts/kyc/sim.ts
//
// Simulated KYC client generator CLI.
//
// Usage:
//   bun run kyc:sim --scenario <name> [--count <n>] [--run-full]
//
// Scenarios:
//   clean              → auto-accept (low risk, all checks clean)
//   pep-linked         → EDD (PEP-linked UBO) → human gate
//   sanctions-exact    → auto-reject (sanctions exact hit)
//   sanctions-fuzzy    → human gate (fuzzy sanctions hit)
//   high-risk-jurisdiction → EDD (Nigeria — FATF grey list) → human gate
//   complex-ubo        → human gate (opaque structure)
//   credit-adverse     → human gate (adverse credit; UBO idNumber ends in 9)
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   PROC-FC-01; AML-CFT-POLICY-V1.
//
// Author: Atlas (Core banking platform architect, engineering).

import { KYCOrchestrator, type NewCandidateInput } from "../../platform/kyc/orchestrator";

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

type ScenarioName =
  | "clean"
  | "pep-linked"
  | "sanctions-exact"
  | "sanctions-fuzzy"
  | "high-risk-jurisdiction"
  | "complex-ubo"
  | "credit-adverse";

const SCENARIOS: Record<ScenarioName, () => NewCandidateInput> = {
  /**
   * clean — low risk; all checks clean; auto-accept expected.
   * Entity name: Meridian Capital (Pty) Ltd
   * Reg: 2020-001234 (prefix "2020" → CIPC active in simulate mode)
   * UBO idNumber: "8001015009087" (ends in 7, not 8/9 → credit clean)
   * Nationality: ZA (not on FATF grey list)
   */
  clean: () => ({
    entityName: "Meridian Capital (Pty) Ltd",
    entityType: "company",
    registrationNumber: "2020-001234",
    jurisdiction: "ZA",
    registeredAddress: "100 Main Street, Johannesburg, 2001",
    directors: [
      { name: "SMITH Thomas Andrew", idNumber: "8001015009087", role: "Director" },
    ],
    ubos: [
      {
        name: "SMITH Thomas Andrew",
        idNumber: "8001015009087",
        nationality: "ZA",
        ownershipPct: 100,
        basisOfControl: "direct-ownership",
      },
    ],
    documentHashes: [
      "sha256:abc123clean000000000000000000000000000000000000000000000000000001",
    ],
    submittedBy: "mira@bank.test",
  }),

  /**
   * pep-linked — UBO name starts with "LINKED" → PEP-linked in simulate mode.
   * Triggers EDD + human gate.
   */
  "pep-linked": () => ({
    entityName: "Greenfield Asset Management (Pty) Ltd",
    entityType: "company",
    registrationNumber: "2020-005678",
    jurisdiction: "ZA",
    registeredAddress: "200 Sandton Drive, Sandton, 2196",
    directors: [
      { name: "JONES Peter", idNumber: "7501015028083", role: "Managing Director" },
    ],
    ubos: [
      {
        name: "LINKED Mokoena James",
        idNumber: "7501015028083",
        nationality: "ZA",
        ownershipPct: 60,
        basisOfControl: "direct-ownership",
      },
      {
        name: "JONES Peter",
        idNumber: "7501015028082",
        nationality: "ZA",
        ownershipPct: 40,
        basisOfControl: "direct-ownership",
      },
    ],
    documentHashes: [
      "sha256:abc123peplinked0000000000000000000000000000000000000000000000001",
    ],
    submittedBy: "mira@bank.test",
  }),

  /**
   * sanctions-exact — entity name starts with "SANCTION" → exact hit on all lists.
   * Auto-reject expected.
   */
  "sanctions-exact": () => ({
    entityName: "SANCTION Holdings Ltd",
    entityType: "company",
    registrationNumber: "2020-009900",
    jurisdiction: "ZA",
    registeredAddress: "999 Unknown Road, Cape Town, 8001",
    directors: [
      { name: "UNKNOWN Entity", idNumber: "6001015026081", role: "Director" },
    ],
    ubos: [
      {
        name: "UNKNOWN Entity",
        idNumber: "6001015026081",
        nationality: "ZA",
        ownershipPct: 100,
        basisOfControl: "direct-ownership",
      },
    ],
    documentHashes: [
      "sha256:abc123sanctionexact000000000000000000000000000000000000000000001",
    ],
    submittedBy: "mira@bank.test",
  }),

  /**
   * sanctions-fuzzy — entity name starts with "FUZZY" → fuzzy hit score < 100.
   * Referred for human review.
   */
  "sanctions-fuzzy": () => ({
    entityName: "FUZZY Investments Ltd",
    entityType: "company",
    registrationNumber: "2020-007777",
    jurisdiction: "ZA",
    registeredAddress: "77 Grey Street, Durban, 4001",
    directors: [
      { name: "PATEL Arjun", idNumber: "8201025036081", role: "Director" },
    ],
    ubos: [
      {
        name: "PATEL Arjun",
        idNumber: "8201025036081",
        nationality: "ZA",
        ownershipPct: 100,
        basisOfControl: "direct-ownership",
      },
    ],
    documentHashes: [
      "sha256:abc123sanctionfuzzy000000000000000000000000000000000000000000001",
    ],
    submittedBy: "mira@bank.test",
  }),

  /**
   * high-risk-jurisdiction — UBO nationality: "NG" (Nigeria, FATF grey list).
   * High risk score → EDD initiated → human gate.
   */
  "high-risk-jurisdiction": () => ({
    entityName: "Lagos Capital Partners (Pty) Ltd",
    entityType: "company",
    registrationNumber: "2020-003344",
    jurisdiction: "NG",
    registeredAddress: "10 Victoria Island, Lagos, NG",
    directors: [
      { name: "OKONKWO Chidi Emmanuel", idNumber: "8505155026081", role: "CEO" },
    ],
    ubos: [
      {
        name: "OKONKWO Chidi Emmanuel",
        idNumber: "8505155026081",
        nationality: "NG",
        ownershipPct: 100,
        basisOfControl: "direct-ownership",
      },
    ],
    documentHashes: [
      "sha256:abc123highriskjuris000000000000000000000000000000000000000000001",
    ],
    submittedBy: "mira@bank.test",
  }),

  /**
   * complex-ubo — basisOfControl contains "nominee arrangement" → opaque_structure=true.
   * Flagged UBO resolution → human gate.
   */
  "complex-ubo": () => ({
    entityName: "Bridgewater Structure Holdings",
    entityType: "trust",
    registrationNumber: "2020-IT-0055",
    jurisdiction: "ZA",
    registeredAddress: "1 Trust Avenue, Stellenbosch, 7600",
    directors: [
      { name: "VAN DER BERG Pieter", idNumber: "7801015026081", role: "Trustee" },
    ],
    ubos: [
      {
        name: "VAN DER BERG Pieter",
        idNumber: "7801015026081",
        nationality: "ZA",
        ownershipPct: 51,
        basisOfControl: "nominee arrangement - Trust XYZ (Guernsey)",
      },
      {
        name: "ANONYMOUS BENEFICIARY",
        idNumber: "0000000000001",
        nationality: "ZA",
        ownershipPct: 49,
        basisOfControl: "beneficial interest via offshore trust",
      },
    ],
    documentHashes: [
      "sha256:abc123complexubo000000000000000000000000000000000000000000000001",
    ],
    submittedBy: "mira@bank.test",
  }),

  /**
   * credit-adverse — UBO idNumber ends in "9" → adverse credit in simulate mode.
   * Human gate expected (medium risk or adverse finding).
   */
  "credit-adverse": () => ({
    entityName: "Horizon Trade Finance (Pty) Ltd",
    entityType: "company",
    registrationNumber: "2020-008899",
    jurisdiction: "ZA",
    registeredAddress: "33 Commerce Street, Pretoria, 0002",
    directors: [
      { name: "DLAMINI Sipho Bongani", idNumber: "8101015026089", role: "CEO" },
    ],
    ubos: [
      {
        name: "DLAMINI Sipho Bongani",
        idNumber: "8101015026089", // ends in 9 → adverse credit
        nationality: "ZA",
        ownershipPct: 100,
        basisOfControl: "direct-ownership",
      },
    ],
    documentHashes: [
      "sha256:abc123creditadverse000000000000000000000000000000000000000000001",
    ],
    submittedBy: "mira@bank.test",
  }),
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  scenario: ScenarioName;
  count: number;
  runFull: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let scenario: ScenarioName | undefined;
  let count = 1;
  let runFull = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--scenario" && i + 1 < args.length) {
      scenario = args[++i] as ScenarioName;
    } else if (args[i] === "--count" && i + 1 < args.length) {
      count = parseInt(args[++i], 10);
    } else if (args[i] === "--run-full") {
      runFull = true;
    }
  }

  if (!scenario) {
    const available = Object.keys(SCENARIOS).join(", ");
    console.error(`Error: --scenario is required. Available: ${available}`);
    process.exit(1);
  }

  if (!(scenario in SCENARIOS)) {
    const available = Object.keys(SCENARIOS).join(", ");
    console.error(`Error: unknown scenario "${scenario}". Available: ${available}`);
    process.exit(1);
  }

  if (Number.isNaN(count) || count < 1) {
    console.error("Error: --count must be a positive integer");
    process.exit(1);
  }

  return { scenario, count, runFull };
}

// ---------------------------------------------------------------------------
// Table output
// ---------------------------------------------------------------------------

function printTable(
  rows: Array<{
    candidateId: string;
    entityName: string;
    scenario: string;
    currentStep: string;
    status: string;
    riskBand: string;
  }>,
): void {
  const headers = ["candidateId", "entityName", "scenario", "currentStep", "status", "riskBand"];
  const widths = headers.map((h) => h.length);

  for (const row of rows) {
    widths[0] = Math.max(widths[0]!, row.candidateId.length);
    widths[1] = Math.max(widths[1]!, row.entityName.length);
    widths[2] = Math.max(widths[2]!, row.scenario.length);
    widths[3] = Math.max(widths[3]!, row.currentStep.length);
    widths[4] = Math.max(widths[4]!, row.status.length);
    widths[5] = Math.max(widths[5]!, row.riskBand.length);
  }

  const sep = widths.map((w) => "-".repeat(w)).join("-+-");
  const header = headers.map((h, i) => h.padEnd(widths[i]!)).join(" | ");

  console.log();
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    const cols = [
      row.candidateId,
      row.entityName,
      row.scenario,
      row.currentStep,
      row.status,
      row.riskBand,
    ];
    console.log(cols.map((c, i) => c.padEnd(widths[i]!)).join(" | "));
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { scenario, count, runFull } = parseArgs();
  const scenarioFactory = SCENARIOS[scenario];
  const orchestrator = new KYCOrchestrator();

  console.log(`\nKYC Simulation — scenario: ${scenario}, count: ${count}, runFull: ${runFull}`);
  console.log("─".repeat(70));

  const tableRows: Array<{
    candidateId: string;
    entityName: string;
    scenario: string;
    currentStep: string;
    status: string;
    riskBand: string;
  }> = [];

  for (let i = 0; i < count; i++) {
    const input = scenarioFactory();
    // Unique-ify entity names for multi-count runs.
    if (count > 1) {
      input.entityName = `${input.entityName} #${i + 1}`;
    }

    const { candidateId } = await orchestrator.startOnboarding(input);
    console.log(`\n[${i + 1}/${count}] Registered: ${candidateId} (${input.entityName})`);

    let state = await orchestrator.getCandidateState(candidateId);

    if (runFull) {
      state = await orchestrator.runFull(candidateId);

      if (state.requiresHuman) {
        console.log(
          `  ⚠  Human gate — reason: ${state.humanGateReason ?? "review-required"}`,
        );
        console.log(
          `     To accept: orchestrator.recordHumanDecision('${candidateId}', 'accept', 'mlro@bank.test')`,
        );
      }
    }

    tableRows.push({
      candidateId,
      entityName: input.entityName,
      scenario,
      currentStep: state.currentStep,
      status: state.status,
      riskBand: state.riskBand ?? "-",
    });
  }

  printTable(tableRows);
}

main().catch((err) => {
  console.error("KYC sim error:", err);
  process.exit(1);
});
