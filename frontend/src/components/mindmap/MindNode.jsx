"use client";
import { memo } from "react";
import { FileText, GitBranchPlus, Loader2, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatClock, isTimeUp, QUICK_ADD } from "@/lib/mindmap-logic";

function MindNode({ node, box, expanding, onToggleRun, onComplete, onAdd, onReset, onExpand }) {
  const running = node.status === "running";
  const done = node.status === "completed";
  const up = isTimeUp(node);
  const pct = node.totalSeconds ? Math.max(0, Math.min(100, (node.remainingSeconds / node.totalSeconds) * 100)) : 0;
  const canPlay = !done && node.remainingSeconds > 0;
  const sources = node.sources ?? [];

  return (
    <article
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      aria-label={node.title}
      className={cn(
        "absolute flex flex-col gap-2 rounded-xl border bg-carbon-800 p-3.5 transition-colors",
        running && "border-running/70 shadow-[0_0_0_1px_hsl(var(--running)/0.25),0_8px_24px_-12px_hsl(var(--running)/0.35)]",
        up && "border-up/70",
        done && "border-done/40",
        !running && !up && !done && "border-carbon-700"
      )}
    >
      <header className="flex items-start gap-2.5">
        <Checkbox
          checked={done}
          onCheckedChange={(v) => onComplete(node.id, v === true)}
          aria-label={`Mark ${node.title} ${done ? "not complete" : "complete"}`}
          className="mt-0.5"
        />
        <h3 className={cn("line-clamp-2 flex-1 text-sm font-medium leading-snug", done && "text-muted-foreground line-through decoration-done/60")}>
          {node.title}
        </h3>
        <Button
          variant="ghost" size="iconSm" className="-mr-1.5 -mt-1 text-muted-foreground"
          onClick={() => onExpand(node)} disabled={expanding}
          aria-label={`Break ${node.title} into sub-topics`} title="Break into sub-topics"
        >
          {expanding ? <Loader2 className="animate-spin" /> : <GitBranchPlus />}
        </Button>
      </header>

      {node.description ? <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{node.description}</p> : null}

      <div className="mt-auto flex items-end justify-between gap-2">
        <div>
          <time
            aria-label={`${formatClock(node.remainingSeconds)} remaining`}
            className={cn(
              "block font-mono text-[2rem] font-medium leading-none tabular-nums tracking-tight",
              running && "text-running", up && "text-up", done && "text-muted-foreground"
            )}
          >
            {formatClock(node.remainingSeconds)}
          </time>
          <span className="mt-1 block h-4 text-xs text-muted-foreground" aria-live="polite">
            {up ? <span className="text-up">Time's up</span> : done ? "Completed" : running ? "Running" : node.status === "paused" ? "Paused" : "Ready"}
          </span>
        </div>
        <Button
          variant={running ? "secondary" : "default"} size="icon" className="rounded-full"
          disabled={!canPlay} onClick={() => onToggleRun(node.id)}
          aria-label={running ? `Pause ${node.title}` : `Start ${node.title}`}
        >
          {running ? <Pause /> : <Play />}
        </Button>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-carbon-700" role="presentation">
        <div
          className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", running ? "bg-running" : done ? "bg-done/60" : up ? "bg-up" : "bg-muted-foreground/60")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <footer className="flex items-center gap-1">
        <Button variant="secondary" size="sm" className="h-7 px-2" onClick={() => onAdd(node.id, QUICK_ADD.m15)} aria-label={`Add 15 minutes to ${node.title}`}>
          <Plus className="size-3" />15m
        </Button>
        <Button variant="secondary" size="sm" className="h-7 px-2" onClick={() => onAdd(node.id, QUICK_ADD.h1)} aria-label={`Add 1 hour to ${node.title}`}>
          <Plus className="size-3" />1hr
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={() => onReset(node.id)} aria-label={`Reset ${node.title} to 30 minutes from scratch`} title="Reset to 30 minutes">
          <RotateCcw className="size-3" />Scratch
        </Button>
        {sources.length > 0 && (
          <Badge className="ml-auto max-w-[96px] truncate" title={sources.join(", ")}>
            <FileText className="size-3 shrink-0" />
            <span className="truncate">{sources.length === 1 ? sources[0] : `${sources.length} sources`}</span>
          </Badge>
        )}
      </footer>
    </article>
  );
}

export default memo(MindNode);
