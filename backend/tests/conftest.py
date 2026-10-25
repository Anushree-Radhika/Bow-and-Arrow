import hashlib
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient

from auth import User, current_user
from config import settings
from main import app
from routers.mindmap import get_ai, get_store

# --------------------------------------------------------------------------------------
# TEST DOUBLES. Gemini and Supabase are not reachable from tests, so these stand in for them.
# They are scripted by each test; nothing here is used by the app itself.
# --------------------------------------------------------------------------------------


class FakeAI:
    """Embeddings: hashed bag-of-words (lexical, NOT semantic: real quality comes from Gemini).
    generate(): returns whatever the test queued, validated by the real parse model."""

    def __init__(self):
        self.queue: list[dict] = []
        self.calls: list[dict] = []

    def _vec(self, text: str) -> list[float]:
        v = [0.0] * 768
        for w in re.findall(r"[a-z0-9]+", text.lower()):
            v[int(hashlib.md5(w.encode()).hexdigest(), 16) % 768] += 1.0
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]

    def embed_documents(self, texts):
        return [self._vec(t) for t in texts]

    def embed_query(self, text):
        return self._vec(text)

    def generate(self, system, user, schema, parse_as):
        self.calls.append({"system": system, "user": user, "schema": schema.__name__})
        assert self.queue, "test forgot to queue an LLM response"
        return parse_as.model_validate(self.queue.pop(0))


class FakeStore:
    def __init__(self):
        self.inserted: list[dict] = []
        self.match_rows: list[dict] = []
        self.match_calls: list[dict] = []
        self.fail_insert = False

    def insert_chunks(self, user, rows):
        if self.fail_insert:
            from store import StoreError
            raise StoreError("boom")
        self.inserted += rows

    def match(self, user, embedding, k, min_similarity, folder_id):
        self.match_calls.append({"k": k, "min": min_similarity, "folder": folder_id, "user": user.id})
        return self.match_rows


def make_pdf(pages: list[str]) -> bytes:
    """Smallest valid PDF with selectable Helvetica text, one string per page."""
    objs: list[bytes] = []
    n_pages = len(pages)
    kids = " ".join(f"{4 + 2 * i} 0 R" for i in range(n_pages))
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode())
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for i, text in enumerate(pages):
        lines = re.findall(r".{1,85}(?:\s|$)", text) if text else []
        body = "".join(
            "(" + ln.strip().replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ") Tj T*\n"
            for ln in lines
        )
        stream = f"BT /F1 11 Tf 14 TL 40 760 Td\n{body}ET".encode()
        objs.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {5 + 2 * i} 0 R "
            f"/Resources << /Font << /F1 3 0 R >> >> >>".encode()
        )
        objs.append(f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream")
    out = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return out


@pytest.fixture
def ai():
    return FakeAI()


@pytest.fixture
def store():
    return FakeStore()


@pytest.fixture
def client(ai, store):
    app.dependency_overrides[current_user] = lambda: User("user-1", "jwt-1")
    app.dependency_overrides[get_ai] = lambda: ai
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def restore_settings():
    saved = {k: getattr(settings, k) for k in ("rag_top_k", "max_pdf_mb", "max_files", "chunk_chars")}
    yield
    for k, v in saved.items():
        setattr(settings, k, v)
