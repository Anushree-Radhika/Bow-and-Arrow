/**
 * Supabase Cloud Storage for Bow and Arrow.
 * 
 * All study roadmaps, timers, progress, and topic notes are stored
 * directly in Supabase (table `study_maps`) under the authenticated user's account.
 * No localStorage is used.
 */

import { supabase } from "./supabase";
import { deleteCloudMap, fetchCloudMaps, saveCloudMap } from "./api";

/**
 * Fetch all study roadmaps for the signed-in user directly from Supabase.
 */
export async function listSupabaseMaps() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("study_maps")
        .select("id, title, folder_id, nodes, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map((r) => ({
          id: r.id,
          title: r.title,
          folderId: r.folder_id,
          nodes: r.nodes || [],
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      }
    } catch (err) {
      console.warn("Direct Supabase query failed, falling back to backend API:", err.message);
    }
  }

  // Fallback to backend API endpoint (which also speaks to Supabase PostgREST with user's JWT)
  try {
    const cloudMaps = await fetchCloudMaps();
    if (Array.isArray(cloudMaps)) return cloudMaps;
  } catch (err) {
    console.error("Could not load maps from server:", err.message);
  }

  return [];
}

/**
 * Save or update a study roadmap in Supabase.
 */
export async function saveSupabaseMap(map) {
  if (!map || !map.id) return null;

  let userId = null;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      userId = data?.session?.user?.id || null;
    } catch {}
  }

  const folderId = (map.folderId && typeof map.folderId === "string" && map.folderId.trim().length > 0) 
    ? map.folderId 
    : null;

  const payload = {
    id: String(map.id),
    title: String(map.title || "Untitled Roadmap").slice(0, 200),
    folder_id: folderId,
    nodes: map.nodes || [],
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    payload.user_id = userId;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("study_maps")
        .upsert(payload)
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          title: data.title,
          folderId: data.folder_id,
          nodes: data.nodes || [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
      if (error) {
        console.warn("Direct Supabase upsert returned error:", error.message);
      }
    } catch (err) {
      console.warn("Direct Supabase upsert failed, falling back to backend API:", err.message);
    }
  }

  // Fallback to backend API
  try {
    return await saveCloudMap(map);
  } catch (err) {
    console.error("Failed saving roadmap to Supabase:", err.message);
    throw err;
  }
}

/**
 * Delete a study roadmap from Supabase.
 */
export async function deleteSupabaseMap(mapId) {
  if (!mapId) return false;

  if (supabase) {
    try {
      const { error } = await supabase
        .from("study_maps")
        .delete()
        .eq("id", String(mapId));

      if (!error) return true;
    } catch (err) {
      console.warn("Direct Supabase delete failed, falling back to backend API:", err.message);
    }
  }

  // Fallback to backend API
  try {
    await deleteCloudMap(mapId);
    return true;
  } catch (err) {
    console.error("Failed deleting roadmap from Supabase:", err.message);
    return false;
  }
}

// Auto-saving helpers with maxWait & beforeunload flush to guarantee no data loss on tab close
const pendingMaps = new Map();
const saveTimers = new Map();
const firstScheduledAt = new Map();

export async function flushPendingSupabaseSaves() {
  const promises = [];
  for (const [id, map] of pendingMaps.entries()) {
    if (saveTimers.has(id)) {
      clearTimeout(saveTimers.get(id));
      saveTimers.delete(id);
    }
    firstScheduledAt.delete(id);
    promises.push(saveSupabaseMap(map).catch((e) => console.warn("Supabase flush error:", e.message)));
  }
  pendingMaps.clear();
  await Promise.all(promises);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    flushPendingSupabaseSaves();
  });
}

export function debouncedSaveToSupabase(map, delayMs = 600, maxWaitMs = 3000) {
  if (!map || !map.id) return;

  pendingMaps.set(map.id, map);
  const now = Date.now();
  if (!firstScheduledAt.has(map.id)) {
    firstScheduledAt.set(map.id, now);
  }

  const elapsed = now - (firstScheduledAt.get(map.id) || now);

  const doSave = () => {
    saveTimers.delete(map.id);
    firstScheduledAt.delete(map.id);
    const m = pendingMaps.get(map.id);
    pendingMaps.delete(map.id);
    if (m) {
      saveSupabaseMap(m).catch((e) => console.warn("Supabase auto-save error:", e.message));
    }
  };

  if (elapsed >= maxWaitMs) {
    if (saveTimers.has(map.id)) {
      clearTimeout(saveTimers.get(map.id));
    }
    doSave();
    return;
  }

  if (saveTimers.has(map.id)) {
    clearTimeout(saveTimers.get(map.id));
  }

  const timer = setTimeout(doSave, delayMs);
  saveTimers.set(map.id, timer);
}

