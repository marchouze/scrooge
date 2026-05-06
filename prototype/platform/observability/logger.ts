// platform/observability/logger.ts
//
// Structured logging via Pino. Local implementation; cloud target swaps
// the transport for Azure Monitor / Application Insights via the same
// interface (`Logger`).
//
// Author: Atlas

import { pino } from "pino";

export const logger = pino({
  base: { service: "bank-prototype" },
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
