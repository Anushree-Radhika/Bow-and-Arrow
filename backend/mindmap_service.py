"""Map generation (two engines) and command execution.

Engine 1, grounded:  PDFs -> pypdf text -> chunks -> Gemini embeddings -> saved to knowledge_chunks
                     -> top-k most relevant chunks for the prompt -> Gemini builds the roadmap from them.
Engine 2, pure LLM:  no files -> Gemini builds the roadmap from the prompt alone
                     (if a folder is chosen, its saved notes are searched first via match_user_knowledge).

Timers are never an LLM decision: every node is created here with DEFAULT_NODE_SECONDS.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass
from difflib import SequenceMatcher

from fastapi import HTTPException

from ai import AI
from auth import User
from config import DEFAULT_NODE_SECONDS, settings
from pdf_utils import Chunk
from schemas import (
    ActionType, CommandDecision, CommandDecisionSchema, CommandIn, CommandOut, GenerateOut,
    GenMap, GenNode, MapNode, MapOut, NodeState, SourceInfo,
)
from store import KnowledgeStore, StoreError

log = logging.getLogger("organizer.mindmap")

MAX_NODES = 20
MAX_DEPTH = 3
MIN_ADD_SECONDS, MAX_ADD_SECONDS = 60, 8 * 3600


@dataclass
class Ctx:
    """One retrieved passage handed to the LLM as grounding."""

    title: str
    page: int | None
    text: str

    @property
    def label(self) -> str:
        return f"{self.title} p.{self.page}" if self.page else self.title


# ----------------------------------------------------------------------------- nodes


def new_id() -> str:
    return "n_" + uuid.uuid4().hex[:8]


def make_node(
    title: str,
    description: str = "",
    parent_id: str | None = None,
    sources: list[str] | None = None,
    node_seconds: int = DEFAULT_NODE_SECONDS,
) -> MapNode:
    return MapNode(
        id=new_id(),
        title=title.strip()[:80],
        description=description.strip()[:300],
        parentId=parent_id,
        totalSeconds=node_seconds,
        remainingSeconds=node_seconds,
        status="idle",
        sources=sources or [],
    )


def nodes_from_gen(gen: GenMap, ctx: list[Ctx], node_seconds: int = DEFAULT_NODE_SECONDS) -> list[MapNode]:
    """Turn the LLM's draft into valid, bounded, acyclic nodes with configurable timers."""
    drafts: dict[str, GenNode] = {}
    for g in gen.nodes:
        if g.key and g.title.strip() and g.key not in drafts and len(drafts) < MAX_NODES:
            drafts[g.key] = g

    def parent_of(k: str) -> str | None:
        p = drafts[k].parentKey
        return p if p in drafts and p != k else None

    # break cycles: walk up from each node; a node that reaches itself becomes a root
    parent: dict[str, str | None] = {k: parent_of(k) for k in drafts}
    for k in drafts:
        seen, cur = {k}, parent[k]
        while cur is not None:
            if cur in seen:
                parent[k] = None
                break
            seen.add(cur)
            cur = parent[cur]

    def depth(k: str) -> int:
        d, cur = 1, parent[k]
        while cur is not None:
            d, cur = d + 1, parent[cur]
        return d

    def ancestor_at(k: str, d: int) -> str:
        chain = [k]
        while parent[chain[-1]] is not None:
            chain.append(parent[chain[-1]])  # type: ignore[arg-type]
        chain.reverse()
        return chain[d - 1]

    for k in drafts:  # too deep: hang it from its ancestor at the maximum depth
        if depth(k) > MAX_DEPTH:
            parent[k] = ancestor_at(k, MAX_DEPTH - 1)

    ids = {k: new_id() for k in drafts}
    out: list[MapNode] = []
    for k, g in drafts.items():
        refs = [ctx[r - 1].label for r in dict.fromkeys(g.sourceRefs) if 1 <= r <= len(ctx)]
        node = make_node(
            g.title,
            g.description,
            ids[parent[k]] if parent[k] else None,
            list(dict.fromkeys(refs)),
            node_seconds=node_seconds,
        )
        node.id = ids[k]
        out.append(node)
    return out


