from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Meeting, Transcript, Participant, MeetingAnalytics
from routers.users import get_current_user
from services.analytics_service import compute_participation, compute_performance_score, build_speaking_graph, detect_interruptions

router = APIRouter()

@router.get("/{meeting_id}")
async def get_analytics(meeting_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)

    res = await db.execute(select(Meeting).where(Meeting.id == meeting_id, Meeting.user_id == user["id"]))
    if not res.scalar_one_or_none():
        raise HTTPException(404, "Meeting not found")

    # Load saved analytics
    ana_res = await db.execute(select(MeetingAnalytics).where(MeetingAnalytics.meeting_id == meeting_id))
    analytics = ana_res.scalar_one_or_none()

    # Load transcripts for live computation
    trans_res = await db.execute(select(Transcript).where(Transcript.meeting_id == meeting_id).order_by(Transcript.timestamp_sec))
    transcripts = trans_res.scalars().all()

    raw_lines = [
        {"speaker": t.speaker, "original_text": t.original_text, "start_sec": t.timestamp_sec, "end_sec": t.timestamp_sec + 5}
        for t in transcripts
    ]

    participation  = compute_participation(raw_lines)
    speaking_graph = build_speaking_graph(raw_lines)
    interruptions  = detect_interruptions(raw_lines)

    # Load participants
    prt_res = await db.execute(select(Participant).where(Participant.meeting_id == meeting_id))
    participants = prt_res.scalars().all()

    return {
        "meeting_id":               meeting_id,
        "participation_breakdown":  participation,
        "speaking_graph":           speaking_graph,
        "interruptions":            interruptions,
        "participants": [
            {
                "name":             p.name,
                "speaking_duration":p.speaking_duration,
                "word_count":       p.word_count,
                "attention_score":  p.attention_score,
                "interruption_count":p.interruption_count,
            }
            for p in participants
        ],
        "performance_score": analytics.performance_score if analytics else 0,
        "score_breakdown":   analytics.score_breakdown   if analytics else {},
        "attention_timeline":analytics.attention_timeline if analytics else [],
        "topic_flow":        analytics.topic_flow         if analytics else [],
        "conflict_moments":  analytics.conflict_moments   if analytics else [],
    }


@router.post("/{meeting_id}/attention")
async def update_attention(
    meeting_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive attention score from frontend MediaPipe."""
    body = await request.json()
    participant_name = body.get("participant", "Unknown")
    score            = body.get("score", 100.0)

    prt_res = await db.execute(
        select(Participant).where(
            Participant.meeting_id == meeting_id,
            Participant.name == participant_name
        )
    )
    participant = prt_res.scalar_one_or_none()
    if participant:
        # Rolling average
        participant.attention_score = (participant.attention_score + score) / 2
        await db.commit()

    return {"status": "ok", "score": score}