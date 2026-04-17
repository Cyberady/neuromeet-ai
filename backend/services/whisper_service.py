import tempfile
import os
import asyncio
import re
import time

from groq import Groq

_client = None


def get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable is not set")
        _client = Groq(api_key=api_key)
    return _client


HALLUCINATIONS = {
    "thank you", "thanks for watching", "thank you for watching",
    "thanks for watching!", "thank you!", ".", "..", "...", "bye",
    "bye bye", "please subscribe", "subtitles by", "[music]",
    "[applause]", "[silence]", "[ silence ]", "you", "yes", "no",
    "okay", "ok", "hmm", "um", "uh", "ah", "oh", "eh",
    "all right", "alright", "sure", "right",
}


def remove_repetitions(text: str) -> str:
    text = re.sub(r'\b(\w+)(\s+\1){2,}\b', r'\1', text, flags=re.IGNORECASE)
    text = re.sub(r'\b(\w+)(\s+\1)\b', r'\1', text, flags=re.IGNORECASE)
    words = text.split()
    if len(words) < 6:
        return text.strip()
    cleaned = []
    i = 0
    while i < len(words):
        found = False
        for plen in range(min(8, (len(words) - i) // 2), 2, -1):
            phrase = words[i: i + plen]
            nxt = words[i + plen: i + plen * 2]
            if len(nxt) == plen:
                norm = lambda ws: [w.lower().strip(".,!?؟،") for w in ws]
                if norm(phrase) == norm(nxt):
                    cleaned.extend(phrase)
                    i += plen * 2
                    found = True
                    break
        if not found:
            cleaned.append(words[i])
            i += 1
    return " ".join(cleaned).strip()


def has_garbage_chars(text: str) -> bool:
    if "\ufffd" in text or "â" in text:
        return True
    if len(text.split()) <= 3:
        non_latin = sum(1 for c in text if ord(c) > 591)
        if non_latin > 4:
            return True
    return False


def is_language_jumble(text: str) -> bool:
    if len(text.split()) > 12:
        return False
    scripts = {
        "latin":      bool(re.search(r'[a-zA-Z]', text)),
        "devanagari": bool(re.search(r'[\u0900-\u097F]', text)),
        "arabic":     bool(re.search(r'[\u0600-\u06FF]', text)),
        "cyrillic":   bool(re.search(r'[\u0400-\u04FF]', text)),
        "cjk":        bool(re.search(r'[\u4E00-\u9FFF\u3040-\u30FF]', text)),
        "thai":       bool(re.search(r'[\u0E00-\u0E7F]', text)),
    }
    return sum(scripts.values()) >= 3


def is_garbage(text: str) -> bool:
    s = text.strip()
    if not s:
        return True
    if has_garbage_chars(s):
        print(f"🗑️ Garbage chars: {repr(s[:60])}")
        return True
    words = s.split()
    if len(words) < 2:
        return True
    if s.lower().strip(".,!?؟، ") in HALLUCINATIONS:
        print(f"🗑️ Hallucination: {repr(s)}")
        return True
    unique_ratio = len(set(w.lower() for w in words)) / len(words)
    if len(words) >= 6 and unique_ratio < 0.3:
        print(f"🗑️ Repetition loop: {repr(s[:60])}")
        return True
    if is_language_jumble(s):
        print(f"🗑️ Language jumble: {repr(s[:60])}")
        return True
    return False


def _transcribe_sync(audio_bytes: bytes, filename: str) -> dict:
    """
    FIX (Rate limit 429): Added retry with exponential backoff.
    Groq free tier = 20 RPM. With 2 users sending 10s chunks = ~12 req/min
    which is safe, but bursts can still hit the limit. We retry up to 3 times
    with increasing delays (4s, 8s) before giving up.
    """
    suffix = os.path.splitext(filename)[-1] or ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        client = get_client()

        with open(tmp_path, "rb") as f:
            audio_data = f.read()

        # Retry loop for 429 rate limit errors
        max_retries = 3
        retry_delays = [4, 8, 16]  # seconds

        for attempt in range(max_retries):
            try:
                transcription = client.audio.transcriptions.create(
                    file=(filename, audio_data),
                    model="whisper-large-v3-turbo",
                    temperature=0,
                    response_format="verbose_json",
                )
                break  # success — exit retry loop

            except Exception as e:
                err_str = str(e)
                if "429" in err_str and attempt < max_retries - 1:
                    wait = retry_delays[attempt]
                    print(f"⏳ Rate limited, retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait)
                    continue
                else:
                    print(f"❌ Whisper error: {e}")
                    return {"text": ""}

        raw_text = transcription.text.strip() if transcription.text else ""
        detected_lang = getattr(transcription, "language", "en") or "en"

        if not raw_text:
            return {"text": ""}

        clean_text = remove_repetitions(raw_text)

        if is_garbage(clean_text):
            return {"text": ""}

        print(f"✅ [{detected_lang}] {clean_text[:100]}")

        return {
            "text": clean_text,
            "original_text": clean_text,
            "language": detected_lang,
            "was_translated": False,
        }

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _transcribe_sync, audio_bytes, filename)