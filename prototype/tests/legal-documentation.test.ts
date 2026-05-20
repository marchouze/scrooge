// tests/legal-documentation.test.ts
//
// Happy-path tests for the legal-documentation event-type module.
//
// Covers:
//   - LegalDocumentationSigned        (incl. "fx-bilateral" agreementType)
//   - JurisdictionalOpinionRefreshed
//
// Authority:
//   - Imani G-9 decision (PR #637, 2026-05-20):
//     `2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md`
//   - Helena FX-spot-only market-risk scope review (PR #631) §6 G-9
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  LEGAL_DOCUMENTATION_TYPED_EVENT_TYPES,
  jurisdictionalOpinionRefreshedPayloadSchema,
  legalDocumentationAgreementTypeSchema,
  legalDocumentationSignedPayloadSchema,
  makeJurisdictionalOpinionRefreshed,
  makeLegalDocumentationSigned,
} from "../platform/event-store/event-types/legal-documentation";

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = [
  "2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md",
  "PR-637",
  "[citation: TBC]",
];
const ACTOR = { id: "agent:imani", type: "service" as const };

const VALID_DOC_HASH =
  "blake3:af4495fb6c24cf04e68e486340d5c521c7fecc2036c06462e6c5e065125e1682";

describe("legal-documentation event types — registry", () => {
  it("LEGAL_DOCUMENTATION_TYPED_EVENT_TYPES lists both event types", () => {
    expect(LEGAL_DOCUMENTATION_TYPED_EVENT_TYPES).toContain("LegalDocumentationSigned");
    expect(LEGAL_DOCUMENTATION_TYPED_EVENT_TYPES).toContain("JurisdictionalOpinionRefreshed");
  });

  it("agreementType enum includes fx-bilateral (Imani G-9 §5)", () => {
    expect(legalDocumentationAgreementTypeSchema.options).toContain("fx-bilateral");
    expect(legalDocumentationAgreementTypeSchema.options).toContain("isda-2002");
    expect(legalDocumentationAgreementTypeSchema.options).toContain("isda-2025");
    expect(legalDocumentationAgreementTypeSchema.options).toContain("gmra-2011");
    expect(legalDocumentationAgreementTypeSchema.options).toContain("gmsla-2018");
    expect(legalDocumentationAgreementTypeSchema.options).toContain("none-listed");
  });
});

describe("LegalDocumentationSigned", () => {
  it("happy-path ISDA-2002 payload validates", () => {
    // Imani G-9 controlled-launch default: ISDA 2002 + SA Schedule, no CSA.
    const payload = {
      counterpartyId: "party:lei:STANDARD-BANK-CORPORATE-TREASURY",
      agreementType: "isda-2002" as const,
      version: "2002-MA + SA Schedule",
      signedDate: "2026-06-01",
      documentHash: VALID_DOC_HASH,
      csaPresent: false,
      nettingEnforceable: true,
    };
    expect(() => legalDocumentationSignedPayloadSchema.parse(payload)).not.toThrow();
    const evt = makeLegalDocumentationSigned({
      asOf: "2026-06-01T08:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload,
    });
    expect(evt.type).toBe("LegalDocumentationSigned");
  });

  it("fx-bilateral variant validates (Imani G-9 schema-completeness)", () => {
    // The fx-bilateral form is rejected for the controlled-launch whitelist
    // but must be representable for schema completeness and future use.
    const payload = {
      counterpartyId: "party:lei:FUTURE-FX-ONLY-CLIENT",
      agreementType: "fx-bilateral" as const,
      version: "in-house v1.0",
      signedDate: "2026-08-01",
      csaPresent: false,
      nettingEnforceable: false,
    };
    expect(() => legalDocumentationSignedPayloadSchema.parse(payload)).not.toThrow();
  });

  it("rejects malformed documentHash", () => {
    expect(() =>
      legalDocumentationSignedPayloadSchema.parse({
        counterpartyId: "party:lei:X",
        agreementType: "isda-2002",
        version: "v1",
        signedDate: "2026-06-01",
        documentHash: "sha256:abc",
        csaPresent: false,
        nettingEnforceable: true,
      }),
    ).toThrow();
  });

  it("requires citations on the envelope", () => {
    expect(() =>
      makeLegalDocumentationSigned({
        asOf: "2026-06-01T08:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: {
          counterpartyId: "party:lei:X",
          agreementType: "isda-2002",
          version: "v1",
          signedDate: "2026-06-01",
          csaPresent: false,
          nettingEnforceable: true,
        },
      }),
    ).toThrow(/citation/i);
  });
});

describe("JurisdictionalOpinionRefreshed", () => {
  it("happy-path ISDA SA opinion validates", () => {
    // Imani G-9 cited example: ISDA South Africa netting opinion,
    // Bowmans 2024-04-15.
    const payload = {
      jurisdiction: "ZA",
      opinionAuthority: "ISDA",
      opinionAuthor: "Bowmans",
      opinionDate: "2024-04-15",
      opinionDocumentHash: VALID_DOC_HASH,
      coversCounterparties: [
        "party:lei:STANDARD-BANK-CORPORATE-TREASURY",
        "party:lei:INVESTEC-BANK-TREASURY",
      ],
      refreshedAt: "2026-05-20T10:00:00.000Z",
      previousOpinionDate: "2023-04-15",
    };
    expect(() => jurisdictionalOpinionRefreshedPayloadSchema.parse(payload)).not.toThrow();
    const evt = makeJurisdictionalOpinionRefreshed({
      asOf: payload.refreshedAt,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload,
    });
    expect(evt.type).toBe("JurisdictionalOpinionRefreshed");
  });

  it("allows null previousOpinionDate (first-on-file case)", () => {
    expect(() =>
      jurisdictionalOpinionRefreshedPayloadSchema.parse({
        jurisdiction: "MU",
        opinionAuthority: "ISDA",
        opinionAuthor: "Conyers",
        opinionDate: "2026-04-15",
        opinionDocumentHash: VALID_DOC_HASH,
        coversCounterparties: [],
        refreshedAt: "2026-05-20T10:00:00.000Z",
        previousOpinionDate: null,
      }),
    ).not.toThrow();
  });

  it("rejects non-ISO jurisdiction code", () => {
    expect(() =>
      jurisdictionalOpinionRefreshedPayloadSchema.parse({
        jurisdiction: "ZAR", // 3-letter — not ISO 3166-1 alpha-2
        opinionAuthority: "ISDA",
        opinionAuthor: "Bowmans",
        opinionDate: "2024-04-15",
        opinionDocumentHash: VALID_DOC_HASH,
        coversCounterparties: [],
        refreshedAt: "2026-05-20T10:00:00.000Z",
        previousOpinionDate: null,
      }),
    ).toThrow();
  });

  it("rejects malformed opinionDocumentHash", () => {
    expect(() =>
      jurisdictionalOpinionRefreshedPayloadSchema.parse({
        jurisdiction: "ZA",
        opinionAuthority: "ISDA",
        opinionAuthor: "Bowmans",
        opinionDate: "2024-04-15",
        opinionDocumentHash: "not-a-blake3-hash",
        coversCounterparties: [],
        refreshedAt: "2026-05-20T10:00:00.000Z",
        previousOpinionDate: null,
      }),
    ).toThrow();
  });
});
