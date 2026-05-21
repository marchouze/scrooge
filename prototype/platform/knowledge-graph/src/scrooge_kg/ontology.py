"""Pydantic ontology for Scrooge Bank's unified knowledge graph (spike scope).

Maps onto Principle 2 — single-graph discipline. Each entity type is a node in
Graphiti's bitemporal graph; each edge type carries a `relation` literal so the
LLM extractor produces typed edges.

Authoritative table is in the plan at
`.claude/plans/i-m-not-happy-with-idempotent-tide.md`.

Author: Atlas (Core banking platform architect, engineering).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ────────────────────────────────────────────────────────────────────────────
# Entity types — 11 in spike scope
# ────────────────────────────────────────────────────────────────────────────


class Regulation(BaseModel):
    """A regulatory instrument (Act, Standard, Directive)."""

    urn: str = Field(..., description="Canonical URN, e.g. urn:reg:za:banks-act-94-of-1990")
    jurisdiction: str = Field(..., description="ISO country code, e.g. 'ZA'")
    act: str = Field(..., description="Short name, e.g. 'Banks Act'")
    year: int | None = None


class Provision(BaseModel):
    """A specific section or paragraph of a regulation."""

    urn: str = Field(..., description="e.g. urn:reg:za:banks-act:s78")
    regulation_urn: str = Field(..., description="Parent regulation URN")
    section: str = Field(..., description="e.g. '§78', 's.28-29'")
    text: str | None = Field(default=None, description="Verbatim text excerpt")


class Obligation(BaseModel):
    """A bank-binding requirement extracted from a provision."""

    urn: str = Field(..., description="e.g. urn:obligation:org-mk-08")
    provision_urn: str | None = None
    requirement: str = Field(..., description="One-sentence WHAT the regulation mandates")
    register_id: str | None = Field(default=None, description="e.g. 'ORG-MK-08'")


class Policy(BaseModel):
    """A bank policy implementing one or more obligations."""

    urn: str = Field(..., description="e.g. policy:market-risk")
    policy_id: str
    title: str
    version: str | None = None
    owner: str | None = None
    citations: list[str] = Field(default_factory=list)


class Procedure(BaseModel):
    """A bank procedure operationalising a policy."""

    urn: str = Field(..., description="e.g. proc:PROC-OPS-SARB-FIX-IPV-01")
    procedure_id: str
    title: str
    policy_urn: str | None = None
    system_capability: str | None = Field(
        default=None, description="e.g. '@platform/market-data/sarb-fixing-ingester'"
    )


class Decision(BaseModel):
    """A CEO / governance decision recorded in the Decisions register."""

    urn: str = Field(..., description="e.g. D-KG-GRAPHITI-SPIKE-FX-SPOT")
    decision_id: str
    title: str
    authority: str | None = None
    recorded_at: str | None = None


class CodeModule(BaseModel):
    """A TypeScript module that implements (part of) a procedure."""

    path: str = Field(..., description="Relative path from `prototype/`")
    exports: list[str] = Field(default_factory=list)
    handler_name: str | None = Field(default=None, description="If module is an event handler")


class Capability(BaseModel):
    """A named system capability bridging procedure to code module(s)."""

    path: str = Field(..., description="e.g. '@platform/markets/eod/fx-revaluation'")
    procedure_urn: str | None = None


class Party(BaseModel):
    """A natural person, legal entity, counterparty, or agent."""

    urn: str = Field(..., description="e.g. urn:party:agent:rohan")
    name: str
    kind: Literal["natural-person", "legal-entity", "counterparty", "agent"]


class RiskCategory(BaseModel):
    """A node in the 94-code risk taxonomy."""

    code: str = Field(..., description="e.g. RT-MK.FX or RT-MK.FX.SPOT")
    label: str | None = None


class ProductInstrument(BaseModel):
    """A tradable product / instrument family."""

    code: str = Field(..., description="e.g. inst-fx-spot")
    label: str | None = None


# ────────────────────────────────────────────────────────────────────────────
# Edge types — Pydantic models with `relation` literal so Graphiti emits typed edges
# ────────────────────────────────────────────────────────────────────────────


class Contains(BaseModel):
    """Regulation → Provision."""

    relation: Literal["CONTAINS"] = "CONTAINS"


class Expresses(BaseModel):
    """Provision → Obligation."""

    relation: Literal["EXPRESSES"] = "EXPRESSES"


class ClosedBy(BaseModel):
    """Obligation → Policy."""

    relation: Literal["CLOSED_BY"] = "CLOSED_BY"


class Governs(BaseModel):
    """Policy → Procedure."""

    relation: Literal["GOVERNS"] = "GOVERNS"


class RealisedBy(BaseModel):
    """Procedure → Capability."""

    relation: Literal["REALISED_BY"] = "REALISED_BY"


class ImplementedAt(BaseModel):
    """Capability → CodeModule."""

    relation: Literal["IMPLEMENTED_AT"] = "IMPLEMENTED_AT"


class Affects(BaseModel):
    """Decision → {Policy | Procedure | CodeModule}."""

    relation: Literal["AFFECTS"] = "AFFECTS"


class Tagged(BaseModel):
    """{Policy | Procedure | Decision} → RiskCategory."""

    relation: Literal["TAGGED"] = "TAGGED"


class AppliesTo(BaseModel):
    """Procedure → ProductInstrument."""

    relation: Literal["APPLIES_TO"] = "APPLIES_TO"


ENTITY_TYPES = [
    Regulation,
    Provision,
    Obligation,
    Policy,
    Procedure,
    Decision,
    CodeModule,
    Capability,
    Party,
    RiskCategory,
    ProductInstrument,
]

EDGE_TYPES = {
    "CONTAINS": Contains,
    "EXPRESSES": Expresses,
    "CLOSED_BY": ClosedBy,
    "GOVERNS": Governs,
    "REALISED_BY": RealisedBy,
    "IMPLEMENTED_AT": ImplementedAt,
    "AFFECTS": Affects,
    "TAGGED": Tagged,
    "APPLIES_TO": AppliesTo,
}
