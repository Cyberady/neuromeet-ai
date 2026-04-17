from groq import Groq
import os, json, re

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL  = "llama-3.3-70b-versatile"

def _chat(system: str, user: str, json_mode=False) -> str:
    kwargs = dict(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=0.3,
        max_tokens=2048,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = client.chat.completions.create(**kwargs)
    return resp.choices[0].message.content.strip()

def _safe_json(text: str, fallback):
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r'\{.*\}|\[.*\]', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return fallback

# ── Full meeting summary ──────────────────────────────────────
async def generate_summary(transcript: str, title: str) -> dict:
    system = """You are an expert meeting analyst. Analyze the transcript and return a JSON object with:
{
  "full_summary": "2-3 paragraph summary",
  "key_points": ["point1", "point2", ...],
  "decisions": ["decision1", ...],
  "best_idea": "the most impactful idea discussed",
  "topics": [{"label": "topic name", "description": "brief desc"}],
  "conflicts": [{"description": "conflict description", "resolution": "how it was resolved or unresolved"}],
  "performance_score": 8.5,
  "score_breakdown": {
    "participation": 9.0,
    "clarity": 8.0,
    "decisions_made": 9.0,
    "time_efficiency": 7.5
  },
  "score_feedback": ["Strong participation", "Clear decisions made", "Minor off-topic discussions"]
}"""
    result = _chat(system, f"Meeting title: {title}\n\nTranscript:\n{transcript}", json_mode=True)
    return _safe_json(result, {
        "full_summary": "Summary unavailable.",
        "key_points": [], "decisions": [], "best_idea": "",
        "topics": [], "conflicts": [], "performance_score": 0,
        "score_breakdown": {}, "score_feedback": []
    })

# ── Action items ──────────────────────────────────────────────
async def extract_action_items(transcript: str) -> list:
    system = """Extract action items from this meeting transcript. Return JSON:
{"items": [{"task": "task description", "assigned_to": "person name or Unknown", "context": "why this task"}]}"""
    result = _chat(system, transcript, json_mode=True)
    data = _safe_json(result, {"items": []})
    return data.get("items", [])

# ── Chat with meeting ─────────────────────────────────────────
async def chat_with_meeting(question: str, transcript: str, summary: str = "") -> str:
    system = f"""You are an AI assistant for meeting analysis. Answer questions based on the meeting transcript.
Be concise and specific. If the answer isn't in the transcript, say so.

Meeting Summary: {summary or 'Not available'}"""
    return _chat(system, f"Transcript:\n{transcript}\n\nQuestion: {question}")

# ── Translation ───────────────────────────────────────────────
async def translate_to_english(text: str, source_lang: str) -> str:
    if source_lang in ("en", "english"):
        return text

    system = "Translate everything into clean English. Only return translated text."
    return _chat(system, text)

# ── Detect language ───────────────────────────────────────────
async def detect_language(text: str) -> str:
    system = """Detect the language of this text. Return ONLY the ISO 639-1 language code (e.g. 'en', 'hi', 'es', 'fr'). Nothing else."""
    result = _chat(system, text[:200])
    return result.strip().lower()[:5]

# ── Conflict detection ────────────────────────────────────────
async def detect_conflict(recent_text: str) -> dict:
    system = """Analyze this recent meeting conversation for conflicts, interruptions or tension.
Return JSON: {"conflict_detected": true/false, "type": "interruption|debate|escalation|none", "severity": "low|medium|high", "description": "brief description"}"""
    result = _chat(system, recent_text, json_mode=True)
    return _safe_json(result, {"conflict_detected": False, "type": "none", "severity": "low", "description": ""})

# ── AI Meeting Coach ──────────────────────────────────────────
async def get_coach_feedback(transcript: str, participants: list) -> list:
    participant_names = ", ".join(participants) if participants else "Unknown"
    system = """You are an AI meeting coach. Analyze the meeting so far and provide live feedback.
Return JSON: {"feedback": ["feedback item 1", "feedback item 2", ...]} 
Focus on: silent participants, off-topic discussions, important ideas, engagement."""
    result = _chat(system, f"Participants: {participant_names}\n\nTranscript so far:\n{transcript}", json_mode=True)
    data = _safe_json(result, {"feedback": []})
    return data.get("feedback", [])

# ── Idea intelligence ─────────────────────────────────────────
async def analyze_ideas(transcript: str) -> dict:
    system = """Extract and rank ideas from this meeting. Return JSON:
{"best_idea": "most impactful idea", "most_practical": "easiest to implement", "most_impactful": "highest business impact",
"all_ideas": [{"idea": "description", "suggested_by": "person", "score": 8.5}]}"""
    result = _chat(system, transcript, json_mode=True)
    return _safe_json(result, {"best_idea": "", "most_practical": "", "most_impactful": "", "all_ideas": []})

# ── Topic segmentation ────────────────────────────────────────
async def segment_topics(transcript: str) -> list:
    system = """Segment this meeting transcript into topics/phases. Return JSON:
{"segments": [{"label": "Introduction", "type": "intro|discussion|debate|decision|conclusion", "summary": "what was discussed"}]}"""
    result = _chat(system, transcript, json_mode=True)
    data = _safe_json(result, {"segments": []})
    return data.get("segments", [])