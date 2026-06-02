// scripts/close-finding.ts
//
// CLI: close an open AuditFinding by emitting a typed AuditFindingClosed event
// (PROC-AUD-FT-01 Step 8 — closure verification and attestation).
//
// Usage:
//   bun run audit:close-finding \
//     --finding-id F-MIRA-20260514-A3B2 \
//     --disposition resolved|superseded|false-positive|acknowledged \
//     --verification recon-rerun|evidence-review|source-removed \
//     --rationale "root cause, the fix, and the evidence it's resolved" \
//     [--closed-by agent:vera] \
//     [--evidence-ref "PR #998 or path/to/file.ts or D-SOME-DECISION"] \
//     [--attestation "CAE attestation text (required for P1/P2)"]
//
// The closure is recorded by marc@tgv.co.za (CEO / principal actor — closure is
// a CEO-directed governance act, so the human-actor append bypasses the agent
// permission gate); `--closed-by` carries the independent-verification
// attribution (defaults to agent:vera).
//
// Authority: PROC-AUD-FT-01; D-AGENT-AUTONOMY-OPERATIONAL.
// Author: Atlas (Core banking platform architect, engineering)

import type {
  AuditFindingDisposition,
  AuditFindingVerificationMethod,
} from "../platform/event-store/event-types/audit";
import { recordAuditFindingClosed } from "../platform/records/helpers";

const DEFAULT_CLOSED_BY = "agent:vera";

function parseArgs(argv: string[]): {
  findingId: string;
  disposition: AuditFindingDisposition;
  verificationMethod: AuditFindingVerificationMethod;
  rationale: string;
  closedBy: string;
  evidenceRef?: string;
  attestation?: string;
} {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--") && i + 1 < argv.length) {
      const key = arg.slice(2);
      args[key] = argv[i + 1] ?? "";
      i++;
    }
  }

  const required = ["finding-id", "disposition", "verification", "rationale"];
  for (const field of required) {
    if (!args[field]) {
      console.error(`Missing required argument: --${field}`);
      console.error(
        'Usage: bun run audit:close-finding --finding-id <id> --disposition resolved|superseded|false-positive|acknowledged --verification recon-rerun|evidence-review|source-removed --rationale "..." [--closed-by agent:vera] [--evidence-ref "..."] [--attestation "..."]',
      );
      process.exit(1);
    }
  }

  const validDispositions: AuditFindingDisposition[] = [
    "resolved",
    "superseded",
    "false-positive",
    "acknowledged",
  ];
  const validVerifications: AuditFindingVerificationMethod[] = [
    "recon-rerun",
    "evidence-review",
    "source-removed",
  ];

  const disposition = args.disposition as AuditFindingDisposition;
  if (!validDispositions.includes(disposition)) {
    console.error(
      `Invalid --disposition "${disposition}". Must be one of: ${validDispositions.join(", ")}`,
    );
    process.exit(1);
  }

  const verificationMethod = args.verification as AuditFindingVerificationMethod;
  if (!validVerifications.includes(verificationMethod)) {
    console.error(
      `Invalid --verification "${verificationMethod}". Must be one of: ${validVerifications.join(", ")}`,
    );
    process.exit(1);
  }

  return {
    findingId: args["finding-id"] as string,
    disposition,
    verificationMethod,
    rationale: args.rationale as string,
    closedBy: args["closed-by"] || DEFAULT_CLOSED_BY,
    ...(args["evidence-ref"] ? { evidenceRef: args["evidence-ref"] } : {}),
    ...(args.attestation ? { attestation: args.attestation } : {}),
  };
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const asOf = new Date().toISOString();

  recordAuditFindingClosed(
    {
      findingId: parsed.findingId,
      disposition: parsed.disposition,
      verificationMethod: parsed.verificationMethod,
      closedBy: parsed.closedBy,
      rationale: parsed.rationale,
      ...(parsed.evidenceRef ? { evidenceRef: parsed.evidenceRef } : {}),
      ...(parsed.attestation ? { thandiweAttestation: parsed.attestation } : {}),
    },
    asOf,
  );

  console.log("\nAuditFindingClosed recorded.");
  console.log(`  Finding ID   : ${parsed.findingId}`);
  console.log(`  Disposition  : ${parsed.disposition}`);
  console.log(`  Verification : ${parsed.verificationMethod}`);
  console.log(`  Closed by    : ${parsed.closedBy}`);
  console.log(`  Rationale    : ${parsed.rationale}`);
  if (parsed.evidenceRef) console.log(`  Evidence ref : ${parsed.evidenceRef}`);
  if (parsed.attestation) console.log(`  Attestation  : ${parsed.attestation}`);
  console.log(`  As-of        : ${asOf}`);
  console.log();
}

main();
