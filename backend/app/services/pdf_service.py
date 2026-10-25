"""PDF text extraction and chunking (pypdf)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.core.config import settings


class PdfError(ValueError):
    """User-fixable problem with an uploaded PDF."""


@dataclass
class Chunk:
    source_title: str
    page: int
    text: str


def extract_pages(data: bytes, filename: str) -> list[tuple[int, str]]:
    if not data.startswith(b"%PDF"):
        raise PdfError(f"{filename} isn't a PDF file.")
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise PdfError(f"{filename} is password protected. Remove the password and upload it again.")
        if len(reader.pages) > settings.max_pdf_pages:
            raise PdfError(f"{filename} has {len(reader.pages)} pages. The limit is {settings.max_pdf_pages}.")
        pages = [(i + 1, (p.extract_text() or "")) for i, p in enumerate(reader.pages)]
    except PdfError:
        raise
    except (PyPdfError, ValueError, KeyError, OSError) as e:
        raise PdfError(f"{filename} couldn't be read ({e.__class__.__name__}).") from e
    pages = [(n, t) for n, t in pages if t.strip()]
    if not pages:
        raise PdfError(f"{filename} has no selectable text. Scanned PDFs need OCR first.")
    return pages


_SENT = re.compile(r"(?<=[.!?])\s+|\n{2,}")


def chunk_pages(pages: list[tuple[int, str]], source_title: str) -> list[Chunk]:
    """Sentence-aware chunks of about chunk_chars characters, never crossing a page boundary."""
    target, overlap = settings.chunk_chars, settings.chunk_overlap
    out: list[Chunk] = []
    for page, raw in pages:
        text = re.sub(r"[ \t]+", " ", raw).strip()
        pieces: list[str] = []
        for s in _SENT.split(text):
            s = re.sub(r"\s+", " ", s).strip()
            while len(s) > target:  # a single huge "sentence": split on whitespace
                cut = s.rfind(" ", 0, target)
                cut = cut if cut > target // 2 else target
                pieces.append(s[:cut].strip())
                s = s[cut:].strip()
            if s:
                pieces.append(s)
        buf = ""
        for s in pieces:
            if buf and len(buf) + 1 + len(s) > target:
                out.append(Chunk(source_title, page, buf))
                buf = (buf[-overlap:].split(" ", 1)[-1] + " " + s) if overlap else s
            else:
                buf = f"{buf} {s}".strip()
        if buf:
            out.append(Chunk(source_title, page, buf))
    return [c for c in out if len(c.text) >= 40]
