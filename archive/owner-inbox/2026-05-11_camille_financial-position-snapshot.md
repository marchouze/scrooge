---
agent: Camille
trigger: financial-position-snapshot
asOf: 2026-05-11T05:51:50.038Z
decision-required: false
---

# Camille — financial-position snapshot, 2026-05-11

Autonomous run of Camille's weekly financial-position-snapshot per `Team/Camille.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fourth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 53 Camille-owned obligations on the register (37 IN FORCE; 3 PARTIAL; 12 PLANNED) · finance bench 3/2 handlers · 0 closes / 0 BA returns / 0 AFS in build phase.

## Camille-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 37 |
| PARTIAL | 3 |
| PLANNED | 12 |
| DRAFTING | 0 |
| N/A-yet | 0 |
| **Total** | **53** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Camille (or where Camille is named anywhere on the row). Coarse — refines once the register exposes a structured per-row API._

## Finance bench

| Seat | Runtime handlers | Keys |
|---|---|---|
| Bea | 2 | `bea:accounting-readiness`, `bea:m1-ifrs-classification-rules` |
| Yael | 1 | `yael:tax-readiness` |

## CFO-domain events (last 7 days)

| Event | Count |
|---|---|
| `CloseApproved` | 0 |
| `BAReturnSigned` | 0 |
| `AFSSigned` | 0 |
| `AccountingPolicyChanged` | 0 |
| `TaxSubmissionApproved` | 0 |
| `RestatementProposed` | 0 |
| `CapitalEvent` | 0 |
| `MaterialIFRSClassificationChange` | 0 |

_Build-phase posture: zero closes / BA returns / AFS. Bea owns the sub-ledger projection (close cycle, IFRS classification); Yael owns the tax-submission pipeline. Live event flow activates once Bea and Yael's substrates ship and commencement of trading lands._

## Readiness state

| Cycle | Last fired |
|---|---|
| Monthly close (`CloseApproved`) | **never — substrate gap** |
| Quarterly BA return (`BAReturnSigned`) | **never — substrate gap** |
| Annual AFS (`AFSSigned`) | **never — substrate gap** |
| Capital-plan refresh (`CapitalPlanRefreshed`) | **never — substrate gap** |

## Substrate gaps surfaced this run

- **Sub-ledger projection (Bea)** — close-cycle pipeline. `CloseApproved` event-type registered but no producer. Required pre-first-close.
- **BA-return generator (Bea + Anya)** — assembles BA returns from sub-ledger + RWA + obligations register. Required pre-first quarterly BA submission.
- **Tax-submission pipeline (Yael)** — VAT FS apportionment, FATCA / CRS XML, IAS 12 calc. Required from first revenue.
- **Capital-plan substrate (Camille + Eitan + Anya)** — capital actions register, ICAAP-aligned plan refresh cadence. Required pre-licence.
- **AC pack generator (Owen + Camille)** — AC-pack generated downward from policy / standard / process / data per Principle 6. Required pre-first-AC.
- **External-auditor relationship register** — auditor-correspondence register; engagement-letter substrate. Activates once external auditor appointed (licence-application cycle).

## Camille's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own._

## Provenance

Camille-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Camille appears in any cell); finance-bench handler-coverage from `runtime/handlers-metadata.ts`; event counts via `eventStore.replay({type:...})` filtered to last 7 days; readiness-state from latest event of each type.
