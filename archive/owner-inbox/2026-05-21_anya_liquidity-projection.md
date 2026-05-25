---
agent: Anya
trigger: liquidity-projection
asOf: 2026-05-21T05:20:11.790Z
decision-required: false
---

# Anya — Liquidity projection, 2026-05-21

Daily LCR / NSFR projection — BA 325 / BA 326 calibration, ZAR, 30-day stress horizon.

## LCR (Liquidity Coverage Ratio)

| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |
|---|---|---|---|---|
| T+0 | 0 | 0 | ∞ | no-positions |
| T+30 | 0 | 0 | ∞ | no-positions |

## NSFR (Net Stable Funding Ratio)

| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |
|---|---|---|---|---|
| T+0 | 0 | 0 | ∞ | no-positions |
| T+30 | 0 | 0 | ∞ | no-positions |

## Build-phase posture

All positions are empty — no collateral inventory or ALM position substrate exists yet.
Results reflect the baseline: `status: no-positions`.

## Substrate gaps

- **Collateral inventory** (Tomas + Atlas): HQLA positions not yet queryable from event store. Once live, this handler will populate L1/L2a/L2b positions from `CollateralInventorySnapshotted` events.
- **ALM position substrate** (Ravi + Atlas): Funding positions and ASF/RSF items not yet queryable. Once live, this handler will populate from `ALMPositionSnapshotted` events.

**Events emitted:** 4
**Authority:** D-TREASURY-GAPS-WAVE1; BA 325; BA 326
