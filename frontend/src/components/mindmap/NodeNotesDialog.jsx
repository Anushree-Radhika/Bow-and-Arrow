"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  FileText,
  ListTodo,
  NotebookPen,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/mindmap-logic";

export default function NodeNotesDialog({
  isOpen,
  onOpenChange,
  node,
  onSaveNotes,
}) {
  if (!node) return null;

  const [points, setPoints] = useState(node.points || []);
  const [notes, setNotes] = useState(node.notes || "");
  const [newPointText, setNewPointText] = useState("");

  // Sync state whenever active node changes
  useEffect(() => {
    setPoints(node.points || []);
    setNotes(node.notes || "");
    setNewPointText("");
  }, [node]);

  const handleAddPoint = (e) => {
    e?.preventDefault();
    const text = newPointText.trim();
    if (!text) return;
    const newPoint = {
      id: "pt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 5),
      text,
      done: false,
      createdAt: Date.now(),
    };
    const nextPoints = [...points, newPoint];
    setPoints(nextPoints);
    setNewPointText("");
    onSaveNotes?.(node.id, notes, nextPoints);
  };

  const handleTogglePoint = (pointId, done) => {
    const nextPoints = points.map((p) => (p.id === pointId ? { ...p, done } : p));
    setPoints(nextPoints);
    onSaveNotes?.(node.id, notes, nextPoints);
  };

  const handleDeletePoint = (pointId) => {
    const nextPoints = points.filter((p) => p.id !== pointId);
    setPoints(nextPoints);
    onSaveNotes?.(node.id, notes, nextPoints);
  };

  const handleNotesChange = (text) => {
    setNotes(text);
    onSaveNotes?.(node.id, text, points);
  };

  const completedPointsCount = points.filter((p) => p.done).length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] flex flex-col p-0 border border-[#2d3342] bg-[#12141a] text-slate-100 shadow-2xl overflow-hidden rounded-2xl">
        <Card className="flex flex-col h-full border-0 bg-transparent shadow-none rounded-none overflow-hidden">
          {/* Card / Dialog Header */}
          <CardHeader className="p-5 pb-3 border-b border-[#232732] bg-[#151821]/80 shrink-0">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-indigo-500/40 bg-indigo-950/60 text-[10px] text-indigo-300 px-2 py-0.5"
                  >
                    Topic Scratchpad
                  </Badge>
                  {node.sources?.length > 0 && (
                    <Badge
                      variant="outline"
                      className="border-[#2d3342] bg-[#1a1d26] text-[10px] text-muted-foreground px-2 py-0.5 truncate max-w-[200px]"
                    >
                      📚 {node.sources.join(", ")}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base font-bold text-white truncate leading-snug">
                  {node.title}
                </CardTitle>
                {node.description && (
                  <CardDescription className="text-xs text-slate-400 line-clamp-2">
                    {node.description}
                  </CardDescription>
                )}
              </div>

              {/* Status and timer pill */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge
                  className={cn(
                    "text-[10px] font-mono",
                    node.status === "completed"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40"
                      : node.status === "running"
                      ? "bg-indigo-950 text-indigo-300 border border-indigo-500/40"
                      : "bg-[#1f222d] text-slate-300 border border-[#2d3342]"
                  )}
                >
                  ⏱ {formatClock(node.remainingSeconds)}
                </Badge>
              </div>
            </div>
          </CardHeader>

          {/* Card Content (Scrollable) */}
          <CardContent className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 1. Point-wise Store Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <ListTodo className="size-4 text-indigo-400" />
                  <span>Key Points & Takeaways</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {completedPointsCount}/{points.length} mastered
                </span>
              </div>

              {/* Add Point Input */}
              <form onSubmit={handleAddPoint} className="flex gap-2">
                <Input
                  value={newPointText}
                  onChange={(e) => setNewPointText(e.target.value)}
                  placeholder="Add a key point, concept, formula, or interview takeaway..."
                  className="h-8 text-xs rounded-lg border-[#2d3342] bg-[#171a23] text-slate-100 placeholder:text-muted-foreground focus-visible:ring-indigo-500"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newPointText.trim()}
                  className="h-8 gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-500 shadow-sm shrink-0 disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  <span>Add Point</span>
                </Button>
              </form>

              {/* Points List */}
              <div className="space-y-1.5 pt-1">
                {points.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#2d3342] bg-[#161821]/40 p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      No points written yet. Type your takeaways above to build a point-wise study summary!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {points.map((pt) => (
                      <div
                        key={pt.id}
                        className={cn(
                          "group flex items-start gap-2.5 rounded-lg border p-2 text-xs transition-colors",
                          pt.done
                            ? "border-emerald-500/30 bg-emerald-950/20 text-slate-400"
                            : "border-[#262c38] bg-[#171a23] text-slate-200 hover:border-[#384052]"
                        )}
                      >
                        <Checkbox
                          checked={pt.done}
                          onCheckedChange={(checked) => handleTogglePoint(pt.id, checked === true)}
                          className="mt-0.5 size-3.5 rounded-sm border-[#384052] data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-600"
                        />
                        <span
                          className={cn(
                            "flex-1 leading-snug break-words",
                            pt.done && "line-through text-slate-400 decoration-emerald-500/60"
                          )}
                        >
                          {pt.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeletePoint(pt.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-rose-400 transition-opacity"
                          title="Delete point"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Freeform Notes & Code Scratchpad */}
            <div className="space-y-1.5 pt-2 border-t border-[#232732]/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <NotebookPen className="size-4 text-indigo-400" />
                  <span>Freeform Notes & Code</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Auto-saved to node</span>
              </div>

              <Textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Write detailed explanations, implementation notes, or syntax examples for this topic..."
                className="min-h-[100px] resize-y rounded-xl border-[#2d3342] bg-[#171a23] font-mono text-xs text-slate-100 placeholder:text-muted-foreground focus-visible:ring-indigo-500 leading-relaxed"
              />
            </div>
          </CardContent>

          {/* Card / Dialog Footer */}
          <CardFooter className="p-4 border-t border-[#232732] bg-[#151821]/80 flex items-center justify-between shrink-0 m-0">
            <span className="text-[11px] text-muted-foreground font-mono">
              {points.length} {points.length === 1 ? "point" : "points"} saved
            </span>
            <Button
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-lg bg-indigo-600 px-4 text-xs font-medium text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
            >
              Done
            </Button>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
