// platform/semantic/registry.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 1 — semantic-layer
// registry implementation.
//
// In-memory append-only-versioned registry of semantic-layer entries.
// Mirrors the substrate pattern used by `@platform/event-store/registry`
// (typed in-memory registry; recon pipelines audit content at boundary).
//
// Why in-memory + append-only: per Principle 1, the registry's
// authoritative form is the *event log* — every published entry will be
// announced via a `MetricRegistered` / `SemanticEntryRegistered` event in
// a downstream slice (mentioned in `Team/Anya.md` §9 — "Approve a new
// metric / semantic-layer term → `MetricRegistered` event"). For Slice 1
// the registry is the typed in-memory form built from the worked-entry
// constants in `entries.ts`; the event family is a Slice-2/3 follow-on
// that will consume this same registry shape as its replay state.
//
// API surface (the minimum that Slice 2 + Slice 3 need to consume):
//
//   register(entry)            — append a new entry (rejects collision on
//                                (id, version); enforces P2 citation
//                                discipline at boundary).
//   resolve(ref)               — look up an entry by id (defaults to the
//                                single in-force version) or by explicit
//                                (id, version) pair.
//   listInForce()              — every entry whose status === "in-force".
//   listAllVersionsOf(id)      — every entry sharing an id, ordered by
//                                version-string lexicographic ascending.
//   citationCoverage()         — recon-pipeline-friendly snapshot.
//
// The registry is intentionally thin: no projection wiring (that's the
// consumer's job), no formula execution (Slice 3 generators carry the
// executable form), no persistence (the event log persists; this is a
// cache).
//
// Author: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)

import type {
  CitationCoverageRow,
  SemanticEntry,
  SemanticEntryId,
  SemanticEntryRef,
} from "./types";

/**
 * Validation error thrown at `register()` boundary when an entry violates
 * a structural invariant. The message is human-readable and names the
 * offending entry; the recon pipeline catches the throw and surfaces it
 * as a violation.
 */
export class SemanticRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemanticRegistryError";
  }
}

/**
 * Append-only-versioned semantic-layer registry. Construct fresh
 * (`new SemanticRegistry()`) or seeded (`SemanticRegistry.from(entries)`).
 * Mutability is intentionally controlled — only `register()` mutates;
 * everything else is a query.
 */
export class SemanticRegistry {
  /** entries keyed by `${id}@${version}` for direct version lookup. */
  private readonly entries = new Map<string, SemanticEntry>();
  /** ordered insertion list (stable iteration order for tests / recons). */
  private readonly insertionOrder: SemanticEntry[] = [];

  /** Build a registry pre-loaded with a fixed entry list. */
  static from(entries: readonly SemanticEntry[]): SemanticRegistry {
    const r = new SemanticRegistry();
    for (const e of entries) r.register(e);
    return r;
  }

