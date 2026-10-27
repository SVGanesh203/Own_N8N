// services/llmProviders.js
// One function, callLLM(node, userQuery), that knows how to talk to a handful
// of providers. All of them get folded into the same shape:
//   { text, raw, ms }
// Add a new provider by adding a case below - nothing else in the app needs to change.

const fetch = require("node-fetch");

function buildSystemPrompt(node) {
  const sources = safeParse(node.data_sources, []);
  let sys = `You are "${node.name}". Your job: ${node.prompt}\n`;
  sys += `Stay strictly inside this job. If the user's question is outside it, say so briefly.\n`;
  if (sources.length) {
    sys += `\nAdditional reference material you were given (use it when relevant):\n`;
    sys += sources
      .map((s) => `- [${s.type}] ${s.name}${s.url ? `: ${s.url}` : ""}${s.content ? `\n  ${s.content.slice(0, 500)}` : ""}`)
      .join("\n");
  }
  return sys;
}

function safeParse(str, fallback) {
  try {
    return JSON.parse(str || "");
  } catch {
    return fallback;
  }
}

async function callOpenAICompatible(node, query, baseUrlDefault) {
  const baseUrl = node.base_url || baseUrlDefault;
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(node.api_key ? { Authorization: `Bearer ${node.api_key}` } : {}),
    },
    body: JSON.stringify({
      model: node.model,
      messages: [
        { role: "system", content: buildSystemPrompt(node) },
        { role: "user", content: query },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${node.provider} HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "(empty response)";
  return { text, raw: data };
}

async function callOllama(node, query) {
  const baseUrl = node.base_url || "http://localhost:11434";
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: node.model,
      messages: [
        { role: "system", content: buildSystemPrompt(node) },
        { role: "user", content: query },
      ],
      stream: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ollama HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.message?.content ?? "(empty response)";
  return { text, raw: data };
}

async function callGemini(node, query) {
  const model = node.model || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${node.api_key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(node) }] },
      contents: [{ role: "user", parts: [{ text: query }] }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`gemini HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(empty response)";
  return { text, raw: data };
}

/**
 * callLLM - dispatch to the right provider.
 * node.provider values:
 *   'nvidia'           -> NVIDIA NIM (OpenAI-compatible), default base_url https://integrate.api.nvidia.com/v1
 *   'ollama'            -> local/self-hosted Ollama server
 *   'gemini'            -> Google Generative Language API
 *   'openai_compatible' -> any OpenAI-compatible endpoint (Groq, Together, OpenAI, self-hosted vLLM, etc.)
 *                          node.base_url is REQUIRED for this one.
 */
async function callLLM(node, query) {
  const started = Date.now();
  let result;
  switch (node.provider) {
    case "nvidia":
      result = await callOpenAICompatible(node, query, "https://integrate.api.nvidia.com/v1");
      break;
    case "ollama":
      result = await callOllama(node, query);
      break;
    case "gemini":
      result = await callGemini(node, query);
      break;
    case "openai_compatible":
      if (!node.base_url) throw new Error("openai_compatible provider requires base_url");
      result = await callOpenAICompatible(node, query);
      break;
    default:
      throw new Error(`Unknown provider: ${node.provider}`);
  }
  return { ...result, ms: Date.now() - started };
}

module.exports = { callLLM, buildSystemPrompt };
