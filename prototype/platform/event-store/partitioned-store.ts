// platform/event-store/partitioned-store.ts
//
// PartitionedEventStore — spans a hot EventStore and zero-or-more cold
// archive SQLite files registered in the hot store's `archive_partitions`
// table. Provides a unified `replay()` that yields events in global
// sequence order (cold first, then hot) and a `verifyArchiveIntegrity()`
// that re-hashes each archive file and compares to the stored SHA-256.
//
// Cold store opens are lazy — an archive DB is only opened when its
// sequence range overlaps the requested replay window. Once opened it is
// cached for the lifetime of the PartitionedEventStore instance.
//
// Authority: D-EVENT-STORE-SCALING-PHASE-5.
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync } from "node:fs";

import { type ArchivePartitionRow, EventStore, type ReplayOpts } from "./store";
import type { Event } from "./types";

export class PartitionedEventStore {
  private readonly coldStores = new Map<string, EventStore>();

  constructor(private readonly hotStore: EventStore) {}

  /**
   * Replay all events in global sequence order. Cold partitions are
   * replayed first (ordered by min_sequence ASC), then the hot store.
   *
   * `opts` is forwarded to each store's own `replay()` call with the
   * appropriate adjustments:
   *   - `fromSequence` is used to skip partitions whose max_sequence
   *     falls below the requested floor (no overlap).
   *   - All other filter dimensions (entity, type, asOf, aggregateId)
   *     are forwarded unchanged.
   *
   * Authority: D-EVENT-STORE-SCALING-PHASE-5.
   */
  *replay(opts?: ReplayOpts): Generator<Event> {
    const from = opts?.fromSequence ?? 1;
    const partitions = this.hotStore.listArchivePartitions();

    for (const partition of partitions) {
      // Skip partitions entirely below the requested floor.
      if (partition.max_sequence < from) continue;

      const coldStore = this.openColdStore(partition);
      // Forward all opts to cold store replay (fromSequence filters in-partition).
      yield* coldStore.replay(opts);
    }

    // Hot store — replay with same opts.
    yield* this.hotStore.replay(opts);
  }

  /**
   * Verify SHA-256 integrity of every archive file listed in
   * `archive_partitions`. Re-hashes the file on disk and compares to
   * the stored hash. Returns one result per partition.
   *
   * Authority: D-EVENT-STORE-SCALING-PHASE-5.
   */
  verifyArchiveIntegrity(): Array<{ partitionId: string; ok: boolean; error?: string }> {
    const partitions = this.hotStore.listArchivePartitions();
    const results: Array<{ partitionId: string; ok: boolean; error?: string }> = [];

    for (const partition of partitions) {
      if (!existsSync(partition.path)) {
        results.push({
          partitionId: partition.partition_id,
          ok: false,
          error: `Archive file not found at path "${partition.path}"`,
        });
        continue;
      }

      try {
        const fileBytes = readFileSync(partition.path);
        const hasher = new Bun.CryptoHasher("sha256");
        hasher.update(fileBytes);
        const actualHash = hasher.digest("hex");

        if (actualHash === partition.sha256_hash) {
          results.push({ partitionId: partition.partition_id, ok: true });
        } else {
          results.push({
            partitionId: partition.partition_id,
            ok: false,
            error: `SHA-256 mismatch: stored=${partition.sha256_hash} actual=${actualHash}`,
          });
        }
      } catch (err) {
        results.push({
          partitionId: partition.partition_id,
          ok: false,
          error: `Error reading archive file: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return results;
  }

  /**
   * Expose the underlying hot store for direct access (e.g. appending
   * new events, checking sequence stats).
   */
  getHotStore(): EventStore {
    return this.hotStore;
  }

  /**
   * Close all open cold stores and the hot store.
   */
  close(): void {
    for (const s of this.coldStores.values()) s.close();
    this.hotStore.close();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private openColdStore(partition: ArchivePartitionRow): EventStore {
    const cached = this.coldStores.get(partition.partition_id);
    if (cached) return cached;
    // READ-ONLY open — load-bearing for hash integrity. A read-write
    // `EventStore` open runs open-time side effects (journal_mode=WAL
    // PRAGMA, DDL migrations, soft-tagger, dispatch-claim backfill) that
    // mutate the archive file's bytes and permanently invalidate the
    // SHA-256 registered in `archive_partitions` (verified empirically
    // 2026-06-11: one replay flipped the journal-mode header byte and
    // broke the stored hash). Cold partitions are immutable by contract;
    // the read-only open skips every side effect so `replay()` never
    // changes a byte. Authority: D-EVENT-STORE-SELECTIVE-ARCHIVE-
    // EXTRACTION; D-EVENT-STORE-SCALING-PHASE-5.
    const store = new EventStore(partition.path, { readonly: true });
    this.coldStores.set(partition.partition_id, store);
    return store;
  }
}
