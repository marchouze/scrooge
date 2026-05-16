# D-DECISIONS-FRAMEWORK-REDESIGN Slice D — notes

**Date:** 2026-05-16  
**Author:** Atlas (Core banking platform architect, engineering)  
**Authority:** D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16)

---

## Group A symmetry fixes

The four Group A entries previously in `decision-symmetry-baseline.txt` are
fixed by the `migrate:decisions-backfill` script on a fresh database:

| Decision ID | Root cause | Fix |
|---|---|---|
| `D-PRINCIPLES-P2-P6-MERGE` | Approved via close-out script; only terminal `CeoDecision` emitted; no `requested` opener | `migrate:decisions-backfill` synthesises `requested` at `2026-05-10T00:00:00.000Z` on fresh db |
| `D-MARKETS-CAPEX-OVERRUN-REVIEW` | `decision-required` flag; no matching frontmatter `decision-id` for the migrate pattern | `migrate:decisions-backfill` finds `actioned/2026-05-12_saskia_capex-overrun-flag.md` and synthesises `requested` at `2026-05-11T00:00:00.000Z` |
| `D-POLICY-DOCUMENT-HOME` | Approved via Scrooge CEO decision record; `requested` opener missing | `migrate:decisions-backfill` finds `actioned/2026-05-12_owen_policy-document-home-decision.md` and synthesises `requested` at `2026-05-11T00:00:00.000Z` |
| `D-AGENT-AUTONOMY-OPERATIONAL` | Approved via Scrooge CEO decision record; `requested` opener missing | `migrate:decisions-backfill` finds `actioned/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md` and synthesises `requested` at `2026-05-10T00:00:00.000Z` |

All four entries removed from `decision-symmetry-baseline.txt` in Slice D.

Note: `scripts/record-d-group-a-symmetry-fix.ts` is included as an additional
idempotent safeguard but is effectively a no-op on CI (fresh db already correct).
On local dev databases with stale pre-Slice-C state, the symmetry check may still
show residuals — this is expected local-db pollution, not a CI defect.

---

## Authority-coverage gaps (post-Slice D)

`recon:decision-authority-coverage` updated: Helena (CRO) and Owen (CoSec) removed
from the baseline (both seats now have Decision events).

### Activated this slice (≥1 Decision event emitted)

| Governance seat | Authority | Decisions activated |
|---|---|---|
| Helena (Chief Risk Officer, governance) | `CRO` | `D-RAS-B-CLUSTER-CONCENTRATION-LINES`, `D-RAS-MARKET-RISK-TAXONOMY-ALIGNMENT`, `D-RAS-CLIMATE-SCENARIO-FRAMEWORK` |
| Owen (Company Secretary, governance) | `CoSec` | `D-PROCEDURE-REGISTER-FIRST-BATCH` |

### Remaining gaps (active seats with zero Decision events post-Slice D)

| Governance seat | Authority | Reason no events yet |
|---|---|---|
| Camille (Chief Financial Officer, governance) | `CFO` | First CFO decision scope (capital plan approval) deferred to M-phase capital substrate |
| Devon (Chief Operating Officer, governance) | `COO` | First COO decision scope (operational model) not yet filed as a Decision event |
| Eitan (Chief Information Security Officer, governance) | `CISO` | T-12 PermissionPolicy substrate not yet complete; first CISO decisions tied to that delivery |
| Thandiwe (Chief Audit Executive, governance) | `CAE` | IAC formation and first audit plan pending |
| Zara (Chief Compliance Officer, governance) | `CCO` | Compliance framework build; first CCO decisions tied to obligations-register activation |

Devon (COO) is not in the `PERSONA_TO_AUTHORITY` map in `decision-authority-coverage.ts`
(no `type: "governance"` persona entry exists for Devon — investigate at next touch).
