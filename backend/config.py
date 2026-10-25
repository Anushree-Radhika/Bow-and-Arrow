import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()  # reads backend/.env if it exists; real environment variables still win


@dataclass
class Settings:
    supabase_url: str = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    gemini_embed_model: str = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
    embed_dim: int = 768  # must match vector(768) in the migration

    max_files: int = int(os.getenv("MAX_FILES", "5"))
    max_pdf_mb: int = int(os.getenv("MAX_PDF_MB", "15"))
    max_pdf_pages: int = int(os.getenv("MAX_PDF_PAGES", "400"))
    max_chunks: int = int(os.getenv("MAX_CHUNKS", "400"))
    chunk_chars: int = int(os.getenv("CHUNK_CHARS", "1200"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "150"))

    rag_top_k: int = int(os.getenv("RAG_TOP_K", "10"))
    # cosine similarity floor for folder retrieval (1.0 = identical). Tune on your own notes.
    rag_min_similarity: float = float(os.getenv("RAG_MIN_SIMILARITY", "0.55"))

    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    )


settings = Settings()

# Every generated or expanded node starts with exactly this. The LLM never chooses durations.
DEFAULT_NODE_SECONDS = 1800
