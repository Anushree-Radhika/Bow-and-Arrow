from __future__ import annotations

import json
import logging
import re
from typing import TypeVar
import httpx
from pydantic import BaseModel

from app.core.config import settings

log = logging.getLogger("organizer.ai.groq")
T = TypeVar("T", bound=BaseModel)


def try_groq_generation(system: str, user: str, parse_as: type[T]) -> T | None:
    if not settings.groq_api_key:
        return None
    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        prompt_with_instructions = (
            f"{system}\n\n"
            f"You MUST respond ONLY with valid JSON matching the required schema.\n"
            f"Do not include Markdown blocks or code fencing.\n\n"
            f"User Prompt:\n{user}"
        )
        body = {
            "model": settings.groq_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt_with_instructions},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }
        with httpx.Client(timeout=15) as client:
            resp = client.post(url, headers=headers, json=body)
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                cleaned = re.sub(r"^```json\s*|\s*```$", "", content.strip(), flags=re.MULTILINE)
                log.info("Successfully generated response using Groq (%s)", settings.groq_model)
                return parse_as.model_validate(json.loads(cleaned))
            log.warning("Groq API returned error %s: %s", resp.status_code, resp.text[:120])
    except Exception as e:
        log.warning("Groq fallback encountered error: %s", e)
    return None
