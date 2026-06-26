// scripts/backfill-agent-memory-from-notes.ts
//
// WS-AGENT-MEMORY seed backfill — SEED the federated agent-memory store from the
// curated note corpus.
//
// ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
//
// Slice 0/1/2 (#1545/#1546) built the federated agent-memory substrate (the
// born-V2 `AgentMemoryCommitted` family + the `agentMemoryRegisterProjection` +
// the `readMyMemory` / `dispatch:recall` read path) but the store carries
// ~zero content. A classification pass curated 214 durable lessons from the
// harness memory corpus, tagged by mandate-domain (`domains[]`, incl `"shared"`
// for the 23 foundational notes). This backfill is the ADOPTION step of the
// approved scope: it seeds those lessons as `AgentMemoryCommitted` events so a
// dispatched seat loads its domain slice (`dispatch:recall --agent Bea` returns
// the accounting lessons; every seat additionally gets the `shared` common-core).
//
// ─── REPLAY-SAFE & APPEND-ONLY (Engineering Charter cmd 9 — the crux) ───────
//
//   - SOURCE is COMMITTED repo data: `seeds/agent-memory/notes.seed.json` (a
//     deterministic, slug-sorted JSON array). The content-addressed document
//     store is gitignored (empty on a clean CI runner), so the BODIES live in
//     the committed seed and `ci:migrate` re-puts them every run — no reliance
//     on out-of-tree state.
//   - IDEMPOTENT on `memoryId` (`memory:<slug>`): a pre-scan of the live store
//     skips any memoryId already present, so a re-run emits ZERO new events and
//     `ci:migrate` replay is byte-stable.
//   - FIXED asOf (`BACKFILL_ASOF`) + FIXED producedByRunId (`BACKFILL_RUN_ID`):
//     no wall-clock, no RNG — re-running produces byte-identical events.
//   - `documentStore.put` is content-addressed and idempotent on bytes (the same
//     body → the same BLAKE3 hash), so re-putting on replay is a no-op.
//
// ─── SHARED-STORE PAIRING (the recall loop — Charter cmd 2 fail-closed) ─────
//
// The memory EVENT (`AgentMemoryCommitted`) and the memory BODY (the doc-store
// blob it cites by `bodyDocumentHash`) MUST land in the SAME store the read path
// reads, or a seeded memory shows "(body UNRESOLVED)" at `dispatch:recall`. The
// read path (`recall.ts` / `readMyMemory` / `WorldStateSnapshot.myMemory`) boots
// the SHARED store (`resolve-event-db-boot` → home-default-enabled resolution:
// `$HOME/.local/share/bank/documents` in the live shared-home topology). This
// backfill therefore boots the SAME shim FIRST (see the import at the top), so:
//
//   - LIVE (shared-home): event → `$HOME/.local/share/bank/event.db`, body →
//     `$HOME/.local/share/bank/documents` — exactly where recall reads. No
//     manual blob copy on a clean rebuild.
//   - CI / local `bun run ci`: `BANK_EVENT_DB` + `BANK_DOCUMENT_STORE` are pinned
//     repo-local (`.local/event.db`, `.local/documents` — see pr-ci.yml), so the
//     env tier dominates the boot resolution and event + body both stay
//     per-worktree, paired, and reproducible (never touching `$HOME`).
//
// Previously this backfill imported NEITHER shim, so the body resolved via the
// `excludeHomeDefault` singleton (`<repo>/prototype/data/documents`) while recall
// read the shared store — the divergence that left seeded bodies UNRESOLVED in
// the live topology. `recon:agent-memory-doc-resolves` now resolves its primary
// store the SAME (read-path) way and FAILS on exactly this split, so a regression
// re-introducing the divergence is caught fail-closed.
//
// ─── PRODUCER FRAMING (the migration instrument) ───────────────────────────
//
// `producedByAgent` is Scrooge (Chief of Staff / Orchestrator) — the migration
// INSTRUMENT that ran the adoption step, resolved via `agentIdForName("Scrooge")`
// (Slice-0 roster-sourced stable agentId). This is deliberate and correct: memory
// is FEDERATED BY THE `domains[]` MANDATE TAG, NOT by the producing agent. The
// read path (`readMyMemory`) filters on `domains[]` intersect (mandate ∪ shared),
// so a memory tagged `accounting` routes to Bea (Financial controller, finance)
// regardless of who produced it. Scrooge as producer records the provenance of
// the seeding act; the domains route the content to its owning seats.
//
// ─── BORN-V2 / RATCHET (D-V1-REMOVAL-PHASE-1) ──────────────────────────────
//
// `AgentMemoryCommitted` is a born-V2 type (`v2Status: "v2-replaced"`). This
// script imports only V2 surfaces (`recordMemoryCommitted` helper, the V2 event
// family, the roster resolver) and emits no `v1-only` type, so the v1-only ratchet
// is unaffected.
//
// ─── CITATIONS (Principle 2, fail-closed) ──────────────────────────────────
//
// Each memory carries its corpus citations VERBATIM (≥1 — free-form: `memory:<slug>`,
// PR numbers, `[[wikilinks]]`, file paths). The only enforcing citation gate
// (`platform/citation/gate.ts`) asserts `citations.length > 0`, NOT a URN format,
// so free-form memory citations pass without weakening any gate. The
// `recordMemoryCommitted` helper requires a non-empty citation array before it
// touches the doc store, and the payload schema enforces `citations.min(1)`.
//
// BOUNDARY: this is a SCRIPT (not under v2-core), so it MAY import platform/. It
// reads a committed seed and calls the canonical `recordMemoryCommitted` helper —
// the SAME write path the close-run `--memory` flag uses.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25 — the seed is the
//   adoption step of approved scope); D-ENGINEERING-INTEGRITY-CHARTER (cmd 9
//   replay-safe & append-only, cmd 2 fail-closed, cmd 4 source-don't-hardcode);
//   WS-AGENT-MEMORY seed backfill; brief:atlas:ws-agent-memory-seed-214-curated-
//   lessons-into-th:2026-06-25. Principle 1 (events canonical; the body is the
//   cited heavy bytes); Principle 2 (every memory ≥1 citation).
// Author: Atlas (Core banking platform architect, engineering).

