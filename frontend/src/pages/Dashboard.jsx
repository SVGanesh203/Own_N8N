import React, { useEffect, useState } from "react";
import { api } from "../api.js";

function StatusDot({ color }) {
  return <span className={`inline-block w-2 h-2 rounded-full pulse`} style={{ background: color }} />;
}

export default function Dashboard() {
  const [nodes, setNodes] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [superHubs, setSuperHubs] = useState([]);
  const [interfaces, setInterfaces] = useState([]);
  const [apiOnline, setApiOnline] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false));
    Promise.all([api.listNodes(), api.listHubs(), api.listSuperHubs(), api.listInterfaces()])
      .then(([n, h, sh, i]) => {
        setNodes(n);
        setHubs(h);
        setSuperHubs(sh);
        setInterfaces(i);
      })
      .catch((e) => setErr(e.message));
  }, []);

  // Layout the graph: up to 5 nodes shown, feeding into one hub box, feeding an interface box.
  const shown = nodes.slice(0, 5);
  const nodeCount = Math.max(shown.length, 1);
  const graphHeight = Math.max(220, nodeCount * 56);
  const nodeX = 40, hubX = 320, hubW = 160, ifaceX = 560;
  const hubY = graphHeight / 2 - 40;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2 text-xs font-mono">
          <StatusDot color={apiOnline ? "#4CAF7D" : apiOnline === false ? "#E4626F" : "#8B93A3"} />
          <span className="text-mute">{apiOnline ? "backend online" : apiOnline === false ? "backend unreachable" : "checking…"}</span>
        </div>
      </div>
      <p className="text-mute text-sm mb-6">Every LLM node you create feeds into a Central Hub, which answers through your connected interfaces.</p>

      {err && (
        <div className="mb-6 text-sm text-fail font-mono border border-fail/30 bg-fail/10 rounded-md px-3 py-2">
          {err} — is the backend running and is VITE_API_URL set correctly?
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "LLM Nodes", value: nodes.length, color: "#5B8DEF" },
          { label: "Central Hubs", value: hubs.length, color: "#4CAF7D" },
          { label: "Super Hubs", value: superHubs.length, color: "#E8A23D" },
          { label: "Interfaces", value: interfaces.filter((i) => i.enabled).length + " / " + interfaces.length, color: "#8B93A3" },
        ].map((s) => (
          <div key={s.label} className="bg-panel border border-line rounded-lg px-4 py-3">
            <div className="text-2xl font-display font-semibold">{s.value}</div>
            <div className="text-xs text-mute mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-panel border border-line rounded-lg p-6">
        <div className="text-sm font-medium mb-4">Live flow</div>
        <svg viewBox={`0 0 640 ${graphHeight}`} width="100%" height={graphHeight} className="overflow-visible">
          {/* connections: nodes -> hub */}
          {shown.map((n, i) => {
            const y = 30 + i * ((graphHeight - 60) / Math.max(nodeCount - 1, 1) || 1) + (nodeCount === 1 ? graphHeight / 2 - 30 : 0);
            return (
              <line
                key={`l-${n.id}`}
                x1={nodeX + 120}
                y1={y + 16}
                x2={hubX}
                y2={hubY + 20}
                stroke="#5B8DEF"
                strokeWidth="1.5"
                className="flow-line"
                opacity="0.6"
              />
            );
          })}
          {/* hub -> interface, bidirectional */}
          <line x1={hubX + hubW} y1={hubY + 20} x2={ifaceX} y2={hubY + 20} stroke="#4CAF7D" strokeWidth="1.5" className="flow-line" opacity="0.6" />

          {/* node boxes */}
          {shown.length === 0 && (
            <text x={nodeX} y={graphHeight / 2} fill="#8B93A3" fontSize="12" fontFamily="JetBrains Mono">
              no LLM nodes yet
            </text>
          )}
          {shown.map((n, i) => {
            const y = 14 + i * ((graphHeight - 60) / Math.max(nodeCount - 1, 1) || 1) + (nodeCount === 1 ? graphHeight / 2 - 44 : 0);
            return (
              <g key={n.id}>
                <rect x={nodeX} y={y} width="120" height="32" rx="6" fill="#20262F" stroke="#2A3138" />
                <circle cx={nodeX + 12} cy={y + 16} r="3" fill={n.status === "active" ? "#4CAF7D" : "#8B93A3"} className="pulse" />
                <text x={nodeX + 24} y={y + 20} fill="#E8EAED" fontSize="11" fontFamily="JetBrains Mono">
                  {n.name.length > 14 ? n.name.slice(0, 13) + "…" : n.name}
                </text>
              </g>
            );
          })}
          {nodes.length > 5 && (
            <text x={nodeX} y={graphHeight - 6} fill="#8B93A3" fontSize="10" fontFamily="JetBrains Mono">
              +{nodes.length - 5} more
            </text>
          )}

          {/* hub box */}
          <rect x={hubX} y={hubY} width={hubW} height="40" rx="8" fill="#1B2028" stroke="#5B8DEF" strokeWidth="1.5" />
          <text x={hubX + hubW / 2} y={hubY + 24} fill="#E8EAED" fontSize="12" fontFamily="Space Grotesk" textAnchor="middle" fontWeight="600">
            Central Hub
          </text>

          {/* interface box */}
          <rect x={ifaceX} y={hubY} width="70" height="40" rx="8" fill="#20262F" stroke="#2A3138" />
          <text x={ifaceX + 35} y={hubY + 24} fill="#E8EAED" fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">
            you
          </text>
        </svg>
      </div>

      <div className="mt-6 text-xs text-mute">
        Start by creating an LLM node, group nodes into a Central Hub, then connect an interface — see the nav on the left.
      </div>
    </div>
  );
}
