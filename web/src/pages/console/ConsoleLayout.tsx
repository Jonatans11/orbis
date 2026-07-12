import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutGrid, KeyRound, FileBadge2, ShieldCheck, MessagesSquare, Code2, ArrowLeft, ShieldAlert, ToggleLeft
} from "lucide-react";
import { api } from "../../lib/api";
import { useAsync } from "../../components/ui";
import { Mark } from "../../components/brand";

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/app/dids", label: "Identifiers", icon: KeyRound },
  { to: "/app/credentials", label: "Credentials", icon: FileBadge2 },
  { to: "/app/status-lists", label: "Status Lists", icon: ToggleLeft },
  { to: "/app/trust", label: "Trust Registry", icon: ShieldCheck },
  { to: "/app/messages", label: "Messages", icon: MessagesSquare },
  { to: "/app/developer", label: "Developer", icon: Code2 },
  { to: "/app/audit", label: "Audit Logs", icon: ShieldAlert },
];

function ApiStatus() {
  const { data, error } = useAsync(() => api.health(), []);
  const up = !!data && !error;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[11.5px] font-medium text-ink-2">
      <span className={`h-1.5 w-1.5 rounded-full ${up ? "bg-[var(--color-pos)] pulse-dot" : "bg-[var(--color-neg)]"}`} />
      {up ? `API v${data.version}` : "API offline"}
    </span>
  );
}

export default function ConsoleLayout() {
  return (
    <div className="flex min-h-screen bg-base">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[236px] flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)]/50 backdrop-blur-xl">
        <div className="flex items-center px-5 py-4">
          <Link to="/" className="focusable inline-flex items-center gap-2.5 rounded-md" aria-label="ORBIS.ID">
            <Mark size={24} />
            <span className="text-[14.5px] font-semibold tracking-[-0.02em] text-ink">ORBIS<span className="font-normal text-ink-3">.ID</span></span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          <p className="px-3 pb-1.5 pt-3 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-4">Console</p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `focusable group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive ? "bg-[var(--color-surface-3)] text-ink" : "text-ink-2 hover:bg-white/[0.04] hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-[var(--color-accent)]" />}
                  <item.icon size={16} strokeWidth={1.9} className={isActive ? "text-[var(--color-accent-hi)]" : "text-ink-3 group-hover:text-ink-2"} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--color-line)] p-3">
          <Link to="/" className="focusable flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] text-ink-3 transition-colors hover:bg-white/[0.04] hover:text-ink">
            <ArrowLeft size={14} /> Back to site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-[236px] flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-line)] bg-[rgba(8,9,11,0.7)] px-8 py-3.5 backdrop-blur-xl">
          <p className="text-[13px] text-ink-3">
            Self-Sovereign Identity <span className="mx-1.5 text-ink-4">/</span>
            <span className="text-ink-2">W3C DIDs & Verifiable Credentials</span>
          </p>
          <ApiStatus />
        </header>
        <main className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