// MUST be first — boots the shared event + document store env BEFORE
// `platform/composition` and `platform/document-store` resolve at module-load.
// This pairs the memory BODY (doc-store blob) with the memory EVENT in the SAME
// store the read path (`dispatch:recall` / `readMyMemory`) reads, in every
// topology — see the "SHARED-STORE PAIRING" note in the header.
import "../platform/event-store/resolve-event-db-boot";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import { agentIdForName } from "../platform/agent-identity";
import { clock, eventStore } from "../platform/composition";
import { AGENT_MEMORY_COMMITTED } from "../platform/event-store/event-types";
import type { RmsAgentRef } from "../platform/event-store/event-types";
import { recordMemoryCommitted } from "../platform/records";

// ---------------------------------------------------------------------------
// Fixed-instant + fixed-run identity. NO wall-clock, NO RNG — re-run = byte-stable.
// `clock` is imported only to satisfy the same composition-wiring posture as the
// other backfills; the asOf below is a FIXED constant, not `clock.now()`.
// ---------------------------------------------------------------------------

void clock; // composition wiring posture; the seed uses a fixed asOf (replay-safe).

const BACKFILL_ASOF = "2026-06-25T00:00:00.000Z";
const BACKFILL_RUN_ID = "run:backfill:agent-memory-seed:2026-06-25";
const ENTITY = "LE-ZA-HOZ-BANK";

// The migration instrument: Scrooge (Chief of Staff / Orchestrator). Resolved
// fail-closed via the Slice-0 roster resolver (throws on an unknown name).
const PRODUCER_NAME = "Scrooge";
const PRODUCER_POSITION = "Chief of Staff / Orchestrator";

// The seeding act's actor (service principal for this backfill).
const BACKFILL_ACTOR = { type: "service" as const, id: "agent:scrooge:backfill-agent-memory" };

