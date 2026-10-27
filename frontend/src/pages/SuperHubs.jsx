import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const EMPTY = { name: "", description: "", hub_ids: [] };

export default function SuperHubs() {
  const [superHubs, setSuperHubs] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [form, setForm] = useState(null);
  const [testSH, setTestSH] = useState(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    Promise.all([api.listSuperHubs(), api.listHubs()])
      .then(([sh, h]) => { setSuperHubs(sh); setHubs(h); })
      .catch((e) => setErr(e.message));
  };
  useEffect(load, []);

  const openCreate = () => setForm({ ...EMPTY });
  const close = () => setForm(null);

  const toggleHub = (id) => {
    setForm((f) => ({ ...f, hub_ids: f.hub_ids.includes(id) ? f.hub_ids.filter((x) => x !== id) : [...f.hub_ids, id] }));
  };

  const save = async () => {
    try {
      await api.createSuperHub(form);
      close();
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this Super Hub?")) return;
    await api.deleteSuperHub(id);
    load();
  };

  const runTest = async () => {
    if (!testSH || !query.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await api.querySuperHub(testSH.id, query);
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setRunning(false);
    }
  };

  const hubName = (id) => hubs.find((h) => h.id === id)?.name || id.slice(0, 8);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold">Super Hub</h1>
        <button onClick={openCreate} className="bg-warn text-white text-sm font-medium px-4 py-2 rounded-md hover:opacity-90">
          + New Super Hub
        </button>
      </div>
      <p className="text-mute text-sm mb-6">
        For project-scale work: combine several Central Hubs (e.g. "Frontend", "Backend", "Testing") under one coordinator.
      </p>

      {err && <div className="mb-4 text-sm text-fail font-mono">{err}</div>}

      <div className="grid grid-cols-2 gap-4">
        {superHubs.map((sh) => (
          <div key={sh.id} className="bg-panel border border-line rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display font-semibold">{sh.name}</div>
                <div className="text-xs text-mute mt-1">{sh.hub_ids.length} hub(s)</div>
              </div>
              <div className="flex gap-2 text-xs">
                <button onClick={() => { setTestSH(sh); setResult(null); setQuery(""); }} className="text-flow hover:underline">Test</button>
                <button onClick={() => remove(sh.id)} className="text-fail hover:underline">Delete</button>
              </div>
            </div>
            {sh.description && <div className="text-sm text-ink/90 mt-2">{sh.description}</div>}
            <div className="flex flex-wrap gap-1 mt-3">
              {sh.hub_ids.map((id) => (
                <span key={id} className="text-[10px] font-mono bg-panel2 border border-line rounded px-2 py-1">{hubName(id)}</span>
              ))}
            </div>
          </div>
        ))}
        {superHubs.length === 0 && (
          <div className="col-span-2 text-mute text-sm border border-dashed border-line rounded-lg p-8 text-center">
            No Super Hubs yet. Useful once you have more than one Central Hub to coordinate.
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-panel border border-line rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-display text-lg font-semibold mb-4">New Super Hub</h2>
            <label className="block text-xs text-mute mb-1">Name</label>
            <input
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Product Launch Coordinator"
            />
            <label className="block text-xs text-mute mb-1">Description</label>
            <input
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <label className="block text-xs text-mute mb-2">Include Central Hubs</label>
            <div className="space-y-1 mb-4 max-h-40 overflow-y-auto border border-line rounded-md p-2">
              {hubs.map((h) => (
                <label key={h.id} className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-panel2 rounded">
                  <input type="checkbox" checked={form.hub_ids.includes(h.id)} onChange={() => toggleHub(h.id)} />
                  {h.name}
                </label>
              ))}
              {hubs.length === 0 && <div className="text-xs text-mute px-2 py-1">Create Central Hubs first.</div>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={close} className="text-sm text-mute px-4 py-2">Cancel</button>
              <button onClick={save} className="text-sm bg-warn text-white px-4 py-2 rounded-md">Save</button>
            </div>
          </div>
        </div>
      )}

      {testSH && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-panel border border-line rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-display text-lg font-semibold mb-1">Test — {testSH.name}</h2>
            <p className="text-xs text-mute mb-4">Fans this query out to every Central Hub under this Super Hub.</p>
            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2 text-sm"
                placeholder="Describe the task…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runTest()}
              />
              <button onClick={runTest} disabled={running} className="text-sm bg-flow text-white px-4 py-2 rounded-md disabled:opacity-50">
                {running ? "Running…" : "Send"}
              </button>
            </div>
            {result?.error && <div className="text-sm text-fail font-mono">{result.error}</div>}
            {result?.per_hub?.map((h) => (
              <div key={h.hub_id} className="border border-line rounded-md px-3 py-2 mb-2">
                <div className="text-xs font-mono text-flow mb-1">{h.hub_name}</div>
                <div className="text-sm">{h.summary}</div>
              </div>
            ))}
            <div className="flex justify-end mt-4">
              <button onClick={() => setTestSH(null)} className="text-sm text-mute px-4 py-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
