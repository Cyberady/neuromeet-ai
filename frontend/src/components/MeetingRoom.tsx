import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useTheme } from "@/lib/ThemeContext";
import { authClient } from "@/lib/auth";
import * as api from "@/lib/api";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function MeetingRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as any) || {};
  const { resolved } = useTheme();
  const d = resolved === "dark";

  if (!id) {
    navigate("/dashboard"); // or error page
    return null;
  }

  const meetingId = id;
  const initCam = state.camOn !== false;
  const initMic = state.micOn !== false;

  // ── FIX: userName from auth session, not just router state ────────────────
  // When a participant opens the invite link in a different browser (e.g.
  // Firefox), location.state is null — there was no React Router navigation
  // to carry it. We fall back to fetching the real name from the auth session.
  const [userName, setUserName] = useState<string>(state.userName || "");
  const [userReady, setUserReady] = useState<boolean>(!!state.userName);

  useEffect(() => {
    if (state.userName) return; // already have it from same-browser flow
    authClient.getSession().then((s: any) => {
      if (!s?.data?.user) { navigate("/login"); return; }
      const u = s.data.user;
      const name =
        u.name?.split(" ")[0] ||
        u.email?.split("@")[0] ||
        "Guest";
      setUserName(name);
      setUserReady(true);
    });
  }, []);

  // Theme colors — defined early so loading screen can use them
  const bg = d ? "#09090b" : "#fafafa";
  const bg2 = d ? "#111113" : "#ffffff";
  const bg3 = d ? "#18181b" : "#f8fafc";
  const bd = d ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const bd2 = d ? "rgba(255,255,255,0.14)" : "#cbd5e1";
  const txt = d ? "#f4f4f5" : "#0f172a";
  const txt2 = d ? "#e4e4e7" : "#374151";
  const txt3 = d ? "#a1a1aa" : "#64748b";
  const txt4 = d ? "#71717a" : "#94a3b8";

  // ── Loading screen while we resolve the user identity ─────────────────────
  if (!userReady) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: bg, color: txt,
        fontFamily: "'Geist','Inter',sans-serif", fontSize: 14, gap: 10,
      }}>
        <div style={{
          width: 16, height: 16,
          border: `2px solid ${bd2}`,
          borderTopColor: txt3,
          borderRadius: "50%",
          animation: "spin 0.6s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        Joining meeting…
      </div>
    );
  }

  // ── Inner component — only rendered once userName is known ─────────────────
  return <MeetingRoomInner
    id={id}
    meetingId={meetingId}
    userName={userName}
    initCam={initCam}
    initMic={initMic}
    camId={state.camId}
    micId={state.micId}
    d={d}
    bg={bg} bg2={bg2} bg3={bg3}
    bd={bd} bd2={bd2}
    txt={txt} txt2={txt2} txt3={txt3} txt4={txt4}
  />;
}