// ---------------------------------------------------------------------------
// Committed seed corpus — the replay-safe source of the bodies.
// ---------------------------------------------------------------------------

const SEED_PATH = resolve(import.meta.dir, "..", "seeds", "agent-memory", "notes.seed.json");

const seedNoteSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
  citations: z.array(z.string().min(1)).min(1),
  body: z.string().min(1),
});
type SeedNote = z.infer<typeof seedNoteSchema>;

const seedFileSchema = z.array(seedNoteSchema);

function loadSeed(): SeedNote[] {
  const raw = readFileSync(SEED_PATH, "utf8");
  const parsed = seedFileSchema.parse(JSON.parse(raw));
  // Defensive: emit in slug order (the seed file is already sorted, but the
  // emission order must be deterministic regardless of file ordering).
  const sorted = [...parsed].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const slugs = new Set<string>();
  for (const n of sorted) {
    if (slugs.has(n.slug)) {
      throw new Error(`duplicate slug in seed corpus: ${n.slug} (memoryIds must be unique)`);
    }
    slugs.add(n.slug);
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Idempotency: the set of memoryIds already committed in the live store.
// ---------------------------------------------------------------------------

function existingMemoryIds(): Set<string> {
  const out = new Set<string>();
  for (const e of eventStore.replay({ type: AGENT_MEMORY_COMMITTED })) {
    const p = e.payload as { memoryId?: string };
    if (p.memoryId) out.add(p.memoryId);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

function main(): void {
  const producer: RmsAgentRef = {
    name: PRODUCER_NAME,
    position: PRODUCER_POSITION,
    // Slice-0 roster-sourced stable agentId; throws fail-closed on an unknown name.
    agentId: agentIdForName(PRODUCER_NAME),
  };

  const notes = loadSeed();
  const already = existingMemoryIds();

  console.log("\n=== WS-AGENT-MEMORY seed backfill — 214 curated lessons ===");
  console.log(`event store  : ${process.env.BANK_EVENT_DB ?? "(home default)"}`);
  console.log(
    `doc store    : ${process.env.BANK_DOCUMENT_STORE ?? "(home default)"} (boot-shim shared resolution)`,
  );
  console.log(`seed         : ${SEED_PATH} (${notes.length} notes)`);
  console.log(`producer     : ${producer.name} (${producer.agentId}) — migration instrument`);
  console.log(`fixed asOf   : ${BACKFILL_ASOF}`);
  console.log(`fixed runId  : ${BACKFILL_RUN_ID}`);

  let committed = 0;
  let skipped = 0;
  let shared = 0;
  let bodiesPut = 0;

  for (const note of notes) {
    const memoryId = `memory:${note.slug}`;
    if (note.domains.includes("shared")) shared += 1;

    if (already.has(memoryId)) {
      skipped += 1;
      continue;
    }

    const result = recordMemoryCommitted(
      {
        memoryId,
        domains: note.domains, // verbatim — already vocab-normalised + "shared" where foundational.
        producedByAgent: producer,
        producedByRunId: BACKFILL_RUN_ID,
        title: note.title,
        body: note.body, // put into the content-addressed doc store → bodyDocumentHash.
        citations: note.citations, // verbatim, ≥1 (P2 fail-closed).
        actor: BACKFILL_ACTOR,
        entity: ENTITY,
      },
      BACKFILL_ASOF,
    );

    already.add(memoryId);
    committed += 1;
    if (result.isNewDocument) bodiesPut += 1;
  }

  console.log("");
  console.log(`committed    : ${committed} new AgentMemoryCommitted head(s)`);
  console.log(`skipped      : ${skipped} (already present — idempotent no-op)`);
  console.log(`shared-tagged: ${shared} of ${notes.length} carry the "shared" common-core tag`);
  console.log(
    `bodies put   : ${bodiesPut} new doc-store blob(s) (content-addressed; re-put is a no-op)`,
  );
  console.log("=== seed backfill complete ===\n");
}

main();
