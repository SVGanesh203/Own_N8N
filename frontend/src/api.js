// api.js — thin wrapper around the backend REST API.
// Set VITE_API_URL in a .env file at the frontend root when deploying
// (e.g. VITE_API_URL=https://your-backend.onrender.com)

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/api/health"),

  listNodes: () => request("/api/llm-nodes"),
  createNode: (data) => request("/api/llm-nodes", { method: "POST", body: JSON.stringify(data) }),
  updateNode: (id, data) => request(`/api/llm-nodes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNode: (id) => request(`/api/llm-nodes/${id}`, { method: "DELETE" }),

  listHubs: () => request("/api/hubs"),
  createHub: (data) => request("/api/hubs", { method: "POST", body: JSON.stringify(data) }),
  updateHub: (id, data) => request(`/api/hubs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteHub: (id) => request(`/api/hubs/${id}`, { method: "DELETE" }),
  queryHub: (id, query) => request(`/api/hubs/${id}/query`, { method: "POST", body: JSON.stringify({ query }) }),
  hubHistory: (id) => request(`/api/hubs/${id}/history`),

  listSuperHubs: () => request("/api/super-hubs"),
  createSuperHub: (data) => request("/api/super-hubs", { method: "POST", body: JSON.stringify(data) }),
  deleteSuperHub: (id) => request(`/api/super-hubs/${id}`, { method: "DELETE" }),
  querySuperHub: (id, query) => request(`/api/super-hubs/${id}/query`, { method: "POST", body: JSON.stringify({ query }) }),

  listInterfaces: () => request("/api/interfaces"),
  createInterface: (data) => request("/api/interfaces", { method: "POST", body: JSON.stringify(data) }),
  updateInterface: (id, data) => request(`/api/interfaces/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteInterface: (id) => request(`/api/interfaces/${id}`, { method: "DELETE" }),
};
