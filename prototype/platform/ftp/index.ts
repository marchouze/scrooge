// platform/ftp/index.ts
//
// Public surface of the FTP (Funds Transfer Pricing) platform module.
//
// Three sub-modules:
//   - curve.ts       — FtpCurve class (exact lookup + linear interpolation)
//   - attribution.ts — attributeTransaction (produces FtpAttributionRecordedPayload)
//   - projection.ts  — buildFtpPortfolio (reduces event stream → FtpPortfolioSummary)
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Ravi (Treasury/ALM Engineer, engineering)

export { FtpCurve, tenorToDays } from "./curve";
export { attributeTransaction } from "./attribution";
export type { AttributionParams } from "./attribution";
export { buildFtpPortfolio, emptyFtpPortfolioSummary } from "./projection";
export type { FtpPortfolioSummary } from "./projection";
