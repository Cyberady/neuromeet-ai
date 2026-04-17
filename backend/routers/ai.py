from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Meeting, Transcript, MeetingSummary, ActionItem, MeetingAnalytics
from routers.users import get_current_user
from services.groq_service import (
    generate_summary, extract_action_items, chat_with_meeting,
    detect_conflict, get_coach_feedback, analyze_ideas, segment_topics
)
from services.analytics_service import compute_participation, compute_performance_score, build_speaking_graph
from pydantic import BaseModel
from datetime import datetime
import uuid

router = APIRouter()

class ChatRequest(BaseModel):
    question: str
    meeting_id: str

class ConflictRequest(BaseModel):
    recent_text: str
    meeting_id: str

# ── Internal helper ───────────────────────────────────────────
async def _generate_and_save_summary(meeting_id: str, db: AsyncSession):
    """Called when meeting ends. Generates and saves all AI insights."""
    # Get all transcripts
    trans_res = await db.execute(
        select(Transcript).where(Transcript.meeting_id == meeting_id).order_by(Transcript.timestamp_sec)
    )
    transcripts = trans_res.scalars().all()
    if not transcripts:
        return

    full_text = "\n".join(
        f"[{int(t.timestamp_sec//60):02d}:{int(t.timestamp_sec%60):02d}] {t.speaker}: {t.translated_text or t.original_text}"
        for t in transcripts
    )

    # Get meeting title
    mtg_res = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = mtg_res.scalar_one_or_none()
    if not meeting:
        return

    # AI calls (parallel would be ideal but sequential is safer)
    summary_data = await generate_summary(full_text, meeting.title)
    action_items = await extract_action_items(full_text)
    ideas        = await analyze_ideas(full_text)
    topics       = await segment_topics(full_text)

    # Participation analytics
    raw_lines = [
        {
            "speaker":    t.speaker,
            "original_text": t.original_text,
            "start_sec":  t.timestamp_sec,
            "end_sec":    t.timestamp_sec + 5,
        }
        for t in transcripts
    ]
    participation = compute_participation(raw_lines)
    speaking_graph = build_speaking_graph(raw_lines)

    # Performance score
    perf = compute_performance_score({
        "participation_breakdown": participation,
        "num_decisions":   len(summary_data.get("decisions", [])),
        "num_action_items":len(action_items),
        "num_conflicts":   len(summary_data.get("conflicts", [])),
        "duration_sec":    meeting.duration_seconds or 0,
    })

    # Save summary
    existing_sum = await db.execute(
        select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
    )
    sum_obj = existing_sum.scalar_one_or_none()
    if not sum_obj:
        sum_obj = MeetingSummary(id=str(uuid.uuid4()), meeting_id=meeting_id)
        db.add(sum_obj)

    sum_obj.full_summary = summary_data.get("full_summary")
    sum_obj.key_points   = summary_data.get("key_points", [])
    sum_obj.decisions    = summary_data.get("decisions", [])
    sum_obj.best_idea    = ideas.get("best_idea") or summary_data.get("best_idea")
    sum_obj.topics       = topics
    sum_obj.conflicts    = summary_data.get("conflicts", [])

    # Save action items
    for item in action_items:
        ai_obj = ActionItem(
            id=str(uuid.uuid4()),
            meeting_id=meeting_id,
            task=item.get("task", ""),
            assigned_to=item.get("assigned_to"),
            context=item.get("context"),
        )
        db.add(ai_obj)

    # Save analytics
    existing_ana = await db.execute(
        select(MeetingAnalytics).where(MeetingAnalytics.meeting_id == meeting_id)
    )
    ana_obj = existing_ana.scalar_one_or_none()
    if not ana_obj:
        ana_obj = MeetingAnalytics(id=str(uuid.uuid4()), meeting_id=meeting_id)
        db.add(ana_obj)

    ana_obj.speaking_graph          = speaking_graph
    ana_obj.participation_breakdown = participation
    ana_obj.performance_score       = perf["overall"]
    ana_obj.score_breakdown         = perf["breakdown"]
    ana_obj.topic_flow              = topics

    # Update meeting score
    meeting.performance_score = perf["overall"]

    await db.commit()


# ── Routes ────────────────────────────────────────────────────
@router.post("/chat")
async def chat(body: ChatRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)

    trans_res = await db.execute(
        select(Transcript).where(Transcript.meeting_id == body.meeting_id).order_by(Transcript.timestamp_sec)
    )
    transcripts = trans_res.scalars().all()

    # ✅ Don't 400 — answer even with no transcript
    if not transcripts:
        full_text = "No transcript available yet. The meeting may not have started or speech recognition may not have captured anything."
    else:
        full_text = "\n".join(
            f"{t.speaker}: {t.translated_text or t.original_text}" for t in transcripts
        )

    sum_res = await db.execute(
        select(MeetingSummary).where(MeetingSummary.meeting_id == body.meeting_id)
    )
    summary = sum_res.scalar_one_or_none()
    summary_text = summary.full_summary if summary else ""

    answer = await chat_with_meeting(body.question, full_text, summary_text)
    return {"answer": answer, "question": body.question}


@router.post("/trigger-summary/{meeting_id}")
async def trigger_summary(meeting_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)
    await _generate_and_save_summary(meeting_id, db)
    return {"status": "summary generated"}


@router.post("/conflict-check")
async def conflict_check(body: ConflictRequest, request: Request):
    user   = await get_current_user(request)
    result = await detect_conflict(body.recent_text)
    return result


@router.post("/coach/{meeting_id}")
async def coach_feedback(meeting_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)
    trans_res = await db.execute(
        select(Transcript).where(Transcript.meeting_id == meeting_id).order_by(Transcript.timestamp_sec)
    )
    transcripts = trans_res.scalars().all()
    full_text   = "\n".join(f"{t.speaker}: {t.original_text}" for t in transcripts[-20:])

    part_res    = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    mtg         = part_res.scalar_one_or_none()

    from models import Participant
    prt_res     = await db.execute(select(Participant).where(Participant.meeting_id == meeting_id))
    participants = [p.name for p in prt_res.scalars().all()]

    feedback = await get_coach_feedback(full_text, participants)
    return {"feedback": feedback}


@router.get("/ideas/{meeting_id}")
async def get_ideas(meeting_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)
    trans_res = await db.execute(
        select(Transcript).where(Transcript.meeting_id == meeting_id)
    )
    transcripts = trans_res.scalars().all()
    full_text   = "\n".join(f"{t.speaker}: {t.original_text}" for t in transcripts)
    ideas       = await analyze_ideas(full_text)
    return ideas