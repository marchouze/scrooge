// platform/recon/domain-ownership-coherence.ts
//
// Standing recon gate: domain-ownership-coherence (D-DOMAIN-OWNERSHIP-MAP,
// CEO-approved 2026-06-14).
//
// Enforces agent ownership on TWO axes against the canonical
// Agent⟺Domain⟺Obligation map (platform/regulatory/domain-ownership-map.ts):
//
//   C1  obligation→domain total — every authored obligation classifies to a
//       known normalised sub-domain (no orphan / unset).
//   C2  domain→seat            — every sub-domain's accountable seat is a
//       governance seat that resolves to an ACTIVE roster agent.
//   C3  domain coverage        — every one of the 10 top-level domains has ≥1
//       accountable agent (the "an agent owns each domain" axis).
//   C4  owner alignment        — each obligation's authored `owner` equals its
//       domain's accountable (or co-accountable) seat; drift surfaces as findings.
//
// Source of truth: Regulations/_obligations.seed.json (the authored origin
// folded into ObligationAdopted; the markdown register is a parity-checked
// render). BCBS knowledge-base obligations are owner-stamped at emit time via
// basel-family-seat.ts, which delegates to the same map, so they are aligned by
// construction and need no seed row here.
//
// Mode: ADVISORY to start — `ok: true` regardless, reporting C4 drift + any C1
// orphans so the remediation (Slice 3) can drain them. Flip to blocking
// (`ADVISORY = false`) once C1 and C4 reach zero.
//
// Authority: D-DOMAIN-OWNERSHIP-MAP; P2-SINGLE-GRAPH-DISCIPLINE;
// P6-AUTONOMOUS-BY-DEFAULT.
// Author: Vera (Internal audit / continuous-assurance engineer, governance).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DOMAIN_OWNERSHIP,
  GOVERNANCE_SEATS,
  SEAT_AGENT,
  type Seat,
  classifyObligationDomain,
  ownershipForObligation,
  topLevelDomains,
} from "../regulatory/domain-ownership-map";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "domain-ownership-coherence";

/** Advisory while Slice-3 remediation drains C1 orphans + C4 drift; flip to make blocking. */
const ADVISORY = true;

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

interface SeedRow {
  id: string;
  owner?: string;
  citation?: string;
  requirement?: string;
}

function loadSeed(): SeedRow[] {
  const path = resolve(REPO_ROOT, "Regulations/_obligations.seed.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as SeedRow[];
}

/** Active governance-seat agent names from the roster (for C2). */
function activeRosterAgents(): Set<string> {
  const path = resolve(REPO_ROOT, "Team/_team-roster.json");
  if (!existsSync(path)) return new Set();
  const roster = JSON.parse(readFileSync(path, "utf8")) as {
    personas?: Array<{ name?: string; type?: string }>;
  };
  return new Set(
    (roster.personas ?? [])
      .filter((p) => p.type === "governance" && typeof p.name === "string")
      .map((p) => p.name as string),
  );
}

export interface OwnershipCoherenceSummary {
  total: number;
  classified: number;
  orphans: number;
  drift: number;
  uncoveredTopLevels: number;
  mode: string;
}

export function run(): ReconResult & { summary: OwnershipCoherenceSummary } {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const seed = loadSeed();
  const agents = activeRosterAgents();

  // ── C2: every sub-domain's accountable seat is a governance seat with an
  //        ACTIVE roster agent (static; asserted once). ──────────────────────
  for (const d of DOMAIN_OWNERSHIP) {
    const seats: Seat[] = [d.accountableSeat, ...(d.coAccountableSeats ?? [])];
    for (const s of seats) {
      if (!GOVERNANCE_SEATS.has(s)) {
        violations.push({
          subject: `domain:${d.key}`,
          message: `accountable seat "${s}" is not a known governance seat`,
          severity: "fail",
        });
      } else if (!agents.has(SEAT_AGENT[s].name)) {
        violations.push({
          subject: `domain:${d.key}`,
          message: `seat "${s}" → agent "${SEAT_AGENT[s].name}" is not an active governance persona in the roster`,
          severity: "fail",
        });
      }
    }
  }

  // ── C3: every top-level domain has ≥1 accountable agent. ───────────────────
  let uncoveredTopLevels = 0;
  for (const t of topLevelDomains()) {
    const covered = t.seats.some((s) => GOVERNANCE_SEATS.has(s) && agents.has(SEAT_AGENT[s].name));
    if (!covered) {
      uncoveredTopLevels++;
      violations.push({
        subject: `top-level:${t.topLevel} ${t.label}`,
        message: "no active accountable agent owns this top-level domain",
        severity: "fail",
      });
    }
  }

  // ── C1 + C4: per-obligation classification + owner alignment. ──────────────
  let classified = 0;
  let orphans = 0;
  let drift = 0;
  for (const row of seed) {
    const sub = ownershipForObligation(row);
    if (!sub || classifyObligationDomain(row) === null) {
      orphans++;
      violations.push({
        subject: row.id,
        message: `does not classify to any normalised domain (prefix "${row.id}")`,
        severity: "fail",
      });
      continue;
    }
    classified++;
    const owner = (row.owner ?? "").trim();
    if (!owner) continue; // unset owner is a separate concern (urn/owner backfill)
    const allowed = new Set<string>([sub.accountableSeat, ...(sub.coAccountableSeats ?? [])]);
    if (!allowed.has(owner)) {
      drift++;
      violations.push({
        subject: row.id,
        message: `owner "${owner}" ≠ domain "${sub.key}" accountable seat "${sub.accountableSeat}"${sub.coAccountableSeats ? ` (or co-owner ${sub.coAccountableSeats.join("/")})` : ""}`,
        severity: "warn",
      });
    }
  }

  const summary: OwnershipCoherenceSummary = {
    total: seed.length,
    classified,
    orphans,
    drift,
    uncoveredTopLevels,
    mode: ADVISORY ? "advisory" : "enforcing",
  };

  const hardFail = violations.some((v) => v.severity === "fail");
  return {
    ...result,
    ok: ADVISORY ? true : !hardFail && drift === 0,
    asserted: seed.length + DOMAIN_OWNERSHIP.length + 10,
    violations,
    summary,
  };
}

if (import.meta.main) {
  const result = run();
  const s = result.summary;
  console.log(
    `recon:${PIPELINE} (${s.mode}) — ${s.total} obligation(s): ${s.classified} classified, ${s.orphans} orphan(s); ${s.drift} owner-drift; ${s.uncoveredTopLevels} uncovered top-level domain(s).`,
  );
  for (const v of result.violations.slice(0, 40)) {
    console.error(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  if (result.violations.length > 40) {
    console.error(`  … and ${result.violations.length - 40} more`);
  }
  process.exit(result.ok ? 0 : 1);
}
