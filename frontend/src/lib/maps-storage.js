/**
 * Multi-map persistence and management for Organizer.
 * Stores all user maps in localStorage, with automatic migration from v1.
 */

const MAPS_STORAGE_KEY = "organizer.maps.v2";
const ACTIVE_MAP_ID_KEY = "organizer.active_map_id.v2";
const LEGACY_STORAGE_KEY = "organizer.map.v1";

export function loadSavedMaps() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MAPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // Migrate from legacy single map storage if present
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && legacy.title && Array.isArray(legacy.nodes) && legacy.nodes.length > 0) {
        const migratedMap = {
          id: "map_" + Date.now().toString(36),
          title: legacy.title,
          nodes: legacy.nodes,
          folderId: legacy.folderId || null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        localStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify([migratedMap]));
        localStorage.setItem(ACTIVE_MAP_ID_KEY, migratedMap.id);
        return [migratedMap];
      }
    }
  } catch {}
  return [];
}

export function saveAllMaps(maps) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify(maps));
  } catch {}
}

export function getActiveMapId() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_MAP_ID_KEY) || null;
  } catch {
    return null;
  }
}

export function setActiveMapId(id) {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVE_MAP_ID_KEY, id);
    else localStorage.removeItem(ACTIVE_MAP_ID_KEY);
  } catch {}
}
