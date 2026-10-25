"""PDF utilities shim re-exporting from app.services.pdf_service."""

from app.services.pdf_service import Chunk, PdfError, chunk_pages, extract_pages

__all__ = ["Chunk", "PdfError", "chunk_pages", "extract_pages"]