def source_infos(ctx: list[Ctx]) -> list[SourceInfo]:
    pages: dict[str, set[int]] = {}
    for c in ctx:
        pages.setdefault(c.title, set())
        if c.page:
            pages[c.title].add(c.page)
    return [SourceInfo(title=t, pages=sorted(p)) for t, p in pages.items()]


# ----------------------------------------------------------------------------- prompts

_GEN_SYSTEM = """You turn a study request into a hierarchical roadmap of topics.
Rules:
- 6 to 14 nodes. Top-level nodes (parentKey null) are the main areas; sub-topics point to their parent via parentKey. At most 3 levels.
- keys are short unique slugs. Titles are specific and short (under 60 chars). description is one sentence on what to learn.
- Do NOT mention durations; timing is handled elsewhere.
- If SOURCES are given, build the roadmap from them: cover what they actually teach, in a sensible learning order, and set sourceRefs to the numbers of the [n] sources each node is based on. Do not invent topics the sources don't support. If no sources are given, use sourceRefs: []."""

_EXPAND_SYSTEM = """You break one study topic into 3 to 6 concrete sub-topics a learner can finish in one short session each.
Return them with parentKey null (they will all be attached under the given topic). Do not repeat the existing sub-topics.
If SOURCES are given, base the sub-topics on them and set sourceRefs; otherwise sourceRefs: []. Do not mention durations."""

_COMMAND_SYSTEM = """You convert one spoken or typed command for a study mind map into exactly one action.
Actions:
- COMPLETE: mark a topic finished ("Tarjan completed", "I'm done with BFS").
- ADD_TIME: add time to a topic's timer. Put the amount in `seconds` ("add 1hr to Dijkstra" -> 3600, "10 more minutes" -> 600). If no amount was given, seconds is null.
- RESTART: reset a topic's timer from scratch ("restart BFS").
- EXPAND: break a topic into sub-topics ("expand Tarjan", "go deeper on DFS").
- GENERATE_NEW_MAP: the user wants a brand new map about something; put the subject in `prompt`.
Choose targetNodeId ONLY from the provided node ids (null for GENERATE_NEW_MAP). Match topic names loosely: speech recognition may misspell them.
`reply` is one short, plain sentence confirming what you did. Never invent node ids."""


def _ctx_block(ctx: list[Ctx]) -> str:
    if not ctx:
        return ""
    parts = [f"[{i}] ({c.label})\n{c.text}" for i, c in enumerate(ctx, 1)]
    return "\n\nSOURCES:\n" + "\n\n".join(parts)


# ----------------------------------------------------------------------------- generation


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))  # both are unit length


def rank_uploaded(chunks: list[Chunk], vectors: list[list[float]], query_vec: list[float], k: int) -> list[Ctx]:
    scored = sorted(zip(chunks, vectors), key=lambda cv: -_cosine(cv[1], query_vec))[:k]
    # present the passages in reading order so the roadmap follows the documents
    scored.sort(key=lambda cv: (cv[0].source_title, cv[0].page))
    return [Ctx(c.source_title, c.page, c.text) for c, _ in scored]


def retrieve_folder_context(user: User, query: str, folder_id: str | None, ai: AI, store: KnowledgeStore) -> list[Ctx]:
    qv = ai.embed_query(query)
    rows = store.match(user, qv, settings.rag_top_k, settings.rag_min_similarity, folder_id)
    return [Ctx(r["source_title"], r.get("page_number"), r["content"]) for r in rows]


