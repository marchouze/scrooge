// scripts/model-registry-list.ts
//
// One-shot CLI: replays the event store and prints the current model
// registry state in a fixed-width table. Empty registry prints a header
// and an explicit "no models" line.
//
// Invocation: `bun run model-registry:list` (npm script in `package.json`).
//
// Per Principle 1: status fields are not stored — the table is a fold
// of `ModelSubmitted` / `ModelTierClassified` /
// `ModelValidationApproved` / `ModelValidationWithheld` /
// `ValidationFindingRaised` / `ValidationFindingClosed` events.
//
// Author: Nadia + Rohan (model-registry skeleton, first slice)

import { eventStore, logger } from "../platform/composition";
import { LocalModelRegistry, type ModelView } from "../platform/model-registry";

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}

function renderRow(v: ModelView): string {
  return [
    pad(v.modelId, 28),
    pad(`T${v.tier}${v.tierClassified ? "" : "*"}`, 4),
    pad(v.latestVersion, 14),
    pad(v.validationStatus, 12),
    pad(`${v.openFindingsCount} (${v.openBlockingFindingsCount} blocking)`, 22),
  ].join("  ");
}

function renderHeader(): string {
  return [
    pad("modelId", 28),
    pad("tier", 4),
    pad("latest version", 14),
    pad("status", 12),
    pad("open findings", 22),
  ].join("  ");
}

async function main(): Promise<number> {
  const registry = new LocalModelRegistry({ eventStore });
  const models = registry.list();
  const eligible = registry.productionEligible();

  const lines: string[] = [];
  lines.push("");
  lines.push("Model registry — folded from event log (P1).");
  lines.push("Tier marked T1*/T2*/T3* = builder-proposed; no Nadia tier classification yet.");
  lines.push("");
  lines.push(renderHeader());
  lines.push("-".repeat(82));

  if (models.length === 0) {
    lines.push("(no models — registry empty)");
  } else {
    for (const v of models) lines.push(renderRow(v));
  }

  lines.push("");
  lines.push(
    `Total models: ${models.length}; production-eligible: ${eligible.length} (approved + non-expired + zero open blocking findings).`,
  );
  lines.push("");

  for (const l of lines) logger.info(l);
  return 0;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
