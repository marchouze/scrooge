// tests/_setup.ts
//
// Test-suite preload. Redirects the singleton event store (and citation
// gate) to a per-process temp DB so test-fixture events do not pollute
// the canonical `.local/event.db` and, more importantly, do not bleed
// across into recon pipelines that read from BANK_EVENT_DB.
//
// Loaded via bunfig.toml `[test]\npreload = "./tests/_setup.ts"`.
//
// This was added 2026-05-10 by Atlas as part of D-CI-GATE-INTEGRITY
// remediation: Vera's overnight-recon handler test was failing in the
// full `bun test` battery because earlier tests (Mira's M1 URN handler,
// Bea's M1 IFRS classification, Senna's M1 trading-stack threat-model)
// inject synthetic CEO-decision events into the event store. Those
// events have no registry entry, so decision-event-recon correctly
// reports drift, and Vera's "live repo passes" assertion fails. The
// recon itself is correct; the issue is that the "live repo" the test
// observes is the test-polluted event store, not the actual repo.
//
// Author: Atlas (Core banking platform architect)

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.BANK_EVENT_DB) {
  const tmpDir = mkdtempSync(join(tmpdir(), "bank-test-eventdb-"));
  process.env.BANK_EVENT_DB = join(tmpDir, "event.db");
}
