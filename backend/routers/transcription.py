from fastapi import APIRouter, Depends, Request, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Transcript, Meeting, Participant
from routers.users import get_current_user
from datetime import datetime
import uuid

router = APIRouter()


# ── Save text transcript ───────────────────────────────────────────────────────
@router.post("/{meeting_id}/text")
async def save_text_transcript(
    meeting_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await get_current_user(request)
    body = await request.json()

    text = body.get("text", "").strip()
    speaker = body.get("speaker", user.get("name", "Unknown"))
    timestamp_sec = body.get("timestamp_sec", 0.0)

    if not text:
        return {"status": "empty"}

    res = await db.execute(
        select(Meeting).where(
            Meeting.id == meeting_id,
            Meeting.user_id == user["id"],
        )
    )
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    transcript = Transcript(
        id=str(uuid.uuid4()),
        meeting_id=meeting_id,
        speaker=speaker,
        original_text=text,
        translated_text=text,
        original_lang="en",
        timestamp_sec=timestamp_sec,
        is_final=True,
    )
    db.add(transcript)

    prt_res = await db.execute(
        select(Participant).where(
            Participant.meeting_id == meeting_id,
            Participant.name == speaker,
        )
    )
    participant = prt_res.scalar_one_or_none()
    if not participant:
        participant = Participant(
            id=str(uuid.uuid4()),
            meeting_id=meeting_id,
            name=speaker,
            speaking_duration=0,
            word_count=0,
        )
        db.add(participant)

    participant.word_count = (participant.word_count or 0) + len(text.split())
    participant.speaking_duration = (participant.speaking_duration or 0) + len(text.split()) * 0.4

    await db.commit()
    return {"status": "ok", "text": text, "speaker": speaker}


# ── Legacy chunk endpoint (kept for backwards compat) ─────────────────────────
@router.post("/{meeting_id}/chunk")
async def transcribe_chunk(
    meeting_id: str,
    request: Request,
    audio: UploadFile = File(...),
    speaker: str = Form("Unknown"),
    timestamp_sec: float = Form(0.0),
    db: AsyncSession = Depends(get_db),
):
    """Deprecated — use /whisper instead."""
    return {
        "status": "ok",
        "text": "",
        "translated_text": "",
        "language": "en",
        "was_translated": False,
        "timestamp_sec": timestamp_sec,
        "speaker": speaker,
        "segments": [],
    }


# ── Whisper endpoint ───────────────────────────────────────────────────────────
@router.post("/{meeting_id}/whisper")
async def whisper_transcribe(
    meeting_id: str,
    file: UploadFile = File(...),
    user: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Receive an audio blob from the frontend, transcribe via Groq Whisper,
    save to DB, and return the transcript text.

    FIX (Bug 2): Language is now auto-detected by Whisper — no hardcoded 'hi'.
    FIX (Bug 3): Removed dict.fromkeys() word deduplication — it was corrupting
                 transcripts by silently dropping valid repeated words.
    """
    from services.whisper_service import transcribe_audio

    audio_bytes = await file.read()

    # Reject obviously empty uploads (saves a Groq API call)
    if len(audio_bytes) < 2000:
        return {"text": ""}

    # Pass original filename so whisper_service picks the right file extension
    result = await transcribe_audio(audio_bytes, filename=file.filename or "audio.webm")

    text = result.get("text", "").strip()
    detected_lang = result.get("language", "en")

    # FIX (Bug 3): No dict.fromkeys() here — Whisper already handles dedup.
    # The old line `text = " ".join(dict.fromkeys(text.split()))` was
    # incorrectly removing valid repeated words like "very very important".

    if len(text.split()) < 2:
        return {"text": ""}

    # Persist to DB
    transcript_obj = Transcript(
        id=str(uuid.uuid4()),
        meeting_id=meeting_id,
        speaker=user,
        original_text=text,
        translated_text=text,
        original_lang=detected_lang,  # FIX: use actual detected language
        timestamp_sec=datetime.utcnow().timestamp(),
        is_final=True,
    )
    db.add(transcript_obj)

    # Update or create participant stats
    prt_res = await db.execute(
        select(Participant).where(
            Participant.meeting_id == meeting_id,
            Participant.name == user,
        )
    )
    participant = prt_res.scalar_one_or_none()
    if not participant:
        participant = Participant(
            id=str(uuid.uuid4()),
            meeting_id=meeting_id,
            name=user,
            speaking_duration=0,
            word_count=0,
        )
        db.add(participant)

    word_count = len(text.split())
    participant.word_count = (participant.word_count or 0) + word_count
    participant.speaking_duration = (participant.speaking_duration or 0) + word_count * 0.4

    await db.commit()

    return {
        "user": user,
        "text": text,
        "original_text": text,
        "language": detected_lang,
        "was_translated": False,
    }


# ── Get transcript ─────────────────────────────────────────────────────────────
@router.get("/{meeting_id}")
async def get_transcript(
    meeting_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await get_current_user(request)

    res = await db.execute(
        select(Meeting).where(
            Meeting.id == meeting_id,
            Meeting.user_id == user["id"],
        )
    )
    if not res.scalar_one_or_none():
        raise HTTPException(404, "Meeting not found")

    trans_res = await db.execute(
        select(Transcript)
        .where(Transcript.meeting_id == meeting_id)
        .order_by(Transcript.timestamp_sec)
    )
    transcripts = trans_res.scalars().all()

    return {
        "meeting_id": meeting_id,
        "lines": [
            {
                "id": t.id,
                "speaker": t.speaker,
                "original_text": t.original_text,
                "translated_text": t.translated_text,
                "original_lang": t.original_lang,
                "timestamp_sec": t.timestamp_sec,
            }
            for t in transcripts
        ],
        "total_lines": len(transcripts),
    }