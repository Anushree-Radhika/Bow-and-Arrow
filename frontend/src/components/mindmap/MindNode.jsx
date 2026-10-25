"use client";
import { memo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  FileText,
  GitBranchPlus,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatClock, isTimeUp, QUICK_ADD } from "@/lib/mindmap-logic";

function MindNode({
  node,
  box,
  expanding,
  onToggleRun,
  onComplete,
  onAdd,
  onReset,
  onExpand,
  onSetTime,
}) {
  const running = node.status === "running";
  const done = node.status === "completed";
  const up = isTimeUp(node);
  const pct = node.totalSeconds
    ? Math.max(0, Math.min(100, (node.remainingSeconds / node.totalSeconds) * 100))
    : 0;
  const canPlay = !done && node.remainingSeconds > 0;
  const sources = node.sources ?? [];

  const [editingTime, setEditingTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(
    Math.max(1, Math.round((node.totalSeconds || 1800) / 60))
  );

  const handleSaveTime = () => {
    const mins = Math.max(1, Math.min(480, Number(customMinutes) || 1));
    if (onSetTime) onSetTime(node.id, mins * 60);
    setEditingTime(false);
  };

  const currentDurationMins = Math.round((node.totalSeconds || 1800) / 60);

  return (
    <article
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      aria-label={node.title}
      className={cn(
        "group absolute flex flex-col justify-between rounded-xl border p-2.5 transition-all duration-200 select-none shadow-md",
        "bg-[#181b22] hover:bg-[#1c2028]",
        running && "border-emerald-500/80 shadow-[0_0_16px_rgba(16,185,129,0.22)] ring-1 ring-emerald-500/40",
        up && "border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
        done && "border-emerald-500/30 bg-[#14181f]/80 opacity-80",
        !running && !up && !done && "border-[#2a2f3a] hover:border-[#3d4352]"
      )}
    >
      {/* Top Header: Checkbox, Title, and Expand action */}
      <div className="flex items-start gap-2">
        <Checkbox
          checked={done}
          onCheckedChange={(v) => onComplete(node.id, v === true)}
          aria-label={`Mark ${node.title} ${done ? "not complete" : "complete"}`}
          className="mt-0.5 size-3.5 rounded-sm border-[#3d4352] data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-600"
        />

        <h3
          className={cn(
            "flex-1 text-[12px] font-medium leading-tight line-clamp-2 text-slate-100",
            done && "text-slate-400 line-through decoration-emerald-500/70"
          )}
          title={node.title}
        >
          {node.title}
        </h3>

        <Button
          variant="ghost"
          size="iconSm"
          className="size-5 p-0 text-muted-foreground opacity-40 transition-opacity hover:text-indigo-400 hover:opacity-100 group-hover:opacity-100 shrink-0"
          onClick={() => onExpand(node)}
          disabled={expanding}
          aria-label={`Break ${node.title} into sub-topics`}
          title="Break into sub-topics"
        >
          {expanding ? <Loader2 className="size-3 animate-spin" /> : <GitBranchPlus className="size-3" />}
        </Button>
      </div>

      {/* Inline time editor popover if active */}
      {editingTime ? (
        <div className="flex items-center gap-1 rounded-md border border-[#3d4352] bg-[#121418] p-1 shadow-lg z-20">
          <Input
            type="number"
            min={1}
            max={480}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            className="h-5 w-11 px-1 text-center font-mono text-[11px]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTime();
              if (e.key === "Escape") setEditingTime(false);
            }}
          />
          <span className="text-[10px] text-muted-foreground">min</span>
          <Button variant="default" size="sm" className="h-5 px-1.5 text-[10px]" onClick={handleSaveTime}>
            Set
          </Button>
          <Button variant="ghost" size="iconSm" className="size-5 p-0" onClick={() => setEditingTime(false)}>
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        /* Bottom Row: Timer Chip + Play/Pause & Hover Action Buttons */
        <div className="flex items-center justify-between gap-1 mt-auto pt-1">
          {/* Timer Chip */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditingTime(true)}
              title="Click to adjust duration"
              className={cn(
                "flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[12px] font-semibold tracking-tight transition-colors",
                running
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                  : up
                  ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                  : done
                  ? "text-slate-400"
                  : "bg-[#1f232c] text-slate-300 hover:text-white border border-[#2a2f3a]"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  running ? "bg-emerald-400 animate-pulse" : up ? "bg-amber-400" : done ? "bg-slate-500" : "bg-slate-400"
                )}
              />
              {formatClock(node.remainingSeconds)}
            </button>

            {/* Play/Pause Button */}
            <Button
              variant={running ? "secondary" : "default"}
              size="iconSm"
              className={cn(
                "size-5 rounded-full p-0 shadow-sm transition-transform active:scale-95",
                running ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-indigo-600 text-white hover:bg-indigo-500"
              )}
              disabled={!canPlay}
              onClick={() => onToggleRun(node.id)}
              aria-label={running ? `Pause ${node.title}` : `Start ${node.title}`}
            >
              {running ? <Pause className="size-2.5 fill-current" /> : <Play className="size-2.5 fill-current ml-0.5" />}
            </Button>
          </div>

          {/* Micro Action Buttons (visible on group hover) */}
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onAdd(node.id, QUICK_ADD.m15)}
              className="rounded px-1 py-0.5 text-[10px] font-medium text-slate-300 hover:bg-[#2a2f3a] hover:text-white"
              title="Add 15 minutes"
            >
              +15m
            </button>
            <button
              type="button"
              onClick={() => onReset(node.id, node.totalSeconds)}
              className="rounded p-1 text-slate-400 hover:bg-[#2a2f3a] hover:text-white"
              title={`Reset to ${currentDurationMins} minutes`}
            >
              <RotateCcw className="size-2.5" />
            </button>
          </div>

          {/* Sources Indicator (if any) */}
          {sources.length > 0 && (
            <div
              className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground"
              title={sources.join(", ")}
            >
              <FileText className="size-2.5 text-indigo-400" />
            </div>
          )}
        </div>
      )}

      {/* Slim Progress Bar */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-[#262a34] mt-1" role="presentation">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            running ? "bg-emerald-400 shadow-[0_0_6px_#10b981]" : done ? "bg-emerald-600/70" : up ? "bg-amber-400" : "bg-indigo-500/60"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </article>
  );
}

export default memo(MindNode);
