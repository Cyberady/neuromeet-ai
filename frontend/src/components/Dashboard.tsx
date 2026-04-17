import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth";
import * as api from "@/lib/api";
import { useTheme } from "@/lib/ThemeContext";

interface User    { id: string; name: string; email: string; image?: string }
interface Meeting { id: string; title: string; status: string; created_at: string; duration: string; performance_score: number }
interface Detail  extends Meeting { transcripts: any[]; participants: any[]; action_items: any[]; summary: any; analytics: any }
interface Stats   { total_meetings: number; ended_meetings: number; avg_score: number; total_minutes: number }

const scoreColor  = (s: number) => s >= 8 ? "#16a34a" : s >= 6 ? "#d97706" : s > 0 ? "#dc2626" : "#94a3b8";
const scoreBg     = (s: number) => s >= 8 ? "#f0fdf4" : s >= 6 ? "#fffbeb" : s > 0 ? "#fef2f2" : "#f8fafc";
const scoreBorder = (s: number) => s >= 8 ? "#bbf7d0" : s >= 6 ? "#fde68a" : s > 0 ? "#fecaca" : "#e2e8f0";

export function Dashboard() {
  const navigate = useNavigate();
  const { theme, setTheme, resolved } = useTheme();
  const isDark = resolved === "dark";
  const [user,          setUser]          = useState<User | null>(null);
  const [meetings,      setMeetings]      = useState<Meeting[]>([]);
  const [stats,         setStats]         = useState<Stats | null>(null);
  const [selected,      setSelected]      = useState<Detail | null>(null);
  const [loadingList,   setLoadingList]   = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [chatQuery,     setChatQuery]     = useState("");
  const [chatHistory,   setChatHistory]   = useState<{q:string;a:string}[]>([]);
  const [chatLoading,   setChatLoading]   = useState(false);
  const [search,        setSearch]        = useState("");
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [creating,      setCreating]      = useState(false);
  const [activeTab,     setActiveTab]     = useState<"chat"|"summary"|"actions"|"analytics">("chat");
  const [renamingId,    setRenamingId]    = useState<string|null>(null);
  const [renameVal,     setRenameVal]     = useState("");
  const profileRef = useRef<HTMLDivElement>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [u, m] = await Promise.all([api.getMe(), api.listMeetings()]);
        setUser(u); setMeetings(m);
        // Load stats separately — don't block
        fetch(`${import.meta.env.VITE_API_URL}/api/meetings/meta/stats`, { credentials: "include" })
          .then(r => r.json()).then(setStats).catch(() => {});
        if (m.length > 0) loadDetail(m[0].id);
      } catch { navigate("/login"); }
      finally { setLoadingList(false); }
    })();
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  useEffect(() => {
    const t = setTimeout(async () => { try { setMeetings(await api.listMeetings(search)); } catch {} }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function loadDetail(id: string) {
    setLoadingDetail(true); setChatHistory([]); setActiveTab("chat");
    try { setSelected(await api.getMeeting(id)); } catch {}
    finally { setLoadingDetail(false); }
  }

  async function handleNew() {
    setCreating(true);
    try {
      const m = await api.createMeeting(`Meeting — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
      navigate(`/pre-meeting/${m.id}`);
    } catch { setCreating(false); }
  }

  async function handleSignOut() { await authClient.signOut(); navigate("/login"); }

  async function handleChat() {
    if (!chatQuery.trim() || !selected) return;
    const q = chatQuery; setChatQuery(""); setChatLoading(true);
    try {
      const res = await api.chatWithMeeting(selected.id, q);
      setChatHistory(h => [...h, { q, a: res.answer }]);
    } catch { setChatHistory(h => [...h, { q, a: "Could not reach AI server." }]); }
    finally { setChatLoading(false); }
  }

  async function handleRename(id: string) {
    if (!renameVal.trim()) return;
    await api.renameMeeting(id, renameVal);
    setMeetings(ms => ms.map(m => m.id === id ? { ...m, title: renameVal } : m));
    if (selected?.id === id) setSelected(s => s ? { ...s, title: renameVal } : s);
    setRenamingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this meeting?")) return;
    await api.deleteMeeting(id);
    setMeetings(ms => ms.filter(m => m.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const suggestions = ["What were the action items?", "What decisions were made?", "Who spoke the most?", "What was the best idea?"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .db{min-height:100vh;background:var(--bg);color:var(--text);font-family:'Geist','Inter',sans-serif;display:flex;flex-direction:column}
        .db-nav{height:56px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:var(--bg2);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}
        .db-nav-left{display:flex;align-items:center;gap:16px}
        .db-logo{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:var(--text);letter-spacing:-0.02em}
        .db-logo-mark{width:26px;height:26px;border-radius:7px;background:#0f172a;display:flex;align-items:center;justify-content:center}
        .db-nav-sep{width:1px;height:18px;background:#e2e8f0}
        .db-nav-label{font-size:13px;color:var(--text4);font-weight:500}
        .db-nav-right{display:flex;align-items:center;gap:8px}
        .db-new-btn{display:flex;align-items:center;gap:6px;background:#0f172a;color:#fff;border:none;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.12s;font-family:'Geist','Inter',sans-serif;letter-spacing:-0.01em}
        .db-new-btn:hover{background:#1e293b}
        .db-new-btn:disabled{opacity:0.5;cursor:not-allowed}
        .db-profile-wrap{position:relative}
        .db-profile-btn{display:flex;align-items:center;gap:7px;background:none;border:1px solid var(--border);border-radius:8px;padding:5px 10px 5px 6px;cursor:pointer;transition:border-color 0.12s;font-family:'Geist','Inter',sans-serif}
        .db-profile-btn:hover{border-color:var(--text4)}
        .db-avatar{width:24px;height:24px;border-radius:6px;object-fit:cover;background:#0f172a;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;flex-shrink:0}
        .db-profile-name{font-size:12.5px;font-weight:500;color:var(--text2);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .db-dropdown{position:absolute;right:0;top:calc(100% + 6px);background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:4px;min-width:188px;box-shadow:0 4px 24px rgba(0,0,0,0.08);z-index:200}
        .db-dropdown-header{padding:8px 10px 10px;border-bottom:1px solid var(--border);margin-bottom:4px}
        .db-dropdown-name{font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:1px}
        .db-dropdown-email{font-size:11px;color:var(--text4)}
        .db-dropdown-item{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:6px;font-size:13px;color:var(--text2);cursor:pointer;transition:background 0.1s;border:none;background:none;width:100%;text-align:left;font-family:'Geist','Inter',sans-serif}
        .db-dropdown-item:hover{background:var(--bg3)}
        .db-dropdown-item.red{color:#dc2626}
        .db-dropdown-item.red:hover{background:#fef2f2}
        .db-stats{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--border)}
        .db-stat{background:var(--bg2);padding:18px 24px;display:flex;align-items:center;gap:12px;border-right:1px solid var(--border)}
        .db-stat:last-child{border-right:none}
        .db-stat-icon{width:34px;height:34px;border-radius:8px;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .db-stat-val{font-size:20px;font-weight:700;color:var(--text);letter-spacing:-0.025em;line-height:1}
        .db-stat-label{font-size:11.5px;color:var(--text4);margin-top:2px;font-weight:500}
        .db-page-header{padding:22px 24px 0;display:flex;align-items:flex-start;justify-content:space-between}
        .db-page-title{font-size:17px;font-weight:700;color:var(--text);letter-spacing:-0.02em;margin-bottom:2px}
        .db-page-sub{font-size:13px;color:var(--text4)}
        .db-body{flex:1;display:grid;grid-template-columns:272px 1fr;gap:16px;padding:16px 24px 24px;align-items:start}
        .db-list{display:flex;flex-direction:column;gap:7px}
        .db-search-wrap{position:relative;margin-bottom:2px}
        .db-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text4)}
        .db-search{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 12px 8px 32px;font-size:13px;color:var(--text);outline:none;transition:border-color 0.12s;font-family:'Geist','Inter',sans-serif;box-sizing:border-box}
        .db-search::placeholder{color:var(--text4)}
        .db-search:focus{border-color:var(--text4)}
        .db-list-label{font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--text4);padding:0 2px}
        .db-mcard{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;cursor:pointer;transition:all 0.12s}
        .db-mcard:hover{border-color:var(--text4);box-shadow:0 1px 6px rgba(0,0,0,0.05)}
        .db-mcard.active{border-color:var(--text);box-shadow:0 0 0 1px #0f172a}
        .db-mcard-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px}
        .db-mcard-title{font-size:13px;font-weight:600;color:var(--text);line-height:1.35}
        .db-score-badge{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:100px;flex-shrink:0;border:1px solid}
        .db-mcard-meta{display:flex;align-items:center;gap:5px;margin-bottom:9px}
        .db-meta{font-size:11px;color:var(--text4)}
        .db-live-pip{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#16a34a}
        .db-live-dot{width:5px;height:5px;border-radius:50%;background:#16a34a;animation:db-pulse 1.5s infinite}
        @keyframes db-pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        .db-mcard-btns{display:flex;gap:4px}
        .db-mcard-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:3px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-size:10.5px;font-weight:500;color:var(--text3);cursor:pointer;transition:all 0.12s;font-family:'Geist','Inter',sans-serif}
        .db-mcard-btn:hover{background:var(--bg3);border-color:var(--text4);color:var(--text)}
        .db-mcard-btn.del:hover{background:#fef2f2;border-color:#fecaca;color:#dc2626}
        .db-rename-input{width:100%;background:var(--bg2);border:1px solid #0f172a;border-radius:6px;padding:5px 8px;font-size:12.5px;color:var(--text);outline:none;font-family:'Geist','Inter',sans-serif;margin-bottom:6px}
        .db-rename-btns{display:flex;gap:5px}
        .db-rename-save{flex:1;background:#0f172a;color:#fff;border:none;border-radius:6px;padding:5px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:'Geist','Inter',sans-serif}
        .db-rename-cancel{flex:1;background:var(--bg3);color:var(--text3);border:1px solid var(--border);border-radius:6px;padding:5px;font-size:11.5px;cursor:pointer;font-family:'Geist','Inter',sans-serif}
        .db-panel{background:var(--bg2);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;height:calc(100vh - 198px);min-height:500px;overflow:hidden}
        .db-panel-header{padding:14px 18px 0;flex-shrink:0;border-bottom:1px solid var(--border)}
        .db-panel-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .db-panel-meeting{font-size:13.5px;font-weight:600;color:var(--text)}
        .db-groq-tag{display:flex;align-items:center;gap:5px;background:var(--bg3);border:1px solid var(--border);border-radius:100px;padding:3px 10px;font-size:11px;color:var(--text3);font-weight:500}
        .db-groq-dot{width:5px;height:5px;border-radius:50%;background:#16a34a;animation:db-pulse 2s infinite}
        .db-tabs{display:flex}
        .db-tab{background:none;border:none;cursor:pointer;font-family:'Geist','Inter',sans-serif;font-size:12.5px;font-weight:500;padding:8px 14px;color:var(--text4);border-bottom:2px solid transparent;transition:all 0.12s;margin-bottom:-1px}
        .db-tab.on{color:var(--text);border-bottom-color:var(--text);font-weight:600}
        .db-tab:not(.on):hover{color:var(--text3)}
        .db-messages{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:13px}
        .db-msg{display:flex;gap:9px;align-items:flex-start}
        .db-msg.user{flex-direction:row-reverse}
        .db-msg-av{width:25px;height:25px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700}
        .db-msg-av.ai{background:var(--bg3);border:1px solid var(--border);color:var(--text3)}
        .db-msg-av.u{background:#0f172a;color:#fff}
        .db-bubble{padding:9px 13px;font-size:13px;line-height:1.6;max-width:84%}
        .db-bubble.ai{background:var(--bg3);border:1px solid var(--border);border-radius:3px 10px 10px 10px;color:var(--text2)}
        .db-bubble.u{background:#0f172a;border-radius:10px 3px 10px 10px;color:#fff}
        .db-bubble-ctx{margin-top:7px;padding-top:7px;border-top:1px solid #e2e8f0;font-size:10px;color:var(--text4);font-family:monospace;line-height:1.5}
        .db-typing{display:flex;gap:3px;padding:2px 0}
        .db-tdot{width:4px;height:4px;border-radius:50%;background:#cbd5e1;animation:db-tbounce 1.2s ease-in-out infinite}
        .db-tdot:nth-child(2){animation-delay:0.15s}
        .db-tdot:nth-child(3){animation-delay:0.3s}
        @keyframes db-tbounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
        .db-input-area{padding:11px 14px;border-top:1px solid var(--border);flex-shrink:0}
        .db-sugs{display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap}
        .db-sug{background:var(--bg3);border:1px solid var(--border);border-radius:100px;font-size:11px;color:var(--text3);padding:3px 10px;cursor:pointer;transition:all 0.12s;font-family:'Geist','Inter',sans-serif}
        .db-sug:hover{background:var(--bg3);color:var(--text)}
        .db-input-row{display:flex;gap:7px;align-items:center}
        .db-input{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 13px;font-size:13px;color:var(--text);outline:none;transition:all 0.12s;font-family:'Geist','Inter',sans-serif}
        .db-input::placeholder{color:var(--text4)}
        .db-input:focus{border-color:var(--text4);background:var(--bg2)}
        .db-send{width:33px;height:33px;border-radius:8px;border:none;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.12s}
        .db-send.on{background:#0f172a;color:#fff}
        .db-send.on:hover{background:#1e293b}
        .db-send.off{background:var(--bg3);color:#e2e8f0;cursor:not-allowed}
        .db-tab-content{flex:1;overflow-y:auto;padding:16px}
        .db-sec{font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text4);margin-bottom:7px;margin-top:16px}
        .db-sec:first-child{margin-top:0}
        .db-card{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:11px 13px;margin-bottom:6px;font-size:13px;color:var(--text2);line-height:1.65}
        .db-pill{display:flex;align-items:flex-start;gap:7px;border-radius:7px;padding:8px 11px;font-size:12.5px;margin-bottom:5px;line-height:1.5;border:1px solid}
        .db-pill-green{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}
        .db-pill-blue{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}
        .db-pill-amber{background:var(--bg2)beb;border-color:#fde68a;color:#92400e}
        .db-pill-purple{background:#faf5ff;border-color:#e9d5ff;color:#6b21a8}
        .db-score-display{text-align:center;padding:20px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;margin-bottom:14px}
        .db-score-num{font-size:52px;font-weight:800;letter-spacing:-0.04em;color:var(--text);line-height:1}
        .db-score-denom{font-size:20px;color:var(--text4);font-weight:400}
        .db-score-label{font-size:12px;color:var(--text4);margin-top:4px}
        .db-bar-row{margin-bottom:9px}
        .db-bar-label{display:flex;justify-content:space-between;font-size:11.5px;color:var(--text3);margin-bottom:4px;font-weight:500}
        .db-bar-track{height:4px;border-radius:100px;background:#e2e8f0;overflow:hidden}
        .db-bar-fill{height:100%;border-radius:100px;background:#0f172a;transition:width 0.5s}
        .db-prow{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)}
        .db-prow:last-child{border-bottom:none}
        .db-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center;color:var(--text4);gap:8px}
        .db-empty-icon{width:40px;height:40px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:2px}
        .db-empty p{font-size:13px;line-height:1.6}
        .db-spin{width:14px;height:14px;border:2px solid rgba(0,0,0,0.08);border-top-color:var(--text);border-radius:50%;animation:db-sp 0.6s linear infinite;flex-shrink:0;display:inline-block}
        .db-spin.w{border-color:rgba(255,255,255,0.2);border-top-color:white}
        @keyframes db-sp{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px}
      `}</style>

      <div className="db">
        {/* ── Nav ── */}
        <nav className="db-nav">
          <div className="db-nav-left">
            <div className="db-logo">
              <div className="db-logo-mark">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              NeuroMeet
            </div>
            <div className="db-nav-sep" />
            <span className="db-nav-label">Dashboard</span>
          </div>
          <div className="db-nav-right">
            <button className="db-new-btn" onClick={handleNew} disabled={creating}>
              {creating ? <div className="db-spin w" /> : <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
              New Meeting
            </button>
            <div className="db-profile-wrap" ref={profileRef}>
              <button className="db-profile-btn" onClick={() => setProfileOpen(o => !o)}>
                {user?.image ? <img src={user.image} className="db-avatar" style={{ borderRadius: 6 }} alt="" /> : <div className="db-avatar">{user?.name?.[0] || "?"}</div>}
                <span className="db-profile-name">{user?.name || "Loading…"}</span>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {profileOpen && (
                <div className="db-dropdown">
                  <div className="db-dropdown-header">
                    <div className="db-dropdown-name">{user?.name}</div>
                    <div className="db-dropdown-email">{user?.email}</div>
                  </div>
                  {/* Theme selector */}
                  <div style={{ padding: "6px 10px 8px", borderBottom: `1px solid var(--border)`, marginBottom: 4 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text4)", marginBottom: 6 }}>Appearance</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["light","dark","system"] as const).map(t => (
                        <button key={t} onClick={() => setTheme(t)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: `1px solid ${theme === t ? "var(--accent)" : "var(--border)"}`, background: theme === t ? "var(--accent)" : "var(--bg3)", color: theme === t ? "var(--accent-fg)" : "var(--text3)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", transition: "all 0.12s" }}>
                          {t === "light" ? "☀️" : t === "dark" ? "🌙" : "💻"}<br />{t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="db-dropdown-item red" onClick={handleSignOut}>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* ── Stats ── */}
        {stats && (
          <div className="db-stats">
            {[
              { icon: "m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z", val: String(stats.total_meetings), label: "Total meetings" },
              { icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", val: String(stats.ended_meetings), label: "Completed" },
              { icon: "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z", val: `${stats.avg_score}/10`, label: "Avg. score" },
              { icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", val: `${stats.total_minutes}m`, label: "Total time" },
            ].map((s, i) => (
              <div key={i} className="db-stat">
                <div className="db-stat-icon">
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={s.icon} /></svg>
                </div>
                <div><div className="db-stat-val">{s.val}</div><div className="db-stat-label">{s.label}</div></div>
              </div>
            ))}
          </div>
        )}

        {/* ── Page header ── */}
        <div className="db-page-header">
          <div>
            <h1 className="db-page-title">Meeting Intelligence</h1>
            <p className="db-page-sub">{user ? `Welcome back, ${user.name.split(" ")[0]}` : "Loading workspace…"}</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="db-body">
          {/* Left */}
          <div className="db-list">
            <div className="db-search-wrap">
              <svg className="db-search-icon" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
              <input className="db-search" placeholder="Search meetings…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <span className="db-list-label">{loadingList ? "Loading…" : `${meetings.length} meeting${meetings.length !== 1 ? "s" : ""}`}</span>

            {loadingList
              ? <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><div className="db-spin" /></div>
              : meetings.length === 0
                ? <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "#94a3b8" }}>No meetings yet.<br />Click "New Meeting" to start.</div>
                : meetings.map(m => (
                  <div key={m.id} className={`db-mcard${selected?.id === m.id ? " active" : ""}`} onClick={() => loadDetail(m.id)}>
                    {renamingId === m.id
                      ? <div onClick={e => e.stopPropagation()}>
                          <input className="db-rename-input" value={renameVal} autoFocus onChange={e => setRenameVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleRename(m.id); if (e.key === "Escape") setRenamingId(null); }} />
                          <div className="db-rename-btns">
                            <button className="db-rename-save" onClick={() => handleRename(m.id)}>Save</button>
                            <button className="db-rename-cancel" onClick={() => setRenamingId(null)}>Cancel</button>
                          </div>
                        </div>
                      : <>
                          <div className="db-mcard-top">
                            <span className="db-mcard-title">{m.title}</span>
                            {m.performance_score > 0 && <span className="db-score-badge" style={{ color: scoreColor(m.performance_score), background: scoreBg(m.performance_score), borderColor: scoreBorder(m.performance_score) }}>{m.performance_score.toFixed(1)}</span>}
                          </div>
                          <div className="db-mcard-meta">
                            {m.status === "active" ? <span className="db-live-pip"><span className="db-live-dot" />Live</span> : <span className="db-meta">{fmtDate(m.created_at)}</span>}
                            <span className="db-meta">·</span>
                            <span className="db-meta">{m.duration}</span>
                          </div>
                          <div className="db-mcard-btns" onClick={e => e.stopPropagation()}>
                            <button className="db-mcard-btn" onClick={() => window.open(api.downloadPDF(m.id), "_blank")}>
                              <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>PDF
                            </button>
                            <button className="db-mcard-btn" onClick={() => { setRenamingId(m.id); setRenameVal(m.title); }}>
                              <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>Rename
                            </button>
                            <button className="db-mcard-btn del" onClick={() => handleDelete(m.id)}>
                              <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>Delete
                            </button>
                          </div>
                        </>}
                  </div>
                ))}
          </div>

          {/* Right panel */}
          <div className="db-panel">
            <div className="db-panel-header">
              <div className="db-panel-top">
                <span className="db-panel-meeting">{selected ? selected.title : "Select a meeting"}</span>
                <div className="db-groq-tag"><span className="db-groq-dot" />NeuroMeet AI</div>
              </div>
              <div className="db-tabs">
                {(["chat","summary","actions","analytics"] as const).map(t => (
                  <button key={t} className={`db-tab${activeTab === t ? " on" : ""}`} onClick={() => setActiveTab(t)}>
                    {t === "chat" ? "Chat" : t === "summary" ? "Summary" : t === "actions" ? "Actions" : "Analytics"}
                  </button>
                ))}
              </div>
            </div>

            {loadingDetail
              ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="db-spin" /></div>
              : !selected
                ? <div className="db-empty"><div className="db-empty-icon"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg></div><p>Select a meeting from the left<br />or create a new one.</p></div>
                : activeTab === "chat"
                  ? <>
                      <div className="db-messages">
                        <div className="db-msg"><div className="db-msg-av ai">AI</div><div className="db-bubble ai">I've loaded <strong>{selected.title}</strong>. Ask me anything about this meeting.{selected.transcripts?.length > 0 && <div className="db-bubble-ctx">{(selected.transcripts[0]?.translated_text || selected.transcripts[0]?.original_text || "").slice(0,80)}…</div>}</div></div>
                        {chatHistory.map((h, i) => (
                          <div key={i}>
                            <div className="db-msg user"><div className="db-msg-av u">{user?.name?.[0] || "U"}</div><div className="db-bubble u">{h.q}</div></div>
                            <div className="db-msg" style={{ marginTop: 9 }}><div className="db-msg-av ai">AI</div><div className="db-bubble ai">{h.a}</div></div>
                          </div>
                        ))}
                        {chatLoading && <div className="db-msg"><div className="db-msg-av ai">AI</div><div className="db-bubble ai"><div className="db-typing"><div className="db-tdot" /><div className="db-tdot" /><div className="db-tdot" /></div></div></div>}
                        <div ref={chatEndRef} />
                      </div>
                      <div className="db-input-area">
                        {chatHistory.length === 0 && <div className="db-sugs">{suggestions.map(s => <button key={s} className="db-sug" onClick={() => setChatQuery(s)}>{s}</button>)}</div>}
                        <div className="db-input-row">
                          <input className="db-input" placeholder="Ask anything about this meeting…" value={chatQuery} onChange={e => setChatQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleChat()} />
                          <button className={`db-send ${chatQuery.trim() && !chatLoading ? "on" : "off"}`} onClick={handleChat} disabled={!chatQuery.trim() || chatLoading}>
                            {chatLoading ? <div className="db-spin w" style={{ width: 12, height: 12 }} /> : <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>}
                          </button>
                        </div>
                      </div>
                    </>
                  : activeTab === "summary"
                    ? <div className="db-tab-content">
                        {!selected.summary ? <div className="db-empty"><p>No summary yet.<br />End the meeting to generate AI insights.</p></div> : <>
                          {selected.summary.full_summary && <><div className="db-sec">Summary</div><div className="db-card">{selected.summary.full_summary}</div></>}
                          {selected.summary.best_idea && <><div className="db-sec">Best Idea 💡</div><div className="db-card">{selected.summary.best_idea}</div></>}
                          {selected.summary.key_points?.length > 0 && <><div className="db-sec">Key Points</div>{selected.summary.key_points.map((k: string, i: number) => <div key={i} className="db-pill db-pill-blue"><span style={{ flexShrink: 0 }}>→</span>{k}</div>)}</>}
                          {selected.summary.decisions?.length > 0 && <><div className="db-sec">Decisions</div>{selected.summary.decisions.map((d: string, i: number) => <div key={i} className="db-pill db-pill-green"><span style={{ flexShrink: 0 }}>✓</span>{d}</div>)}</>}
                          {selected.summary.topics?.length > 0 && <><div className="db-sec">Topic Segments</div>{selected.summary.topics.map((t: any, i: number) => <div key={i} className="db-pill db-pill-purple"><span style={{ flexShrink: 0 }}>◆</span><span><strong>{t.label || t.type}</strong>{t.description || t.summary ? ` — ${t.description || t.summary}` : ""}</span></div>)}</>}
                          {selected.summary.conflicts?.length > 0 && <><div className="db-sec">Conflicts</div>{selected.summary.conflicts.map((c: any, i: number) => <div key={i} className="db-pill db-pill-amber"><span style={{ flexShrink: 0 }}>⚠</span>{c.description}</div>)}</>}
                        </>}
                      </div>
                    : activeTab === "actions"
                      ? <div className="db-tab-content">
                          {!selected.action_items?.length ? <div className="db-empty"><p>No action items yet.<br />End the meeting to extract tasks.</p></div>
                            : selected.action_items.map((a: any, i: number) => (
                              <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "11px 13px", marginBottom: 7 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 3 }}>{a.task}</div>
                                    {a.assigned_to && <div style={{ fontSize: 11.5, color: "#6366f1", fontWeight: 500 }}>→ {a.assigned_to}</div>}
                                    {a.context && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3 }}>{a.context}</div>}
                                  </div>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, flexShrink: 0, background: a.status === "done" ? "#f0fdf4" : "#fffbeb", color: a.status === "done" ? "#16a34a" : "#92400e", border: `1px solid ${a.status === "done" ? "#bbf7d0" : "#fde68a"}` }}>{(a.status || "pending").toUpperCase()}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      : <div className="db-tab-content">
                          {!selected.analytics ? <div className="db-empty"><p>No analytics yet.<br />End the meeting to generate data.</p></div> : <>
                            <div className="db-score-display">
                              <div className="db-score-num">{selected.analytics.performance_score?.toFixed(1) || "—"}<span className="db-score-denom">/10</span></div>
                              <div className="db-score-label">Meeting Performance Score</div>
                            </div>
                            {Object.entries(selected.analytics.score_breakdown || {}).map(([k, v]: any) => (
                              <div key={k} className="db-bar-row">
                                <div className="db-bar-label"><span style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span><span>{Number(v).toFixed(1)}/10</span></div>
                                <div className="db-bar-track"><div className="db-bar-fill" style={{ width: `${Number(v) * 10}%` }} /></div>
                              </div>
                            ))}
                            {selected.participants?.length > 0 && <>
                              <div className="db-sec" style={{ marginTop: 18 }}>Participant Breakdown</div>
                              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "2px 13px" }}>
                                {selected.participants.map((p: any, i: number) => {
                                  const pct = selected.analytics?.participation_breakdown?.[p.name]?.participation_pct || 0;
                                  return (
                                    <div key={i} className="db-prow">
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{Math.floor(p.speaking_duration / 60)}m {Math.floor(p.speaking_duration % 60)}s · {p.word_count} words</div>
                                      </div>
                                      <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{pct.toFixed(0)}%</div>
                                        <div style={{ fontSize: 11, color: "#94a3b8" }}>Attention {p.attention_score?.toFixed(0)}%</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>}
                          </>}
                        </div>}
          </div>
        </div>
      </div>
    </>
  );
}