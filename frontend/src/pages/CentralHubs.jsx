import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const EMPTY = { name: "", description: "", node_ids: [], settings: { cacheEnabled: true, sessionsToKeep: 20 } };

export default function CentralHubs() {
  const [hubs, setHubs] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [form, setForm] = useState(null);
  const [testHub, setTestHub] = useState(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    Promise.all([api.listHubs(), api.listNodes()])
      .then(([h, n]) => { setHubs(h); setNodes(n); })
      .catch((e) => setErr(e.message));
  };
  useEffect(load, []);

  const openCreate = () => setForm({ ...EMPTY, settings: { ...EMPTY.settings } });
  const openEdit = (h) => setForm({ ...h });
  const close = () => setForm(null);

  const toggleNode = (id) => {
    setForm((f) => ({
      ...f,
      node_ids: f.node_ids.includes(id) ? f.node_ids.filter((x) => x !== id) : [...f.node_ids, id],
    }));
  };

  const save = async () => {
    try {
      if (form.id) await api.updateHub(form.id, form);
      else await api.createHub(form);
      close();
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this Central Hub?")) return;
    await api.deleteHub(id);
    load();
  };

  const runTest = async () => {
    if (!testHub || !query.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await api.queryHub(testHub.id, query);
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setRunning(false);
    }
  };

  const nodeName = (id) => nodes.find((n) => n.id === id)?.name || id.slice(0, 8);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold">Central Hubs</h1>
        <button onClick={openCreate} className="bg-live text-white text-sm font-medium px-4 py-2 rounded-md hover:opacity-90">
          + New Central Hub
        </button>
      </div>
      <p className="text-mute text-sm mb-6">A hub groups LLM nodes, routes queries to the right ones, retries failures, and caches similar questions.</p>

      {err && <div className="mb-4 text-sm text-fail font-mono">{err}</div>}

      <div className="grid grid-cols-2 gap-4">
        {hubs.map((h) => (
          <div key={h.id} className="bg-panel border border-line rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display font-semibold">{h.name}</div>
                <div className="text-xs text-mute mt-1">{h.node_ids.length} node(s) assigned</div>
              </div>
              <div className="flex gap-2 text-xs">
                <button onClick={() => { setTestHub(h); setResult(null); setQuery(""); }} className="text-flow hover:underline">Test</button>
                <button onClick={() => openEdit(h)} className="text-flow hover:underline">Edit</button>
                <button onClick={() => remove(h.id)} className="text-fail hover:underline">Delete</button>
              </div>
            </div>
            {h.description && <div className="text-sm text-ink/90 mt-2">{h.description}</div>}
            <div className="flex flex-wrap gap-1 mt-3">
              {h.node_ids.map((id) => (
                <span key={id} className="text-[10px] font-mono bg-panel2 border border-line rounded px-2 py-1">{nodeName(id)}</span>
              ))}
            </div>
          </div>
        ))}
        {hubs.length === 0 && (
          <div className="col-span-2 text-mute text-sm border border-dashed border-line rounded-lg p-8 text-center">
            No Central Hubs yet — group some LLM nodes into one.
          </div>
        )}
      </div>

      {/* Create/edit modal */}
      {form && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-panel border border-line rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-display text-lg font-semibold mb-4">{form.id ? "Edit Central Hub" : "New Central Hub"}</h2>

            <label className="block text-xs text-mute mb-1">Name</label>
            <input
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. DSA Tutor Hub"
            />

            <label className="block text-xs text-mute mb-1">Description</label>
            <input
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            <label className="block text-xs text-mute mb-2">Assign LLM nodes</label>
            <div className="space-y-1 mb-4 max-h-40 overflow-y-auto border border-line rounded-md p-2">
              {nodes.map((n) => (
                <label key={n.id} className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-panel2 rounded">
                  <input type="checkbox" checked={form.node_ids.includes(n.id)} onChange={() => toggleNode(n.id)} />
                  {n.name}
                </label>
              ))}
              {nodes.length === 0 && <div className="text-xs text-mute px-2 py-1">Create LLM nodes first.</div>}
            </div>

            <label className="flex items-center gap-2 text-sm mb-2">
              <input
                type="checkbox"
                checked={form.settings.cacheEnabled !== false}
                onChange={(e) => setForm({ ...form, settings: { ...form.settings, cacheEnabled: e.target.checked } })}
              />
              Use smart chat cache (reuse past answers to similar questions)
            </label>

            <label className="block text-xs text-mute mb-1">Sessions to keep for cache/history</label>
            <input
              type="number"
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-4"
              value={form.settings.sessionsToKeep ?? 20}
              onChange={(e) => setForm({ ...form, settings: { ...form.settings, sessionsToKeep: Number(e.target.value) } })}
            />

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={close} className="text-sm text-mute px-4 py-2">Cancel</button>
              <button onClick={save} className="text-sm bg-live text-white px-4 py-2 rounded-md">Save hub</button>
            </div>
          </div>
        </div>
      )}

      {/* Test query modal */}
      {testHub && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-panel border border-line rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-display text-lg font-semibold mb-1">Test — {testHub.name}</h2>
            <p className="text-xs text-mute mb-4">Sends a real query through this hub's assigned nodes.</p>
            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2 text-sm"
                placeholder="Ask something…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runTest()}
              />
              <button onClick={runTest} disabled={running} className="text-sm bg-flow text-white px-4 py-2 rounded-md disabled:opacity-50">
                {running ? "Running…" : "Send"}
              </button>
            </div>

            {result?.error && <div className="text-sm text-fail font-mono">{result.error}</div>}
            {result && !result.error && (
              <div className="space-y-3">
                {result.cached && (
                  <div className="text-xs text-warn font-mono border border-warn/30 bg-warn/10 rounded px-3 py-2">
                    Answered from cache (similar to a previous question) — no new LLM tokens used.
                  </div>
                )}
                <div className="text-sm bg-panel2 border border-line rounded-md px-3 py-2">
                  <span className="text-mute text-xs block mb-1">Summary</span>
                  {result.summary}
                </div>
                {result.results?.map((r) => (
                  <div key={r.node_id} className="border border-line rounded-md px-3 py-2">
                    <div className="text-xs font-mono flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${r.ok ? "bg-live" : "bg-fail"}`} />
                      {r.node_name} {r.ok && `· ${r.ms}ms`} {r.retried && "· retried"}
                    </div>
                    <div className="text-sm">{r.ok ? r.text : r.error}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button onClick={() => setTestHub(null)} className="text-sm text-mute px-4 py-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
