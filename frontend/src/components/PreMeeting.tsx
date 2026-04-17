import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authClient } from "@/lib/auth";

export function PreMeeting() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState("");
  const [micId, setMicId] = useState("");
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    authClient.getSession().then((s: any) => {
      if (!s?.data?.user) { navigate("/login"); return; }
      setUser(s.data.user);
    });
  }, []);

  useEffect(() => {
    async function initDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(t => t.stop());

        const d = await navigator.mediaDevices.enumerateDevices();
        setDevices(d);

        const cam = d.find(x => x.kind === "videoinput");
        const mic = d.find(x => x.kind === "audioinput");
        if (cam) setCamId(cam.deviceId);
        if (mic) setMicId(mic.deviceId);
      } catch (err) {
        console.error("❌ Permission denied:", err);
        alert("Please allow camera & microphone permissions 🔴");
      }
    }
    initDevices();
  }, []);

  useEffect(() => {
    let active = true;

    async function startPreview() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (!camOn && !micOn) return;

      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: camOn ? (camId ? { deviceId: { ideal: camId } } : true) : false,
          audio: micOn ? (micId ? { deviceId: { ideal: micId } } : true) : false,
        });
        if (!active) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current && camOn) videoRef.current.srcObject = s;
      } catch {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
          if (!active) { s.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = s;
          if (videoRef.current && camOn) videoRef.current.srcObject = s;
        } catch {}
      }
    }

    startPreview();
    return () => { active = false; };
  }, [camOn, micOn, camId, micId]);

  function handleJoin() {
    setLoading(true);
    navigate(`/meeting/${id}`, {
      state: {
        camOn,
        micOn,
        camId,
        micId,
        // FIX: Use the full name so participants are identified correctly,
        // not hardcoded to "Host". The first word of the name is used as
        // a display name — if unavailable, fall back to their email prefix.
        userName: user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Guest",
      }
    });
  }

  function copyInvite() {
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cams = devices.filter(d => d.kind === "videoinput");
  const mics = devices.filter(d => d.kind === "audioinput");

  // Display name shown in the lobby preview
  const displayName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "You";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');
        .pm { min-height:100vh; background:var(--bg); color:var(--text); font-family:'Geist','Inter',sans-serif; display:flex; flex-direction:column; }
        .pm-nav { height:54px; display:flex; align-items:center; justify-content:space-between; padding:0 24px; background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0; }
        .pm-logo { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:700; color:var(--text); letter-spacing:-0.02em; cursor:pointer; border:none; background:none; font-family:inherit; }
        .pm-logo-mark { width:24px; height:24px; border-radius:6px; background:var(--text); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .pm-back { display:flex; align-items:center; gap:5px; font-size:13px; color:var(--text3); cursor:pointer; background:none; border:none; font-family:inherit; transition:color 0.12s; }
        .pm-back:hover { color:var(--text); }
        .pm-body { flex:1; display:flex; align-items:center; justify-content:center; padding:32px 20px; }
        .pm-wrap { display:grid; grid-template-columns:1fr 352px; gap:20px; width:100%; max-width:840px; align-items:start; }
        .pm-left { display:flex; flex-direction:column; gap:11px; }
        .pm-video-box { position:relative; border-radius:14px; overflow:hidden; background:#000; aspect-ratio:16/9; border:1px solid var(--border); }
        .pm-video-box video { width:100%; height:100%; object-fit:cover; transform:scaleX(-1); display:block; }
        .pm-no-cam { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:var(--text4); }
        .pm-name { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.55); backdrop-filter:blur(6px); border-radius:100px; padding:4px 14px; font-size:12px; font-weight:600; color:white; white-space:nowrap; }
        .pm-toggles { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .pm-toggle { display:flex; align-items:center; justify-content:center; gap:7px; padding:10px; border-radius:9px; border:1px solid var(--border); background:var(--bg2); cursor:pointer; font-family:inherit; font-size:13px; font-weight:600; color:var(--text2); transition:all 0.12s; }
        .pm-toggle:hover { border-color:var(--border2); }
        .pm-toggle.off { background:var(--red-bg); border-color:var(--red-bd); color:var(--red); }
        .pm-panel { background:var(--bg2); border:1px solid var(--border); border-radius:14px; padding:26px; display:flex; flex-direction:column; gap:16px; }
        .pm-panel-logo { display:flex; align-items:center; gap:7px; font-size:14px; font-weight:700; color:var(--text); letter-spacing:-0.02em; }
        .pm-panel-logo-mark { width:24px; height:24px; border-radius:7px; background:var(--text); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .pm-title { font-size:19px; font-weight:700; color:var(--text); letter-spacing:-0.02em; margin-bottom:1px; }
        .pm-sub { font-size:13px; color:var(--text4); }
        .pm-room { background:var(--bg3); border:1px solid var(--border); border-radius:9px; padding:11px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .pm-room-label { font-size:10.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--text4); margin-bottom:3px; }
        .pm-room-id { font-size:12px; font-weight:700; color:var(--text); font-family:monospace; word-break:break-all; }
        .pm-copy { background:var(--bg2); border:1px solid var(--border); border-radius:7px; padding:5px 11px; font-size:11.5px; font-weight:600; color:var(--text2); cursor:pointer; transition:all 0.12s; font-family:inherit; white-space:nowrap; flex-shrink:0; }
        .pm-copy:hover { border-color:var(--border2); }
        .pm-copy.ok { background:var(--green-bg); border-color:var(--green-bd); color:var(--green); }
        .pm-sel-group { display:flex; flex-direction:column; gap:5px; }
        .pm-sel-label { font-size:11.5px; font-weight:600; color:var(--text3); }
        .pm-sel { width:100%; background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:8px 11px; font-size:13px; color:var(--text); outline:none; font-family:inherit; cursor:pointer; transition:border-color 0.12s; }
        .pm-sel:focus { border-color:var(--border2); }
        .pm-user { display:flex; align-items:center; gap:9px; padding:10px 12px; background:var(--bg3); border:1px solid var(--border); border-radius:9px; }
        .pm-uav { width:30px; height:30px; border-radius:8px; background:var(--accent); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:var(--accent-fg); flex-shrink:0; }
        .pm-uname { font-size:13px; font-weight:600; color:var(--text); }
        .pm-uemail { font-size:11px; color:var(--text4); }
        .pm-join { width:100%; padding:12px; border-radius:10px; border:none; background:var(--accent); color:var(--accent-fg); font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px; letter-spacing:-0.01em; transition:opacity 0.12s; }
        .pm-join:hover { opacity:0.85; }
        .pm-join:disabled { opacity:0.5; cursor:not-allowed; }
        .pm-spin { width:16px; height:16px; border:2px solid rgba(128,128,128,0.3); border-top-color:currentColor; border-radius:50%; animation:pm-sp 0.6s linear infinite; }
        @keyframes pm-sp { to { transform:rotate(360deg); } }
        @media(max-width:680px) { .pm-wrap { grid-template-columns:1fr; } }
      `}</style>

      <div className="pm">
        <nav className="pm-nav">
          <button className="pm-logo" onClick={() => navigate("/dashboard")}>
            <div className="pm-logo-mark">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} style={{ stroke: "var(--accent-fg)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            NeuroMeet
          </button>
          <button className="pm-back" onClick={() => navigate("/dashboard")}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to dashboard
          </button>
        </nav>

        <div className="pm-body">
          <div className="pm-wrap">
            <div className="pm-left">
              <div className="pm-video-box">
                <video ref={videoRef} autoPlay muted playsInline style={{ display: camOn ? "block" : "none" }} />
                {!camOn && (
                  <div className="pm-no-cam">
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 20.47 5.78a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <span style={{ fontSize: 13 }}>Camera is off</span>
                  </div>
                )}
                {/* FIX: Show actual user's name, not hardcoded "Host" */}
                <div className="pm-name">{displayName}</div>
              </div>

              <div className="pm-toggles">
                <button className={`pm-toggle${micOn ? "" : " off"}`} onClick={() => setMicOn(m => !m)}>
                  {micOn
                    ? <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
                    : <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>}
                  {micOn ? "Mic on" : "Mic off"}
                </button>
                <button className={`pm-toggle${camOn ? "" : " off"}`} onClick={() => setCamOn(c => !c)}>
                  {camOn
                    ? <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                    : <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 20.47 5.78a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>}
                  {camOn ? "Cam on" : "Cam off"}
                </button>
              </div>
            </div>

            <div className="pm-panel">
              <div className="pm-panel-logo">
                <div className="pm-panel-logo-mark">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} style={{ stroke: "var(--accent-fg)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                NeuroMeet
              </div>
              <div>
                <div className="pm-title">Ready to join?</div>
                <div className="pm-sub">Set up your audio and video before entering.</div>
              </div>
              <div className="pm-room">
                <div style={{ minWidth: 0 }}>
                  <div className="pm-room-label">Room ID</div>
                  <div className="pm-room-id">{id}</div>
                </div>
                <button className={`pm-copy${copied ? " ok" : ""}`} onClick={copyInvite}>
                  {copied ? "Copied!" : "Copy invite"}
                </button>
              </div>
              {cams.length > 1 && (
                <div className="pm-sel-group">
                  <span className="pm-sel-label">Camera</span>
                  <select className="pm-sel" value={camId} onChange={e => setCamId(e.target.value)}>
                    {cams.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>)}
                  </select>
                </div>
              )}
              {mics.length > 0 && (
                <div className="pm-sel-group">
                  <span className="pm-sel-label">Microphone</span>
                  <select className="pm-sel" value={micId} onChange={e => setMicId(e.target.value)}>
                    {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}
                  </select>
                </div>
              )}
              {user && (
                <div className="pm-user">
                  {user.image
                    ? <img src={user.image} className="pm-uav" style={{ borderRadius: 8, objectFit: "cover" }} alt="" />
                    : <div className="pm-uav">{(user.name || user.email || "?")[0].toUpperCase()}</div>}
                  <div>
                    <div className="pm-uname">{user.name}</div>
                    <div className="pm-uemail">{user.email}</div>
                  </div>
                </div>
              )}
              <button className="pm-join" onClick={handleJoin} disabled={loading}>
                {loading
                  ? <div className="pm-spin" />
                  : <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>}
                {loading ? "Joining…" : "Join Meeting"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}