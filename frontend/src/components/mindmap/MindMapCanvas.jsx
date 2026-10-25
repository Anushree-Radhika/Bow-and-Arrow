"use client";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/api";
import {
  CARD, ROOT_ID, actionsFromCommand, initialState, layoutTree, nodeStates, reducer, QUICK_ADD,
} from "@/lib/mindmap-logic";
import CommandBar from "./CommandBar";
import GeneratePanel from "./GeneratePanel";
import MindNode from "./MindNode";

const STORAGE_KEY = "organizer.map.v1";

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.28, 0.56].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.24);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

function speak(text) {
  try {
    window.speechSynthesis?.cancel();
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text));
  } catch {}
}

export default function MindMapCanvas() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [ready, setReady] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expanding, setExpanding] = useState(null);
  const lastAlarm = useRef(0);

  // restore the last session (client only, so server and client markup match on first paint)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", saved: JSON.parse(raw), now: Date.now() });
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ title: state.title, nodes: state.nodes, folderId: state.folderId }));
    } catch {}
  }, [ready, state.title, state.nodes, state.folderId]);

  // one interval, only while something is running; correctness comes from timestamps, not tick count
  const anyRunning = state.nodes.some((n) => n.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => dispatch({ type: "TICK", now: Date.now() }), 250);
    const onVisible = () => document.visibilityState === "visible" && dispatch({ type: "TICK", now: Date.now() });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [anyRunning]);

  useEffect(() => {
    if (!state.alarm || state.alarm.n === lastAlarm.current) return;
    lastAlarm.current = state.alarm.n;
    beep();
    const n = state.nodes.find((x) => x.id === state.alarm.id);
    if (n) setNotice({ kind: "ok", text: `Time's up for ${n.title}. Add time, or mark it complete.` });
  }, [state.alarm, state.nodes]);

  const now = () => Date.now();
  const onToggleRun = useCallback((id) => dispatch({ type: "TOGGLE_RUN", id, now: now() }), []);
  const onComplete = useCallback((id, value) => dispatch({ type: "SET_COMPLETE", id, value, now: now() }), []);
  const onAdd = useCallback((id, seconds) => dispatch({ type: "ADD_TIME", id, seconds, now: now() }), []);
  const onReset = useCallback((id) => dispatch({ type: "RESTART", id, now: now() }), []);

  const run = async (command, spoken = false, expandId = null) => {
    setBusy(true);
    setExpanding(expandId);
    setNotice(null);
    try {
      const res = await sendCommand({ command, nodes: nodeStates(state.nodes), mapTitle: state.title, folderId: state.folderId });
      for (const a of actionsFromCommand(res, now())) dispatch(a);
      if (res.action === "GENERATE_NEW_MAP") setShowGenerate(false);
      setNotice({ kind: "ok", text: res.reply });
      if (spoken) speak(res.reply);
    } catch (e) {
      setNotice({ kind: "error", text: e.message });
      if (spoken) speak(e.message);
    } finally {
      setBusy(false);
      setExpanding(null);
    }
  };

  const onExpand = useCallback((node) => run(`Expand ${node.title}`, false, node.id), [state.nodes, state.title, state.folderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onGenerated = (res) => {
    dispatch({ type: "LOAD_MAP", map: res, now: now() });
    setShowGenerate(false);
    const bits = [res.grounded ? `Built from ${res.sources.map((s) => s.title).join(", ")}.` : "Built from your prompt.", ...res.warnings];
    setNotice({ kind: "ok", text: bits.join(" ") });
  };

  const { pos, edges, width, height } = useMemo(() => layoutTree(state.nodes), [state.nodes]);
  const done = state.nodes.filter((n) => n.status === "completed").length;
  const hasMap = state.nodes.length > 0;
  const doneIds = useMemo(() => new Set(state.nodes.filter((n) => n.status === "completed").map((n) => n.id)), [state.nodes]);

  if (!ready) return null;

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4">
      {hasMap && (
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{state.title}</h1>
            <p className="text-sm text-muted-foreground">{done} of {state.nodes.length} topics complete</p>
          </div>
          {!showGenerate && (
            <Button variant="secondary" size="sm" onClick={() => setShowGenerate(true)}>
              <Plus /> New map
            </Button>
          )}
        </header>
      )}

      {(showGenerate || !hasMap) && (
        <GeneratePanel
          folderId={state.folderId}
          onFolderChange={(folderId) => dispatch({ type: "SET_FOLDER", folderId })}
          onGenerated={onGenerated}
          onCancel={hasMap ? () => setShowGenerate(false) : undefined}
        />
      )}

      {hasMap && !showGenerate && (
        <div
          className="relative max-h-[calc(100vh-17rem)] min-h-[380px] overflow-auto rounded-xl border border-carbon-700 bg-carbon-900"
          role="region" aria-label="Study map" tabIndex={0}
        >
          <div className="relative" style={{ width, height }}>
            <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
              {edges.map((e) => (
                <path
                  key={e.id} d={e.d} fill="none" strokeWidth={1.5}
                  className={doneIds.has(e.to) ? "stroke-done/40" : "stroke-carbon-700"}
                />
              ))}
            </svg>

            <div
              style={{ left: pos[ROOT_ID].x, top: pos[ROOT_ID].y, width: pos[ROOT_ID].w, height: pos[ROOT_ID].h }}
              className="absolute flex items-center rounded-xl border border-carbon-700 bg-carbon-800 px-4"
            >
              <span className="line-clamp-2 text-sm font-semibold leading-tight">{state.title}</span>
            </div>

            {state.nodes.map((n) => (
              <MindNode
                key={n.id} node={n} box={pos[n.id] ?? { x: 0, y: 0, w: CARD.w, h: CARD.h }} expanding={expanding === n.id}
                onToggleRun={onToggleRun} onComplete={onComplete} onAdd={onAdd} onReset={onReset} onExpand={onExpand}
              />
            ))}
          </div>
        </div>
      )}

      <CommandBar onSubmit={(text, spoken) => run(text, spoken)} busy={busy} notice={notice} />
    </main>
  );
}
