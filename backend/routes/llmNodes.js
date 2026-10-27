const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");

const router = express.Router();

function serialize(row) {
  return { ...row, data_sources: JSON.parse(row.data_sources || "[]") };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM llm_nodes ORDER BY created_at DESC").all();
  res.json(rows.map(serialize));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM llm_nodes WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(serialize(row));
});

router.post("/", (req, res) => {
  const { name, prompt, provider, base_url, model, api_key, data_sources } = req.body;
  if (!name || !prompt || !provider || !model) {
    return res.status(400).json({ error: "name, prompt, provider and model are required" });
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO llm_nodes (id, name, prompt, provider, base_url, model, api_key, data_sources)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, prompt, provider, base_url || null, model, api_key || null, JSON.stringify(data_sources || []));
  res.status(201).json(serialize(db.prepare("SELECT * FROM llm_nodes WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM llm_nodes WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE llm_nodes SET name=?, prompt=?, provider=?, base_url=?, model=?, api_key=?, data_sources=?, status=?, updated_at=datetime('now')
     WHERE id = ?`
  ).run(
    merged.name,
    merged.prompt,
    merged.provider,
    merged.base_url || null,
    merged.model,
    merged.api_key || null,
    typeof merged.data_sources === "string" ? merged.data_sources : JSON.stringify(merged.data_sources || []),
    merged.status || "active",
    req.params.id
  );
  res.json(serialize(db.prepare("SELECT * FROM llm_nodes WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM llm_nodes WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
