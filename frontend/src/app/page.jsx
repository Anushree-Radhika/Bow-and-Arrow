"use client";
import AuthGate from "@/components/AuthGate";
import MindMapCanvas from "@/components/mindmap/MindMapCanvas";

export default function Home() {
  return (
    <AuthGate>
      <MindMapCanvas />
    </AuthGate>
  );
}