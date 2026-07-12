import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, EyeOff, Eye } from "lucide-react";
import { Button, Input, Field, ErrorNote } from "../../components/ui";
import { Mark } from "../../components/brand";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!d.success) { setError(d.message || "Login failed"); return; }
      if (!d.user.admin) { setError("Access denied: not an admin user"); return; }
      localStorage.setItem("orbis_admin_token", d.token);
      navigate("/admin", { replace: true });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center"><Mark size={48} /></div>
          <h1 className="text-[22px] font-semibold text-ink">Admin Console</h1>
          <p className="mt-1 text-[13px] text-ink-3">Restricted to authorized administrators only.</p>
        </div>
        <form onSubmit={handleLogin} className="panel seam rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3.5 py-2.5 text-[12px] text-amber-400"><ShieldAlert size={14} /> Authorized personnel only</div>
          <Field label="Admin email"><Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="admin@orbis.id" autoFocus /></Field>
          <Field label="Password">
            <div className="relative"><Input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" tabIndex={-1}>{showPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </Field>
          {error && <ErrorNote message={error} />}
          <Button type="submit" loading={loading} className="w-full"><ShieldAlert size={14} /> Sign in to Admin</Button>
        </form>
      </div>
    </div>
  );
}