def build_roadmap(prompt: str, ctx: list[Ctx], ai: AI, node_seconds: int = DEFAULT_NODE_SECONDS) -> MapOut:
    gen = ai.generate(_GEN_SYSTEM, f"Study request: {prompt}{_ctx_block(ctx)}", GenMap, GenMap)
    nodes = nodes_from_gen(gen, ctx, node_seconds=node_seconds)
    if not nodes:
        raise HTTPException(502, "The model returned an empty roadmap. Try rephrasing your request.")
    return MapOut(title=gen.title.strip()[:100] or prompt[:100], nodes=nodes)


def generate_map(
    user: User,
    prompt: str,
    chunks: list[Chunk],
    folder_id: str | None,
    ai: AI,
    store: KnowledgeStore,
    node_minutes: int = 30,
) -> GenerateOut:
    warnings: list[str] = []
    ctx: list[Ctx] = []
    node_seconds = max(60, min(8 * 3600, int(node_minutes) * 60))

    if chunks:  # ---- engine 1: grounded in the uploaded PDFs
        vectors = ai.embed_documents([c.text for c in chunks])
        qv = ai.embed_query(prompt)
        ctx = rank_uploaded(chunks, vectors, qv, settings.rag_top_k)
        rows = [
            {
                **({"folder_id": folder_id} if folder_id else {}),
                "source_title": c.source_title,
                "page_number": c.page,
                "content": c.text,
                "embedding": v,
            }
            for c, v in zip(chunks, vectors)
        ]
        try:
            store.insert_chunks(user, rows)
        except StoreError as e:
            log.warning("could not persist chunks: %s", e)
            warnings.append("Your PDFs weren't saved to your knowledge base, so they can't be reused later. The roadmap was still built from them.")
    elif folder_id:  # ---- engine 2 with the user's saved notes
        try:
            ctx = retrieve_folder_context(user, prompt, folder_id, ai, store)
        except StoreError as e:
            log.warning("folder search failed: %s", e)
            warnings.append("Couldn't search that folder, so the roadmap uses your prompt alone.")
        if not ctx and not warnings:
            warnings.append("Nothing in that folder matched your prompt, so the roadmap uses your prompt alone.")

    roadmap = build_roadmap(prompt, ctx, ai, node_seconds=node_seconds)
    return GenerateOut(
        **roadmap.model_dump(), grounded=bool(ctx), sources=source_infos(ctx), warnings=warnings
    )


# ----------------------------------------------------------------------------- commands

_STOP = {"the", "and", "for", "with", "algorithm", "algorithms", "problems", "practice", "basics", "add", "set"}


