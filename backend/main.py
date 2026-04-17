from dotenv import load_dotenv
import os

load_dotenv()

# 🔐 API KEY CHECK
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("❌ GROQ_API_KEY is not set in environment")

print("✅ GROQ_API_KEY loaded")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine, Base
from routers import meetings, transcription, analytics, ai, users, recordings
from signaling import router as signaling_router
import uvicorn


# 🧠 DATABASE INIT
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables ready")
    yield


# 🚀 FASTAPI APP
app = FastAPI(
    title="NeroMeet AI Backend",
    version="1.0.0",
    lifespan=lifespan,
)


# 🌐 CORS CONFIG (IMPORTANT)
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", "https://your-app.onrender.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 🔗 ROUTES
app.include_router(users.router,          prefix="/api/users",         tags=["Users"])
app.include_router(meetings.router,       prefix="/api/meetings",      tags=["Meetings"])
app.include_router(transcription.router,  prefix="/api/transcription", tags=["Transcription"])
app.include_router(analytics.router,      prefix="/api/analytics",     tags=["Analytics"])
app.include_router(ai.router,             prefix="/api/ai",            tags=["AI"])
app.include_router(recordings.router,     prefix="/api/recordings",    tags=["Recordings"])

# 🔌 WebSocket signaling
app.include_router(signaling_router, tags=["Signaling"])


# 🏠 ROOT
@app.get("/")
async def root():
    return {"status": "NeroMeet AI Backend running", "version": "1.0.0"}


# ❤️ HEALTH CHECK
@app.get("/health")
async def health():
    return {"status": "ok"}


# 🚀 ENTRY POINT (RENDER COMPATIBLE)
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),  # ✅ FIXED
        reload=False,  # ❌ no reload in production
        log_level="info",
    )