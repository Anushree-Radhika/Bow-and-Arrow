"use client";
import { useEffect, useRef, useState } from "react";
import { FolderPlus, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateMap } from "@/lib/api";
import { createFolder, listFolders } from "@/lib/folders";

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export default function GeneratePanel({ folderId, onFolderChange, onGenerated, onCancel }) {
  const [prompt, setPrompt] = useState("");
  const [nodeMinutes, setNodeMinutes] = useState(30);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [newFolder, setNewFolder] = useState(null); // null = not creating
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const DURATION_PRESETS = [15, 25, 30, 45, 60];

  useEffect(() => {
    listFolders().then(setFolders).catch(() => setError("Couldn't load your folders. You can still build a map."));
  }, []);

  const addFiles = (list) => {
    const pdfs = Array.from(list).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length < list.length) setError("Only PDF files can be added.");
    setFiles((cur) => [...cur, ...pdfs].slice(0, 5));
    if (fileRef.current) fileRef.current.value = "";
  };

  const saveFolder = async () => {
    if (!newFolder?.trim()) return setNewFolder(null);
    try {
      const f = await createFolder(newFolder);
      setFolders((cur) => [...cur, f].sort((a, b) => a.name.localeCompare(b.name)));
      onFolderChange(f.id);
      setNewFolder(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onGenerated(await generateMap({ prompt: prompt.trim(), files, folderId, nodeMinutes: Number(nodeMinutes) || 30 }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-carbon-700 bg-carbon-800 p-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">What do you want to study?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe a topic and Organizer builds a study map with a {nodeMinutes}-minute timer on every node. Add PDFs and the map follows what they cover.
        </p>
      </div>

      <label className="sr-only" htmlFor="prompt">Study topic</label>
      <Textarea
        id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} required minLength={3} maxLength={2000}
        placeholder="Graph algorithms for interviews: traversals, shortest paths, strongly connected components"
      />

      <div className="flex flex-col gap-2 rounded-lg border border-carbon-700/60 bg-carbon-900/60 p-3">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-foreground">Topic Timer Duration</span>
          <span className="font-mono text-muted-foreground">{nodeMinutes} min per topic</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((m) => (
            <Button
              key={m}
              type="button"
              variant={nodeMinutes === m ? "default" : "secondary"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setNodeMinutes(m)}
            >
              {m}m{m === 25 ? " (Pomodoro)" : m === 30 ? " (Default)" : ""}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Custom:</span>
            <Input
              type="number"
              min={1}
              max={480}
              value={nodeMinutes}
              onChange={(e) => setNodeMinutes(Math.max(1, Math.min(480, Number(e.target.value) || 1)))}
              className="h-7 w-16 px-2 text-center text-xs"
              aria-label="Custom minutes per topic"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={files.length >= 5}>
            <Upload /> Add PDFs
          </Button>
          <label htmlFor="folder" className="sr-only">Save to folder</label>
          {newFolder === null ? (
            <>
              <select
                id="folder" value={folderId ?? ""} onChange={(e) => onFolderChange(e.target.value || null)}
                className="h-8 rounded-md border border-input bg-carbon-900 px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No folder</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewFolder("")}><FolderPlus /> New folder</Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder name" aria-label="New folder name"
                className="h-8 w-44" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveFolder(); } if (e.key === "Escape") setNewFolder(null); }}
              />
              <Button type="button" size="sm" onClick={saveFolder}>Create</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewFolder(null)}>Cancel</Button>
            </div>
          )}
        </div>
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-md bg-carbon-700 py-1 pl-2 pr-1 text-xs">
                <span className="max-w-[180px] truncate">{f.name}</span>
                <span className="text-muted-foreground">{mb(f.size)}</span>
                <Button type="button" variant="ghost" size="iconSm" className="size-5" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>
                  <X className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {files.length ? "PDFs are saved to your knowledge base so future maps can use them." : folderId ? "Notes saved in this folder will be searched for your topic." : "No PDFs: the map is built from your prompt alone."}
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={busy || prompt.trim().length < 3}>
          {busy && <Loader2 className="animate-spin" />}
          {busy ? (files.length ? "Reading PDFs and building your map" : "Building your map") : "Build map"}
        </Button>
      </div>
    </form>
  );
}
