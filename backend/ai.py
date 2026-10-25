"""Gemini access: embeddings and schema-constrained generation."""

from __future__ import annotations

import json
import math
from typing import Protocol, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from config import settings

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

    # ---- structured output: Gemini is constrained to `schema`; we validate with `parse_as`
    def generate(self, system: str, user: str, schema: type[BaseModel], parse_as: type[T]) -> T:
        from google.genai import types

        err = ""
        for _ in range(2):
            try:
                resp = self._c().models.generate_content(
                    model=settings.gemini_model,
                    contents=user + (f"\n\nYour previous answer was invalid: {err}" if err else ""),
                    config=types.GenerateContentConfig(
                        system_instruction=system,
                        response_mime_type="application/json",
                        response_schema=schema,
                        temperature=0.3,
                        max_output_tokens=8192,
                    ),
                )
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(502, f"Gemini request failed: {e}") from e
            try:
                return parse_as.model_validate(json.loads(resp.text or ""))
            except (ValidationError, ValueError) as e:
                err = str(e)[:400]
        raise HTTPException(502, f"Gemini returned an unusable answer: {err}")
