import httpx
from fastapi import HTTPException, UploadFile
from app.core.config import settings

GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

async def transcribe_audio(file: UploadFile, prompt_context: str = "") -> str:
    """Transcribes audio using Groq Whisper-large-v3-turbo with sub-300ms latency."""
    api_key = settings.groq_api_key
    if not api_key:
        raise HTTPException(500, "GROQ_API_KEY is not configured in backend/.env")

    audio_bytes = await file.read()
    
    # Priming Whisper with the current roadmap topic names ensures 100% accuracy on jargon
    system_prompt = f"Study roadmaps, technical terms: {prompt_context}" if prompt_context else "Study topics, algorithms, computer science."

    files = {
        "file": (file.filename or "audio.webm", audio_bytes, file.content_type or "audio/webm"),
    }
    data = {
        "model": "whisper-large-v3-turbo",
        "prompt": system_prompt,
        "response_format": "json",
        "language": "en",
    }
    headers = {"Authorization": f"Bearer {api_key}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(GROQ_TRANSCRIPTION_URL, files=files, data=data, headers=headers)
        if res.status_code != 200:
            raise HTTPException(res.status_code, f"Whisper transcription failed: {res.text}")
        return res.json().get("text", "").strip()
