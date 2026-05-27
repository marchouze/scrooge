// platform/recon/clients-entityname-uniqueness.ts
//
// Vera recon: clients-entityname-uniqueness — detects duplicate active client
// rows with the same entityName in the KYC clients projection.
//
// A duplicate entityName in the clients register means the same legal entity
// has been onboarded more than once — an AML/CDD integrity violation. This
// gate surfaces the violation and emits a `SubstrateAlert{alertClass:"integrity",
// severity:"high"}` per violating entityName so Vera's recon pipeline and the
// dashboard both surface it.
//
// Mode: blocking (non-zero exit on any violation). Wired into
//       `bun run ci:recon:domain` via `bun run recon:clients-entityname-uniqueness`.
//
// Authority:
//   - D-RECON-CLIENT-ENTITYNAME-UNIQUENESS (CEO-approved 2026-05-27)
//   - AML-CFT-POLICY-V1 (CDD uniqueness obligation)
//   - FIC-ACT-38-2001 §21 (know-your-client)
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { nowUtc } from "@platform/core/types";
import { makeSubstrateAlert } from "@platform/event-store/event-types";
import { EventStore } from "@platform/event-store/store";
import { buildKycClientsView } from "../../dashboard/kyc-clients-view";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "clients-entityname-uniqueness";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");

  const result: ReconResult = emptyResult(PIPELINE);

  if (!existsSync(dbPath)) {
    // No event store — nothing to assert. Return ok.
    return result;
  }

  const store = new EventStore(dbPath);
  const view = buildKycClientsView(store);
  const clients = view.clients;

  // Group active rows by entityName (case-sensitive — legal names are exact).
  const byName = new Map<string, (typeof clients)[number][]>();
  for (const client of clients) {
    const name = client.entityName;
    if (!name) continue;
    let bucket = byName.get(name);
    if (!bucket) {
      bucket = [];
      byName.set(name, bucket);
    }
    bucket.push(client);
  }

  result.asserted = byName.size;

  const violations: ReconViolation[] = [];

  for (const [entityName, rows] of byName) {
    if (rows.length <= 1) continue; // unique — ok

    // Duplicate detected.
    const clientIds = rows.map((r) => r.clientId).join(", ");
    violations.push({
      subject: entityName,
      message: `duplicate entityName "${entityName}" appears ${rows.length} times in the active clients register (clientIds: ${clientIds}). This is an AML/CDD integrity violation — the same legal entity must not be onboarded more than once (authority: D-RECON-CLIENT-ENTITYNAME-UNIQUENESS; AML-CFT-POLICY-V1; FIC-ACT-38-2001 §21).`,
      severity: "fail",
    });

    // Emit a SubstrateAlert per violating entityName so the dashboard and
    // Vera's recon pipeline both surface it.
    const slug = entityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    try {
      store.append(
        makeSubstrateAlert({
          asOf: nowUtc(),
          entity: "clients-register",
          actor: { type: "service", id: "recon:clients-entityname-uniqueness" },
          citations: [
            "D-RECON-CLIENT-ENTITYNAME-UNIQUENESS",
            "AML-CFT-POLICY-V1",
            "FIC-ACT-38-2001",
          ],
          payload: {
            alertId: `alert:integrity:clients-dup-entityname-${slug}`,
            alertClass: "integrity",
            severity: "high",
            details: `Duplicate entityName detected in active clients register: "${entityName}" (${rows.length} rows, clientIds: ${clientIds}). Remediation: investigate ClientAccepted event history and tombstone the duplicate via ClientRejected.`,
          },
        }),
      );
    } catch {
      // Best-effort — if alert emission fails (e.g. read-only store in CI),
      // we still report the violation via the recon result.
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;

  return result;
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");

  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  if (fails.length === 0) {
    console.log(`recon:${PIPELINE} OK — ${result.asserted} entityName(s) checked, 0 duplicates`);
  } else {
    console.error(
      `\nrecon:${PIPELINE} — ${result.asserted} entityName(s) checked, ${fails.length} duplicate(s) found`,
    );
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
