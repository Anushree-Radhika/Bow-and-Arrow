from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.core.security import User, current_user
from app.models.command import CommandIn, CommandOut
from app.models.mindmap import GenerateOut
from app.services.ai import AI, GeminiAI
from app.services.mindmap_service import generate_map, run_command
from app.services.pdf_service import Chunk, PdfError, chunk_pages, extract_pages
from app.services.storage_service import KnowledgeStore, SupabaseKnowledgeStore
from app.services.voice_service import transcribe_audio


router = APIRouter(prefix="/api/mindmap", tags=["mindmap"])

_ai = GeminiAI()
_store = SupabaseKnowledgeStore()


def get_ai() -> AI:
    return _ai


def get_store() -> KnowledgeStore:
    return _store


def _check_uuid(value: str | None, field: str) -> str | None:
    if not value:
        return None
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise HTTPException(422, f"{field} isn't a valid id.")


def _read_pdfs(files: list[UploadFile]) -> list[Chunk]:
    real = [f for f in files if f.filename]  # browsers send an empty part when no file is chosen
    if len(real) > settings.max_files:
        raise HTTPException(400, f"Upload at most {settings.max_files} PDFs at a time.")
    limit = settings.max_pdf_mb * 1024 * 1024
    chunks: list[Chunk] = []
    for f in real:
        data = f.file.read(limit + 1)
        if len(data) > limit:
            raise HTTPException(413, f"{f.filename} is larger than {settings.max_pdf_mb} MB.")
        try:
            chunks += chunk_pages(extract_pages(data, f.filename or "file.pdf"), f.filename or "file.pdf")
        except PdfError as e:
            raise HTTPException(400, str(e))
        if len(chunks) > settings.max_chunks:
            raise HTTPException(413, "That's a lot of text. Upload fewer pages or split the PDF.")
    return chunks


@router.post("/generate", response_model=GenerateOut)
def generate(
    prompt: str = Form(..., min_length=3, max_length=2000),
    folderId: str | None = Form(default=None),
    nodeMinutes: int = Form(default=30, ge=1, le=480),
    files: list[UploadFile] = File(default=[]),
    user: User = Depends(current_user),
    ai: AI = Depends(get_ai),
    store: KnowledgeStore = Depends(get_store),
):
    """Dual engine: PDFs uploaded -> grounded in them (RAG); no PDFs -> prompt-only generation."""
    chunks = _read_pdfs(files)
    return generate_map(
        user,
        prompt.strip(),
        chunks,
        _check_uuid(folderId, "folderId"),
        ai,
        store,
        node_minutes=nodeMinutes,
    )


@router.post("/command", response_model=CommandOut)
def command(
    body: CommandIn,
    user: User = Depends(current_user),
    ai: AI = Depends(get_ai),
    store: KnowledgeStore = Depends(get_store),
):
    """Natural language -> one mutation action (COMPLETE, ADD_TIME, RESTART, EXPAND, GENERATE_NEW_MAP)."""
    body.folderId = _check_uuid(body.folderId, "folderId")
    return run_command(body, user, ai, store)



@router.post("/transcribe")
async def transcribe_voice(
    file: UploadFile = File(...),
    node_titles: str = Form(default=""),
    user: User = Depends(current_user),
):
    text = await transcribe_audio(file, prompt_context=node_titles)
    return {"text": text}