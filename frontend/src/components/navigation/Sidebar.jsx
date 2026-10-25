"use client";
import { useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Folder,
  LogOut,
  Map,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthGate";

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
  onNewMap,
  onDeleteMap,
  isOpen,
  onToggle,
}) {
  const { user, signOut } = useAuth();
  const [search, setSearch] = useState("");

  const filteredMaps = maps.filter((m) =>
    (m.title || "Untitled Map").toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 flex h-full flex-col border-r border-[#262a34] bg-[#121418] transition-all duration-300 ease-in-out shrink-0",
          isOpen ? "w-72" : "w-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-r-0"
        )}
        aria-label="Study maps sidebar"
      >
        <div className="flex h-full w-72 flex-col">
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-[#262a34] px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 font-mono text-xs font-bold text-white shadow-md shadow-indigo-600/30">
                <BrainCircuit className="size-4" />
              </div>
              <div>
                <span className="font-mono text-xs font-bold tracking-wider text-slate-100 uppercase">
                  Organizer
                </span>
                <span className="block text-[10px] text-muted-foreground font-sans">
                  Study Roadmaps
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="iconSm"
              onClick={onToggle}
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          {/* New Map CTA */}
          <div className="p-3">
            <Button
              onClick={onNewMap}
              className="w-full gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 font-medium text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-indigo-600"
              size="sm"
            >
              <Plus className="size-4" /> New Study Map
            </Button>
          </div>

          {/* Search bar */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search maps..."
                className="h-8 rounded-lg border-[#262a34] bg-[#191c22] pl-8 text-xs text-slate-200 placeholder:text-muted-foreground focus-visible:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Maps List Header */}
          <div className="flex items-center justify-between px-4 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <span>Your Maps</span>
            <Badge variant="outline" className="border-[#262a34] bg-[#191c22] px-1.5 py-0 text-[10px]">
              {maps.length}
            </Badge>
          </div>

          {/* Maps List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
            {filteredMaps.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {search ? "No maps match your search." : "No saved maps yet. Build your first map!"}
              </div>
            ) : (
              filteredMaps.map((map) => {
                const isActive = map.id === activeMapId;
                const nodes = map.nodes || [];
                const completedCount = nodes.filter((n) => n.status === "completed").length;
                const isAllDone = nodes.length > 0 && completedCount === nodes.length;

                return (
                  <div
                    key={map.id}
                    onClick={() => onSelectMap(map)}
                    className={cn(
                      "group relative flex cursor-pointer flex-col gap-1 rounded-xl border p-2.5 transition-all text-left",
                      isActive
                        ? "border-indigo-500/50 bg-[#1e222b] shadow-sm shadow-indigo-500/10"
                        : "border-transparent bg-transparent hover:border-[#262a34] hover:bg-[#191c22]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Map className={cn("size-3.5 shrink-0", isActive ? "text-indigo-400" : "text-muted-foreground")} />
                        <span className={cn("truncate text-xs font-medium", isActive ? "text-white" : "text-slate-300 group-hover:text-white")}>
                          {map.title || "Untitled Map"}
                        </span>
                      </div>

                      {/* Delete button (shows on hover) */}
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${map.title}"?`)) onDeleteMap(map.id);
                        }}
                        className="size-5 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                        title="Delete map"
                        aria-label="Delete map"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{nodes.length} topics</span>
                        <span>•</span>
                        {isAllDone ? (
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <CheckCircle2 className="size-2.5" /> All done
                          </span>
                        ) : (
                          <span>{completedCount}/{nodes.length} done</span>
                        )}
                      </div>
                      <span className="font-mono">{timeAgo(map.updatedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* User Profile & Sign Out Footer */}
          <div className="border-t border-[#262a34] bg-[#16181e] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-950 border border-indigo-500/40 font-mono text-xs font-bold text-indigo-300">
                  {user?.email ? user.email.slice(0, 2).toUpperCase() : "U"}
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-slate-200">
                    {user?.email || "Signed In"}
                  </span>
                  <span className="block text-[10px] text-emerald-400">Online</span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="iconSm"
                onClick={signOut}
                className="size-7 text-muted-foreground hover:bg-rose-950/30 hover:text-rose-400"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
