from fastapi import APIRouter, Depends, Request, HTTPException, Query, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete as sql_delete
from database import get_db, AsyncSessionLocal
from models import Meeting, Transcript, Participant, ActionItem, MeetingSummary, MeetingAnalytics
from routers.users import get_current_user
from services.pdf_service import generate_meeting_pdf
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

router = APIRouter()


class CreateMeetingRequest(BaseModel):
    title: str = "Untitled Meeting"


class RenameMeetingRequest(BaseModel):
    title: str


async def get_meeting_or_404(meeting_id: str, user_id: str, db: AsyncSession) -> Meeting:
    """Owner-only lookup — used for destructive actions (end, delete, rename)."""
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.user_id == user_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


async def get_meeting_any_user(meeting_id: str, db: AsyncSession) -> Meeting:
    """
    FIX: Participant lookup — any authenticated user can read an active meeting
    by ID (e.g. via invite link) without needing to own it.
    """
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


def meeting_to_dict(m: Meeting) -> dict:
    duration_sec = m.duration_seconds or 0
    duration_min = duration_sec // 60
    duration_str = f"{duration_min} min" if duration_min else "< 1 min"
    return {
        "id":                m.id,
        "title":             m.title,
        "status":            m.status,
        "created_at":        m.created_at.isoformat() if m.created_at else None,
        "ended_at":          m.ended_at.isoformat()   if m.ended_at   else None,
        "duration":          duration_str,
        "duration_seconds":  duration_sec,
        "performance_score": round(m.performance_score or 0, 1),
        "recording_url":     m.recording_url,
    }


async def _run_summary_background(meeting_id: str):
    try:
        from routers.ai import _generate_and_save_summary
        async with AsyncSessionLocal() as db:
            await _generate_and_save_summary(meeting_id, db)
    except Exception as e:
        print(f"[Summary Background] Error for {meeting_id}: {e}")


@router.get("/meta/stats")
async def get_stats(request: Request, db: AsyncSession = Depends(get_db)):
    user    = await get_current_user(request)
    total_r = await db.execute(select(Meeting).where(Meeting.user_id == user["id"]))
    all_m   = total_r.scalars().all()
    ended   = [m for m in all_m if m.status == "ended"]
    avg_score  = round(sum(m.performance_score or 0 for m in ended) / max(len(ended), 1), 1)
    total_mins = sum((m.duration_seconds or 0) for m in ended) // 60
    return {
        "total_meetings": len(all_m),
        "ended_meetings": len(ended),
        "avg_score":      avg_score,
        "total_minutes":  total_mins,
    }


@router.get("")
async def list_meetings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
):
    user  = await get_current_user(request)
    query = select(Meeting).where(Meeting.user_id == user["id"]).order_by(desc(Meeting.created_at))
    if search:
        query = query.where(Meeting.title.ilike(f"%{search}%"))
    query  = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return [meeting_to_dict(m) for m in result.scalars().all()]


@router.post("")
async def create_meeting(body: CreateMeetingRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user    = await get_current_user(request)
    meeting = Meeting(id=str(uuid.uuid4()), user_id=user["id"], title=body.title, status="active")
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return meeting_to_dict(meeting)


@router.get("/{meeting_id}")
async def get_meeting(meeting_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """
    FIX: Participants joining via invite link can read the meeting.
    We still require authentication, but not ownership.
    """
    await get_current_user(request)  # must be logged in
    meeting = await get_meeting_any_user(meeting_id, db)

    trans_r = await db.execute(select(Transcript).where(Transcript.meeting_id == meeting_id).order_by(Transcript.timestamp_sec))
    part_r  = await db.execute(select(Participant).where(Participant.meeting_id == meeting_id))
    act_r   = await db.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))
    sum_r   = await db.execute(select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id))
    ana_r   = await db.execute(select(MeetingAnalytics).where(MeetingAnalytics.meeting_id == meeting_id))

    transcripts  = trans_r.scalars().all()
    participants = part_r.scalars().all()
    action_items = act_r.scalars().all()
    summary      = sum_r.scalar_one_or_none()
    analytics    = ana_r.scalar_one_or_none()

    return {
        **meeting_to_dict(meeting),
        "transcripts":  [{"id": t.id, "speaker": t.speaker, "original_text": t.original_text, "translated_text": t.translated_text, "original_lang": t.original_lang, "timestamp_sec": t.timestamp_sec} for t in transcripts],
        "participants": [{"id": p.id, "name": p.name, "email": p.email, "speaking_duration": p.speaking_duration, "word_count": p.word_count, "attention_score": p.attention_score, "interruption_count": p.interruption_count} for p in participants],
        "action_items": [{"id": a.id, "task": a.task, "assigned_to": a.assigned_to, "context": a.context, "status": a.status} for a in action_items],
        "summary":    {"full_summary": summary.full_summary, "key_points": summary.key_points, "decisions": summary.decisions, "best_idea": summary.best_idea, "topics": summary.topics, "conflicts": summary.conflicts} if summary else None,
        "analytics":  {"speaking_graph": analytics.speaking_graph, "participation_breakdown": analytics.participation_breakdown, "performance_score": analytics.performance_score, "score_breakdown": analytics.score_breakdown, "attention_timeline": analytics.attention_timeline, "topic_flow": analytics.topic_flow, "conflict_moments": analytics.conflict_moments} if analytics else None,
    }


