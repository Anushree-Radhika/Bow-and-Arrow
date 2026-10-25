"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function CommandBar({ onSubmit, busy, notice }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    setVoiceOk(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recRef.current?.abort();
  }, []);

  const submit = (value, spoken = false) => {
    const command = value.trim();
    if (!command || busy) return;
    setText("");
    onSubmit(command, spoken);
  };

  const toggleMic = () => {
    if (listening) return recRef.current?.stop();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const heard = Array.from(e.results).map((r) => r[0].transcript).join("");
      setText(heard);
      if (e.results[e.results.length - 1].isFinal) submit(heard, true);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <section aria-label="Command bar" className="flex flex-col gap-2">
      <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="flex items-center gap-2">
        <Button
          type="button" variant={listening ? "default" : "secondary"} size="icon"
          onClick={toggleMic} disabled={!voiceOk || busy}
          aria-label={listening ? "Stop listening" : "Speak a command"}
          title={voiceOk ? "Speak a command" : "Voice input isn't supported in this browser"}
          className={cn(listening && "bg-running text-carbon-900 hover:bg-running/90")}
        >
          {listening ? <MicOff /> : <Mic />}
        </Button>
        <Input
          value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
          placeholder={listening ? "Listening…" : 'Try "add 1 hour to Dijkstra" or "Tarjan completed"'}
          aria-label="Command" className="flex-1"
        />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Run command">
          {busy ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
        </Button>
      </form>
      <p
        role={notice?.kind === "error" ? "alert" : "status"} aria-live="polite"
        className={cn("min-h-5 text-sm", notice?.kind === "error" ? "text-destructive" : "text-muted-foreground")}
      >
        {notice?.text ?? ""}
      </p>
    </section>
  );
}
