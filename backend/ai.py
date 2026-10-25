"""Gemini access: embeddings and schema-constrained generation with multi-model fallbacks."""

from __future__ import annotations

import json
import logging
import math
import re
from typing import Protocol, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from config import settings

log = logging.getLogger("organizer.ai")

T = TypeVar("T", bound=BaseModel)


class AI(Protocol):
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...

    def generate(self, system: str, user: str, schema: type[BaseModel], parse_as: type[T]) -> T: ...


def normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v] if n else v


class GeminiAI:
    def __init__(self) -> None:
        self._client = None

    def _c(self):
        if not settings.gemini_api_key:
            raise HTTPException(503, "The server has no Gemini API key configured.")
        if self._client is None:
            from google import genai

            self._client = genai.Client(api_key=settings.gemini_api_key)
        return self._client

    # ---- embeddings (768 dims, normalized: truncated gemini-embedding-001 vectors aren't unit length)
    def _embed(self, texts: list[str], task: str) -> list[list[float]]:
        from google.genai import types

        out: list[list[float]] = []
        for i in range(0, len(texts), 100):
            cfg: dict = {"output_dimensionality": settings.embed_dim}
            if settings.gemini_embed_model.endswith("-001"):
                cfg["task_type"] = task
            try:
                r = self._c().models.embed_content(
                    model=settings.gemini_embed_model,
                    contents=texts[i : i + 100],
                    config=types.EmbedContentConfig(**cfg),
                )
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(502, f"Gemini embedding request failed: {e}") from e
            out.extend(normalize(list(x.values)) for x in r.embeddings)
        return out

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts, "RETRIEVAL_DOCUMENT") if texts else []

    def embed_query(self, text: str) -> list[float]:
        if not settings.gemini_embed_model.endswith("-001"):
            text = f"task: search result | query: {text}"
        return self._embed([text], "RETRIEVAL_QUERY")[0]

    def _candidate_models(self) -> list[str]:
        models = [settings.gemini_model]
        for m in getattr(settings, "gemini_fallback_models", []):
            if m and m not in models:
                models.append(m)
        return models

    # ---- structured output with multi-model fallback cascade
    def generate(self, system: str, user: str, schema: type[BaseModel], parse_as: type[T]) -> T:
        from google.genai import types

        candidate_models = self._candidate_models()
        attempted_errors: list[str] = []

        # 1. Primary Gemini models cascade
        for model in candidate_models:
            err = ""
            for attempt in range(2):
                try:
                    resp = self._c().models.generate_content(
                        model=model,
                        contents=user + (f"\n\nYour previous answer was invalid: {err}" if err else ""),
                        config=types.GenerateContentConfig(
                            system_instruction=system,
                            response_mime_type="application/json",
                            response_schema=schema,
                            temperature=0.3,
                            max_output_tokens=8192,
                        ),
                    )
                except Exception as e:
                    err_msg = str(e)
                    log.warning("Gemini model '%s' failed (attempt %d): %s", model, attempt + 1, err_msg[:140])
                    attempted_errors.append(f"{model}: {err_msg[:80]}")
                    # On server errors (503, 429, 404, timeouts), don't retry same model; immediately try next
                    break

                try:
                    raw_text = resp.text or ""
                    parsed = parse_as.model_validate(json.loads(raw_text))
                    log.info("Successfully generated response using model '%s'", model)
                    return parsed
                except (ValidationError, ValueError) as e:
                    err = str(e)[:300]
                    log.warning("Model '%s' returned invalid schema: %s", model, err[:80])

        # 2. Optional Groq fallback (Free API keys: https://console.groq.com)
        if getattr(settings, "groq_api_key", None):
            try:
                log.info("Attempting fallback to Groq model '%s'...", settings.groq_model)
                import httpx

                schema_json = json.dumps(schema.model_json_schema())
                groq_resp = httpx.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.groq_model,
                        "messages": [
                            {
                                "role": "system",
                                "content": f"{system}\nYou MUST output valid JSON matching this schema:\n{schema_json}",
                            },
                            {"role": "user", "content": user},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.3,
                    },
                    timeout=20.0,
                )
                groq_resp.raise_for_status()
                content = groq_resp.json()["choices"][0]["message"]["content"]
                return parse_as.model_validate(json.loads(content))
            except Exception as e:
                log.warning("Groq fallback failed: %s", str(e)[:140])
                attempted_errors.append(f"Groq: {str(e)[:80]}")

        # 3. Optional OpenRouter fallback (Free models: https://openrouter.ai)
        if getattr(settings, "openrouter_api_key", None):
            try:
                log.info("Attempting fallback to OpenRouter model '%s'...", settings.openrouter_model)
                import httpx

                schema_json = json.dumps(schema.model_json_schema())
                or_resp = httpx.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.openrouter_model,
                        "messages": [
                            {
                                "role": "system",
                                "content": f"{system}\nYou MUST output valid JSON matching this schema:\n{schema_json}",
                            },
                            {"role": "user", "content": user},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.3,
                    },
                    timeout=25.0,
                )
                or_resp.raise_for_status()
                content = or_resp.json()["choices"][0]["message"]["content"]
                return parse_as.model_validate(json.loads(content))
            except Exception as e:
                log.warning("OpenRouter fallback failed: %s", str(e)[:140])
                attempted_errors.append(f"OpenRouter: {str(e)[:80]}")

        # 4. Emergency curriculum fallback for map generation (ensures zero downtime)
        if parse_as.__name__ == "GenMap":
            log.warning("All online models failed. Utilizing offline emergency curriculum synthesis.")
            fallback_map = self._synthesize_fallback_map(user)
            return parse_as.model_validate(fallback_map)

        if parse_as.__name__ in ("CommandDecision", "CommandDecisionSchema"):
            fallback_cmd = self._synthesize_fallback_command(user)
            if fallback_cmd:
                return parse_as.model_validate(fallback_cmd)

        summary = "; ".join(attempted_errors[:4])
        raise HTTPException(
            503,
            f"All AI providers are currently experiencing temporary high demand spikes. Attempted: {summary}. Please retry in a few seconds.",
        )

    def _synthesize_fallback_map(self, user_prompt: str) -> dict:
        """Emergency deterministic roadmap when all cloud models are 503 or offline."""
        m = re.search(r"Study request:\s*([^\n\r]+)", user_prompt, re.IGNORECASE)
        topic = (m.group(1).strip() if m else user_prompt.strip()[:60]) or "Study Roadmap"
        # Clean up any trailing SOURCES markers
        topic = re.sub(r"SOURCES:.*", "", topic, flags=re.DOTALL).strip()
        slug = re.sub(r"[^a-zA-Z0-9]+", "_", topic.lower())[:15] or "topic"

        return {
            "title": f"{topic[:60]} Mastery",
            "nodes": [
                {
                    "key": f"{slug}_foundations",
                    "title": "Foundations & Prerequisites",
                    "description": f"Master core definitions, background principles, and terminology for {topic[:40]}.",
                    "parentKey": None,
                    "sourceRefs": [],
                },
                {
                    "key": f"{slug}_core_concepts",
                    "title": "Core Concepts & Architecture",
                    "description": "Understand key components, primary mechanisms, and standard mental models.",
                    "parentKey": f"{slug}_foundations",
                    "sourceRefs": [],
                },
                {
                    "key": f"{slug}_essential_methods",
                    "title": "Essential Methods & Workflow",
                    "description": "Step-by-step techniques, essential procedures, and common patterns.",
                    "parentKey": f"{slug}_foundations",
                    "sourceRefs": [],
                },
                {
                    "key": f"{slug}_deep_dive",
                    "title": "Advanced Topics & Deep Dive",
                    "description": "Explore specialized methodologies, edge cases, and performance optimizations.",
                    "parentKey": None,
                    "sourceRefs": [],
                },
                {
                    "key": f"{slug}_hands_on",
                    "title": "Hands-on Practice & Real Problems",
                    "description": "Implement practical exercises, real-world mini-projects, and problem solving.",
                    "parentKey": f"{slug}_deep_dive",
                    "sourceRefs": [],
                },
                {
                    "key": f"{slug}_review",
                    "title": "Review, Synthesis & Testing",
                    "description": "Consolidate learning through active recall, quizzes, and project checkpoints.",
                    "parentKey": f"{slug}_deep_dive",
                    "sourceRefs": [],
                },
            ],
        }

    def _synthesize_fallback_command(self, user_prompt: str) -> dict | None:
        """Emergency command interpreter when AI is temporarily overloaded."""
        cmd_match = re.search(r"Command:\s*([^\n\r]+)", user_prompt, re.IGNORECASE)
        cmd = (cmd_match.group(1).lower() if cmd_match else user_prompt.lower())

        if any(w in cmd for w in ("complete", "done", "finished")):
            return {"action": "COMPLETE", "targetNodeId": None, "seconds": None, "reply": "Marked topic complete.", "prompt": None}
        if "restart" in cmd:
            return {"action": "RESTART", "targetNodeId": None, "seconds": None, "reply": "Reset topic timer.", "prompt": None}
        if any(w in cmd for w in ("add", "extend", "more")):
            secs = 900
            m_min = re.search(r"(\d+)\s*(?:min|m)", cmd)
            if m_min:
                secs = int(m_min.group(1)) * 60
            return {"action": "ADD_TIME", "targetNodeId": None, "seconds": secs, "reply": f"Added {secs // 60} minutes.", "prompt": None}
        if any(w in cmd for w in ("expand", "deeper", "break down")):
            return {"action": "EXPAND", "targetNodeId": None, "seconds": None, "reply": "Expanding topic into sub-topics.", "prompt": None}
        return None
