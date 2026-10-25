"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  BrainCircuit,
  Compass,
  PanelLeft,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sendCommand } from "@/lib/api";
import {
  CARD,
  ROOT_ID,
  actionsFromCommand,
  initialState,
  layoutTree,
  nodeStates,
  reducer,
} from "@/lib/mindmap-logic";
import {
  deleteMapFromCloud,
  getActiveMapId,
  loadSavedMaps,
  persistMapToCloud,
  saveAllMaps,
  setActiveMapId,
  syncMapsWithCloud,
} from "@/lib/maps-storage";
import Sidebar from "@/components/navigation/Sidebar";
import CommandBar from "./CommandBar";
import MindNode from "./MindNode";
import NodeNotesDialog from "./NodeNotesDialog";
import { ArchersBowIcon } from "@/components/ui/ArchersBowIcon";
import { cn } from "@/lib/utils";

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
  } catch { }
}

function speak(text) {
  try {
    window.speechSynthesis?.cancel();
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text));
  } catch { }
}

export default function MindMapCanvas() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expanding, setExpanding] = useState(null);

  // Multi-map management & Sidebar State
  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapIdState] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState("maps"); // "maps" | "create"
  const [activeNotesNodeId, setActiveNotesNodeId] = useState(null);

  // Canvas Viewport & Zoom (Eraser-style 2D canvas with pan & zoom)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef(null);
  const panStartRef = useRef({ startX: 0, startY: 0, initialPanX: 60, initialPanY: 60 });
  const lastAlarm = useRef(0);

  // Load saved maps on mount & synchronize with cloud database
  useEffect(() => {
    try {
      const savedMaps = loadSavedMaps();
      setMaps(savedMaps);

      const savedActiveId = getActiveMapId();
      const initialMap = savedMaps.find((m) => m.id === savedActiveId) || savedMaps[0];

      if (initialMap) {
        setActiveMapIdState(initialMap.id);
        setActiveMapId(initialMap.id);
        dispatch({ type: "HYDRATE", saved: initialMap, now: Date.now() });
      } else {
        setSidebarTab("create");
      }

      const savedZoom = localStorage.getItem("bow_and_arrow.zoom.v1") || localStorage.getItem("organizer.zoom.v1");
      if (savedZoom) setZoom(Number(savedZoom) || 1);
    } catch {}
    setReady(true);

    // Synchronize with database in background
    syncMapsWithCloud()
      .then((cloudMaps) => {
        if (Array.isArray(cloudMaps) && cloudMaps.length > 0) {
          setMaps(cloudMaps);
          setActiveMapIdState((curActive) => {
            if (!curActive || !cloudMaps.some((m) => m.id === curActive)) {
              const first = cloudMaps[0];
              setActiveMapId(first.id);
              dispatch({ type: "HYDRATE", saved: first, now: Date.now() });
              return first.id;
            }
            return curActive;
          });
        }
      })
      .catch(() => {});
  }, []);

  const changeZoom = (newZoom) => {
    const clamped = Math.max(0.5, Math.min(1.6, Number(newZoom.toFixed(2))));
    setZoom(clamped);
    try {
      localStorage.setItem("organizer.zoom.v1", String(clamped));
    } catch { }
  };

  // Sync active map updates back into maps array and cloud database
  useEffect(() => {
    if (!ready || !activeMapId || !state.title) return;
    setMaps((prev) => {
      const idx = prev.findIndex((m) => m.id === activeMapId);
      if (idx === -1) return prev;
      const updated = {
        ...prev[idx],
        title: state.title,
        nodes: state.nodes,
        folderId: state.folderId,
        updatedAt: Date.now(),
      };
      const nextMaps = [...prev];
      nextMaps[idx] = updated;
      saveAllMaps(nextMaps);
      persistMapToCloud(updated);
      return nextMaps;
    });
  }, [ready, state.nodes, state.title, state.folderId, activeMapId]);

  // One interval timer while any node is running
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

  // Alarm when time is up
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
  const onReset = useCallback((id, seconds) => dispatch({ type: "RESTART", id, seconds, now: now() }), []);
  const onSetTime = useCallback((id, seconds) => dispatch({ type: "SET_NODE_TIME", id, seconds, now: now() }), []);
  const onSaveNotes = useCallback((id, notes, points) => dispatch({ type: "SET_NODE_NOTES", id, notes, points, now: now() }), []);

  const run = async (command, spoken = false, expandId = null) => {
    setBusy(true);
    setExpanding(expandId);
    setNotice(null);
    try {
      const res = await sendCommand({
        command,
        nodes: nodeStates(state.nodes),
        mapTitle: state.title,
        folderId: state.folderId,
      });
      for (const a of actionsFromCommand(res, now())) dispatch(a);
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

  const onExpand = useCallback(
    (node) => run(`Expand ${node.title}`, false, node.id),
    [state.nodes, state.title, state.folderId]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // Map generation handler
  const onGenerated = (res) => {
    const newId = "map_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
    const newMap = {
      id: newId,
      title: res.title,
      nodes: res.nodes,
      folderId: state.folderId || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const nextMaps = [newMap, ...maps.filter((m) => m.id !== newId)];
    setMaps(nextMaps);
    saveAllMaps(nextMaps);
    persistMapToCloud(newMap);
    setActiveMapIdState(newId);
    setActiveMapId(newId);

    dispatch({ type: "LOAD_MAP", map: res, now: now() });
    setPan({ x: 60, y: 60 });
    changeZoom(1);

    const bits = [
      res.grounded ? `Built from ${res.sources.map((s) => s.title).join(", ")}.` : "Built from your prompt.",
      ...res.warnings,
    ];
    setNotice({ kind: "ok", text: bits.join(" ") });
  };

  // Map selection from sidebar
  const handleSelectMap = (map) => {
    setActiveMapIdState(map.id);
    setActiveMapId(map.id);
    dispatch({ type: "LOAD_MAP", map, now: now() });
    setPan({ x: 60, y: 60 });
    changeZoom(1);
  };

  // Map deletion
  const handleDeleteMap = (id) => {
    const nextMaps = maps.filter((m) => m.id !== id);
    setMaps(nextMaps);
    saveAllMaps(nextMaps);
    deleteMapFromCloud(id);

    if (activeMapId === id) {
      if (nextMaps.length > 0) {
        handleSelectMap(nextMaps[0]);
      } else {
        setActiveMapIdState(null);
        setActiveMapId(null);
        dispatch({ type: "LOAD_MAP", map: { title: "", nodes: [] }, now: now() });
        setSidebarOpen(true);
        setSidebarTab("create");
      }
    }
  };

  // Pan & Drag on Eraser-style canvas (Supports Left, Right, Up, Down freely)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // only left click pans
    if (
      e.target.closest("article") ||
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest("select") ||
      e.target.closest("form") ||
      e.target.closest("[role='dialog']")
    ) {
      return;
    }
    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    setPan({
      x: Math.round(panStartRef.current.initialPanX + dx),
      y: Math.round(panStartRef.current.initialPanY + dy),
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Wheel handling: regular scroll/swipe pans in both X and Y; Ctrl+wheel / pinch zooms
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomDelta = -e.deltaY * 0.002;
      changeZoom(zoom + zoomDelta);
    } else {
      setPan((prev) => ({
        x: Math.round(prev.x - e.deltaX),
        y: Math.round(prev.y - e.deltaY),
      }));
    }
  };

  const resetView = () => {
    changeZoom(1);
    setPan({ x: 60, y: 60 });
  };

  const { pos, edges, width, height } = useMemo(() => layoutTree(state.nodes), [state.nodes]);
  const done = state.nodes.filter((n) => n.status === "completed").length;
  const hasMap = state.nodes.length > 0;
  const doneIds = useMemo(
    () => new Set(state.nodes.filter((n) => n.status === "completed").map((n) => n.id)),
    [state.nodes]
  );

  if (!ready) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0d0f14] text-slate-100 font-sans">
      {/* 1. Side-by-side Collapsible Sidebar (2 Clean Tabs: Maps & Create) */}
      <Sidebar
        maps={maps}
        activeMapId={activeMapId}
        onSelectMap={handleSelectMap}
        onDeleteMap={handleDeleteMap}
        onGenerated={onGenerated}
        folderId={state.folderId}
        onFolderChange={(folderId) => dispatch({ type: "SET_FOLDER", folderId })}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
      />

      {/* 2. Main Canvas Workspace Area */}
      <div className="relative flex flex-1 flex-col overflow-hidden w-full">
        {/* Top Header Bar */}
        <header className="flex h-13 w-full shrink-0 items-center justify-between border-b border-[#232732] bg-[#12141a]/90 px-4 py-2 backdrop-blur-md z-30">
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setSidebarOpen(true)}
                className="size-8 text-muted-foreground hover:bg-[#1f232c] hover:text-white"
                title="Open sidebar"
                aria-label="Open sidebar"
              >
                <PanelLeft className="size-4" />
              </Button>
            )}

            {hasMap ? (
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="truncate text-sm font-semibold text-slate-100 max-w-[280px] md:max-w-[420px]">
                  {state.title}
                </h1>
                <Badge
                  variant="outline"
                  className="hidden sm:inline-flex border-[#2d3342] bg-[#191c24] text-[11px] text-muted-foreground px-2 py-0.5"
                >
                  {done}/{state.nodes.length} topics done
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ArchersBowIcon className="size-4 text-indigo-400" />
                <span className="text-sm font-semibold text-slate-100">Bow and Arrow</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">• Study Canvas</span>
              </div>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSidebarOpen(true);
                setSidebarTab("create");
              }}
              className="h-8 gap-1.5 rounded-lg border border-[#2d3342] bg-[#191c24] text-xs font-medium text-slate-200 hover:bg-[#222631] hover:text-white shadow-sm"
              title="Create new roadmap"
            >
              <Plus className="size-3.5 text-indigo-400" />
              <span className="hidden sm:inline">New map</span>
            </Button>

            {/* Eraser-style Canvas Zoom Controls */}
            {hasMap && (
              <div className="flex items-center gap-1 rounded-lg border border-[#2d3342] bg-[#161922] p-0.5 shadow-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 font-mono text-xs font-bold text-slate-300 hover:bg-[#222631] hover:text-white"
                  onClick={() => changeZoom(zoom - 0.1)}
                  title="Zoom Out (A-)"
                  aria-label="Zoom out"
                >
                  A-
                </Button>

                <button
                  type="button"
                  onClick={resetView}
                  title="Click to reset zoom to 100%"
                  className="px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-white transition-colors"
                >
                  {Math.round(zoom * 100)}%
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 font-mono text-xs font-bold text-slate-300 hover:bg-[#222631] hover:text-white"
                  onClick={() => changeZoom(zoom + 0.1)}
                  title="Zoom In (A+)"
                  aria-label="Zoom in"
                >
                  A+
                </Button>

                <div className="mx-0.5 h-3.5 w-px bg-[#2d3342]" />

                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={resetView}
                  className="size-7 text-muted-foreground hover:text-white hover:bg-[#222631]"
                  title="Reset view and pan"
                  aria-label="Reset view"
                >
                  <Compass className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Workspace Body */}
        <div className="relative flex flex-1 flex-col overflow-hidden w-full">
          {/* Eraser.io Dot-Grid Canvas Viewport */}
          {hasMap ? (
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              style={{
                backgroundPosition: `${pan.x}px ${pan.y}px`,
              }}
              className={cn(
                "relative flex-1 w-full h-full overflow-hidden select-none",
                "bg-[#0d0f14] bg-[radial-gradient(#262c38_1.2px,transparent_1.2px)] [background-size:24px_24px]",
                isPanning ? "cursor-grabbing" : "cursor-grab"
              )}
              role="region"
              aria-label="Study mindmap canvas"
              tabIndex={0}
            >
              {/* Transform Plane with Pan & Zoom */}
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                  width,
                  height,
                }}
                className="absolute left-0 top-0 transition-transform duration-75 will-change-transform"
              >
                {/* SVG Connector Lines */}
                <svg
                  className="pointer-events-none absolute inset-0"
                  width={width}
                  height={height}
                  aria-hidden="true"
                >
                  {edges.map((e) => {
                    const isDone = doneIds.has(e.to);
                    return (
                      <path
                        key={e.id}
                        d={e.d}
                        fill="none"
                        strokeWidth={isDone ? 2 : 1.5}
                        className={cn(
                          "transition-colors duration-300",
                          isDone ? "stroke-emerald-500/80" : "stroke-[#2d3342]"
                        )}
                      />
                    );
                  })}
                </svg>

                {/* Root Node (Study Topic Title) */}
                <div
                  style={{
                    left: pos[ROOT_ID].x,
                    top: pos[ROOT_ID].y,
                    width: pos[ROOT_ID].w,
                    height: pos[ROOT_ID].h,
                  }}
                  className="absolute flex items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/70 px-3.5 shadow-lg shadow-indigo-950/50 backdrop-blur"
                  title="Main Roadmap Topic"
                >
                  <Sparkles className="size-3.5 text-indigo-300 shrink-0" />
                  <span className="line-clamp-2 text-xs font-semibold leading-tight text-indigo-100 text-center">
                    {state.title}
                  </span>
                </div>

                {/* Compact Mindmap Nodes */}
                {state.nodes.map((n) => (
                  <MindNode
                    key={n.id}
                    node={n}
                    box={pos[n.id] ?? { x: 0, y: 0, w: CARD.w, h: CARD.h }}
                    expanding={expanding === n.id}
                    onToggleRun={onToggleRun}
                    onComplete={onComplete}
                    onAdd={onAdd}
                    onReset={onReset}
                    onExpand={onExpand}
                    onSetTime={onSetTime}
                    onOpenNotes={(node) => setActiveNotesNodeId(node.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Welcome / Empty Canvas State */
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center bg-[#0d0f14] bg-[radial-gradient(#262c38_1.2px,transparent_1.2px)] [background-size:24px_24px]">
              <div className="max-w-md space-y-4 rounded-2xl border border-[#232732] bg-[#12141a]/90 p-8 backdrop-blur shadow-2xl">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <ArchersBowIcon className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Welcome to Bow and Arrow
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Select a study roadmap from the left sidebar, or create a new one to begin your focused study session.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                  <Button
                    onClick={() => {
                      setSidebarOpen(true);
                      setSidebarTab("maps");
                    }}
                    variant="outline"
                    className="w-full sm:w-auto gap-2 rounded-xl border-[#2d3342] bg-[#1a1d26] text-xs font-medium text-slate-200 hover:bg-[#202430] hover:text-white"
                  >
                    <PanelLeft className="size-3.5 text-indigo-400" />
                    <span>View Maps ({maps.length})</span>
                  </Button>

                  <Button
                    onClick={() => {
                      setSidebarOpen(true);
                      setSidebarTab("create");
                    }}
                    className="w-full sm:w-auto gap-2 rounded-xl bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/25"
                  >
                    <Sparkles className="size-3.5" />
                    <span>Create New Roadmap</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Command Bar at bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-xl">
              <CommandBar onSubmit={(text, spoken) => run(text, spoken)} busy={busy} notice={notice} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Topic Notes & Points Store Dialog (shadcn Card + Dialog) */}
      <NodeNotesDialog
        isOpen={Boolean(activeNotesNodeId)}
        onOpenChange={(open) => !open && setActiveNotesNodeId(null)}
        node={state.nodes.find((n) => n.id === activeNotesNodeId)}
        onSaveNotes={onSaveNotes}
      />
    </div>
  );
}