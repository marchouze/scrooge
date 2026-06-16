// platform/event-store/v2-store-tee.ts
//
// Generic V1→v2 store-tee — Wave 2 infrastructure (D-BANK-WIDE-V2-MIGRATION).
//
// ## What this is
//
// A composition-seam wrapper around the V1 `EventStore` that, after a successful
// V1 append, MIRRORS the event into the v2 control-plane store (the W0 general
// host) — but ONLY for event types that opted in via a `tee` declaration on
// their v2 registry row. This generalises the Wave-2 PILOT
// (`scripts/backfill-posture-v2-dual-run.ts`): instead of a bespoke per-domain
// mirror script, every registered tee-enabled type is mirrored automatically.
//
// Onboarding a NEW domain to the rollout is now a REGISTRY EDIT, not a callsite
// edit: add a `tee: {}` (verbatim) or `tee: { codec }` (money-bearing) block to
// the type's `V2_EVENT_TYPE_REGISTRY` row, add a parity gate, run the generic
// backfill once, flip. The live emit sites are untouched.
//
// ## Idempotency / replay-safety
//
//   - The v2 event reuses the V1 event_id. The control-plane store's `append()`
//     is `INSERT OR IGNORE` on `event_id`, so a re-mirror (re-run of the tee, or
//     a re-run of the generic backfill) is a no-op at the storage layer.
//   - The codec is a pure function of the V1 payload, so re-applying it to the
//     same input yields the same output — replay-safe.
//
// ## Failure handling — surfaced, never swallowed (Engineering Charter cmd 6)
//
// DESIGN CHOICE: option (b) — DECOUPLED-WRITE + LOUD-DIVERGENCE.
//
//   The V1 store is authoritative. We mirror to v2 AFTER the V1 append has
//   committed, in a try/catch. A mirror failure does NOT propagate to the V1
//   caller (so a transient v2-store problem can never wedge the live bank's V1
//   write path), but it is NEVER swallowed: the failure emits a
//   `SubstrateAlert{alertClass:"integrity", severity:"high"}` into the V1 store,
//   and the standing `recon:v2-store-tee-coverage` gate independently detects any
//   v1↔v2 count divergence. So a divergence surfaces two ways: a typed alert at
//   the moment it happens, and a recon finding on the next pass.
//
//   WHY NOT option (a) (mirror in the same logical write, failure = hard error):
//   coupling V1 write AVAILABILITY to the v2 store would let a v2-store outage
//   take down the live bank's V1 ingest — exactly the "wedge the bank" failure
//   mode the brief forbids. The Charter's cmd-2 (fail-closed) is satisfied at the
//   level that matters: the AUTHORITATIVE V1 write fails closed on its own
//   errors; the mirror is a derived projection whose divergence is made loud, not
//   a second authority whose failure must abort the primary. The parity gate
//   (`recon:posture-v2-parity`, enforcing) is the hard backstop that a silent
//   divergence cannot survive CI.
//
// ## Overhead
//
//   For a NON-tee-enabled type (the overwhelming majority during rollout) the
//   tee does ONE Map lookup (`isV2TeeEnabled`) and returns — sub-microsecond, no
//   v2-store touch. For a tee-enabled type the tee additionally opens (lazily,
//   once) the v2 control-plane store handle, applies the codec, and runs one
//   `INSERT OR IGNORE`. The store handle is opened lazily on first mirror and
//   cached for the process lifetime, so steady-state overhead per mirrored append
//   is one codec call + one prepared INSERT.
//
// ARCHITECTURE NOTE: this file is v1-side infra. It imports the v2 store +
// registry via the PERMITTED v1→v2 direction (`recon:v2-no-v1-import` forbids
// only the reverse).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:wave-2-infra-generic-v1-v2-store-tee:2026-06-16.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import {
  type ControlPlaneStore,
  type CpEvent,
  defaultControlPlanePath,
  openControlPlaneStore,
} from "../../v2-core/control-plane/store";
import { ANCHOR_TENANT_ID } from "../../v2-core/control-plane/tenant";
import { isV2TeeEnabled, v2TeeCodecFor } from "../../v2-core/registry";
import { makeSubstrateAlert } from "./event-types";
import type { EventStore } from "./store";
import type { Event } from "./types";

