import { getAccessToken } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request(path, init = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to continue.");
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error("Can't reach the Organizer server. Check that the backend is running.");
  }
  if (!res.ok) {
    let message = `Something went wrong (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d) => d.msg).join(" ");
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

/** Dual engine: with PDFs the roadmap is grounded in them; without, it comes from the prompt alone. */
export function generateMap({ prompt, files = [], folderId }) {
  const form = new FormData();
  form.append("prompt", prompt);
  if (folderId) form.append("folderId", folderId);
  for (const f of files) form.append("files", f);
  return request("/api/mindmap/generate", { method: "POST", body: form });
}

export function sendCommand({ command, nodes, mapTitle, folderId }) {
  return request("/api/mindmap/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, nodes, mapTitle, folderId: folderId || null }),
  });
}
