import type { Urn } from "../citation/types.ts";
import type { Brand } from "../types/brand.ts";
import type { Currency } from "../types/currency.ts";
import type { Jurisdiction, LegalEntityId } from "../types/entity.ts";
import type { UtcTimestamp } from "../types/time.ts";

export type EventId = Brand<string, "EventId">;

export type StreamId = Brand<string, "StreamId">;

export interface EventEnvelope<TBody = unknown> {
  readonly id: EventId;
  readonly type: string;
  readonly stream: StreamId;
  readonly streamVersion: number;
  readonly recordedAt: UtcTimestamp;

  readonly legalEntity: LegalEntityId | null;
  readonly currency: Currency | null;
  readonly jurisdiction: Jurisdiction | null;

  readonly citations: ReadonlyArray<Urn>;

  readonly prevHash: string | null;
  readonly hash: string;

  readonly producer: string;
  readonly signature: string;

  readonly body: TBody;
}
