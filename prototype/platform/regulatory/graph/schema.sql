CREATE TABLE IF NOT EXISTS graph_nodes (
  id              TEXT PRIMARY KEY,
  node_type       TEXT NOT NULL,
  label           TEXT NOT NULL,
  effective_from  TEXT,
  effective_to    TEXT,
  metadata        TEXT
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id                TEXT PRIMARY KEY,
  from_id           TEXT NOT NULL REFERENCES graph_nodes(id),
  to_id             TEXT NOT NULL REFERENCES graph_nodes(id),
  edge_type         TEXT NOT NULL,
  effective_from    TEXT,
  effective_to      TEXT,
  source_provision  TEXT,
  extraction_method TEXT,
  confidence_score  REAL,
  extracted_at      TEXT,
  metadata          TEXT,
  UNIQUE(from_id, to_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_from ON graph_edges(from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to   ON graph_edges(to_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON graph_edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON graph_nodes(node_type);
