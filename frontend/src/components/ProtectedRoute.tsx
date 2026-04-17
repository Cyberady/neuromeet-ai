import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authed,   setAuthed]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    authClient.getSession().then((s: any) => {
      if (s?.data?.user) {
        setAuthed(true);
      } else {
        navigate("/login", { replace: true });
      }
    }).catch(() => {
      navigate("/login", { replace: true });
    }).finally(() => {
      setChecking(false);
    });
  }, []);

  if (checking) return (
    <div style={{
      minHeight: "100vh", background: "#07080f",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 32, height: 32,
        border: "3px solid rgba(99,102,241,0.2)",
        borderTopColor: "#6366f1",
        borderRadius: "50%",
        animation: "pr-spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes pr-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return authed ? <>{children}</> : null;
}