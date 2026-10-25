from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

# ------------------------------------------------------------------ what the client sees


class MapNode(BaseModel):
    id: str
    title: str
    description: str = ""
    parentId: str | None = None
    totalSeconds: int
    remainingSeconds: int
    status: str = "idle"  # idle | running | paused | completed
    sources: list[str] = Field(default_factory=list)  # e.g. "graphs.pdf p.12"


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


# ------------------------------------------------------------------ what Gemini must return
# No defaults here on purpose: Gemini's response_schema is stricter without them.


class GenNode(BaseModel):
    key: str
    title: str
    description: str
    parentKey: str | None
    sourceRefs: list[int]  # numbers of the [n] sources this node is based on, [] if none


class GenMap(BaseModel):
    title: str
    nodes: list[GenNode]


class ActionType(str, Enum):
    COMPLETE = "COMPLETE"
    ADD_TIME = "ADD_TIME"
    RESTART = "RESTART"
    EXPAND = "EXPAND"
    GENERATE_NEW_MAP = "GENERATE_NEW_MAP"


class CommandDecisionSchema(BaseModel):
    action: ActionType
    targetNodeId: str | None
    seconds: int | None
    prompt: str | None
    reply: str


class CommandDecision(BaseModel):
    """Lenient mirror of the schema above, used to validate what actually came back."""

    action: ActionType
    targetNodeId: str | None = None
    seconds: int | None = None
    prompt: str | None = None
    reply: str = ""


# ------------------------------------------------------------------ command endpoint


class NodeState(BaseModel):
    id: str
    title: str
    status: str = "idle"
    remainingSeconds: int = 0
    totalSeconds: int = 0
    parentId: str | None = None


class CommandIn(BaseModel):
    command: str = Field(min_length=1, max_length=500)
    nodes: list[NodeState] = Field(default_factory=list, max_length=200)
    mapTitle: str | None = None
    folderId: str | None = None


class CommandOut(BaseModel):
    action: ActionType
    targetNodeId: str | None = None
    seconds: int | None = None  # ADD_TIME only
    reply: str
    newNodes: list[MapNode] | None = None  # EXPAND only
    map: MapOut | None = None  # GENERATE_NEW_MAP only
    sources: list[SourceInfo] = Field(default_factory=list)
    grounded: bool = False
