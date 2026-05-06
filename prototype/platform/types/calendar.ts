import type { Brand } from "./brand.ts";
import type { Jurisdiction } from "./entity.ts";

export type CalendarId = Brand<string, "CalendarId">;

export interface Calendar {
  readonly id: CalendarId;
  readonly jurisdiction: Jurisdiction;
  readonly name: string;
  readonly holidays: ReadonlySet<string>;
  readonly weekend: ReadonlySet<number>;
}

export const isBusinessDay = (cal: Calendar, isoDate: string): boolean => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (cal.weekend.has(d.getUTCDay())) return false;
  if (cal.holidays.has(isoDate)) return false;
  return true;
};
