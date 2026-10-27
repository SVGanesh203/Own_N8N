const express = require("express");
const fetch = require("node-fetch");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { runQuery } = require("../services/orchestrator");

const router = express.Router();

function serialize(row) {
  return { ...row, credentials: JSON.parse(row.credentials || "{}"), enabled: !!row.enabled };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM interfaces ORDER BY created_at DESC").all();
  res.json(rows.map(serialize));
});

router.post("/", (req, res) => {
  const { type, label, credentials, target_hub_id, enabled } = req.body;
  if (!type) return res.status(400).json({ error: "type is required (telegram | whatsapp | custom_webhook)" });
  const id = uuid();
  db.prepare(
    `INSERT INTO interfaces (id, type, label, credentials, target_hub_id, enabled) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, type, label || type, JSON.stringify(credentials || {}), target_hub_id || null, enabled ? 1 : 0);
  res.status(201).json(serialize(db.prepare("SELECT * FROM interfaces WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM interfaces WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE interfaces SET type=?, label=?, credentials=?, target_hub_id=?, enabled=? WHERE id = ?`
  ).run(
    merged.type,
    merged.label,
    typeof merged.credentials === "string" ? merged.credentials : JSON.stringify(merged.credentials || {}),
    merged.target_hub_id || null,
    merged.enabled ? 1 : 0,
    req.params.id
  );
  res.json(serialize(db.prepare("SELECT * FROM interfaces WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM interfaces WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// ---- Telegram webhook -------------------------------------------------
// Point Telegram at: POST https://<your-backend>/api/interfaces/webhook/telegram
router.post("/webhook/telegram", async (req, res) => {
  res.sendStatus(200); // ack immediately, Telegram expects a fast response
  try {
    const iface = db.prepare("SELECT * FROM interfaces WHERE type = 'telegram' AND enabled = 1").get();
    if (!iface) return; // channel not enabled -> per spec, silently ignore
    const creds = JSON.parse(iface.credentials || "{}");
    const text = req.body?.message?.text;
    const chatId = req.body?.message?.chat?.id;
    if (!text || !chatId || !iface.target_hub_id) return;

    const hub = db.prepare("SELECT * FROM central_hubs WHERE id = ?").get(iface.target_hub_id);
    if (!hub) return;
    const result = await runQuery(hub, text);

    await fetch(`https://api.telegram.org/bot${creds.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: result.summary || "No response generated." }),
    });
  } catch (err) {
    console.error("telegram webhook error:", err.message);
  }
});

// ---- WhatsApp Cloud API webhook ---------------------------------------
// Verification handshake (Meta requires this GET check when you register the webhook)
router.get("/webhook/whatsapp", (req, res) => {
  const iface = db.prepare("SELECT * FROM interfaces WHERE type = 'whatsapp' AND enabled = 1").get();
  const creds = iface ? JSON.parse(iface.credentials || "{}") : {};
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === creds.verify_token) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post("/webhook/whatsapp", async (req, res) => {
  res.sendStatus(200);
  try {
    const iface = db.prepare("SELECT * FROM interfaces WHERE type = 'whatsapp' AND enabled = 1").get();
    if (!iface) return;
    const creds = JSON.parse(iface.credentials || "{}");

    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    const text = msg?.text?.body;
    const from = msg?.from;
    if (!text || !from || !iface.target_hub_id) return;

    const hub = db.prepare("SELECT * FROM central_hubs WHERE id = ?").get(iface.target_hub_id);
    if (!hub) return;
    const result = await runQuery(hub, text);

    await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.access_token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: from,
        text: { body: result.summary || "No response generated." },
      }),
    });
  } catch (err) {
    console.error("whatsapp webhook error:", err.message);
  }
});

// ---- Generic custom webhook (build your own bridge) --------------------
// POST { text, session_id } -> returns the hub's response synchronously.
router.post("/webhook/custom/:interfaceId", async (req, res) => {
  const iface = db.prepare("SELECT * FROM interfaces WHERE id = ?").get(req.params.interfaceId);
  if (!iface || !iface.enabled) return res.status(403).json({ error: "Interface disabled or not found" });
  const hub = db.prepare("SELECT * FROM central_hubs WHERE id = ?").get(iface.target_hub_id);
  if (!hub) return res.status(400).json({ error: "This interface has no target hub configured" });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });
  try {
    const result = await runQuery(hub, text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
