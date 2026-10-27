const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { runQuery, getNodesForHub } = require("../services/orchestrator");

const router = express.Router();

function serialize(row) {
  return { ...row, node_ids: JSON.parse(row.node_ids || "[]"), settings: JSON.parse(row.settings || "{}") };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM central_hubs ORDER BY created_at DESC").all();
  res.json(rows.map(serialize));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM central_hubs WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(serialize(row));
});

router.post("/", (req, res) => {
  const { name, description, node_ids, settings } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const id = uuid();
  db.prepare(
    `INSERT INTO central_hubs (id, name, description, node_ids, settings) VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, description || "", JSON.stringify(node_ids || []), JSON.stringify(settings || {}));
  res.status(201).json(serialize(db.prepare("SELECT * FROM central_hubs WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM central_hubs WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE central_hubs SET name=?, description=?, node_ids=?, settings=?, updated_at=datetime('now') WHERE id = ?`
  ).run(
    merged.name,
    merged.description || "",
    typeof merged.node_ids === "string" ? merged.node_ids : JSON.stringify(merged.node_ids || []),
    typeof merged.settings === "string" ? merged.settings : JSON.stringify(merged.settings || {}),
    req.params.id
  );
  res.json(serialize(db.prepare("SELECT * FROM central_hubs WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM central_hubs WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// The actual orchestration entry point: send a query into this hub
router.post("/:id/query", async (req, res) => {
  const hub = db.prepare("SELECT * FROM central_hubs WHERE id = ?").get(req.params.id);
  if (!hub) return res.status(404).json({ error: "Hub not found" });
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "query is required" });
  try {
    const result = await runQuery(hub, query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/history", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM chat_history WHERE hub_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(req.params.id);
  res.json(
    rows.map((r) => ({ ...r, full_response: JSON.parse(r.full_response || "[]") }))
  );
});

module.exports = router;
