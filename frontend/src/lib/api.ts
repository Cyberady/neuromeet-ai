const BASE = `${import.meta.env.VITE_API_URL}/api`;

async function req(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// Users
export const getMe = () => req("/users/me");

// Meetings
export const listMeetings  = (search = "") => req(`/meetings${search ? `?search=${encodeURIComponent(search)}` : ""}`);
export const getMeeting    = (id: string)  => req(`/meetings/${id}`);
export const createMeeting = (title: string) => req("/meetings", { method: "POST", body: JSON.stringify({ title }) });
export const endMeeting    = (id: string)  => req(`/meetings/${id}/end`, { method: "POST" });
export const renameMeeting = (id: string, title: string) => req(`/meetings/${id}/rename`, { method: "PATCH", body: JSON.stringify({ title }) });
export const deleteMeeting = (id: string)  => req(`/meetings/${id}`, { method: "DELETE" });
export const downloadPDF   = (id: string)  => `${BASE}/meetings/${id}/pdf`;

// AI
export const chatWithMeeting = (meeting_id: string, question: string) =>
  req("/ai/chat", { method: "POST", body: JSON.stringify({ meeting_id, question }) });

export const getCoachFeedback = (meeting_id: string) =>
  req(`/ai/coach/${meeting_id}`, { method: "POST" });

export const checkConflict = (meeting_id: string, recent_text: string) =>
  req("/ai/conflict-check", { method: "POST", body: JSON.stringify({ meeting_id, recent_text }) });

export const triggerSummary = (meeting_id: string) =>
  req(`/ai/trigger-summary/${meeting_id}`, { method: "POST" });

export const getIdeas = (meeting_id: string) =>
  req(`/ai/ideas/${meeting_id}`);

// Analytics
export const getAnalytics  = (meeting_id: string) => req(`/analytics/${meeting_id}`);
export const sendAttention = (meeting_id: string, participant: string, score: number) =>
  req(`/analytics/${meeting_id}/attention`, { method: "POST", body: JSON.stringify({ participant, score }) });

// Transcription — uses FormData, no Content-Type header
export const uploadChunk = async (meeting_id: string, audioBlob: Blob, speaker: string, timestamp_sec: number) => {
  const form = new FormData();
  form.append("audio", audioBlob, "chunk.webm");
  form.append("speaker", speaker);
  form.append("timestamp_sec", String(timestamp_sec));
  const res = await fetch(`${BASE}/transcription/${meeting_id}/chunk`, {
    method: "POST",
    credentials: "include",
    body: form,
    // NO Content-Type header — browser sets it with boundary automatically
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Transcription ${res.status}: ${text}`);
  }
  return res.json();
};

// Save transcript text line (Web Speech API → backend)
export const saveTranscriptText = async (
  meeting_id: string,
  text: string,
  speaker: string,
  timestamp_sec: number
) => {
  return req(`/transcription/${meeting_id}/text`, {
    method: "POST",
    body: JSON.stringify({ text, speaker, timestamp_sec }),
  });
};