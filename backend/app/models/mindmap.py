from __future__ import annotations

from pydantic import BaseModel, Field


class MapNode(BaseModel):
    id: str
    title: str
    description: str = ""
    parentId: str | None = None
    totalSeconds: int
    remainingSeconds: int
    status: str = "idle"  # idle | running | paused | completed
    sources: list[str] = Field(default_factory=list)  # e.g. "graphs.pdf p.12"
    notes: str | None = None
    points: list[dict] = Field(default_factory=list)


class SourceInfo(BaseModel):
    title: str
    pages: list[int]


class MapOut(BaseModel):
    title: str
    nodes: list[MapNode]


class GenerateOut(MapOut):
    grounded: bool  # True when the roadmap was built from retrieved PDF/notes context
    sources: list[SourceInfo] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


# ------------------------------------------------------------------ LLM Generation DTOs
# No defaults here on purpose: Gemini/Groq response_schema is stricter without them.


class GenNode(BaseModel):
    key: str
    title: str
    description: str
    parentKey: str | None
    sourceRefs: list[int]  # numbers of the [n] sources this node is based on, [] if none


class GenMap(BaseModel):
    title: str
    nodes: list[GenNode]
