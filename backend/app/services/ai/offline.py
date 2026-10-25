from __future__ import annotations

import re
from typing import TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def generate_offline_fallback(user: str, parse_as: type[T]) -> T:
    """Deterministic offline fallback if all cloud LLM providers are unreachable."""
    topic_match = re.search(r'topic\s*:\s*["\']?([^"\']+)["\']?', user, re.IGNORECASE)
    topic = topic_match.group(1).strip() if topic_match else "Core Subject Mastery"

    if parse_as.__name__ == "GenMap":
        data = {
            "title": f"{topic} (Study Roadmap)",
            "nodes": [
                {
                    "key": "n1",
                    "title": f"Fundamentals of {topic}",
                    "description": f"Core principles, prerequisites, and foundational concepts of {topic}.",
                    "parentKey": None,
                    "sourceRefs": [],
                },
                {
                    "key": "n2",
                    "title": "Architecture & Core Concepts",
                    "description": "Essential structural components, data models, and primary mechanics.",
                    "parentKey": "n1",
                    "sourceRefs": [],
                },
                {
                    "key": "n3",
                    "title": "Implementation & Coding Practice",
                    "description": "Hands-on implementation patterns, workflows, and algorithmic execution.",
                    "parentKey": "n2",
                    "sourceRefs": [],
                },
                {
                    "key": "n4",
                    "title": "Optimization & Edge Cases",
                    "description": "Performance tuning, error handling, edge cases, and design trade-offs.",
                    "parentKey": "n2",
                    "sourceRefs": [],
                },
                {
                    "key": "n5",
                    "title": "Production Deployment & Mastery",
                    "description": "Real-world projects, integration scenarios, and evaluation.",
                    "parentKey": "n3",
                    "sourceRefs": [],
                },
            ],
        }
        return parse_as.model_validate(data)

    if parse_as.__name__ == "CommandDecision":
        data = {
            "action": "GENERATE_NEW_MAP",
            "targetNodeId": None,
            "seconds": None,
            "prompt": topic,
            "reply": f"Generated roadmap for {topic}.",
        }
        return parse_as.model_validate(data)

    return parse_as.model_validate({})
