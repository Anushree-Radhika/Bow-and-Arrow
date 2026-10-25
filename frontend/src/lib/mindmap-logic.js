/**
 * Pure state logic for the mind map canvas: no React, no DOM, no timers.
 * Time is passed in (`now`, ms) so the countdown is exact and testable.
 */

export const DEFAULT_SECONDS = 1800; // 30 minutes: every node starts here, and "scratch reset" returns here
export const QUICK_ADD = { m15: 15 * 60, h1: 60 * 60 };

export function initialState() {
  return { title: "", nodes: [], lastTick: 0, alarm: null, folderId: null };
}

const hasTime = (n) => n.remainingSeconds > 0;

// Subtract the whole seconds that have passed since lastTick from every running node.
// Based on timestamps (not "one per interval") so background-tab throttling can't make it drift.
export function tick(state, now) {
  const delta = Math.floor((now - state.lastTick) / 1000);
  if (delta <= 0) return state;
  let alarm = state.alarm;
  const nodes = state.nodes.map((n) => {
    if (n.status !== "running") return n;
    const remaining = Math.max(0, n.remainingSeconds - delta);
    if (remaining === 0) {
      alarm = { id: n.id, n: (alarm?.n ?? 0) + 1 };
      return { ...n, remainingSeconds: 0, status: "paused" };
    }
    return { ...n, remainingSeconds: remaining };
  });
  return { ...state, nodes, alarm, lastTick: state.lastTick + delta * 1000 };
}

const patch = (state, id, fn) => ({
  ...state,
  nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...fn(n) } : n)),
});

export function reducer(state, action) {
  switch (action.type) {
    case "TICK":
      return tick(state, action.now);

    case "LOAD_MAP": {
      const nodes = action.map.nodes.map((n) => ({ ...n, status: n.status ?? "idle", sources: n.sources ?? [] }));
      return { ...state, title: action.map.title, nodes, lastTick: action.now, alarm: null };
    }

    case "SET_FOLDER":
      return { ...state, folderId: action.folderId || null };

    case "HYDRATE": // restoring from storage: nothing was counting while the page was closed
      return {
        ...state,
        ...action.saved,
        nodes: (action.saved.nodes ?? []).map((n) => (n.status === "running" ? { ...n, status: "paused" } : n)),
        lastTick: action.now,
        alarm: null,
      };

    case "TOGGLE_RUN": {
      const s = tick(state, action.now);
      const target = s.nodes.find((n) => n.id === action.id);
      if (!target || target.status === "completed") return s;
      if (target.status === "running") return patch(s, action.id, () => ({ status: "paused" }));
      if (!hasTime(target)) return s; // out of time: add time or reset first
      // one focus at a time: starting a node pauses whatever else was running
      return {
        ...s,
        nodes: s.nodes.map((n) =>
          n.id === action.id ? { ...n, status: "running" } : n.status === "running" ? { ...n, status: "paused" } : n
        ),
      };
    }

    case "SET_COMPLETE": {
      const s = tick(state, action.now);
      return patch(s, action.id, (n) => ({
        status: action.value ? "completed" : n.remainingSeconds === n.totalSeconds ? "idle" : "paused",
      }));
    }

    case "ADD_TIME": {
      const s = tick(state, action.now);
      const secs = Math.max(0, Math.floor(action.seconds));
      return patch(s, action.id, (n) => ({
        totalSeconds: n.totalSeconds + secs,
        remainingSeconds: n.remainingSeconds + secs,
      }));
    }

    case "SET_NODE_TIME": {
      const s = tick(state, action.now);
      const secs = Math.max(60, Math.floor(action.seconds));
      return patch(s, action.id, (n) => ({
        totalSeconds: secs,
        remainingSeconds: secs,
        status: n.status === "completed" ? "idle" : n.status,
      }));
    }

    case "RESTART": {
      // "Scratch reset": back to fresh timer, not started, not completed
      const s = tick(state, action.now);
      const secs = action.seconds || DEFAULT_SECONDS;
      return patch(s, action.id, (n) => ({
        totalSeconds: secs,
        remainingSeconds: secs,
        status: "idle",
      }));
    }

    case "EXPAND": {
      const s = tick(state, action.now);
      const have = new Set(s.nodes.map((n) => n.id));
      const fresh = action.newNodes.filter((n) => !have.has(n.id)).map((n) => ({ ...n, status: n.status ?? "idle" }));
      return { ...s, nodes: [...s.nodes, ...fresh] };
    }

    default:
      return state;
  }
}

/** Translate the backend's /command response into reducer actions. */
export function actionsFromCommand(res, now) {
  switch (res.action) {
    case "COMPLETE":
      return [{ type: "SET_COMPLETE", id: res.targetNodeId, value: true, now }];
    case "ADD_TIME":
      return [{ type: "ADD_TIME", id: res.targetNodeId, seconds: res.seconds, now }];
    case "RESTART":
      return [{ type: "RESTART", id: res.targetNodeId, now }];
    case "EXPAND":
      return [{ type: "EXPAND", id: res.targetNodeId, newNodes: res.newNodes ?? [], now }];
    case "GENERATE_NEW_MAP":
      return res.map ? [{ type: "LOAD_MAP", map: res.map, now }] : [];
    default:
      return [];
  }
}

/** What the backend needs to know about the map to resolve "restart BFS". */
export function nodeStates(nodes) {
  return nodes.map(({ id, title, status, remainingSeconds, totalSeconds, parentId }) => ({
    id, title, status, remainingSeconds, totalSeconds, parentId,
  }));
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export const isTimeUp = (n) => n.status !== "completed" && n.remainingSeconds === 0;

// ------------------------------------------------------------------ layout

export const CARD = { w: 220, h: 84, gapX: 64, gapY: 20, pad: 32, rootW: 180, rootH: 46 };
export const ROOT_ID = "__root__";

/** Left-to-right tidy tree. Leaves take consecutive rows; parents centre on their children. */
export function layoutTree(nodes) {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map();
  for (const n of nodes) {
    const p = n.parentId && ids.has(n.parentId) ? n.parentId : ROOT_ID;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(n.id);
  }
  const pos = {};
  let row = 0;
  const rowH = CARD.h + CARD.gapY;
  const place = (id, depth) => {
    const children = kids.get(id) ?? [];
    let y;
    if (children.length === 0) {
      y = CARD.pad + row++ * rowH;
    } else {
      const ys = children.map((c) => place(c, depth + 1));
      y = (ys[0] + ys[ys.length - 1]) / 2;
    }
    const w = id === ROOT_ID ? CARD.rootW : CARD.w;
    const h = id === ROOT_ID ? CARD.rootH : CARD.h;
    pos[id] = { x: CARD.pad + depth * (CARD.w + CARD.gapX), y: id === ROOT_ID ? y + (CARD.h - CARD.rootH) / 2 : y, w, h, depth };
    return y;
  };
  place(ROOT_ID, 0);
  // children of the virtual root sit one column further right than their parent's column
  const edges = [];
  for (const [parent, children] of kids) {
    for (const c of children) {
      const a = pos[parent];
      const b = pos[c];
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y + b.h / 2;
      const mx = (x1 + x2) / 2;
      edges.push({ id: `${parent}->${c}`, from: parent, to: c, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` });
    }
  }
  const maxX = Math.max(...Object.values(pos).map((p) => p.x + p.w));
  const maxY = Math.max(...Object.values(pos).map((p) => p.y + p.h));
  return { pos, edges, width: maxX + CARD.pad, height: maxY + CARD.pad };
}
