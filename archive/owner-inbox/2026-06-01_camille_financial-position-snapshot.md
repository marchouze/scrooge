---
agent: Camille
trigger: financial-position-snapshot
asOf: 2026-06-01T06:41:13.527Z
decision-required: false
---

# Camille — financial-position snapshot, 2026-06-01

Autonomous run of Camille's weekly financial-position-snapshot per `Team/Camille.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Fourth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 105 Camille-owned obligations on the register (0 IN FORCE; 6 PARTIAL; 40 PLANNED) · finance bench 10/2 handlers · 0 closes / 0 BA returns / 0 AFS in build phase.

## Camille-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 0 |
| PARTIAL | 6 |
| PLANNED | 40 |
| DRAFTING | 0 |
| N/A-yet | 0 |
| **Total** | **105** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Camille (or where Camille is named anywhere on the row). Coarse — refines once the register exposes a structured per-row API._

## Finance bench

| Seat | Runtime handlers | Keys |
|---|---|---|
| Bea | 8 | `bea:goal-loop`, `bea:accounting-readiness`, `bea:fx-posting-engine`, `bea:gl-posting-engine`, `bea:m1-ifrs-classification-rules`, `bea:event-triage`, `bea:period-close`, `bea:product-control-daily` |
| Yael | 2 | `yael:tax-readiness`, `yael:event-triage` |

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
- **AC pack generator (Owen + Camille)** — AC-pack generated downward from policy / standard / process / data per Principle 2. Required pre-first-AC.
- **External-auditor relationship register** — auditor-correspondence register; engagement-letter substrate. Activates once external auditor appointed (licence-application cycle).

## Camille's narrative

The substrate is pre-first-close. CloseApproved, BAReturnSigned, AFSSigned and CapitalPlanRefreshed have all never fired; zero CFO-domain events in the last seven days is the expected build-phase signal, not a regression. Of 105 obligations on my register, none are IN FORCE — 6 sit at PARTIAL, 40 at PLANNED, and the 6 PARTIAL items are the ones load-bearing on first close. Bea's eight handlers cover the GL/FX posting spine, IFRS classification rules, period-close and product-control daily, which is the right shape; Yael runs only `tax-readiness` plus triage, which is thin for the submission cycle she will own.

Three observations rank above the rest. First, the BA-return pipeline (Banks Act 94 of 1990, s90 read with Regulation 18 of the Regulations relating to Banks) has no producer behind it — Bea's `period-close` handler will generate a trial balance, but there is no handler mapping that TB into BA 100 / BA 120 / BA 325 line items, so the first BA return cannot be signed even if a close is approved. Second, the capital-plan refresh cadence I co-own with Helena under ICAAP / ILAAP (Regulation 39) has never run and has no scheduled producer — this is substrate I owe, not a Helena gap. Third, Yael's tax submission cycle is unproducered end-to-end: there is no handler for provisional tax under paragraph 19 of the Fourth Schedule to the Income Tax Act 58 of 1962, and no FATCA/CRS reportable-account determination pipeline under the IGA and the OECD CRS regulations gazetted under s257.

Next CFO moves, concretely. (1) I will author the IFRS 9 classification and measurement accounting policy (IFRS 9.4.1.1–4.1.4 and 4.2.1, SPPI and business-model assessment) this cycle, so Bea's `m1-ifrs-classification-rules` handler has a policy authority to cite rather than infer; the IFRS 13 fair-value hierarchy policy (IFRS 13.72–90) follows immediately after. (2) I will commission from Bea a `bea:ba-return-mapping` handler scoped first to BA 100 and BA 120, mapping GL accounts to PA line items, with BA 325 (capital adequacy) deferred until Helena's RWA substrate is in place. (3) Yael owes two position memos before her handler set can be trusted at first close: a provisional-tax computation memo under Fourth Schedule paragraph 19, and a FATCA/CRS classification memo determining the bank's Reporting FI status and account-holder due-diligence procedures. None of these are register entries — the register already names the obligations; these are the producers that turn PLANNED into PARTIAL and PARTIAL into IN FORCE.

## Provenance

Camille-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Camille appears in any cell); finance-bench handler-coverage from `runtime/handlers-metadata.ts`; event counts via `eventStore.replay({type:...})` filtered to last 7 days; readiness-state from latest event of each type.
