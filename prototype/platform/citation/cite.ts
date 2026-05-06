import { utcNow } from "../types/time.ts";
import type { Citation, Urn } from "./types.ts";

export interface CiteOptions {
  readonly urn: Urn;
  readonly symbol: string;
  readonly controlId: string;
}

export const cite = (opts: CiteOptions): Citation => ({
  urn: opts.urn,
  symbol: opts.symbol,
  controlId: opts.controlId,
  citedAt: utcNow(),
});