def _tokens(s: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", s.lower().replace("'s", ""))


def match_node(command: str, nodes: list[NodeState]) -> NodeState | None:
    """Fallback when the LLM gave no valid node id: loose title match, tolerant of STT typos."""
    words = _tokens(command)
    best: list[tuple[float, NodeState]] = []
    for n in nodes:
        toks = [t for t in _tokens(n.title) if len(t) >= 3 and t not in _STOP]
        if not toks:
            continue
        hit = sum(1 for t in toks if any(SequenceMatcher(None, t, w).ratio() >= 0.8 for w in words))
        best.append((hit / len(toks), n))
    best.sort(key=lambda x: -x[0])
    if best and best[0][0] >= 0.5 and (len(best) == 1 or best[1][0] < best[0][0]):
        return best[0][1]
    return None


def _node_listing(nodes: list[NodeState]) -> str:
    rows = [
        {"id": n.id, "title": n.title, "status": n.status, "remainingSeconds": n.remainingSeconds, "parentId": n.parentId}
        for n in nodes
    ]
    return json.dumps(rows)


def expand_node(
    target: NodeState, body: CommandIn, user: User, ai: AI, store: KnowledgeStore
) -> tuple[list[MapNode], list[Ctx]]:
    ctx: list[Ctx] = []
    if body.folderId:
        try:
            ctx = retrieve_folder_context(user, f"{body.mapTitle or ''} {target.title}".strip(), body.folderId, ai, store)
        except StoreError as e:
            log.warning("folder search failed: %s", e)
    existing = [n.title for n in body.nodes if n.parentId == target.id]
    user_msg = (
        f"Map: {body.mapTitle or 'Study map'}\nTopic to break down: {target.title}\n"
        f"Existing sub-topics: {existing or 'none'}{_ctx_block(ctx)}"
    )
    gen = ai.generate(_EXPAND_SYSTEM, user_msg, GenMap, GenMap)
    taken = {t.lower() for t in existing} | {target.title.lower()}
    kids: list[MapNode] = []
    for g in gen.nodes:
        t = g.title.strip()
        if not t or t.lower() in taken or len(kids) >= 6:
            continue
        taken.add(t.lower())
        refs = [ctx[r - 1].label for r in dict.fromkeys(g.sourceRefs) if 1 <= r <= len(ctx)]
        kids.append(
            make_node(
                t,
                g.description,
                target.id,
                list(dict.fromkeys(refs)),
                node_seconds=target.totalSeconds or DEFAULT_NODE_SECONDS,
            )
        )
    if not kids:
        raise HTTPException(422, f"I couldn't find new sub-topics for {target.title}.")
    return kids, ctx


_NEEDS_TARGET = {ActionType.COMPLETE, ActionType.ADD_TIME, ActionType.RESTART, ActionType.EXPAND}


def run_command(body: CommandIn, user: User, ai: AI, store: KnowledgeStore) -> CommandOut:
    decision = ai.generate(
        _COMMAND_SYSTEM,
        f"Nodes on the map:\n{_node_listing(body.nodes)}\n\nCommand: {body.command}",
        CommandDecisionSchema,
        CommandDecision,
    )
    by_id = {n.id: n for n in body.nodes}
    target: NodeState | None = None

    if decision.action in _NEEDS_TARGET:
        target = by_id.get(decision.targetNodeId or "") or match_node(body.command, body.nodes)
        if target is None:
            raise HTTPException(422, "I couldn't tell which topic you mean. Say its name, like 'restart Dijkstra'.")

    action = decision.action
    reply = decision.reply.strip()

    if action == ActionType.COMPLETE:
        return CommandOut(action=action, targetNodeId=target.id, reply=reply or f"Marked {target.title} complete.")

    if action == ActionType.RESTART:
        mins = (target.totalSeconds or DEFAULT_NODE_SECONDS) // 60
        return CommandOut(
            action=action, targetNodeId=target.id,
            reply=reply or f"Reset {target.title} to {mins} minutes.",
        )

    if action == ActionType.ADD_TIME:
        if not decision.seconds or decision.seconds <= 0:
            raise HTTPException(422, "How much time should I add? For example, 'add 30 minutes to Dijkstra'.")
        secs = max(MIN_ADD_SECONDS, min(MAX_ADD_SECONDS, int(decision.seconds)))
        return CommandOut(
            action=action, targetNodeId=target.id, seconds=secs,
            reply=reply or f"Added {secs // 60} minutes to {target.title}.",
        )

    if action == ActionType.EXPAND:
        kids, ctx = expand_node(target, body, user, ai, store)
        return CommandOut(
            action=action, targetNodeId=target.id, newNodes=kids, grounded=bool(ctx), sources=source_infos(ctx),
            reply=reply or f"Added {len(kids)} sub-topics under {target.title}.",
        )

    # GENERATE_NEW_MAP
    prompt = (decision.prompt or body.command).strip()
    ctx = []
    if body.folderId:
        try:
            ctx = retrieve_folder_context(user, prompt, body.folderId, ai, store)
        except StoreError as e:
            log.warning("folder search failed: %s", e)
    roadmap = build_roadmap(prompt, ctx, ai)
    return CommandOut(
        action=action, map=roadmap, grounded=bool(ctx), sources=source_infos(ctx),
        reply=reply or f"Built a new map: {roadmap.title}.",
    )
