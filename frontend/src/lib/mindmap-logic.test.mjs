import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SECONDS, reducer, initialState, actionsFromCommand, formatClock, layoutTree, ROOT_ID, isTimeUp, CARD,
} from "./mindmap-logic.js";

const node = (id, extra = {}) => ({
  id, title: id, parentId: null, totalSeconds: DEFAULT_SECONDS, remainingSeconds: DEFAULT_SECONDS, status: "idle", sources: [], ...extra,
});
const load = (nodes, now = 0) => reducer(initialState(), { type: "LOAD_MAP", map: { title: "T", nodes }, now });
const get = (s, id) => s.nodes.find((n) => n.id === id);

test("default timer is exactly 30 minutes", () => {
  assert.equal(DEFAULT_SECONDS, 1800);
});

test("a running node counts down by whole elapsed seconds, not by interval count", () => {
  let s = load([node("a")], 0);
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 0 });
  s = reducer(s, { type: "TICK", now: 1000 });
  assert.equal(get(s, "a").remainingSeconds, 1799);
  s = reducer(s, { type: "TICK", now: 61_400 }); // tab was throttled for a minute
  assert.equal(get(s, "a").remainingSeconds, 1739);
  s = reducer(s, { type: "TICK", now: 61_400 }); // no double counting
  assert.equal(get(s, "a").remainingSeconds, 1739);
});

test("paused nodes do not count down; resuming continues from where they stopped", () => {
  let s = load([node("a")], 0);
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 0 });
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 10_000 }); // pause at 10s
  s = reducer(s, { type: "TICK", now: 50_000 });
  assert.equal(get(s, "a").remainingSeconds, 1790);
  assert.equal(get(s, "a").status, "paused");
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 50_000 });
  s = reducer(s, { type: "TICK", now: 55_000 });
  assert.equal(get(s, "a").remainingSeconds, 1785);
});

test("starting a node pauses the one that was running", () => {
  let s = load([node("a"), node("b")], 0);
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 0 });
  s = reducer(s, { type: "TOGGLE_RUN", id: "b", now: 5000 });
  assert.equal(get(s, "a").status, "paused");
  assert.equal(get(s, "a").remainingSeconds, 1795);
  assert.equal(get(s, "b").status, "running");
});

test("reaching zero stops the node, flags time up, and raises the alarm once", () => {
  let s = load([node("a", { remainingSeconds: 3, totalSeconds: 3 })], 0);
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 0 });
  s = reducer(s, { type: "TICK", now: 10_000 });
  const a = get(s, "a");
  assert.equal(a.remainingSeconds, 0);
  assert.equal(a.status, "paused");
  assert.ok(isTimeUp(a));
  assert.deepEqual(s.alarm, { id: "a", n: 1 });
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 11_000 }); // can't start with no time
  assert.equal(get(s, "a").status, "paused");
});

test("completing stops the clock and keeps the remaining time; unchecking returns to idle or paused", () => {
  let s = load([node("a")], 0);
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 0 });
  s = reducer(s, { type: "SET_COMPLETE", id: "a", value: true, now: 20_000 });
  assert.equal(get(s, "a").status, "completed");
  assert.equal(get(s, "a").remainingSeconds, 1780);
  s = reducer(s, { type: "TICK", now: 90_000 });
  assert.equal(get(s, "a").remainingSeconds, 1780);
  s = reducer(s, { type: "SET_COMPLETE", id: "a", value: false, now: 90_000 });
  assert.equal(get(s, "a").status, "paused");
});

test("add time extends both total and remaining, including while running", () => {
  let s = load([node("a")], 0);
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 0 });
  s = reducer(s, { type: "ADD_TIME", id: "a", seconds: 3600, now: 5000 });
  const a = get(s, "a");
  assert.equal(a.totalSeconds, 1800 + 3600);
  assert.equal(a.remainingSeconds, 1800 - 5 + 3600);
  assert.equal(a.status, "running");
});

test("add time revives a node whose time ran out", () => {
  let s = load([node("a", { remainingSeconds: 0, status: "paused" })]);
  s = reducer(s, { type: "ADD_TIME", id: "a", seconds: 900, now: 0 });
  s = reducer(s, { type: "TOGGLE_RUN", id: "a", now: 0 });
  assert.equal(get(s, "a").status, "running");
});

