import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { LoginAuth }      from "@/components/LoginAuth";
import { MeetingRoom }    from "@/components/MeetingRoom";
import { Dashboard }      from "@/components/Dashboard";
import { PreMeeting }     from "@/components/PreMeeting";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { authClient } from "@/lib/auth";

// ─── Landing Nav ─────────────────────────────────────────────
function LandingNav() {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const isDark = resolved === "dark";

  useEffect(() => {
    authClient.getSession().then((s: any) => {
      if (s?.data?.user) setUser(s.data.user);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function handleSignOut() {
    await authClient.signOut();
    setUser(null);
    setProfileOpen(false);
  }

  const bg    = isDark ? "#111113" : "#fff";
  const bd    = isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const text  = isDark ? "#f4f4f5" : "#0f172a";
  const text3 = isDark ? "#a1a1aa" : "#64748b";
  const bg3   = isDark ? "#18181b" : "#f8fafc";

  return (
    <nav style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", borderBottom: `1px solid ${bd}`, position: "sticky", top: 0, background: isDark ? "rgba(9,9,11,0.9)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: text, letterSpacing: "-0.02em", cursor: "pointer" }} onClick={() => navigate("/")}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: text, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={bg} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
        </div>
        NeuroMeet
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {user ? (
          /* Logged in → show profile + go to dashboard */
          <>
            <button onClick={() => navigate("/dashboard")} style={{ background: bg3, border: `1px solid ${bd}`, color: text3, fontSize: 13.5, fontWeight: 500, padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s" }}>
              Dashboard
            </button>
            <div ref={profileRef} style={{ position: "relative" }}>
              <button onClick={() => setProfileOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: `1px solid ${bd}`, borderRadius: 8, padding: "5px 10px 5px 6px", cursor: "pointer", transition: "border-color 0.12s", fontFamily: "inherit" }}>
                {user.image
                  ? <img src={user.image} style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }} alt="" />
                  : <div style={{ width: 24, height: 24, borderRadius: 6, background: text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: bg }}>{user.name?.[0]}</div>}
                <span style={{ fontSize: 12.5, fontWeight: 500, color: text3, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name?.split(" ")[0]}</span>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke={text3} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {profileOpen && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: 4, minWidth: 160, boxShadow: "0 4px 24px rgba(0,0,0,0.12)", zIndex: 200 }}>
                  <div style={{ padding: "8px 10px 10px", borderBottom: `1px solid ${bd}`, marginBottom: 4 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: text, marginBottom: 1 }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: text3 }}>{user.email}</div>
                  </div>
                  <button onClick={handleSignOut} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 6, fontSize: 13, color: "#dc2626", cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left", fontFamily: "inherit", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(248,113,113,0.08)" : "#fef2f2")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Not logged in → sign in + get started */
          <>
            <button onClick={() => navigate("/login")} style={{ background: "none", border: `1px solid ${bd}`, color: text3, fontSize: 13.5, fontWeight: 500, padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s" }}>
              Sign in
            </button>
            <button onClick={() => navigate("/login")} style={{ background: text, color: bg, border: "none", fontSize: 13.5, fontWeight: 600, padding: "7px 16px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", transition: "background 0.12s", letterSpacing: "-0.01em" }}>
              Get started →
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

// ─── Landing Page ─────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  const bg    = isDark ? "#09090b" : "#fff";
  const bg3   = isDark ? "#18181b" : "#f8fafc";
  const bd    = isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const bd2   = isDark ? "rgba(255,255,255,0.14)" : "#cbd5e1";
  const text  = isDark ? "#f4f4f5" : "#0f172a";
  const text2 = isDark ? "#e4e4e7" : "#374151";
  const text3 = isDark ? "#a1a1aa" : "#64748b";
  const text4 = isDark ? "#71717a" : "#94a3b8";

  const features = [
    { icon: "M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z", title: "Live Transcription", desc: "Real-time speech-to-text via Whisper. Works fully offline — zero audio ever leaves your network." },
    { icon: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z", title: "Groq AI Insights", desc: "Auto-extract action items, decisions and key ideas using Llama 3 via Groq's ultra-fast inference." },
    { icon: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z", title: "Focus Analytics", desc: "Attention detection, conflict monitoring and performance scoring for every meeting." },
    { icon: "M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802", title: "Auto Translation", desc: "Detects spoken language and translates to English automatically for standardized summaries." },
    { icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z", title: "Meeting Analytics", desc: "Speaking time, participation %, attention scores and AI-powered performance rating." },
    { icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z", title: "PDF Reports", desc: "Generate comprehensive meeting reports with summaries, action items, analytics and full transcripts." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'Geist','Inter',sans-serif", transition: "background 0.15s, color 0.15s" }}>
      <LandingNav />

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "88px 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: bg3, border: `1px solid ${bd}`, color: text3, fontSize: 11.5, fontWeight: 600, padding: "5px 14px", borderRadius: 100, marginBottom: 32, letterSpacing: "0.02em" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#16a34a", animation: "pulse 2s infinite" }} />
          Whisper · Groq · MediaPipe
        </div>

        <h1 style={{ fontSize: "clamp(38px,6vw,64px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.06, color: text, marginBottom: 20, maxWidth: 820 }}>
          Meetings that{" "}
          <span style={{ color: text3 }}>think for you</span>
        </h1>

        <p style={{ fontSize: 17, color: text3, lineHeight: 1.7, maxWidth: 480, marginBottom: 40 }}>
          NeuroMeet AI listens, transcribes, translates, and extracts insights from your meetings in real‑time.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 48 }}>
          <button onClick={() => navigate("/login")} style={{ display: "flex", alignItems: "center", gap: 7, background: text, color: bg, border: "none", padding: "12px 24px", borderRadius: 9, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.01em", transition: "opacity 0.12s" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
            Start a meeting
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </button>
          <button onClick={() => navigate("/login")} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", color: text2, border: `1px solid ${bd}`, padding: "12px 24px", borderRadius: 9, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "border-color 0.12s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = bd2)} onMouseLeave={e => (e.currentTarget.style.borderColor = bd)}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
            View demo
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: text4 }}>
          <div style={{ display: "flex" }}>
            {["#0f172a","#374151","#6b7280","#9ca3af"].map((c,i) => (
              <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: `2px solid ${bg}`, marginLeft: i > 0 ? -7 : 0 }} />
            ))}
          </div>
          <span>Trusted by <strong style={{ color: text2 }}>2,400+</strong> teams</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: bd, maxWidth: 1100, margin: "0 auto" }} />

      {/* Features */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 32px 80px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: text4, textAlign: "center", marginBottom: 12 }}>Platform</p>
        <h2 style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 800, letterSpacing: "-0.03em", color: text, textAlign: "center", marginBottom: 48, lineHeight: 1.15 }}>
          Everything your meetings need
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 14, padding: "22px 24px", transition: "box-shadow 0.15s, border-color 0.15s", cursor: "default" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = bd2; (e.currentTarget as HTMLDivElement).style.boxShadow = isDark ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = bd; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: bg3, border: `1px solid ${bd}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={text3} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={f.icon} /></svg>
              </div>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: text, letterSpacing: "-0.015em", marginBottom: 7 }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: text3, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", border: `1px solid ${bd}`, borderRadius: 14, overflow: "hidden" }}>
          {[
            { val: "<200ms", label: "Transcription latency" },
            { val: "99.2%",  label: "AI accuracy rate" },
            { val: "30+",    label: "Languages supported" },
            { val: "100%",   label: "On-premise processing" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "26px 20px", textAlign: "center", borderRight: i < 3 ? `1px solid ${bd}` : "none", transition: "background 0.12s" }}
              onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = bg3)}
              onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: text, marginBottom: 4, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 12, color: text4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: isDark ? "#18181b" : "#0f172a", margin: "0 32px 80px", borderRadius: 18, padding: "56px 40px", textAlign: "center", maxWidth: 1036, marginLeft: "auto", marginRight: "auto" }}>
        <h2 style={{ fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12 }}>Start your first meeting today</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 28, lineHeight: 1.6 }}>Free to get started. No credit card required.<br />Your data never leaves your network.</p>
        <button onClick={() => navigate("/login")} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#0f172a", border: "none", padding: "13px 28px", borderRadius: 9, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em", transition: "opacity 0.12s" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
          Get started for free
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
        </button>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${bd}`, padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: text, letterSpacing: "-0.01em" }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: text, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke={bg} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
          </div>
          NeuroMeet
        </div>
        <p style={{ fontSize: 12, color: text4 }}>© {new Date().getFullYear()} NeuroMeet AI. All rights reserved.</p>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/"      element={<LandingPage />} />
          <Route path="/login" element={<LoginAuth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/pre-meeting/:id" element={<ProtectedRoute><PreMeeting /></ProtectedRoute>} />
          <Route path="/meeting/:id" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;