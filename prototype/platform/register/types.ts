import type { Urn } from "../citation/types.ts";
import type { Brand } from "../types/brand.ts";
import type { Jurisdiction } from "../types/entity.ts";
import type { UtcTimestamp } from "../types/time.ts";

export type Status = "draft" | "in_force" | "superseded" | "repealed" | "withdrawn";

export type Language = Brand<string, "Language">;

export type SourceType = "regulator" | "standards-body" | "counterparty" | "internal";

export type InstrumentType =
  | "statute"
  | "regulation"
  | "directive"
  | "standard"
  | "contract"
  | "policy";

export type Severity = "statutory" | "regulatory" | "contractual" | "internal";

export type ReviewCadence = "monthly" | "quarterly" | "annually";

export interface Source {
  readonly urn: Urn;
  readonly name: string;
  readonly jurisdiction: Jurisdiction | null;
  readonly type: SourceType;
  readonly parent: Urn | null;
}

export interface Instrument {
  readonly urn: Urn;
  readonly title: string;
  readonly source: Urn;
  readonly jurisdiction: Jurisdiction | null;
  readonly instrumentType: InstrumentType;
  readonly promulgatedAt: string | null;
  readonly repealedAt: string | null;
  readonly language: Language;
  readonly tags: ReadonlyArray<string>;
}

export interface Provision {
  readonly urn: Urn;
  readonly instrument: Urn;
  readonly path: string;
  readonly canonicalText: string | null;
  readonly textHash: string;
  readonly textAsOf: string | null;
  readonly summary: string;
  readonly extract: unknown | null;
  readonly tags: ReadonlyArray<string>;
}

export interface Policy {
  readonly urn: Urn;
  readonly title: string;
  readonly owner: string;
  readonly approver: string;
  readonly scope: string;
  readonly supersedes: Urn | null;
  readonly relatedProvisions: ReadonlyArray<Urn>;
}

export interface Obligation {
  readonly urn: Urn;
  readonly statement: string;
  readonly basis: ReadonlyArray<Urn>;
  readonly precondition: unknown | null;
  readonly action: unknown | null;
  readonly severity: Severity;
  readonly responsibleTeam: string | null;
  readonly evidenceRequirement: string;
}

export interface RegisterException {
  readonly urn: Urn;
  readonly deviationFrom: Urn;
  readonly justificationText: string;
  readonly justificationBasis: ReadonlyArray<Urn>;
  readonly scope: unknown;
  readonly approver: string;
  readonly reviewCadence: ReviewCadence;
  readonly expiresAt: string | null;
}

export interface VersionEnvelope<T> {
  readonly entry: T;
  readonly version: string;
  readonly asOf: UtcTimestamp;
  readonly status: Status;
  readonly supersededBy: { readonly urn: Urn; readonly version: string } | null;
  readonly attestedAt: UtcTimestamp | null;
  readonly attestedBy: string | null;
  readonly integrityHash: string;
}