// ─── Inner component (needs userName to be resolved before mounting) ──────────
function MeetingRoomInner({
  id, meetingId, userName, initCam, initMic, camId, micId,
  d, bg, bg2, bg3, bd, bd2, txt, txt2, txt3, txt4,
}: any) {
  const navigate = useNavigate();

  const {
    localVideoRef, remoteStreams, transcript, liveText,
    insights, conflictAlert, attention, peerName,
    isMuted, isCamOff, isScreenSharing, isRecording, isTranscribing, elapsed,
    toggleMic, toggleCamera, toggleScreenShare, toggleRecording, updateAttention,
  } = useWebRTC({ meetingId, userName, camOn: initCam, micOn: initMic, camId, micId });

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [sideTab, setSideTab] = useState<"transcript" | "insights" | "coach" | "analytics">("transcript");
  const [ending, setEnding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (remoteStreams.size > 0 && remoteVideoRef.current)
      remoteVideoRef.current.srcObject = Array.from(remoteStreams.values())[0];
  }, [remoteStreams]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Simulate attention every 5s
  useEffect(() => {
    const t = setInterval(() => updateAttention(Math.round(65 + Math.random() * 35)), 5000);
    return () => clearInterval(t);
  }, []);

  function handleEnd() {
    setEnding(true);
    navigate("/dashboard", { replace: true });
    api.endMeeting(meetingId).catch(console.error);
  }

  function copyInvite() {
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${id}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const atColor = attention.status === "focused" ? "#16a34a" : attention.status === "confused" ? "#d97706" : "#dc2626";
  const atEmoji = attention.status === "focused" ? "😊" : attention.status === "confused" ? "😕" : "😴";

  const CtrlBtn = ({ onClick, active = false, danger = false, title, children }: any) => (
    <button onClick={onClick} title={title} style={{
      width: 40, height: 40, borderRadius: 9, border: `1px solid ${danger ? "rgba(220,38,38,0.3)" : active ? bd2 : bd}`,
      background: danger ? "#dc2626" : active ? (d ? "#27272a" : "#f1f5f9") : bg3,
      color: danger ? "#fff" : active ? txt : txt3,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", transition: "all 0.12s", flexShrink: 0,
    }}
      onMouseEnter={e => { if (!danger) (e.currentTarget as HTMLButtonElement).style.borderColor = bd2; }}
      onMouseLeave={e => { if (!danger) (e.currentTarget as HTMLButtonElement).style.borderColor = active ? bd2 : bd; }}>
      {children}
    </button>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: bg, color: txt, fontFamily: "'Geist','Inter',sans-serif", overflow: "hidden", transition: "background 0.15s" }}>

      {/* ── Header ── */}
      <div style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: bg2, borderBottom: `1px solid ${bd}`, zIndex: 50 }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, color: txt, letterSpacing: "-0.02em" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: txt, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={bg2} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
            </div>
            NeuroMeet
          </div>
          <div style={{ width: 1, height: 16, background: bd }} />
          <span style={{ fontSize: 12.5, color: txt3, fontFamily: "monospace" }}>
            {id?.slice(0, 8)}…
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: d ? "rgba(239,68,68,0.1)" : "#fef2f2", border: `1px solid ${d ? "rgba(239,68,68,0.2)" : "#fecaca"}`, borderRadius: 100, padding: "3px 9px" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", animation: "mr-pulse 1.5s infinite" }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#ef4444" }}>LIVE</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: txt3, fontFamily: "monospace" }}>{fmt(elapsed)}</span>
          {isTranscribing && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6366f1" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6366f1", animation: "mr-pulse 1s infinite" }} />
              Listening…
            </div>
          )}
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={copyInvite} style={{ display: "flex", alignItems: "center", gap: 5, background: copied ? (d ? "rgba(22,163,74,0.1)" : "#f0fdf4") : bg3, border: `1px solid ${copied ? (d ? "rgba(22,163,74,0.2)" : "#bbf7d0") : bd}`, color: copied ? "#16a34a" : txt3, borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s" }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
            {copied ? "Copied!" : "Invite"}
          </button>
          {/* FIX: show real userName, not hardcoded "Host" */}
          <span style={{ fontSize: 12, color: txt4, background: bg3, border: `1px solid ${bd}`, borderRadius: 100, padding: "3px 10px" }}>{userName}</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Stage */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: 14, gap: 10, position: "relative", minWidth: 0 }}>

          {/* Conflict alert */}
          {conflictAlert?.conflict_detected && (
            <div style={{ background: d ? "rgba(239,68,68,0.08)" : "#fef2f2", border: `1px solid ${d ? "rgba(239,68,68,0.2)" : "#fecaca"}`, borderRadius: 9, padding: "9px 14px", fontSize: 12.5, color: d ? "#f87171" : "#dc2626", display: "flex", alignItems: "center", gap: 8, animation: "mr-fadein 0.3s ease" }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <strong>Conflict detected ({conflictAlert.severity})</strong> — {conflictAlert.description}
            </div>
          )}

          {/* Videos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 1 }}>
            {/* Local */}
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", border: `1px solid ${bd}` }}>
              <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: "block", filter: isCamOff ? "brightness(0)" : "none" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)", padding: "24px 12px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {/* FIX: real name shown on local video tile */}
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{userName} (You)</span>
                <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${atColor}22`, border: `1px solid ${atColor}44`, borderRadius: 100, padding: "2px 8px", fontSize: 10.5, fontWeight: 700, color: atColor }}>
                  {atEmoji} {attention.score}%
                </div>
              </div>
              {isCamOff && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: txt4 }}>
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 20.47 5.78a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                  <span style={{ fontSize: 12 }}>Camera off</span>
                </div>
              )}
            </div>

            {/* Remote */}
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: d ? "#111113" : "#f1f5f9", border: `1px solid ${bd}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {remoteStreams.size > 0 ? (
                <>
                  <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 100%)", padding: "24px 12px 10px" }}>
                    {/* FIX: show real peer name from WebSocket signaling */}
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{peerName}</span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", color: txt4 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: bg3, border: `1px solid ${bd}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={txt4} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" /></svg>
                  </div>
                  <p style={{ fontSize: 12.5, fontWeight: 500 }}>Waiting for participants…</p>
                  <p style={{ fontSize: 11, marginTop: 4, color: txt4, fontFamily: "monospace" }}>{id}</p>
                </div>
              )}
            </div>
          </div>

          {/* Live text bar */}
          <div style={{ background: bg2, border: `1px solid ${bd}`, borderRadius: 9, padding: "8px 14px", fontSize: 13, color: txt3, display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#6366f1", flexShrink: 0 }}>LIVE</span>
            <span style={{ fontStyle: liveText ? "normal" : "italic" }}>{liveText || "Speak to see live transcription…"}</span>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 0 2px" }}>
            <CtrlBtn onClick={toggleMic} active={isMuted} title={isMuted ? "Unmute" : "Mute"}>
              {isMuted
                ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>}
            </CtrlBtn>

            <CtrlBtn onClick={toggleCamera} active={isCamOff} title={isCamOff ? "Turn on camera" : "Turn off camera"}>
              {isCamOff
                ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 20.47 5.78a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>}
            </CtrlBtn>

            <CtrlBtn onClick={toggleScreenShare} active={isScreenSharing} title={isScreenSharing ? "Stop sharing" : "Share screen"}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" /></svg>
            </CtrlBtn>

            <CtrlBtn onClick={toggleRecording} active={isRecording} title={isRecording ? "Stop recording" : "Record"}>
              {isRecording
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8" /></svg>}
            </CtrlBtn>

            <CtrlBtn onClick={() => setSideTab("transcript")} active={sideTab === "transcript"} title="Transcript">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
            </CtrlBtn>

            <div style={{ width: 1, height: 26, background: bd, margin: "0 4px" }} />

            <button onClick={handleEnd} disabled={ending} style={{ display: "flex", alignItems: "center", gap: 6, background: "#dc2626", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: ending ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "opacity 0.12s", opacity: ending ? 0.7 : 1 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#b91c1c")}
              onMouseLeave={e => (e.currentTarget.style.background = "#dc2626")}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75 18 6m0 0 2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 0 1 4.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 0 0-.38 1.21 12.035 12.035 0 0 0 7.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 0 1 1.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 0 1-2.25 2.25h-2.25Z" /></svg>
              End Meeting
            </button>
          </div>
        </main>

        {/* ── Sidebar ── */}
        <aside style={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${bd}`, background: bg2, display: "flex", flexDirection: "column" }}>

          {/* Sidebar header */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${bd}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: txt }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: bg3, border: `1px solid ${bd}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={txt3} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
                </div>
                Live AI Analysis
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: bg3, border: `1px solid ${bd}`, borderRadius: 100, padding: "3px 9px", fontSize: 10.5, color: txt4 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#16a34a", animation: "mr-pulse 2s infinite" }} />
                Web Speech · Groq
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2 }}>
              {(["transcript", "insights", "coach", "analytics"] as const).map(t => (
                <button key={t} onClick={() => setSideTab(t)} style={{ flex: 1, background: sideTab === t ? (d ? "#27272a" : "#f1f5f9") : "none", border: `1px solid ${sideTab === t ? bd2 : "transparent"}`, borderRadius: 6, padding: "5px 0", fontSize: 10.5, fontWeight: 600, color: sideTab === t ? txt : txt4, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s", textTransform: "capitalize" }}>
                  {t === "transcript" ? "📝" : t === "insights" ? "💡" : t === "coach" ? "🧠" : "📊"} {t}
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar body */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* TRANSCRIPT */}
            {sideTab === "transcript" && (
              transcript.length === 0
                ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: txt4, gap: 8, padding: 24 }}>
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={txt4} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
                  <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>Speak to start live transcription.<br />Translation is automatic.</p>
                  <p style={{ fontSize: 11, color: txt4 }}>Uses Groq Whisper</p>
                </div>
                : transcript.map((line, i) => {
                  const m = Math.floor(line.timestamp_sec / 60);
                  const s = Math.floor(line.timestamp_sec % 60);
                  return (
                    <div key={i} style={{ borderBottom: `1px solid ${bd}`, paddingBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1" }}>{line.speaker}</span>
                        <span style={{ fontSize: 10, color: txt4, fontFamily: "monospace" }}>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: txt2, lineHeight: 1.55 }}>{line.translated_text}</div>
                    </div>
                  );
                })
            )}

            {/* INSIGHTS */}
            {sideTab === "insights" && (
              insights.actions.length === 0 && insights.ideas.length === 0
                ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: txt4, gap: 8, padding: 24 }}>
                  <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>AI insights appear automatically<br />as the meeting progresses.</p>
                </div>
                : <>
                  {insights.actions.length > 0 && <>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: txt4, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#16a34a" }} />Action Items
                    </div>
                    {insights.actions.map((a, i) => (
                      <div key={i} style={{ background: d ? "rgba(22,163,74,0.08)" : "#f0fdf4", border: `1px solid ${d ? "rgba(22,163,74,0.2)" : "#bbf7d0"}`, borderRadius: 8, padding: "8px 11px", fontSize: 12.5, color: d ? "#4ade80" : "#15803d", lineHeight: 1.5 }}>{a}</div>
                    ))}
                  </>}
                  {insights.ideas.length > 0 && <>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: txt4, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b" }} />Key Ideas
                    </div>
                    {insights.ideas.map((idea, i) => (
                      <div key={i} style={{ background: d ? "rgba(245,158,11,0.08)" : "#fffbeb", border: `1px solid ${d ? "rgba(245,158,11,0.2)" : "#fde68a"}`, borderRadius: 8, padding: "8px 11px", fontSize: 12.5, color: d ? "#fbbf24" : "#92400e", lineHeight: 1.5 }}>{idea}</div>
                    ))}
                  </>}
                </>
            )}

            {/* COACH */}
            {sideTab === "coach" && (
              insights.coach.length === 0
                ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
                  <p style={{ fontSize: 12.5, color: txt4, lineHeight: 1.6 }}>Coach feedback appears every 60s<br />based on meeting dynamics.</p>
                </div>
                : insights.coach.map((fb, i) => (
                  <div key={i} style={{ background: d ? "rgba(99,102,241,0.08)" : "#eff6ff", border: `1px solid ${d ? "rgba(99,102,241,0.2)" : "#bfdbfe"}`, borderRadius: 8, padding: "8px 11px", fontSize: 12.5, color: d ? "#a5b4fc" : "#1d4ed8", lineHeight: 1.5 }}>{fb}</div>
                ))
            )}

            {/* ANALYTICS */}
            {sideTab === "analytics" && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: txt4, marginBottom: 4 }}>Attention</div>
                <div style={{ background: bg3, border: `1px solid ${bd}`, borderRadius: 9, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{atEmoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: atColor, textTransform: "capitalize", marginBottom: 4 }}>{attention.status}</div>
                    <div style={{ height: 4, borderRadius: 100, background: bd, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${attention.score}%`, background: atColor, borderRadius: 100, transition: "width 0.5s" }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: atColor }}>{attention.score}%</span>
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: txt4, marginTop: 8, marginBottom: 4 }}>Meeting Stats</div>
                <div style={{ background: bg3, border: `1px solid ${bd}`, borderRadius: 9, padding: "6px 14px" }}>
                  {[
                    { label: "Duration", val: fmt(elapsed) },
                    { label: "Transcript lines", val: transcript.length },
                    { label: "Words spoken", val: transcript.reduce((a, t) => a + t.text.split(" ").length, 0) },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${bd}`, fontSize: 12 }}>
                      <span style={{ color: txt3 }}>{label}</span>
                      <span style={{ fontWeight: 700, color: txt }}>{val}</span>
                    </div>
                  ))}
                </div>

                {transcript.length > 0 && (() => {
                  const counts: Record<string, number> = {};
                  transcript.forEach(t => { counts[t.speaker] = (counts[t.speaker] || 0) + 1; });
                  const total = Object.values(counts).reduce((a, b) => a + b, 0);
                  return (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: txt4, marginTop: 8, marginBottom: 4 }}>Speakers</div>
                      <div style={{ background: bg3, border: `1px solid ${bd}`, borderRadius: 9, padding: "6px 14px" }}>
                        {Object.entries(counts).map(([spk, count]) => {
                          const pct = Math.round(count / total * 100);
                          return (
                            <div key={spk} style={{ padding: "7px 0", borderBottom: `1px solid ${bd}` }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, color: txt }}>{spk}</span>
                                <span style={{ color: "#6366f1", fontWeight: 700 }}>{pct}%</span>
                              </div>
                              <div style={{ height: 3, borderRadius: 100, background: bd, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: "#6366f1", borderRadius: 100 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Sidebar footer */}
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${bd}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 100, background: bd, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${attention.score}%`, background: atColor, borderRadius: 100, transition: "width 0.5s" }} />
            </div>
            <span style={{ fontSize: 11, color: txt4, whiteSpace: "nowrap" }}>Attention {attention.score}%</span>
            {isRecording && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#ef4444", marginLeft: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", animation: "mr-pulse 1s infinite" }} />
                REC
              </div>
            )}
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes mr-pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes mr-fadein{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border,#e2e8f0);border-radius:3px}
      `}</style>
    </div>
  );
}