"""Ingesters for the FX-Spot slice.

Each ingester emits Graphiti `episodes` carrying:
- source_file (relative path)
- content_hash (BLAKE3 of the bytes)
- typed entities (per `ontology.py`)

Deterministic ingesters (frontmatter, registers, tree-sitter) run first and
register URN-keyed nodes. The narrative LLM extractor then enriches edges from
free-text bodies.
"""
