// platform/forward-obligations/views/planning.ts
//
// Planning view — what action is required, by whom, by when.
//
// Implements ForwardObligationView<PlanningViewOutput>. Returns all
// obligations in the horizon sorted by dueDate, grouped into four
// date buckets (today / this-week / this-month / later).
//
// Bucket logic (relative to asOf):
//   today      : dueDate === asOf date
//   this-week  : dueDate within the next 7 calendar days (inclusive)
//   this-month : dueDate within the same calendar month as asOf
//   later      : everything else in the horizon
//
// Author: Atlas (Core banking platform architect, engineering) + Anya (Frontend / dashboard engineer, engineering)

import type {
  ForwardObligation,
  ForwardObligationView,
  PlanningBucket,
  PlanningViewOutput,
  PlanningViewRow,
} from "../types";

function deriveBucket(dueDate: string, asOf: string): PlanningBucket {
  const asOfDate = asOf.slice(0, 10);
  if (dueDate === asOfDate) return "today";

  // "this-week": within 7 calendar days
  const due = new Date(`${dueDate}T00:00:00Z`);
  const base = new Date(`${asOfDate}T00:00:00Z`);
  const sevenDaysOut = new Date(base);
  sevenDaysOut.setUTCDate(sevenDaysOut.getUTCDate() + 7);
  if (due <= sevenDaysOut) return "this-week";

  // "this-month": same calendar year + month
  if (
    due.getUTCFullYear() === base.getUTCFullYear() &&
    due.getUTCMonth() === base.getUTCMonth()
  ) {
    return "this-month";
  }

  return "later";
}

export const planningView: ForwardObligationView<PlanningViewOutput> = {
  name: "planning",
  label: "Planning",

  fold(obligations: ForwardObligation[], asOf: string): PlanningViewOutput {
    const rows: PlanningViewRow[] = [];
    const bucketCounts: Record<PlanningBucket, number> = {
      today: 0,
      "this-week": 0,
      "this-month": 0,
      later: 0,
    };

    for (const ob of obligations) {
      const bucket = deriveBucket(ob.dueDate, asOf);
      bucketCounts[bucket]++;

      rows.push({
        dueDate: ob.dueDate,
        title: ob.title,
        owner: ob.owner,
        certainty: ob.certainty,
        source: ob.source,
        bucket,
        relatedRef: ob.relatedRef,
        description: ob.description,
      });
    }

    // Already sorted by dueDate ASC from the projection — no re-sort needed.
    return {
      rows,
      bucketCounts,
      totalCount: rows.length,
    };
  },
};
