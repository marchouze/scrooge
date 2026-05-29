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
// 2026-05-29: redirect made UNCONDITIONAL. The previous guard
// (`if (!process.env.BANK_EVENT_DB)`) only redirected when the env var
// was UNSET — so running `bun test` in a shell that already had
// `BANK_EVENT_DB` pointed at the production store (e.g. left over from
// `bun run dashboard`, which exports
// `BANK_EVENT_DB=$HOME/.local/share/bank/event.db`) let test-fixture
// events (`D-TEST-SESSION-DELEGATION-*` etc.) append straight into
// production. Now the preload always points the singleton at a fresh
// temp DB unless a caller has *explicitly* opted into the ambient store
// via `BANK_TEST_USE_AMBIENT_DB=1`. Tests that need a specific DB set
// `process.env.BANK_EVENT_DB` themselves at runtime (after this preload)
// or pass it to spawned subprocesses, so they are unaffected.
//
// Author: Atlas (Core banking platform architect)

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.env.BANK_TEST_USE_AMBIENT_DB !== "1") {
  const tmpDir = mkdtempSync(join(tmpdir(), "bank-test-eventdb-"));
  process.env.BANK_EVENT_DB = join(tmpDir, "event.db");
}
