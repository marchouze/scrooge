// platform/forward-obligations/views/liquidity.ts
//
// Liquidity view — net cashflow by date, probability-weighted by certainty.
//
// Implements ForwardObligationView<LiquidityViewOutput>. Only obligations
// with a defined `cashflow` field contribute to this view. Items without
// cashflow (e.g. regulatory filings) are excluded.
//
// Probability weights (per CEO design brief):
//   certain   = 100%
//   probable  =  90%
//   estimated =  60%
//
// Bucketing: one bucket per date (ISO date string). Net flow per bucket is
// the probability-weighted sum (positive = net inflow, negative = net outflow).
//
// Multi-currency: buckets are grouped by currency. If a single date has
// items in multiple currencies, multiple buckets are emitted for that date
// (one per currency). The UI is expected to handle this; `totalNetFlow`
// reports the primary-currency net only.
//
// Author: Atlas (Core banking platform architect, engineering) + Anya (Frontend / dashboard engineer, engineering)

import type {
  ForwardObligation,
  ForwardObligationView,
  LiquidityViewBucket,
  LiquidityViewItem,
  LiquidityViewOutput,
} from "../types";
import { CERTAINTY_WEIGHTS } from "../types";

export const liquidityView: ForwardObligationView<LiquidityViewOutput> = {
  name: "liquidity",
  label: "Liquidity",

  fold(obligations: ForwardObligation[], _asOf: string): LiquidityViewOutput {
    // Bucket key = `${date}::${currency}`
    const bucketMap = new Map<
      string,
      {
        date: string;
        currency: string;
        items: LiquidityViewItem[];
        netFlow: number;
        grossOutflow: number;
        grossInflow: number;
      }
    >();

    let primaryCurrency = "";
    let cashflowItemCount = 0;

    for (const ob of obligations) {
      if (!ob.cashflow) continue;

      cashflowItemCount++;
      const { amount, currency, direction } = ob.cashflow;
      const weight = CERTAINTY_WEIGHTS[ob.certainty];
      const weightedAmount = amount * weight;

      if (!primaryCurrency) primaryCurrency = currency;

      const key = `${ob.dueDate}::${currency}`;
      let bucket = bucketMap.get(key);
      if (!bucket) {
        bucket = {
          date: ob.dueDate,
          currency,
          items: [],
          netFlow: 0,
          grossOutflow: 0,
          grossInflow: 0,
        };
        bucketMap.set(key, bucket);
      }

      const item: LiquidityViewItem = {
        title: ob.title,
        amount,
        weightedAmount,
        direction,
        certainty: ob.certainty,
      };
      bucket.items.push(item);

      if (direction === "outflow") {
        bucket.netFlow -= weightedAmount;
        bucket.grossOutflow += amount;
      } else {
        bucket.netFlow += weightedAmount;
        bucket.grossInflow += amount;
      }
    }

    // Sort buckets by date ASC then currency.
    const buckets: LiquidityViewBucket[] = [...bucketMap.values()]
      .sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return a.currency < b.currency ? -1 : 1;
      })
      .map((b) => ({
        date: b.date,
        currency: b.currency,
        netFlow: Math.round(b.netFlow * 100) / 100, // round to 2dp
        grossOutflow: Math.round(b.grossOutflow * 100) / 100,
        grossInflow: Math.round(b.grossInflow * 100) / 100,
        items: b.items,
      }));

    // Total net flow in the primary currency only (for the summary tile).
    const totalNetFlow = Math.round(
      buckets
        .filter((b) => b.currency === primaryCurrency)
        .reduce((sum, b) => sum + b.netFlow, 0) * 100,
    ) / 100;

    return {
      buckets,
      totalNetFlow,
      primaryCurrency: primaryCurrency || "ZAR",
      cashflowItemCount,
    };
  },
};
