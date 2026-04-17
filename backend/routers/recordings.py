from fastapi import APIRouter, Depends, Request, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Meeting
from routers.users import get_current_user

router = APIRouter()

@router.post("/{meeting_id}/upload")
async def upload(
    meeting_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    user = await get_current_user(request)

    res = await db.execute(
        select(Meeting).where(
            Meeting.id == meeting_id,
            Meeting.user_id == user["id"]
        )
    )

    meeting = res.scalar_one_or_none()

    if not meeting:
        raise HTTPException(404, "Meeting not found")

    # 🚫 STORAGE DISABLED
    meeting.recording_url = "disabled"

    await db.commit()

    return {"url": "disabled"}


@router.get("/{meeting_id}/url")
async def get_url(meeting_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request)

    res = await db.execute(
        select(Meeting).where(
            Meeting.id == meeting_id,
            Meeting.user_id == user["id"]
        )
    )

    meeting = res.scalar_one_or_none()

    if not meeting:
        raise HTTPException(404, "Not found")

    return {"url": meeting.recording_url}