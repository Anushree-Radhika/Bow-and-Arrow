"""Gemini access: embeddings and schema-constrained generation with multi-model fallbacks."""

from __future__ import annotations

import json
import logging
from typing import TypeVar

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.services.ai.base import normalize
from app.services.ai.groq import try_groq_generation
from app.services.ai.offline import generate_offline_fallback
from app.services.ai.openrouter import try_openrouter_generation

log = logging.getLogger("organizer.ai.gemini")
T = TypeVar("T", bound=BaseModel)


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

        # 2. Free-tier provider fallbacks: Groq
        if settings.groq_api_key:
            log.info("Gemini cascade exhausted. Falling back to Groq (%s)...", settings.groq_model)
            groq_res = try_groq_generation(system, user, parse_as)
            if groq_res is not None:
                return groq_res

        # 3. Free-tier provider fallbacks: OpenRouter
        if settings.openrouter_api_key:
            log.info("Groq exhausted. Falling back to OpenRouter (%s)...", settings.openrouter_model)
            openrouter_res = try_openrouter_generation(system, user, parse_as)
            if openrouter_res is not None:
                return openrouter_res

        # 4. Emergency deterministic offline curriculum
        log.warning("All cloud LLMs unavailable (%s). Synthesizing emergency roadmap.", "; ".join(attempted_errors[:2]))
        return generate_offline_fallback(user, parse_as)