// ---------------------------------------------------------------------------
// Lineage tags — identical convention to the Wave-2 pilot so a v2 row mirrored
// by the tee is indistinguishable from one mirrored by the (now-delegating)
// posture backfill.
// ---------------------------------------------------------------------------

export const V1_SOURCE_TAG_PREFIX = "bank:v1-source:";
export const TENANT_TAG_PREFIX = "bank:tenant:";

/**
 * Transform one V1 event into the `CpEvent` the v2 control-plane store stores.
 *
 * Pure + deterministic: the V1 identity (event_id, as_of, entity, actor,
 * citations) is carried verbatim; the payload is passed through the registry-
 * declared `codec` (verbatim by default); the V2 envelope axes (schemaVersion,
 * provenance with a `bank:v1-source:<id>` lineage tag, anchor tenant tag) are
 * stamped. Reusing the V1 event_id makes the mirror idempotent at the storage
 * layer (INSERT OR IGNORE).
 *
 * Exported so the generic backfill (`scripts/backfill-v2-store-tee.ts`) and the
 * coverage recon share ONE mirror shape — the tee and the backfill can never
 * drift.
 */
export function toMirroredCpEvent(
  v1: Event,
  codec: (p: Record<string, unknown>) => Record<string, unknown>,
): CpEvent {
  const sourceTag = `${V1_SOURCE_TAG_PREFIX}${v1.event_id}`;
  const tenantTag = `${TENANT_TAG_PREFIX}${ANCHOR_TENANT_ID}`;
  const baseProv = v1.provenance;
  const provenance: Record<string, unknown> = baseProv
    ? { ...baseProv, tags: [...(baseProv.tags ?? []), sourceTag, tenantTag] }
    : {
        // Minimal lineage-only provenance for legacy un-tagged V1 rows. The W0
        // store accepts optional provenance; we never fabricate a `kind` we
        // cannot defend, so this thin tag carries only the lineage links.
        kind: "simulated",
        sourceLineage: "v2-store-tee",
        scenario: "wave-2-generic-store-tee-mirror",
        tags: [sourceTag, tenantTag],
      };

  return {
    event_id: v1.event_id,
    type: v1.type,
    as_of: v1.as_of,
    entity: v1.entity,
    actor: { type: v1.actor.type, id: v1.actor.id },
    citations: [...v1.citations],
    payload: codec(v1.payload),
    schemaVersion: 1,
    provenance,
  };
}

// ---------------------------------------------------------------------------
// The tee wrapper.
// ---------------------------------------------------------------------------

export interface TeeOptions {
  /**
   * Explicit v2 control-plane store path. Defaults to
   * `defaultControlPlanePath()` (BANK_V2_CONTROL_PLANE_DB env, then the home
   * default). Tests / scenarios pass an explicit tmpdir path.
   */
  readonly controlPlaneDbPath?: string;
  /**
   * Inject a pre-opened control-plane store (tests). When supplied the tee uses
   * it directly and does NOT close it (the owner does). When omitted the tee
   * lazily opens its own handle on first mirror and keeps it for the process.
   */
  readonly controlPlaneStore?: ControlPlaneStore;
  /**
   * Disable the tee entirely (no mirroring). Default false. Set true via the
   * composition root when `BANK_V2_STORE_TEE_DISABLED=true` for local debugging.
   */
  readonly disabled?: boolean;
}

/**
 * Wrap `store` so every successful V1 append of a TEE-ENABLED type is mirrored
 * into the v2 control-plane store. Non-tee-enabled types pass through untouched.
 *
 * The wrapper exposes the full `EventStore` surface (via `Object.create`, the
 * same prototype-delegation pattern `gateEventStore` uses) and intercepts only
 * `append` / `appendAll`.
 */