test("scratch reset restores a fresh 30 minutes and clears completion", () => {
  let s = load([node("a", { totalSeconds: 9000, remainingSeconds: 12, status: "completed" })]);
  s = reducer(s, { type: "RESTART", id: "a", now: 0 });
  assert.deepEqual(
    { t: get(s, "a").totalSeconds, r: get(s, "a").remainingSeconds, st: get(s, "a").status },
    { t: 1800, r: 1800, st: "idle" }
  );
});

test("expand appends children once even if the same response is applied twice", () => {
  let s = load([node("a")]);
  const kids = [node("k1", { parentId: "a" }), node("k2", { parentId: "a" })];
  s = reducer(s, { type: "EXPAND", id: "a", newNodes: kids, now: 0 });
  s = reducer(s, { type: "EXPAND", id: "a", newNodes: kids, now: 0 });
  assert.equal(s.nodes.length, 3);
});

test("restoring a saved session pauses anything that was running", () => {
  const saved = { title: "T", nodes: [node("a", { status: "running", remainingSeconds: 100 })], folderId: null };
  const s = reducer(initialState(), { type: "HYDRATE", saved, now: 500 });
  assert.equal(get(s, "a").status, "paused");
  assert.equal(get(s, "a").remainingSeconds, 100);
});

test("backend command responses map onto reducer actions", () => {
  assert.deepEqual(actionsFromCommand({ action: "COMPLETE", targetNodeId: "a" }, 1), [{ type: "SET_COMPLETE", id: "a", value: true, now: 1 }]);
  assert.deepEqual(actionsFromCommand({ action: "ADD_TIME", targetNodeId: "a", seconds: 3600 }, 1), [{ type: "ADD_TIME", id: "a", seconds: 3600, now: 1 }]);
  assert.deepEqual(actionsFromCommand({ action: "RESTART", targetNodeId: "a" }, 1), [{ type: "RESTART", id: "a", now: 1 }]);
  assert.equal(actionsFromCommand({ action: "EXPAND", targetNodeId: "a", newNodes: [] }, 1)[0].type, "EXPAND");
  assert.equal(actionsFromCommand({ action: "GENERATE_NEW_MAP", map: { title: "x", nodes: [] } }, 1)[0].type, "LOAD_MAP");
  assert.deepEqual(actionsFromCommand({ action: "SOMETHING_NEW" }, 1), []);
});

test("a full command round trip: add an hour, then complete", () => {
  let s = load([node("a"), node("b")], 0);
  for (const a of actionsFromCommand({ action: "ADD_TIME", targetNodeId: "b", seconds: 3600 }, 0)) s = reducer(s, a);
  for (const a of actionsFromCommand({ action: "COMPLETE", targetNodeId: "a" }, 0)) s = reducer(s, a);
  assert.equal(get(s, "b").remainingSeconds, 5400);
  assert.equal(get(s, "a").status, "completed");
});

test("clock formatting", () => {
  assert.equal(formatClock(1800), "30:00");
  assert.equal(formatClock(59), "00:59");
  assert.equal(formatClock(5400), "1:30:00");
  assert.equal(formatClock(-4), "00:00");
});

test("layout: columns by depth, parents centred on children, no overlaps, edges for every node", () => {
  const nodes = [
    node("r1"), node("r2"),
    node("c1", { parentId: "r1" }), node("c2", { parentId: "r1" }), node("g1", { parentId: "c2" }),
  ];
  const { pos, edges, width, height } = layoutTree(nodes);
  assert.equal(edges.length, nodes.length); // root->r1, root->r2, r1->c1, r1->c2, c2->g1
  assert.ok(pos[ROOT_ID].x < pos.r1.x && pos.r1.x < pos.c1.x && pos.c2.x < pos.g1.x);
  assert.equal(pos.c1.x, pos.c2.x);
  const mid = (pos.c1.y + pos.c2.y) / 2;
  assert.equal(pos.r1.y, mid);
  const cards = nodes.map((n) => pos[n.id]);
  for (const a of cards) for (const b of cards) {
    if (a === b || a.x !== b.x) continue;
    assert.ok(a.y + CARD.h <= b.y || b.y + CARD.h <= a.y, "cards in a column must not overlap");
  }
  assert.ok(width > 0 && height > 0);
});

test("layout survives an orphan whose parent is missing", () => {
  const { pos } = layoutTree([node("a", { parentId: "ghost" })]);
  assert.ok(pos.a);
});
