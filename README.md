# HubMind — your N8N-style multi-LLM orchestration system

This is a working skeleton of the architecture you described: LLM Nodes → Central Hub →
Super Hub → Interfaces. It's a real, running app (not a mockup) — every layer talks to
the layer next to it over a real HTTP API. Some of the "smart" behaviors are implemented
as lightweight stand-ins for now (see **What's stubbed vs. real** below) so the whole
skeleton runs today with zero paid API keys, and each stub is built to be swapped for
the fuller version later without changing anything around it.

## How this maps to your diagram

| Your diagram | This project |
|---|---|
| LLM 1 / LLM 2 / LLM 3 box (prompt + data + API key) | `llm_nodes` table + `/api/llm-nodes` + the **LLM Nodes** page |
| Central Hub (sync, retry, cache, smart routing) | `central_hubs` table + `services/orchestrator.js` + the **Central Hubs** page |
| Multiple Central Hubs → Super Central Hub | `super_hubs` table + `/api/super-hubs` + the **Super Hub** page |
| Interface connection (WhatsApp, Telegram, custom) | `interfaces` table + webhook routes + the **Interfaces** page |

## Project layout

```
n8n-clone/
  backend/     Node.js + Express + SQLite API — the Central Hub "brain" lives here
  frontend/    React (Vite) control panel — create nodes, hubs, super hubs, interfaces
```

## Running it locally

**Backend**
```bash
cd backend
npm install
cp .env.example .env
npm start          # -> http://localhost:8080
```

**Frontend** (in a second terminal)
```bash
cd frontend
npm install
npm run dev         # -> http://localhost:5173
```

Open http://localhost:5173. The Dashboard shows a live node → hub → interface graph
that reflects what you actually create.

## Deploying it (cloud)

You asked for cloud-deployable, so here's the straightforward path:

1. **Backend → Render or Railway** (both give you a persistent Node process, which
   SQLite needs — don't use a serverless platform for the backend as-is).
   - New Web Service, root directory `backend`, build command `npm install`,
     start command `npm start`.
   - Set the `CORS_ORIGIN` env var to your frontend's deployed URL once you have it.
   - Note: on Render's free tier the disk isn't persistent across deploys — for anything
     beyond testing, add a persistent disk (Render) or switch `db.js` to Postgres.

2. **Frontend → Vercel or Netlify**
   - Root directory `frontend`, build command `npm run build`, output directory `dist`.
   - Set env var `VITE_API_URL` to your backend's Render/Railway URL.

3. **Interfaces** (Telegram/WhatsApp) need your backend's **public** URL to register a
   webhook — that's why interfaces are the last thing to wire up, after step 1 is live.

## Getting your first LLM key (open source, free tier)

- **NVIDIA NIM** — free API keys with generous limits for open models (Llama, Mixtral,
  Gemma, Qwen). Sign up at build.nvidia.com, create a key, pick `provider: nvidia` and
  a model id like `meta/llama3-70b-instruct`.
- **Ollama** — fully free, runs models on your own machine/server. Install it, pull a
  model (`ollama pull llama3`), set `provider: ollama` and `base_url` to wherever
  Ollama is running.
- **Groq** — free tier, very fast open models. Use `provider: openai_compatible` with
  `base_url: https://api.groq.com/openai/v1`.

## What's stubbed vs. real right now

Everything routes and runs end-to-end. Three pieces from your spec are implemented as
simple, working heuristics rather than a dedicated small model — they do the job, and
are the clearest next upgrade:

- **Smart query analysis** (deciding which LLM nodes a query needs): keyword-overlap
  between the query and each node's job description. Works well once your node prompts
  are specific. Upgrade path: point `orchestrator.js`'s `pickRelevantNodes` at a real
  small model call instead.
- **Chat cache similarity check**: word-overlap scoring against recent queries in that
  hub. Upgrade path: replace with embeddings + vector similarity.
- **Response summary**: extractive (first ~140 chars per node). Upgrade path: one more
  LLM call that reads all node outputs and writes a real 2-line summary.

Everything else — node CRUD, hub/super-hub composition, parallel dispatch, retry-once-
then-reorder-then-report on failure, per-channel enable toggles, chat history — is real,
not mocked.

## Suggested next build sessions

1. Wire your first real LLM node (NVIDIA or Ollama) and confirm a live answer in the
   **Central Hubs → Test** panel.
2. Deploy backend + frontend, connect one interface (start with the custom webhook —
   no third-party approval needed).
3. Swap the three stubs above for real small-model calls once the skeleton feels right.
4. Harden for multi-user use: add auth, and move API keys out of plaintext SQLite into
   a secrets manager or at-rest encryption — right now they're stored as-is, which is
   fine solo/local but not for a shared deployment.
