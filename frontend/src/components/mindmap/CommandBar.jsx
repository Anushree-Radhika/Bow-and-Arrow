"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

export default function CommandBar({ onSubmit, busy, notice }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop()); // release mic
        await sendAudioToWhisper(audioBlob);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };
  const sendAudioToWhisper = async (audioBlob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "command.webm");

    // Prime Whisper with current node titles so it accurately recognizes topic names
    const nodeNames = activeNodes.map((n) => n.title).join(", ");
    formData.append("node_titles", nodeNames);
    try {
      const { text: transcribedText } = await apiFetch("/api/mindmap/transcribe", {
        method: "POST",
        body: formData,
      });
      if (transcribedText) {
        setText(transcribedText);
        onSubmit(transcribedText, true); // runs your existing command pipeline!
      }
    } catch (e) {
      console.error("Whisper error:", e);
    }
  };
  const toggleMic = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
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
