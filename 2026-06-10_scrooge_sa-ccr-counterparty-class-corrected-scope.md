# SA-CCR per-counterparty-class — corrected scope (grounded)

**Context:** backlog `task_4edabfa7` / D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL capital residual.
**Method:** ground the premise in code before building.

## The chip's premise is wrong on two counts

The chip said: *"SA-CCR is counterparty-class-blind — add counterpartyType to TradeSummary
and apply per-class supervisory treatment."* Code + the BCBS framework say otherwise:

1. **SA-CCR EAD is *correctly* counterparty-class-agnostic** (BCBS CRE52). EAD = α·(RC+PFE)
   is an *exposure* amount; the PFE supervisory factors are by **asset class** (IR/FX/credit/
   equity/commodity), never counterparty class. The counterparty class enters **downstream**,
   at the risk-weight step: CreditRWA = Σ EAD × RW(counterpartyType). Adding `counterpartyType`
   to SA-CCR's `TradeSummary`/PFE would be the wrong layer (and double-counts the axis).

2. The RWA engine **already** has the per-class side: `CreditExposure` (rwa-engine.ts:141-163)
   carries `counterpartyType: CounterpartyType` + caller-supplied `eadMinor`, and
   `standardisedRiskWeight()` applies the per-class Basel weight (retail 75%, corporate-ig 65%,
   bank 20%, sovereign 0%, …). The architecture is exactly per-CRE52.

## The real gaps

**Gap A — FX/IRS counterparty credit RWA is not computed.** `rwa-from-positions.ts` maps
`FxTradeExecuted` / `IrsTradeBooked` to **TradingBookPosition** (market-risk / NOP) only. The
SA-CCR EAD (`CcrEadComputed`) is consumed by leverage-ratio (BA-700), the credit-limit engine,
and posting-rules — but is **never turned into a `CreditExposure`** for CreditRWA. So FX/IRS
derivative *counterparty-default* capital is absent from CreditRWA. (rwa-from-positions builds
credit exposures only for bonds / repo / IBL.)

**Gap B — no authoritative counterparty Basel-classification (blocks differentiation).** The
only class source today is the CVA engine's **name/id heuristic** (`cva-engine.ts:149`:
"sarb"→sovereign, "bank"→bank, "corp"→corporate, else other), and `rwa-from-positions` hardcodes
`counterpartyType: "bank"` for repo/IBL. There is no authoritative Basel class on the party
register (it has `PartyKind` natural-person/legal-entity/agent + LEI/authorisedProducts, not
bank/corporate-ig/PSE/sovereign). The chip's actual goal — *differentiate capital by class* —
is **blocked** by this: you cannot differentiate without an authoritative classification.

## Why this isn't a build-now item

- Wiring FX/IRS SA-CCR EAD into CreditRWA **changes a regulated capital number** (adds RWA) — a
  CRO methodology decision, not an engineering default.
- Classifying counterparties for Basel (bank/corporate-ig/corporate-non-ig/PSE/sovereign) is a
  **CRO/credit-policy** decision + a missing party-register data field — not something to invent
  from a name heuristic for capital purposes.

## Recommended path (CRO-owned)

1. **Establish an authoritative counterparty Basel-classification** — a party-register attribute
   (or a classification event), CRO-governed, replacing the name heuristic + hardcoded "bank".
2. **Wire `CcrEadComputed` → `CreditExposure`** in rwa-from-positions, sourcing `counterpartyType`
   from (1); the RWA engine's existing per-class `standardisedRiskWeight()` does the rest.
3. Interim option (if the CRO wants completeness before classification lands): wire the EAD at the
   **most-punitive class** (prudent over-statement; refine down as classification arrives).

Owner: Helena (Chief Risk Officer, governance) + Rohan (counterparty-risk engineer). The
`task_4edabfa7` chip's title ("add counterpartyType to SA-CCR") is superseded by this corrected
scope (wire EAD→CreditRWA + classify counterparties), per D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL.
