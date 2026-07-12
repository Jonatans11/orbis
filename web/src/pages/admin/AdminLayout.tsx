import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutGrid, Users, ScrollText, Activity, KeyRound,
  FileBadge2, KeySquare, LogOut, ShieldAlert, ArrowLeft,
  BookOpen, Code2, Puzzle, Key, Smartphone, Shield,
} from "lucide-react";
import { Mark } from "../../components/brand";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { to: "/admin/health", label: "System Health", icon: Activity },
  { to: "/admin/dids", label: "DIDs", icon: KeyRound },
  { to: "/admin/credentials", label: "Credentials", icon: FileBadge2 },
  { to: "/admin/api-keys", label: "API Keys", icon: KeySquare },
  { to: "/admin/docs", label: "Documentation", icon: BookOpen },
  { to: "/admin/developers", label: "Developer Support", icon: Code2 },
  { to: "/admin/integrations", label: "Integrations", icon: Puzzle },
  { to: "/admin/tokens", label: "Access Tokens", icon: Key },
  { to: "/admin/wallets", label: "Wallets", icon: Smartphone },
  { to: "/admin/grants", label: "Consent Grants", icon: Shield },
];

function getJwt(): string | null {
  try { return localStorage.getItem("orbis_admin_token"); }
  catch { return null; }
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = getJwt();
    if (!token) { navigate("/admin/login", { replace: true }); return; }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user.admin) { setAuthorized(true); }
        else { localStorage.removeItem("orbis_admin_token"); navigate("/admin/login", { replace: true }); }
      })
      .catch(() => { navigate("/admin/login", { replace: true }); })
      .finally(() => setChecking(false));
  }, [navigate]);

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-base"><p className="text-ink-3">Verifying access…</p></div>;
  if (!authorized) return null;
  return <>{children}</>;
}

function AdminSidebar() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("orbis_admin_token");
    navigate("/admin/login", { replace: true });
  };
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[236px] flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)]/50 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 border-b border-[var(--color-line)] px-5 py-4">
        <Mark size={24} />
        <div><span className="text-[14.5px] font-semibold text-ink">Admin</span><span className="ml-1.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">Console</span></div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 pt-3">
        <p className="px-3 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-4">Management</p>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `focusable group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${isActive ? "bg-amber-500/10 text-amber-300" : "text-ink-2 hover:bg-white/[0.04] hover:text-ink"}`}>
            {({ isActive }) => (<>
              {isActive && <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-amber-400" />}
              <item.icon size={16} strokeWidth={1.9} className={isActive ? "text-amber-400" : "text-ink-3 group-hover:text-ink-2"} />
              {item.label}
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-[var(--color-line)] p-3 space-y-1">
        <Link to="/app" className="focusable flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] text-ink-3 transition-colors hover:bg-white/[0.04] hover:text-ink"><ArrowLeft size={14} /> Back to console</Link>
        <button onClick={handleLogout} className="focusable flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] text-ink-3 transition-colors hover:bg-white/[0.04] hover:text-[#ffb0ad]"><LogOut size={14} /> Log out</button>
      </div>
    </aside>
  );
}

export default function AdminLayout() {
  const location = window.location.pathname;
  if (location === "/admin/login") return <Outlet />;
  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-base">
        <AdminSidebar />
        <div className="ml-[236px] flex-1">
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--color-line)] bg-[rgba(8,9,11,0.7)] px-8 py-3.5 backdrop-blur-xl">
            <ShieldAlert size={16} className="text-amber-500" />
            <p className="text-[13px] text-ink-3">Admin Console <span className="mx-1.5 text-ink-4">/</span><span className="text-amber-400/80 font-medium">Restricted Access</span></p>
          </header>
          <main className="mx-auto max-w-6xl px-8 py-8"><Outlet /></main>
        </div>
      </div>
    </AdminGuard>
  );
}
