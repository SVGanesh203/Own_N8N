import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const PROVIDERS = [
  { value: "nvidia", label: "NVIDIA NIM (open source models)", needsBaseUrl: false },
  { value: "ollama", label: "Ollama (self-hosted / local, free)", needsBaseUrl: true },
  { value: "gemini", label: "Google Gemini", needsBaseUrl: false },
  { value: "openai_compatible", label: "OpenAI-compatible (Groq, Together, OpenAI, vLLM…)", needsBaseUrl: true },
];

const EMPTY = { name: "", prompt: "", provider: "nvidia", base_url: "", model: "", api_key: "", data_sources: [] };

export default function LLMNodes() {
  const [nodes, setNodes] = useState([]);
  const [form, setForm] = useState(null); // null = closed, object = editing/creating
  const [sourceDraft, setSourceDraft] = useState({ type: "link", name: "", url: "", content: "" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = () => api.listNodes().then(setNodes).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  useEffect(load, []);

  const openCreate = () => setForm({ ...EMPTY });
  const openEdit = (n) => setForm({ ...n });
  const close = () => { setForm(null); setSourceDraft({ type: "link", name: "", url: "", content: "" }); };

  const addSource = () => {
    if (!sourceDraft.name) return;
    setForm((f) => ({ ...f, data_sources: [...f.data_sources, sourceDraft] }));
    setSourceDraft({ type: "link", name: "", url: "", content: "" });
  };
  const removeSource = (i) => setForm((f) => ({ ...f, data_sources: f.data_sources.filter((_, idx) => idx !== i) }));

  const save = async () => {
    try {
      if (form.id) await api.updateNode(form.id, form);
      else await api.createNode(form);
      close();
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this LLM node?")) return;
    await api.deleteNode(id);
    load();
  };

  const toggleStatus = async (n) => {
    await api.updateNode(n.id, { ...n, status: n.status === "active" ? "paused" : "active" });
    load();
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold">LLM Nodes</h1>
        <button onClick={openCreate} className="bg-flow text-white text-sm font-medium px-4 py-2 rounded-md hover:opacity-90">
          + New LLM node
        </button>
      </div>
      <p className="text-mute text-sm mb-6">Each node is one job: a prompt, its own data, and its own API key. Create as many as the task needs.</p>

      {err && <div className="mb-4 text-sm text-fail font-mono">{err}</div>}
      {loading && <div className="text-mute text-sm">Loading…</div>}

      <div className="grid grid-cols-2 gap-4">
        {nodes.map((n) => (
          <div key={n.id} className="bg-panel border border-line rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display font-semibold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${n.status === "active" ? "bg-live" : "bg-mute"}`} />
                  {n.name}
                </div>
                <div className="text-xs text-mute font-mono mt-1">{n.provider} · {n.model}</div>
              </div>
              <div className="flex gap-2 text-xs">
                <button onClick={() => toggleStatus(n)} className="text-mute hover:text-ink">
                  {n.status === "active" ? "Pause" : "Activate"}
                </button>
                <button onClick={() => openEdit(n)} className="text-flow hover:underline">Edit</button>
                <button onClick={() => remove(n.id)} className="text-fail hover:underline">Delete</button>
              </div>
            </div>
            <div className="text-sm text-ink/90 mt-3 line-clamp-3">{n.prompt}</div>
            {n.data_sources?.length > 0 && (
              <div className="text-xs text-mute mt-3 font-mono">{n.data_sources.length} data source(s) attached</div>
            )}
          </div>
        ))}
        {!loading && nodes.length === 0 && (
          <div className="col-span-2 text-mute text-sm border border-dashed border-line rounded-lg p-8 text-center">
            No LLM nodes yet — create one to give it a job.
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-panel border border-line rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-display text-lg font-semibold mb-4">{form.id ? "Edit LLM node" : "New LLM node"}</h2>

            <label className="block text-xs text-mute mb-1">Name</label>
            <input
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Java/Python code generator"
            />

            <label className="block text-xs text-mute mb-1">Job (prompt)</label>
            <textarea
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3 min-h-[80px]"
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              placeholder="Only answer with working code in Java and Python for the question asked."
            />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-mute mb-1">Provider</label>
                <select
                  className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm"
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-mute mb-1">Model</label>
                <input
                  className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g. meta/llama3-70b-instruct"
                />
              </div>
            </div>

            {PROVIDERS.find((p) => p.value === form.provider)?.needsBaseUrl && (
              <>
                <label className="block text-xs text-mute mb-1">Base URL</label>
                <input
                  className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
                  value={form.base_url || ""}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                  placeholder="http://localhost:11434 or https://api.groq.com/openai/v1"
                />
              </>
            )}

            <label className="block text-xs text-mute mb-1">API key {form.provider === "ollama" ? "(usually not needed for local Ollama)" : ""}</label>
            <input
              type="password"
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-4"
              value={form.api_key || ""}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="sk-…"
            />

            <label className="block text-xs text-mute mb-2">Additional data (optional)</label>
            <div className="space-y-2 mb-2">
              {form.data_sources.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-panel2 border border-line rounded-md px-3 py-2 text-xs">
                  <span className="font-mono">[{s.type}] {s.name}{s.url ? ` — ${s.url}` : ""}</span>
                  <button onClick={() => removeSource(i)} className="text-fail">remove</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <select
                className="bg-panel2 border border-line rounded-md px-2 py-2 text-xs"
                value={sourceDraft.type}
                onChange={(e) => setSourceDraft({ ...sourceDraft, type: e.target.value })}
              >
                <option value="link">link</option>
                <option value="doc">doc/text</option>
              </select>
              <input
                className="flex-1 bg-panel2 border border-line rounded-md px-2 py-2 text-xs"
                placeholder="Label"
                value={sourceDraft.name}
                onChange={(e) => setSourceDraft({ ...sourceDraft, name: e.target.value })}
              />
              <input
                className="flex-1 bg-panel2 border border-line rounded-md px-2 py-2 text-xs"
                placeholder={sourceDraft.type === "link" ? "URL" : "Paste text"}
                value={sourceDraft.type === "link" ? sourceDraft.url : sourceDraft.content}
                onChange={(e) =>
                  setSourceDraft({ ...sourceDraft, [sourceDraft.type === "link" ? "url" : "content"]: e.target.value })
                }
              />
              <button onClick={addSource} className="text-xs bg-panel2 border border-line rounded-md px-3">Add</button>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={close} className="text-sm text-mute px-4 py-2">Cancel</button>
              <button onClick={save} className="text-sm bg-flow text-white px-4 py-2 rounded-md">Save node</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