export function teeEventStore(store: EventStore, opts: TeeOptions = {}): EventStore {
  const disabled = opts.disabled === true || process.env.BANK_V2_STORE_TEE_DISABLED === "true";

  // Lazily-opened, process-lifetime v2 store handle. Only opened the first time
  // a tee-enabled type is appended, so a process that never emits a mirrored
  // type never touches the v2 store. An injected store (tests) short-circuits.
  let cpStore: ControlPlaneStore | undefined = opts.controlPlaneStore;
  let ownsStore = false;
  const cpPath = opts.controlPlaneDbPath ?? defaultControlPlanePath();
  const resolveCpStore = (): ControlPlaneStore => {
    if (cpStore) return cpStore;
    cpStore = openControlPlaneStore(cpPath);
    ownsStore = true;
    return cpStore;
  };

  // Per-process dedup of mirror-failure alerts — one alert per event type, to
  // avoid an alert flood if the v2 store is persistently unavailable. The recon
  // gate is the closure mechanism, not high-frequency alerts.
  const alertedFailureTypes = new Set<string>();

  const emitMirrorFailureAlert = (v1: Event, err: unknown): void => {
    if (alertedFailureTypes.has(v1.type)) return;
    alertedFailureTypes.add(v1.type);
    const message = err instanceof Error ? err.message : String(err);
    try {
      // Emit through the UNDERLYING V1 store: the V1 append already committed,
      // and the alert is itself a V1 event of record (Principle 1). We do NOT
      // re-tee the alert (SubstrateAlert is not tee-enabled), so no recursion.
      store.append(
        makeSubstrateAlert({
          asOf: v1.as_of,
          entity: v1.entity,
          actor: { type: "service", id: "agent:atlas:v2-store-tee" },
          citations: [
            "D-BANK-WIDE-V2-MIGRATION",
            "Principles/1-events-are-truth.md",
            "Engineering-Charter.md",
          ],
          payload: {
            alertId: `alert:integrity:v2-store-tee-mirror-failed-${v1.type.toLowerCase()}`,
            alertClass: "integrity",
            severity: "high",
            details:
              `v2 store-tee FAILED to mirror a "${v1.type}" event (V1 event_id ${v1.event_id}) ` +
              `into the v2 control-plane store at ${cpPath}: ${message}. The V1 write is ` +
              `committed and authoritative; the v2 store is now DIVERGENT for this type. ` +
              `recon:v2-store-tee-coverage will report the count gap. Investigate the v2 ` +
              `store availability and re-run bun run backfill:v2-store-tee to re-sync.`,
          },
        }),
      );
    } catch {
      // Last-resort: the alert emission itself failed (e.g. store closed during
      // teardown). We surface to stderr so the failure is never fully silent.
      // This is the only swallow, and it is logged, not hidden.
      process.stderr.write(
        `[v2-store-tee] CRITICAL: mirror of ${v1.type} (${v1.event_id}) failed AND the ` +
          `SubstrateAlert could not be emitted: ${message}\n`,
      );
    }
  };

  const mirror = (v1: Event): void => {
    if (!isV2TeeEnabled(v1.type)) return;
    const codec = v2TeeCodecFor(v1.type);
    if (!codec) return; // defensive: isV2TeeEnabled true ⇒ codec present.
    try {
      resolveCpStore().append(toMirroredCpEvent(v1, codec));
    } catch (err) {
      // DECOUPLED-WRITE: the V1 write stands; the mirror failure is surfaced
      // (typed alert + recon), never swallowed, never propagated to the V1
      // caller. See the module header for the trade-off rationale.
      emitMirrorFailureAlert(v1, err);
    }
  };

  const wrapped: EventStore = Object.create(store) as EventStore;

  wrapped.append = (raw: Event): void => {
    store.append(raw);
    if (disabled) return;
    mirror(raw);
  };

  wrapped.appendAll = (events: Event[]): void => {
    store.appendAll(events);
    if (disabled) return;
    for (const e of events) mirror(e);
  };

  // Expose a teardown that closes the lazily-opened v2 handle (if the tee owns
  // it). Wired into process exit by the composition root; a no-op for an
  // injected store.
  (wrapped as EventStore & { closeTee?: () => void }).closeTee = (): void => {
    if (cpStore && ownsStore) {
      cpStore.close();
      cpStore = undefined;
      ownsStore = false;
    }
  };

  return wrapped;
}
