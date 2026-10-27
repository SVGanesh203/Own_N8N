const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");

const router = express.Router();

function serialize(row) {
  return { ...row, hub_ids: JSON.parse(row.hub_ids || "[]") };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM super_hubs ORDER BY created_at DESC").all();
  res.json(rows.map(serialize));
});

router.post("/", (req, res) => {
  const { name, description, hub_ids } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const id = uuid();
  db.prepare(`INSERT INTO super_hubs (id, name, description, hub_ids) VALUES (?, ?, ?, ?)`).run(
    id,
    name,
    description || "",
    JSON.stringify(hub_ids || [])
  );
  res.status(201).json(serialize(db.prepare("SELECT * FROM super_hubs WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM super_hubs WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const merged = { ...existing, ...req.body };
  db.prepare(`UPDATE super_hubs SET name=?, description=?, hub_ids=?, updated_at=datetime('now') WHERE id = ?`).run(
    merged.name,
    merged.description || "",
    typeof merged.hub_ids === "string" ? merged.hub_ids : JSON.stringify(merged.hub_ids || []),
    req.params.id
  );
  res.json(serialize(db.prepare("SELECT * FROM super_hubs WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM super_hubs WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// Fan a query out to every central hub under this super hub, then combine.
router.post("/:id/query", async (req, res) => {
  const { runQuery } = require("../services/orchestrator");
  const superHub = db.prepare("SELECT * FROM super_hubs WHERE id = ?").get(req.params.id);
  if (!superHub) return res.status(404).json({ error: "Super hub not found" });
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "query is required" });

  const hubIds = JSON.parse(superHub.hub_ids || "[]");
  const hubs = hubIds
    .map((id) => db.prepare("SELECT * FROM central_hubs WHERE id = ?").get(id))
    .filter(Boolean);

  const perHub = await Promise.all(
    hubs.map(async (hub) => ({ hub_id: hub.id, hub_name: hub.name, ...(await runQuery(hub, query)) }))
  );

  res.json({ super_hub: superHub.name, per_hub: perHub });
});

module.exports = router;
