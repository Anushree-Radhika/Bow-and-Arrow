from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field

from app.models.mindmap import MapNode, MapOut, SourceInfo


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
    """Lenient mirror of the schema above, used to validate actual LLM outputs."""

    action: ActionType
    targetNodeId: str | None = None
    seconds: int | None = None
    prompt: str | None = None
    reply: str = ""


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
