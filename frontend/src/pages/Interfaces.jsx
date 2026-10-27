import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const TYPES = [
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp (Cloud API)" },
  { value: "custom_webhook", label: "Custom webhook" },
];

function emptyForm() {
  return { type: "telegram", label: "", target_hub_id: "", enabled: false, credentials: {} };
}

export default function Interfaces() {
  const [interfaces, setInterfaces] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");

  const load = () => {
    Promise.all([api.listInterfaces(), api.listHubs()])
      .then(([i, h]) => { setInterfaces(i); setHubs(h); })
      .catch((e) => setErr(e.message));
  };
  useEffect(load, []);

  const openCreate = () => setForm(emptyForm());
  const openEdit = (i) => setForm({ ...i });
  const close = () => setForm(null);

  const save = async () => {
    try {
      if (form.id) await api.updateInterface(form.id, form);
      else await api.createInterface(form);
      close();
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm("Remove this interface?")) return;
    await api.deleteInterface(id);
    load();
  };

  const toggleEnabled = async (i) => {
    await api.updateInterface(i.id, { ...i, enabled: !i.enabled });
    load();
  };

  const hubName = (id) => hubs.find((h) => h.id === id)?.name || "— none —";

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold">Interfaces</h1>
        <button onClick={openCreate} className="bg-panel2 border border-line text-sm font-medium px-4 py-2 rounded-md hover:bg-line">
          + Connect interface
        </button>
      </div>
      <p className="text-mute text-sm mb-6">
        Connect chat channels. Only channels with the checkbox on will actually receive and answer messages.
      </p>

      {err && <div className="mb-4 text-sm text-fail font-mono">{err}</div>}

      <div className="space-y-3">
        {interfaces.map((i) => (
          <div key={i.id} className="bg-panel border border-line rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={i.enabled} onChange={() => toggleEnabled(i)} className="w-4 h-4" />
              <div>
                <div className="font-medium text-sm">{i.label} <span className="text-mute font-mono text-xs">({i.type})</span></div>
                <div className="text-xs text-mute mt-0.5">Routes to: {hubName(i.target_hub_id)}</div>
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <button onClick={() => openEdit(i)} className="text-flow hover:underline">Edit</button>
              <button onClick={() => remove(i.id)} className="text-fail hover:underline">Remove</button>
            </div>
          </div>
        ))}
        {interfaces.length === 0 && (
          <div className="text-mute text-sm border border-dashed border-line rounded-lg p-8 text-center">
            No interfaces connected yet.
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-panel border border-line rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-display text-lg font-semibold mb-4">{form.id ? "Edit interface" : "Connect interface"}</h2>

            <label className="block text-xs text-mute mb-1">Type</label>
            <select
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value, credentials: {} })}
              disabled={!!form.id}
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <label className="block text-xs text-mute mb-1">Label</label>
            <input
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. My Telegram bot"
            />

            <label className="block text-xs text-mute mb-1">Answers through</label>
            <select
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
              value={form.target_hub_id || ""}
              onChange={(e) => setForm({ ...form, target_hub_id: e.target.value })}
            >
              <option value="">— select a Central Hub —</option>
              {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>

            {form.type === "telegram" && (
              <>
                <label className="block text-xs text-mute mb-1">Bot token</label>
                <input
                  type="password"
                  className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
                  value={form.credentials.bot_token || ""}
                  onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, bot_token: e.target.value } })}
                  placeholder="123456:ABC-DEF…"
                />
                <p className="text-xs text-mute mb-3">
                  Set your webhook to <code className="font-mono">POST /api/interfaces/webhook/telegram</code> on your deployed backend.
                </p>
              </>
            )}

            {form.type === "whatsapp" && (
              <>
                <label className="block text-xs text-mute mb-1">Access token</label>
                <input
                  type="password"
                  className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
                  value={form.credentials.access_token || ""}
                  onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, access_token: e.target.value } })}
                />
                <label className="block text-xs text-mute mb-1">Phone number ID</label>
                <input
                  className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
                  value={form.credentials.phone_number_id || ""}
                  onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, phone_number_id: e.target.value } })}
                />
                <label className="block text-xs text-mute mb-1">Verify token (you choose this)</label>
                <input
                  className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm mb-3"
                  value={form.credentials.verify_token || ""}
                  onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, verify_token: e.target.value } })}
                />
                <p className="text-xs text-mute mb-3">
                  Register webhook URL <code className="font-mono">/api/interfaces/webhook/whatsapp</code> with this verify token in Meta's app dashboard.
                </p>
              </>
            )}

            {form.type === "custom_webhook" && (
              <p className="text-xs text-mute mb-3">
                Once saved and enabled, POST <code className="font-mono">{"{ text: \"...\" }"}</code> to
                {" "}<code className="font-mono">/api/interfaces/webhook/custom/{form.id || "<id-after-save>"}</code> and you'll get the hub's response back synchronously.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm mb-4">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Enabled (receive and answer messages on this channel)
            </label>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={close} className="text-sm text-mute px-4 py-2">Cancel</button>
              <button onClick={save} className="text-sm bg-flow text-white px-4 py-2 rounded-md">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
