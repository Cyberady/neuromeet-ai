import { useState } from "react";
import { authClient } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/ThemeContext";

export function LoginAuth() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const navigate  = useNavigate();
  const { resolved } = useTheme();
  const d = resolved === "dark";

  const bg   = d ? "#09090b" : "#fafafa";
  const bg2  = d ? "#111113" : "#ffffff";
  const bd   = d ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const bd2  = d ? "rgba(255,255,255,0.14)" : "#cbd5e1";
  const txt  = d ? "#f4f4f5" : "#0f172a";
  const txt3 = d ? "#a1a1aa" : "#64748b";
  const txt4 = d ? "#71717a"  : "#94a3b8";

  const handleGoogleLogin = async () => {
    setLoading(true); setError("");
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "https://your-app.onrender.com/dashboard"} );
    } catch {
      setError("Sign-in failed. Make sure Google OAuth is configured.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", fontFamily: "'Geist','Inter',sans-serif", transition: "background 0.15s" }}>
      {/* Nav */}
      <div style={{ height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: bg2, borderBottom: `1px solid ${bd}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: txt, letterSpacing: "-0.02em", cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: txt, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={bg2} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
          </div>
          NeuroMeet
        </div>
        <button onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: txt3, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", transition: "color 0.12s" }}
          onMouseEnter={e => (e.currentTarget.style.color = txt)} onMouseLeave={e => (e.currentTarget.style.color = txt3)}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
          Back to home
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
        <div>
          {/* Card */}
          <div style={{ background: bg2, border: `1px solid ${bd}`, borderRadius: 14, padding: 36, width: "100%", maxWidth: 380, boxShadow: d ? "0 4px 24px rgba(0,0,0,0.4)" : "0 1px 8px rgba(0,0,0,0.04)" }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: txt, letterSpacing: "-0.02em", marginBottom: 28 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: txt, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={bg2} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
              </div>
              NeuroMeet
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 700, color: txt, letterSpacing: "-0.025em", marginBottom: 6 }}>Welcome back</h1>
            <p style={{ fontSize: 13.5, color: txt3, marginBottom: 28, lineHeight: 1.55 }}>Sign in to your AI-powered meeting workspace.</p>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <div style={{ flex: 1, height: 1, background: bd }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: txt4 }}>Continue with</span>
              <div style={{ flex: 1, height: 1, background: bd }} />
            </div>

            {/* Google button */}
            <button onClick={handleGoogleLogin} disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, background: bg2, color: txt, border: `1px solid ${bd}`, padding: "11px 18px", borderRadius: 9, fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", boxShadow: d ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.05)", transition: "all 0.12s", opacity: loading ? 0.6 : 1 }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.borderColor = bd2; (e.currentTarget as HTMLButtonElement).style.background = d ? "#18181b" : "#f8fafc"; }}}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = bd; (e.currentTarget as HTMLButtonElement).style.background = bg2; }}>
              {loading
                ? <div style={{ width: 16, height: 16, border: `2px solid ${bd}`, borderTopColor: txt, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                : <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
              {loading ? "Signing in…" : "Continue with Google"}
            </button>

            {error && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 7, background: d ? "rgba(248,113,113,0.08)" : "#fef2f2", border: `1px solid ${d ? "rgba(248,113,113,0.2)" : "#fecaca"}`, borderRadius: 8, padding: "10px 13px", fontSize: 12.5, color: d ? "#f87171" : "#dc2626", lineHeight: 1.5 }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                {error}
              </div>
            )}

            <div style={{ marginTop: 22, paddingTop: 20, borderTop: `1px solid ${bd}`, textAlign: "center", fontSize: 12, color: txt4, lineHeight: 1.6 }}>
              By signing in you agree to our <span style={{ color: txt3, cursor: "pointer" }}>Terms of Service</span> and <span style={{ color: txt3, cursor: "pointer" }}>Privacy Policy</span>.
            </div>
          </div>

          {/* Trust row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 18 }}>
            {[{ c: "#16a34a", l: "E2E Encrypted" }, { c: "#2563eb", l: "On-Premise AI" }, { c: "#7c3aed", l: "SOC2 Ready" }].map(t => (
              <div key={t.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: txt4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.c }} />{t.l}
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}