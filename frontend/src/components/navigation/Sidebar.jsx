"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  FileText,
  FolderOpen,
  Loader2,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { generateMap } from "@/lib/api";
import { listFolders } from "@/lib/folders";
import { useAuth } from "@/components/AuthGate";
import { cn } from "@/lib/utils";

const DURATION_PRESETS = [15, 25, 30, 45, 60];

const SUGGESTIONS = [
  "Microservices & Event-Driven Architecture",
  "LeetCode: Graph Traversal & Dynamic Programming",
  "React 19 & Next.js App Router Architecture",
  "PostgreSQL: Indexing & Query Optimization",
];

function timeAgo(timestamp) {
  if (!timestamp) return "Recently";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Sidebar({
  maps = [],
  activeMapId,
  onSelectMap,
  onDeleteMap,
  onGenerated,
  folderId,
  onFolderChange,
  isOpen,
  onToggle,
  activeTab = "maps",
  onTabChange,
}) {
  const { user, signOut } = useAuth();

  // Internal tab state if not controlled
  const [localTab, setLocalTab] = useState("maps"); // "maps" | "create"
  const currentTab = onTabChange ? activeTab : localTab;
  const setTab = (t) => {
    if (onTabChange) onTabChange(t);
    else setLocalTab(t);
  };

  // Maps search
  const [search, setSearch] = useState("");

  // Create form state
  const [prompt, setPrompt] = useState("");
  const [nodeMinutes, setNodeMinutes] = useState(30);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [showRAG, setShowRAG] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    listFolders()
      .then(setFolders)
      .catch(() => {});
  }, []);

  const addFiles = (list) => {
    const pdfs = Array.from(list).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length < list.length) setError("Only PDF files are supported.");
    setFiles((cur) => [...cur, ...pdfs].slice(0, 5));
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await generateMap({
        prompt: prompt.trim(),
        files,
        folderId,
        nodeMinutes: Number(nodeMinutes) || 30,
      });
      onGenerated(res);
      setPrompt("");
      setFiles([]);
      setTab("maps"); // switch back to maps list
    } catch (err) {
      setError(err.message || "Failed to generate roadmap.");
    } finally {
      setBusy(false);
    }
  };

  const filteredMaps = maps.filter((m) =>
    (m.title || "Untitled Map").toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Side-by-side Collapsible Sidebar */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 flex h-full flex-col border-r border-[#232732] bg-[#12141a] transition-all duration-300 ease-in-out shrink-0 select-none",
          isOpen ? "w-80" : "w-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-r-0"
        )}
        aria-label="Organizer Sidebar"
      >
        <div className="flex h-full w-80 flex-col overflow-hidden">
          {/* 1. Header */}
          <div className="flex h-13 shrink-0 items-center justify-between border-b border-[#232732] px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 font-mono text-xs font-bold text-white shadow-md shadow-indigo-600/30">
                <BrainCircuit className="size-4" />
              </div>
              <div>
                <span className="font-mono text-xs font-bold tracking-wider text-slate-100 uppercase">
                  Organizer
                </span>
                <span className="block text-[10px] text-muted-foreground font-sans">
                  Study Platform
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="iconSm"
              onClick={onToggle}
              className="size-7 text-muted-foreground hover:text-white"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          {/* 2. Organized Segmented Tabs (2 Tabs: Maps & Create) */}
          <div className="px-3 pt-3 pb-2 shrink-0 border-b border-[#232732]/70 bg-[#14161f]/40">
            <div className="flex items-center rounded-xl border border-[#232732] bg-[#171a23] p-1 gap-1">
              <button
                type="button"
                onClick={() => setTab("maps")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                  currentTab === "maps"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-slate-200 hover:bg-[#1f232e]"
                )}
              >
                <FolderOpen className="size-3.5" />
                <span>Maps</span>
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                    currentTab === "maps" ? "bg-indigo-700 text-white" : "bg-[#232732] text-slate-400"
                  )}
                >
                  {maps.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTab("create")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                  currentTab === "create"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-slate-200 hover:bg-[#1f232e]"
                )}
              >
                <Sparkles className="size-3.5" />
                <span>Create</span>
              </button>
            </div>
          </div>

          {/* 3. Tab Contents */}
          <div className="flex-1 overflow-y-auto">
            {/* TAB 1: STUDY MAPS LIST */}
            {currentTab === "maps" && (
              <div className="flex flex-col h-full p-3 space-y-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search maps..."
                    className="h-8 rounded-lg border-[#232732] bg-[#161821] pl-8 text-xs text-slate-200 placeholder:text-muted-foreground focus-visible:ring-indigo-500"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                {/* Maps items list */}
                <div className="flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                  {filteredMaps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FolderOpen className="size-8 text-muted-foreground/50 mb-2" />
                      <p className="text-xs font-semibold text-slate-300">
                        {search ? "No maps found" : "No study maps yet"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {search ? "Try another keyword" : "Create your first interactive roadmap"}
                      </p>
                      {!search && (
                        <Button
                          size="sm"
                          onClick={() => setTab("create")}
                          className="mt-3 gap-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500"
                        >
                          <Plus className="size-3.5" /> Create Roadmap
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredMaps.map((map) => {
                      const isActive = map.id === activeMapId;
                      const total = map.nodes?.length || 0;
                      const completed = map.nodes?.filter((n) => n.status === "completed").length || 0;
                      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                      const isDone = total > 0 && completed === total;

                      return (
                        <div
                          key={map.id}
                          onClick={() => onSelectMap(map)}
                          className={cn(
                            "group relative flex flex-col rounded-xl border p-2.5 transition-all duration-150 cursor-pointer text-left",
                            isActive
                              ? "border-indigo-500/70 bg-[#1a1d28] shadow-sm"
                              : "border-[#232732]/80 bg-[#161821]/80 hover:border-[#333a4a] hover:bg-[#1a1c26]"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <h4
                              className={cn(
                                "text-xs font-semibold truncate leading-tight flex-1",
                                isActive ? "text-indigo-200 font-bold" : "text-slate-200 group-hover:text-white"
                              )}
                            >
                              {map.title || "Untitled Map"}
                            </h4>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete roadmap "${map.title}"?`)) {
                                  onDeleteMap(map.id);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-400 transition-opacity"
                              title="Delete map"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>

                          {/* Stats and mini progress bar */}
                          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span>
                              {completed}/{total} done
                            </span>
                            <span>{timeAgo(map.updatedAt || map.createdAt)}</span>
                          </div>

                          <div className="mt-1.5 h-1 w-full rounded-full bg-[#20242f] overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                isDone ? "bg-emerald-500" : "bg-indigo-500"
                              )}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CREATE MAP */}
            {currentTab === "create" && (
              <form onSubmit={handleCreate} className="flex flex-col h-full p-4 space-y-3.5">
                <div className="space-y-1.5">
                  <label htmlFor="sidebar-prompt" className="text-xs font-semibold text-slate-200">
                    What topic are you studying?
                  </label>
                  <Textarea
                    id="sidebar-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Distributed Caching with Redis & Memcached..."
                    className="min-h-[80px] resize-none rounded-xl border-[#232732] bg-[#161821] text-xs text-slate-100 placeholder:text-muted-foreground focus-visible:ring-indigo-500"
                    required
                  />
                </div>

                {/* Suggestions */}
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Quick ideas:</span>
                  <div className="flex flex-wrap gap-1">
                    {SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPrompt(s)}
                        className="rounded-md border border-[#232732] bg-[#161821] px-2 py-0.5 text-[10px] text-slate-300 hover:border-indigo-500/50 hover:text-white transition-colors truncate max-w-full text-left"
                      >
                        {s.split(":")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic Duration Presets */}
                <div className="rounded-xl border border-[#232732] bg-[#161821] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">Topic Timer Duration</span>
                    <span className="font-mono text-indigo-400 font-bold">{nodeMinutes} min</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {DURATION_PRESETS.map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={nodeMinutes === m ? "default" : "secondary"}
                        size="sm"
                        className={cn(
                          "h-6 px-2 text-[11px] rounded-lg",
                          nodeMinutes === m
                            ? "bg-indigo-600 text-white hover:bg-indigo-500"
                            : "bg-[#1f222d] text-slate-300 hover:bg-[#282d3b]"
                        )}
                        onClick={() => setNodeMinutes(m)}
                      >
                        {m}m{m === 25 ? " 🍅" : ""}
                      </Button>
                    ))}

                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-[10px] text-muted-foreground">Custom:</span>
                      <Input
                        type="number"
                        min={1}
                        max={480}
                        value={nodeMinutes}
                        onChange={(e) => setNodeMinutes(Math.max(1, Math.min(480, Number(e.target.value) || 1)))}
                        className="h-6 w-14 px-1 text-center text-xs rounded-lg border-[#232732] bg-[#1a1d26]"
                      />
                      <span className="text-[10px] text-muted-foreground">m</span>
                    </div>
                  </div>
                </div>

                {/* Collapsible PDF & Notes Section */}
                <div className="rounded-xl border border-[#232732] bg-[#161821] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRAG(!showRAG)}
                    className="flex w-full items-center justify-between p-2.5 text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    <span className="flex items-center gap-1.5">
                      <Upload className="size-3.5 text-indigo-400" />
                      Attach PDFs & Notes
                      {files.length > 0 && (
                        <Badge className="ml-1 bg-indigo-600 px-1 py-0 text-[10px]">{files.length}</Badge>
                      )}
                    </span>
                    <ChevronDown
                      className={cn("size-3.5 text-muted-foreground transition-transform", showRAG && "rotate-180")}
                    />
                  </button>

                  {showRAG && (
                    <div className="p-3 pt-0 border-t border-[#232732] space-y-2 mt-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        multiple
                        hidden
                        onChange={(e) => addFiles(e.target.files)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                        disabled={files.length >= 5}
                        className="w-full h-7 gap-1.5 rounded-lg border-[#232732] bg-[#12141a] text-xs text-slate-300 hover:bg-[#1a1d26]"
                      >
                        <Upload className="size-3" />
                        <span>Choose PDF files (max 5)</span>
                      </Button>

                      {files.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {files.map((f, i) => (
                            <span
                              key={i}
                              className="flex items-center gap-1 rounded-md border border-[#2d3342] bg-[#191c25] px-2 py-0.5 text-[10px] text-slate-300"
                            >
                              <FileText className="size-2.5 text-indigo-400" />
                              <span className="truncate max-w-[120px]">{f.name}</span>
                              <button
                                type="button"
                                onClick={() => setFiles((cur) => cur.filter((_, idx) => idx !== i))}
                                className="hover:text-rose-400"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {folders.length > 0 && (
                        <select
                          value={folderId ?? ""}
                          onChange={(e) => onFolderChange?.(e.target.value || null)}
                          className="h-7 w-full rounded-lg border border-[#232732] bg-[#12141a] px-2 text-xs text-slate-200 focus-visible:outline-none"
                        >
                          <option value="">No notes folder</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              📁 {f.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-2 text-xs text-rose-300">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={busy || !prompt.trim()}
                  className="w-full gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Synthesizing Roadmap...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      <span>Generate Study Roadmap</span>
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* 4. Footer: User Profile & Sign Out */}
          <div className="flex items-center justify-between border-t border-[#232732] bg-[#0f1116] px-4 py-2.5 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-7 items-center justify-center rounded-full bg-[#1e222e] text-indigo-400 border border-[#2d3342] text-xs font-medium shrink-0">
                <User className="size-3.5" />
              </div>
              <div className="truncate">
                <span className="block truncate text-xs font-medium text-slate-200">
                  {user?.email || "Student"}
                </span>
                <span className="block text-[10px] text-muted-foreground font-mono">
                  Active Session
                </span>
              </div>
            </div>

            {signOut && (
              <Button
                variant="ghost"
                size="iconSm"
                onClick={signOut}
                className="size-7 text-muted-foreground hover:text-rose-400"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
