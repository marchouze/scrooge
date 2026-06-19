# RRB obligations — Authority-set values register

> Per CEO direction (Marc, 2026-06-19, items 2 & 3 of D-RRB-OBLIGATIONS-ADOPT): keep a record
> of every regulatory value that the Prudential Authority sets in writing — both those still
> **deferred** (awaiting Authority specification) and those already **populated** — so each can
> be tracked, and a deferred value updated to its populated figure when the Authority specifies it.
>
> Scope: the 43 adopted RRB obligations (`ORG-PR-067…111` minus `092`/`093`; reg31/reg35/reg36
> held this phase per the 2026-06-19 in-session amendment to `D-RRB-OBLIGATIONS-ADOPT`).
> This register is a traceability artefact; on the engineering substrate it should be promoted
> to typed events (and ideally a projection-derived register) rather than a standalone markdown.
> That promotion is a tracked roadmap item — `SubstrateAlert` `alert:integrity:rrb-deferred-values-register-home`
> (no silent gap; Engineering Charter command 5).

## Deferred — awaiting Authority specification (TBD)

| Obligation | URN | Provision | Value the Authority must set | Status | Current value | Populated on / source |
|------------|-----|-----------|------------------------------|:------:|---------------|-----------------------|
| ORG-PR-086 | `urn:reg:za:rrb:reg29` | Reg 29(3) | Aggregate effective net open foreign-currency position limit — per single currency and all currencies taken together (close-of-business cap) | **DEFERRED** | TBD | — (set in writing by the PA) |
| ORG-PR-097 | `urn:reg:za:rrb:reg38` | Reg 38(8)(a)(ii)–(iii), (vi) | Pillar 2 idiosyncratic (bank-specific) capital add-on %, systemic-risk add-on %, and any SIB loss-absorbency add-on | **DEFERRED** | TBD | — (set in writing by the PA) |

## Populated — Authority-set / Basel-anchored values currently in force

| Obligation | URN | Provision | Value | Status | Notes |
|------------|-----|-----------|-------|:------:|-------|
| ORG-PR-077 | `urn:reg:za:rrb:reg24` | Reg 24(6) | Single-counterparty large-exposure cap **25%** of CET1+AT1; aggregate large exposures **800%** trigger; related-party write-off board-approval **1%** | POPULATED | Verbatim in RRB; hard limits |
| ORG-PR-078 | `urn:reg:za:rrb:reg24` | Reg 24(6) | Large-exposure reporting trigger **10%**; connected-counterparty consideration trigger **5%** of CET1+AT1 | POPULATED | Verbatim in RRB |
| ORG-PR-080 | `urn:reg:za:rrb:reg26` | Reg 26(12) | Liquidity Coverage Ratio minimum **100%** | POPULATED | Basel III fully phased-in level; the PA confirms the minimum in writing |
| ORG-PR-081 | `urn:reg:za:rrb:reg26` | Reg 26(14) | Net Stable Funding Ratio minimum **100%** | POPULATED | Basel III fully phased-in level; the PA confirms the minimum in writing |
| ORG-PR-083 | `urn:reg:za:rrb:reg27` | Reg 27(3) | Level-1 HQLA **5%** of liabilities-as-reduced; intraday floors **75% / 50%**; **95%** owned outright | POPULATED | Verbatim in RRB; statutory (Banks Act s.72(1)) |
| ORG-PR-094 | `urn:reg:za:rrb:reg38` | Reg 38(8) | CET1 **≥ 4.5%**, Tier 1 **≥ 6%**, Total qualifying capital **≥ 8%** of RWA | POPULATED | Verbatim minima; PA may set higher |
| ORG-PR-095 | `urn:reg:za:rrb:reg38` | Reg 38(8)(f)–(g) | Capital conservation buffer **2.5%** (CET1); countercyclical buffer **0–2.5%** range | POPULATED | 2.5% retained after Notice 6342 substitution; countercyclical % set by PA within the 0–2.5% range (currently variable) |
| ORG-PR-096 | `urn:reg:za:rrb:reg38` | Reg 38(15) | Leverage ratio management level **4%**, absolute floor **3%**, leverage multiple **≤ 25×** | POPULATED | Verbatim in RRB; PA may impose an additional leverage buffer |

## Maintenance

- When the Authority specifies a deferred value in writing, move the row to the populated table,
  enter the value, the effective date, and the source reference (directive / circular / notice),
  and update the corresponding obligation's `requirement` text.
- The countercyclical buffer % (within ORG-PR-095) is itself periodically set by the Authority;
  treat each re-setting as an update event here.