@router.patch("/{meeting_id}/rename")
async def rename_meeting(meeting_id: str, body: RenameMeetingRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user    = await get_current_user(request)
    meeting = await get_meeting_or_404(meeting_id, user["id"], db)
    meeting.title = body.title.strip() or meeting.title
    await db.commit()
    return {"success": True, "title": meeting.title}


@router.post("/{meeting_id}/end")
async def end_meeting(meeting_id: str, request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user    = await get_current_user(request)
    meeting = await get_meeting_or_404(meeting_id, user["id"], db)

    if meeting.status == "ended":
        return meeting_to_dict(meeting)

    now                      = datetime.utcnow()
    meeting.status           = "ended"
    meeting.ended_at         = now
    if meeting.created_at:
        meeting.duration_seconds = int((now - meeting.created_at).total_seconds())

    await db.commit()
    await db.refresh(meeting)

    background_tasks.add_task(_run_summary_background, meeting_id)
    return meeting_to_dict(meeting)


@router.delete("/{meeting_id}")
async def delete_meeting(meeting_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)
    res  = await db.execute(select(Meeting.id).where(Meeting.id == meeting_id, Meeting.user_id == user["id"]))
    if not res.scalar_one_or_none():
        raise HTTPException(404, "Meeting not found")
    for Model, col in [
        (Transcript,       Transcript.meeting_id),
        (Participant,      Participant.meeting_id),
        (ActionItem,       ActionItem.meeting_id),
        (MeetingSummary,   MeetingSummary.meeting_id),
        (MeetingAnalytics, MeetingAnalytics.meeting_id),
    ]:
        await db.execute(sql_delete(Model).where(col == meeting_id))
    await db.execute(sql_delete(Meeting).where(Meeting.id == meeting_id))
    await db.commit()
    return {"success": True}


@router.get("/{meeting_id}/pdf")
async def download_pdf(meeting_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    user    = await get_current_user(request)
    meeting = await get_meeting_or_404(meeting_id, user["id"], db)
    detail  = await get_meeting(meeting_id, request, db)
    summary = detail.get("summary") or {}
    pdf_data = {
        "title":             meeting.title,
        "date":              meeting.created_at.strftime("%b %d, %Y") if meeting.created_at else "N/A",
        "duration":          detail.get("duration", "N/A"),
        "full_summary":      summary.get("full_summary"),
        "key_points":        summary.get("key_points", []),
        "decisions":         summary.get("decisions", []),
        "best_idea":         summary.get("best_idea"),
        "topics":            summary.get("topics", []),
        "action_items":      detail.get("action_items", []),
        "participants":      detail.get("participants", []),
        "transcript":        detail.get("transcripts", []),
        "performance_score": meeting.performance_score or 0,
        "score_feedback":    (detail.get("analytics") or {}).get("score_breakdown", {}),
    }
    pdf_bytes  = generate_meeting_pdf(pdf_data)
    safe_title = meeting.title.replace('"', "'").replace("—", "-")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )