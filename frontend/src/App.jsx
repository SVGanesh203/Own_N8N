import React from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import LLMNodes from "./pages/LLMNodes.jsx";
import CentralHubs from "./pages/CentralHubs.jsx";
import SuperHubs from "./pages/SuperHubs.jsx";
import Interfaces from "./pages/Interfaces.jsx";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/nodes", label: "LLM Nodes" },
  { to: "/hubs", label: "Central Hubs" },
  { to: "/super-hubs", label: "Super Hub" },
  { to: "/interfaces", label: "Interfaces" },
];

export default function App() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-line bg-panel flex flex-col">
        <div className="px-5 py-6 border-b border-line">
          <div className="font-display text-lg font-semibold tracking-tight">HubMind</div>
          <div className="text-xs text-mute mt-1">LLM orchestration console</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? "bg-panel2 text-ink" : "text-mute hover:text-ink hover:bg-panel2/60"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-line text-xs text-mute font-mono">
          nodes → hub → super hub → interface
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nodes" element={<LLMNodes />} />
          <Route path="/hubs" element={<CentralHubs />} />
          <Route path="/super-hubs" element={<SuperHubs />} />
          <Route path="/interfaces" element={<Interfaces />} />
        </Routes>
      </main>
    </div>
  );
}
