from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid

def gen_id():
    return str(uuid.uuid4())

class Meeting(Base):
    __tablename__ = "meetings"

    id              = Column(String, primary_key=True, default=gen_id)
    user_id         = Column(String, nullable=False, index=True)
    title           = Column(String, nullable=False, default="Untitled Meeting")
    status          = Column(String, default="active")   # active | ended
    language        = Column(String, default="en")
    created_at      = Column(DateTime, default=datetime.utcnow)
    ended_at        = Column(DateTime, nullable=True)
    duration_seconds= Column(Integer, default=0)
    recording_url   = Column(String, nullable=True)
    performance_score = Column(Float, default=0.0)

    # Relationships
    transcripts     = relationship("Transcript",   back_populates="meeting", cascade="all, delete")
    participants    = relationship("Participant",  back_populates="meeting", cascade="all, delete")
    action_items    = relationship("ActionItem",  back_populates="meeting", cascade="all, delete")
    summary         = relationship("MeetingSummary", back_populates="meeting", uselist=False, cascade="all, delete")
    analytics       = relationship("MeetingAnalytics", back_populates="meeting", uselist=False, cascade="all, delete")


class Transcript(Base):
    __tablename__ = "transcripts"

    id              = Column(String, primary_key=True, default=gen_id)
    meeting_id      = Column(String, ForeignKey("meetings.id"), nullable=False)
    speaker         = Column(String, default="Unknown")
    original_text   = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=True)
    original_lang   = Column(String, default="en")
    timestamp_sec   = Column(Float, default=0.0)
    created_at      = Column(DateTime, default=datetime.utcnow)
    is_final        = Column(Boolean, default=True)

    meeting         = relationship("Meeting", back_populates="transcripts")


class Participant(Base):
    __tablename__ = "participants"

    id                  = Column(String, primary_key=True, default=gen_id)
    meeting_id          = Column(String, ForeignKey("meetings.id"), nullable=False)
    user_id             = Column(String, nullable=True)
    name                = Column(String, nullable=False)
    email               = Column(String, nullable=True)
    speaking_duration   = Column(Float, default=0.0)   # seconds
    word_count          = Column(Integer, default=0)
    interruption_count  = Column(Integer, default=0)
    attention_score     = Column(Float, default=100.0) # 0-100
    joined_at           = Column(DateTime, default=datetime.utcnow)

    meeting             = relationship("Meeting", back_populates="participants")


class ActionItem(Base):
    __tablename__ = "action_items"

    id              = Column(String, primary_key=True, default=gen_id)
    meeting_id      = Column(String, ForeignKey("meetings.id"), nullable=False)
    task            = Column(Text, nullable=False)
    assigned_to     = Column(String, nullable=True)
    context         = Column(Text, nullable=True)
    status          = Column(String, default="pending")  # pending | done
    created_at      = Column(DateTime, default=datetime.utcnow)

    meeting         = relationship("Meeting", back_populates="action_items")


class MeetingSummary(Base):
    __tablename__ = "meeting_summaries"

    id              = Column(String, primary_key=True, default=gen_id)
    meeting_id      = Column(String, ForeignKey("meetings.id"), nullable=False, unique=True)
    full_summary    = Column(Text, nullable=True)
    key_points      = Column(JSON, default=list)       # ["point1", "point2"]
    decisions       = Column(JSON, default=list)
    best_idea       = Column(Text, nullable=True)
    topics          = Column(JSON, default=list)       # [{label, start_sec, end_sec}]
    conflicts       = Column(JSON, default=list)       # [{time, description}]
    created_at      = Column(DateTime, default=datetime.utcnow)

    meeting         = relationship("Meeting", back_populates="summary")


class MeetingAnalytics(Base):
    __tablename__ = "meeting_analytics"

    id                      = Column(String, primary_key=True, default=gen_id)
    meeting_id              = Column(String, ForeignKey("meetings.id"), nullable=False, unique=True)
    speaking_graph          = Column(JSON, default=dict)   # {speaker: [sec,...]}
    attention_timeline      = Column(JSON, default=list)   # [{t, score}]
    emotion_timeline        = Column(JSON, default=list)   # [{t, emotion}]
    topic_flow              = Column(JSON, default=list)   # [{label, duration}]
    conflict_moments        = Column(JSON, default=list)
    participation_breakdown = Column(JSON, default=dict)   # {speaker: pct}
    performance_score       = Column(Float, default=0.0)
    score_breakdown         = Column(JSON, default=dict)
    created_at              = Column(DateTime, default=datetime.utcnow)

    meeting                 = relationship("Meeting", back_populates="analytics")