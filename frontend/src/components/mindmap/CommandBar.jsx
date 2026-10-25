"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { transcribeVoice } from "@/lib/api";

export default function CommandBar({ onSubmit, busy, notice, activeNodes = [] }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [localError, setLocalError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    const isSupported = Boolean(
      typeof window !== "undefined" &&
      navigator?.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined"
    );
    setVoiceSupported(isSupported);
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const submit = (value, spoken = false) => {
    const command = (value || "").trim();
    if (!command || busy || transcribing) return;
    setText("");
    setLocalError(null);
    onSubmit(command, spoken);
  };

  const startRecording = async () => {
    setLocalError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop()); // release mic
        const finalBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        await sendAudioToWhisper(finalBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      setLocalError("Microphone access was denied or not found.");
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const sendAudioToWhisper = async (audioBlob) => {
    setTranscribing(true);
    setLocalError(null);
    try {
      const nodeTitles = (activeNodes || []).map((n) => n.title);
      const res = await transcribeVoice(audioBlob, nodeTitles);
      const transcribedText = (res?.text || "").trim();

      if (transcribedText) {
        setText(transcribedText);
        submit(transcribedText, true);
      } else {
        setLocalError("No speech detected. Please try speaking again.");
      }
    } catch (err) {
      console.error("Whisper transcription error:", err);
      setLocalError(err.message || "Failed to transcribe audio with Whisper.");
    } finally {
      setTranscribing(false);
    }
  };

  const toggleMic = () => {
    if (busy || transcribing) return;
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isMicBusy = busy || transcribing;
  const currentNotice = localError ? { kind: "error", text: localError } : notice;

  return (
    <section aria-label="Command bar" className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex items-center gap-2"
      >
        <Button
          type="button"
          variant={recording ? "default" : "secondary"}
          size="icon"
          onClick={toggleMic}
          disabled={!voiceSupported || isMicBusy}
          aria-label={
            recording
              ? "Stop recording"
              : transcribing
                ? "Transcribing with Whisper"
                : "Speak a command (Whisper)"
          }
          title={
            !voiceSupported
              ? "Audio recording isn't supported in this browser"
              : recording
                ? "Recording audio... click to finish & transcribe"
                : transcribing
                  ? "Transcribing audio via Whisper..."
                  : "Record voice command with Whisper"
          }
          className={cn(
            "transition-all duration-200",
            recording && "bg-red-600 text-white hover:bg-red-700 animate-pulse ring-2 ring-red-500/50",
            transcribing && "bg-indigo-600 text-white"
          )}
        >
          {transcribing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : recording ? (
            <MicOff className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || transcribing}
          placeholder={
            recording
              ? "Listening... Click microphone to finish & transcribe"
              : transcribing
                ? "Transcribing with Whisper..."
                : 'Try "add 1 hour to Dijkstra" or "Tarjan completed"'
          }
          aria-label="Command"
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || transcribing || !text.trim()}
          aria-label="Run command"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
        </Button>
      </form>
      <p
        role={currentNotice?.kind === "error" ? "alert" : "status"}
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm",
          currentNotice?.kind === "error" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {currentNotice?.text ?? ""}
      </p>
    </section>
  );
}
