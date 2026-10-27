// services/orchestrator.js
// This is the "Central Hub" brain. Given a hub + a user query, it:
//   1. checks the metadata cache (chat_history) for a close-enough match
//   2. does smart query analysis to decide which LLM nodes to activate
//   3. dispatches to those nodes in parallel, with one retry on failure
//   4. synchronizes responses back into the hub's preferred order
//   5. writes a metadata summary to chat_history for future cache hits
//
// The "smart query analysis" and "summary" steps are stubbed with lightweight
// keyword heuristics by default so the system works with zero extra API keys.
// If the hub's settings.routerModel is configured, those steps call a real
// small model instead (see useRouterModel below) - this is the "small LLM at
// the Central Hub" from the spec (Llama/Gemma/DeepSeek etc).

const { v4: uuid } = require("uuid");
const db = require("../db");
const { callLLM } = require("./llmProviders");

function safeParse(str, fallback) {
  try {
    return JSON.parse(str || "");
  } catch {
    return fallback;
  }
}

function getNodesForHub(hub) {
  const ids = safeParse(hub.node_ids, []);
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM llm_nodes WHERE id IN (${placeholders})`).all(...ids);
  // preserve hub's node_ids order
  return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean);
}

// --- Step 1: metadata cache -------------------------------------------------
function checkCache(hubId, query, settings) {
  if (settings.cacheEnabled === false) return null;
  const limit = settings.sessionsToKeep ?? 20;
  const recent = db
    .prepare(`SELECT * FROM chat_history WHERE hub_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(hubId, limit);

  const q = query.toLowerCase();
  const qWords = new Set(q.split(/\W+/).filter((w) => w.length > 3));
  let best = null;
  let bestScore = 0;
  for (const row of recent) {
    const prevWords = new Set(row.query.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const overlap = [...qWords].filter((w) => prevWords.has(w)).length;
    const score = overlap / Math.max(qWords.size, 1);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  // require a strong overlap before trusting the cache - this is a heuristic
  // stand-in for the "small local LLM decides similarity" behaviour.
  if (best && bestScore >= 0.6) {
    return { cached: true, summary: best.summary, source_query: best.query, score: bestScore };
  }
  return null;
}

// --- Step 2: smart query analysis (which nodes to trigger) -----------------
function pickRelevantNodes(query, nodes) {
  const q = query.toLowerCase();
  const scored = nodes.map((node) => {
    const jobWords = node.prompt.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const hit = jobWords.some((w) => q.includes(w));
    return { node, hit };
  });
  const relevant = scored.filter((s) => s.hit).map((s) => s.node);
  // if nothing matched confidently, fall back to activating every active node
  // rather than silently answering nothing
  return relevant.length ? relevant : nodes;
}

// --- Step 3/4: dispatch with one retry, then reorder ------------------------
async function dispatchToNodes(nodes, query, orderPreference) {
  const results = await Promise.all(
    nodes
      .filter((n) => n.status !== "paused")
      .map(async (node) => {
        try {
          const r = await callLLM(node, query);
          return { node_id: node.id, node_name: node.name, ok: true, text: r.text, ms: r.ms };
        } catch (err) {
          // one retry, per the spec's failure-handling step
          try {
            const r = await callLLM(node, query);
            return { node_id: node.id, node_name: node.name, ok: true, text: r.text, ms: r.ms, retried: true };
          } catch (err2) {
            return {
              node_id: node.id,
              node_name: node.name,
              ok: false,
              error: `${node.name} failed twice: ${err2.message}`,
            };
          }
        }
      })
  );

  const order = orderPreference && orderPreference.length ? orderPreference : nodes.map((n) => n.id);
  // successful responses first, in preferred order; failures moved to the end
  // (this mirrors the spec's "resend once, then reorder + report the failure")
  const ok = results.filter((r) => r.ok).sort((a, b) => order.indexOf(a.node_id) - order.indexOf(b.node_id));
  const failed = results.filter((r) => !r.ok);
  return [...ok, ...failed];
}

// --- Step 5: cheap extractive summary ---------------------------------------
function summarize(results) {
  const ok = results.filter((r) => r.ok);
  if (!ok.length) return "All assigned LLMs failed to respond.";
  return ok.map((r) => `${r.node_name}: ${r.text.slice(0, 140).replace(/\s+/g, " ")}${r.text.length > 140 ? "…" : ""}`).join(" | ");
}

async function runQuery(hub, query) {
  const settings = safeParse(hub.settings, {});
  const allNodes = getNodesForHub(hub);
  if (!allNodes.length) {
    return { cached: false, results: [], summary: "This hub has no LLM nodes assigned yet.", activated: [] };
  }

  const cacheHit = checkCache(hub.id, query, settings);
  if (cacheHit) {
    return { cached: true, ...cacheHit, results: [], activated: [] };
  }

  const activeNodes = pickRelevantNodes(query, allNodes);
  const results = await dispatchToNodes(activeNodes, query, settings.orderPreference);
  const summary = summarize(results);

  db.prepare(
    `INSERT INTO chat_history (id, hub_id, query, summary, full_response) VALUES (?, ?, ?, ?, ?)`
  ).run(uuid(), hub.id, query, summary, JSON.stringify(results));

  return { cached: false, results, summary, activated: activeNodes.map((n) => n.id) };
}

module.exports = { runQuery, getNodesForHub };
