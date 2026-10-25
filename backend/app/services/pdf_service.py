"""PDF text extraction and chunking with LangChain Document metadata and text splitters."""

from __future__ import annotations

import re
from io import BytesIO
from typing import Any

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.core.config import settings


class PdfError(ValueError):
    """User-fixable problem with an uploaded PDF."""


class Chunk(Document):
    """LangChain Document representing a text chunk with complete metadata.
    
    Inherits from langchain_core.documents.Document for native LangChain ecosystem
    compatibility, while providing backward-compatible properties for Bow and Arrow.
    """

    def __init__(
        self,
        source_title: str,
        page: int,
        text: str,
        metadata: dict[str, Any] | None = None,
        **extra_metadata: Any,
    ) -> None:
        merged_metadata: dict[str, Any] = {
            "source": source_title,
            "source_title": source_title,
            "page": page,
            "page_number": page,
            "char_count": len(text),
            "word_count": len(text.split()),
            **(metadata or {}),
            **extra_metadata,
        }
        super().__init__(page_content=text, metadata=merged_metadata)

    @property
    def source_title(self) -> str:
        return self.metadata.get("source_title") or self.metadata.get("source") or ""

    @property
    def page(self) -> int:
        return self.metadata.get("page") or self.metadata.get("page_number") or 1

    @property
    def text(self) -> str:
        return self.page_content


class PyMuPdfReader:
    """High-speed PyMuPDF (fitz) reader extracting pages as LangChain Documents with complete metadata."""

    def __init__(self, data: bytes, filename: str) -> None:
        self.data = data
        self.filename = filename

    def load_pages(self) -> list[tuple[int, str]]:
        """Extract (page_number, text) tuples with PyMuPDF speed and fidelity."""
        if not self.data.startswith(b"%PDF"):
            raise PdfError(f"{self.filename} isn't a PDF file.")
        
        try:
            import pymupdf

            doc = pymupdf.open(stream=self.data, filetype="pdf")
            if doc.is_encrypted and not doc.authenticate(""):
                raise PdfError(f"{self.filename} is password protected. Remove the password and upload it again.")
            if len(doc) > settings.max_pdf_pages:
                raise PdfError(f"{self.filename} has {len(doc)} pages. The limit is {settings.max_pdf_pages}.")

            pages: list[tuple[int, str]] = []
            for i, page in enumerate(doc):
                txt = page.get_text("text") or ""
                if txt.strip():
                    pages.append((i + 1, txt))

            if not pages:
                raise PdfError(f"{self.filename} has no selectable text. Scanned PDFs need OCR first.")
            return pages
        except PdfError:
            raise
        except Exception:
            # Automatic fallback to pypdf in case of unusual stream quirks
            return _fallback_pypdf_extract(self.data, self.filename)

    def load_documents(self) -> list[Document]:
        """Load extracted pages directly as LangChain Document instances with full PDF metadata."""
        try:
            import pymupdf
            doc = pymupdf.open(stream=self.data, filetype="pdf")
            doc_meta = doc.metadata or {}
            total_pages = len(doc)
        except Exception:
            doc_meta = {}
            total_pages = 0

        pages = self.load_pages()
        if not total_pages:
            total_pages = len(pages)

        return [
            Document(
                page_content=text,
                metadata={
                    "source": self.filename,
                    "source_title": self.filename,
                    "page": page_num,
                    "page_number": page_num,
                    "total_pages": total_pages,
                    "pdf_title": doc_meta.get("title") or self.filename,
                    "pdf_author": doc_meta.get("author") or "",
                    "pdf_creator": doc_meta.get("creator") or "",
                },
            )
            for page_num, text in pages
        ]


def _fallback_pypdf_extract(data: bytes, filename: str) -> list[tuple[int, str]]:
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


def extract_pages(data: bytes, filename: str) -> list[tuple[int, str]]:
    """Extract pages using high-speed PyMuPdfReader with graceful fallback."""
    return PyMuPdfReader(data, filename).load_pages()


def chunk_pages(pages: list[tuple[int, str]], source_title: str) -> list[Chunk]:
    """LangChain-powered recursive chunking per page with metadata preservation.
    
    Uses LangChain RecursiveCharacterTextSplitter with sentence-aware separators,
    enforcing page boundary constraints so citations are 100% exact.
    """
    target = settings.chunk_chars
    overlap = settings.chunk_overlap

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=target,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""],
        keep_separator=True,
        length_function=len,
    )

    out: list[Chunk] = []
    total_pages = max((p[0] for p in pages), default=len(pages))
    global_chunk_idx = 0

    for page, raw in pages:
        cleaned = re.sub(r"[ \t]+", " ", raw).strip()
        if not cleaned:
            continue

        # Wrap raw page in a LangChain Document
        page_doc = Document(
            page_content=cleaned,
            metadata={
                "source": source_title,
                "source_title": source_title,
                "page": page,
                "page_number": page,
                "total_pages": total_pages,
            },
        )

        split_docs = splitter.split_documents([page_doc])

        for page_chunk_idx, doc in enumerate(split_docs):
            txt = doc.page_content.strip()
            if len(txt) < 40:
                continue

            chunk = Chunk(
                source_title=source_title,
                page=page,
                text=txt,
                metadata={
                    **doc.metadata,
                    "chunk_index": global_chunk_idx,
                    "page_chunk_index": page_chunk_idx,
                    "char_count": len(txt),
                    "word_count": len(txt.split()),
                },
            )
            out.append(chunk)
            global_chunk_idx += 1

    return out

