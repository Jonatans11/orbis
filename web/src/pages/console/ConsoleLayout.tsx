import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard, KeyRound, FileBadge2, ShieldCheck, MessagesSquare, Code2, ArrowLeft,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAsync } from "../../components/ui";

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/dids", label: "Identifiers", icon: KeyRound },
  { to: "/app/credentials", label: "Credentials", icon: FileBadge2 },
  { to: "/app/trust", label: "Trust Registry", icon: ShieldCheck },
  { to: "/app/messages", label: "Messages", icon: MessagesSquare },
  { to: "/app/developer", label: "Developer", icon: Code2 },
];

function HealthDot() {
  const { data, error } = useAsync(() => api.health(), []);
  const up = !!data && !error;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-space-900 px-3 py-1.5 text-[11.5px] font-medium text-ink-300">
      <span className={`h-2 w-2 rounded-full ${up ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-400"}`} />
      {up ? `API v${data.version}` : "API offline"}
    </span>
  );
}

export default function ConsoleLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-white/6 bg-space-900/60 backdrop-blur-xl">
        <div className="flex h-16 items-center border-b border-white/6 px-5">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Back to site">
            <img src="/orbis.svg" width={26} height={26} alt="" />
            <span className="font-display text-[15px] font-bold tracking-tight text-ink-100">
              ORBIS<span className="text-orbit-400">.ID</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-500">
            Identity Console
          </p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-orbit-500/15 text-orbit-300 shadow-[inset_2px_0_0_0_#3987e5]"
                    : "text-ink-300 hover:bg-white/5 hover:text-ink-100"
                }`
              }
            >
              <item.icon size={16} strokeWidth={1.9} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/6 p-3">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] text-ink-500 transition-colors hover:bg-white/5 hover:text-ink-100"
          >
            <ArrowLeft size={14} /> Back to site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-60 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/6 bg-space-950/75 px-8 backdrop-blur-xl">
          <p className="text-[13px] text-ink-500">
            Self-Sovereign Identity · <span className="text-ink-300">W3C DIDs & Verifiable Credentials</span>
          </p>
          <HealthDot />
        </header>
        <main className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