  /**
   * Append a new entry. Enforces:
   *   - (id, version) uniqueness — duplicate registration throws.
   *   - At least one citation per Principle 2.
   *   - At least one signer (downstream consumers need an accountable).
   *   - At least one entityScope URN (Principle 5).
   *   - `version` matches the `vN.M` pattern.
   *   - When `status === "in-force"`, no other version of the same id
   *     may also be `in-force` (single in-force version per id at any
   *     time; older versions must be marked `superseded` first).
   *   - When `status === "superseded"`, `supersededBy` MUST be present
   *     and resolve to an existing registered entry; otherwise the
   *     supersession is incoherent.
   */
  register(entry: SemanticEntry): void {
    const key = this.keyFor(entry.id, entry.version);

    if (this.entries.has(key)) {
      throw new SemanticRegistryError(
        `semantic-registry: duplicate (id, version) — '${entry.id}'@${entry.version} already registered`,
      );
    }

    if (!/^v[0-9]+\.[0-9]+$/.test(entry.version)) {
      throw new SemanticRegistryError(
        `semantic-registry: '${entry.id}'@${entry.version} — version must match /^v[0-9]+\\.[0-9]+$/`,
      );
    }

    if (entry.citations.length === 0) {
      throw new SemanticRegistryError(
        `semantic-registry: '${entry.id}'@${entry.version} — at least one citation required (Principle 2)`,
      );
    }

    if (entry.signers.length === 0) {
      throw new SemanticRegistryError(
        `semantic-registry: '${entry.id}'@${entry.version} — at least one signer required`,
      );
    }

    if (entry.entityScope.length === 0) {
      throw new SemanticRegistryError(
        `semantic-registry: '${entry.id}'@${entry.version} — at least one entityScope URN required (Principle 5)`,
      );
    }

    for (const e of entry.entityScope) {
      if (!/^urn:legal-entity:[a-z0-9-]+:[a-z0-9-]+:v[0-9]+$/.test(e)) {
        throw new SemanticRegistryError(
          `semantic-registry: '${entry.id}'@${entry.version} — entityScope URN '${e}' does not match urn:legal-entity:<group>:<entity>:vN form (per Regulations/_legal-entity-tree.md)`,
        );
      }
    }

    if (entry.status === "in-force") {
      const existingInForce = this.insertionOrder.find(
        (e) => e.id === entry.id && e.status === "in-force",
      );
      if (existingInForce) {
        throw new SemanticRegistryError(
          `semantic-registry: '${entry.id}' already has an in-force version (${existingInForce.version}); supersede it before registering '${entry.version}' as in-force`,
        );
      }
    }

    if (entry.status === "superseded") {
      if (!entry.supersededBy) {
        throw new SemanticRegistryError(
          `semantic-registry: '${entry.id}'@${entry.version} — status is 'superseded' but supersededBy is missing`,
        );
      }
      const replacementKey = this.keyFor(entry.supersededBy.id, entry.supersededBy.version);
      if (!this.entries.has(replacementKey)) {
        throw new SemanticRegistryError(
          `semantic-registry: '${entry.id}'@${entry.version} — supersededBy '${entry.supersededBy.id}'@${entry.supersededBy.version} is not a registered entry`,
        );
      }
    }

    this.entries.set(key, entry);
    this.insertionOrder.push(entry);
  }

  /**
   * Resolve an entry by ref. With a bare `{ id }`, returns the single
   * in-force version (throws if none, throws if many — invariant from
   * `register()` should prevent the latter, but the throw is defensive).
   * With `{ id, version }`, returns the named version regardless of
   * status. Returns `undefined` if no matching entry exists.
   */
  resolve(ref: SemanticEntryRef): SemanticEntry | undefined {
    if ("version" in ref) {
      return this.entries.get(this.keyFor(ref.id, ref.version));
    }

    const inForce = this.insertionOrder.filter((e) => e.id === ref.id && e.status === "in-force");
    if (inForce.length === 0) return undefined;
    if (inForce.length > 1) {
      // register()'s in-force invariant should make this unreachable;
      // the throw is defensive, not load-bearing.
      throw new SemanticRegistryError(
        `semantic-registry: '${ref.id}' has ${inForce.length} in-force versions; registry is in an incoherent state`,
      );
    }
    return inForce[0];
  }

  /** Every entry whose status is currently `in-force`, in insertion order. */
  listInForce(): SemanticEntry[] {
    return this.insertionOrder.filter((e) => e.status === "in-force");
  }

  /** Every registered entry, in insertion order. */
  listAll(): SemanticEntry[] {
    return [...this.insertionOrder];
  }

  /** Every version of a given id, ordered by version-string ascending. */
  listAllVersionsOf(id: SemanticEntryId): SemanticEntry[] {
    return this.insertionOrder
      .filter((e) => e.id === id)
      .slice()
      .sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  }

  /**
   * Citation-coverage snapshot for the recon pipeline. Every entry
   * appears once; counts split into resolved (typed citations carrying
   * a real anchor — `regulation`, `policy`, `ifrs`, `statute`) and
   * placeholder (`tbc`). Total count = resolved + placeholder.
   *
   * The recon pipeline (Vera Wave-N follow-on; pack §8.5) will assert
   * placeholder density across the registry against a falling threshold
   * (Q1: 90% TBC allowed at start, ratchet down per quarter).
   */
  citationCoverage(): CitationCoverageRow[] {
    return this.insertionOrder.map((e) => {
      const placeholderCount = e.citations.filter((c) => c.type === "tbc").length;
      const resolvedCount = e.citations.length - placeholderCount;
      return {
        id: e.id,
        version: e.version,
        status: e.status,
        citationCount: e.citations.length,
        resolvedCount,
        placeholderCount,
        citations: [...e.citations],
      };
    });
  }

  /** Number of entries registered. */
  size(): number {
    return this.entries.size;
  }

  private keyFor(id: SemanticEntryId, version: string): string {
    return `${id}@${version}`;
  }
}
