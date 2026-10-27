// db.js
// Single SQLite file holding every node type in the system:
// llm_nodes -> central_hubs -> super_hubs, plus interfaces + chat_history.
// SQLite is enough for an MVP; swap for Postgres later without changing the API shape.

const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS llm_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,           -- the job assigned to this LLM
  provider TEXT NOT NULL,         -- 'nvidia' | 'ollama' | 'gemini' | 'openai_compatible' | 'groq' | ...
  base_url TEXT,                  -- override endpoint, needed for ollama / self-hosted / nvidia NIM
  model TEXT NOT NULL,
  api_key TEXT,                   -- stored as-is for MVP; see README for a note on hardening this
  data_sources TEXT DEFAULT '[]', -- JSON array of {type, name, content|url}
  status TEXT DEFAULT 'active',   -- 'active' | 'paused'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS central_hubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  node_ids TEXT DEFAULT '[]',     -- JSON array of llm_nodes.id
  settings TEXT DEFAULT '{}',     -- JSON: { orderPreference: [], retryOnce: true, cacheEnabled: true,
                                   --         routerModel: {provider, model, api_key}, sessionsToKeep: 20 }
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS super_hubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  hub_ids TEXT DEFAULT '[]',      -- JSON array of central_hubs.id
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interfaces (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,             -- 'telegram' | 'whatsapp' | 'custom_webhook'
  label TEXT,
  credentials TEXT DEFAULT '{}',  -- JSON, shape depends on type
  target_hub_id TEXT,             -- which central_hub answers messages from this interface
  enabled INTEGER DEFAULT 0,      -- the "tick box" from the spec
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  hub_id TEXT NOT NULL,
  query TEXT NOT NULL,
  summary TEXT,                   -- short metadata summary used for cheap cache hits later
  full_response TEXT,             -- JSON: per-node responses + timing + failures
  created_at TEXT DEFAULT (datetime('now'))
);
`);

module.exports = db;
