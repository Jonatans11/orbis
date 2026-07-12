import { useState, useEffect } from "react";
import { Activity, RefreshCw, Server, Database, Shield, Clock } from "lucide-react";
import { Card, CardHeader, StatTile, ErrorNote, CodeBlock } from "../../components/ui";
function adminFetch(path: string) { const t = localStorage.getItem("orbis_admin_token"); return fetch(path, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()); }
export default function AdminSystemHealth() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  function load() { setLoading(true); setError(null); adminFetch("/api/admin/health/detailed").then(d => setHealth(d)).catch(e => setError(e.message)).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);
  return (<div className="space-y-7">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-[22px] font-semibold text-ink">System Health</h1><p className="mt-1 text-[13.5px] text-ink-3">Detailed health check and diagnostics.</p></div>
      <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-[var(--color-surface-3)]"><RefreshCw size={13} /> Refresh</button>
    </div>
    {error && <ErrorNote message={error} />}
    {loading && <div className="py-10 text-center text-ink-3">Running diagnostics…</div>}
    {health && (<><div className="grid gap-4 sm:grid-cols-4">
      <Card seam className="px-5 py-4"><div className="flex items-center justify-between"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3"><Server size={14} className="inline mr-1" />Service</span></div><p className={`mt-2 text-[17px] font-semibold ${health.status === "healthy" ? "text-emerald-400" : "text-red-400"}`}>{health.status?.toUpperCase() || "UNKNOWN"}</p><p className="mt-1 text-[12px] text-ink-3">{health.service}</p></Card>
      <Card seam className="px-5 py-4"><div className="flex items-center justify-between"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3"><Database size={14} className="inline mr-1" />Database</span></div><p className={`mt-2 text-[17px] font-semibold ${health.database?.connected ? "text-emerald-400" : "text-red-400"}`}>{health.database?.connected ? "Connected" : "Disconnected"}</p><p className="mt-1 text-[12px] text-ink-3">{health.database?.type || "turso"}</p></Card>
      <Card seam className="px-5 py-4"><div className="flex items-center justify-between"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3"><Shield size={14} className="inline mr-1" />Encryption</span></div><p className={`mt-2 text-[17px] font-semibold ${health.encryption?.enabled ? "text-emerald-400" : "text-amber-400"}`}>{health.encryption?.enabled ? "Enabled" : "Disabled"}</p><p className="mt-1 text-[12px] text-ink-3">{health.encryption?.type || "AES-256-GCM"}</p></Card>
      <Card seam className="px-5 py-4"><div className="flex items-center justify-between"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3"><Clock size={14} className="inline mr-1" />Uptime</span></div><p className="mt-2 text-[17px] font-semibold text-ink">{health.uptime ? `${health.uptime}s` : "—"}</p><p className="mt-1 text-[12px] text-ink-3">v{health.version}</p></Card>
    </div>
    <Card><CardHeader title="Raw health payload" /><div className="p-4"><CodeBlock data={health} maxHeight="30rem" /></div></Card></>)}
  </div>);
}
