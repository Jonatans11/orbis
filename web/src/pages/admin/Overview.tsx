import { useState, useEffect } from "react";
import { LayoutGrid, Users, KeyRound, FileBadge2, KeySquare, ScrollText, ShieldCheck, RefreshCw, Activity } from "lucide-react";
import { Card, CardHeader, StatTile, useAsync } from "../../components/ui";
function adminFetch(path: string) {
  const token = localStorage.getItem("orbis_admin_token");
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}
export default function AdminOverview() {
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  function load() {
    setLoading(true); setError(null);
    Promise.all([adminFetch("/api/admin/system/stats"), adminFetch("/api/admin/health/detailed")])
      .then(([s, h]) => { setStats(s.stats); setHealth(h); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  if (loading) return <div className="flex justify-center py-20 text-ink-3">Loading dashboard…</div>;
  if (error) return <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">{error}</div>;
  if (!stats) return null;
  return (<div className="space-y-7">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-[22px] font-semibold text-ink">Overview</h1><p className="mt-1 text-[13.5px] text-ink-3">System-wide statistics and health.</p></div>
      <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-[var(--color-surface-3)]"><RefreshCw size={13} /> Refresh</button>
    </div>
    <div className="grid gap-4 sm:grid-cols-4">
      <StatTile label="Users" value={stats.users.total} detail={`${stats.users.active} active · ${stats.users.suspended} suspended`} icon={<Users size={15} />} />
      <StatTile label="DIDs" value={stats.dids.total} detail={`${stats.dids.did_key} key · ${stats.dids.did_web} web`} icon={<KeyRound size={15} />} />
      <StatTile label="Credentials" value={stats.credentials.total} detail={`${stats.credentials.active} active · ${stats.credentials.revoked} revoked`} icon={<FileBadge2 size={15} />} />
      <StatTile label="API Keys" value={stats.api_keys.total} detail={`${stats.trust_registry.total_entries} trusted entities`} icon={<KeySquare size={15} />} />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Card><CardHeader title="Audit & Activity" icon={<ScrollText size={15} />} /><div className="p-5 space-y-3">
        <div className="flex justify-between rounded-lg bg-[var(--color-surface-3)] px-4 py-3"><span className="text-[13px] text-ink-2">Audit log entries</span><span className="font-mono text-[15px] font-semibold text-ink">{stats.audit_log.total_entries}</span></div>
        <div className="flex justify-between rounded-lg bg-[var(--color-surface-3)] px-4 py-3"><span className="text-[13px] text-ink-2">Messages sent</span><span className="font-mono text-[15px] font-semibold text-ink">{stats.messages.total}</span></div>
        {health && <div className="flex justify-between rounded-lg bg-[var(--color-surface-3)] px-4 py-3"><span className="text-[13px] text-ink-2">System uptime</span><span className="font-mono text-[15px] font-semibold text-ink">{health.uptime}s</span></div>}
      </div></Card>
      <Card><CardHeader title="System" icon={<Activity size={15} />} /><div className="p-5 space-y-3">
        {health && (<><div className="flex justify-between rounded-lg bg-[var(--color-surface-3)] px-4 py-3"><span className="text-[13px] text-ink-2">Database</span><span className={`font-mono text-[13px] font-semibold ${health.database?.connected ? "text-emerald-400" : "text-red-400"}`}>{health.database?.connected ? "Connected" : "Disconnected"}</span></div>
        <div className="flex justify-between rounded-lg bg-[var(--color-surface-3)] px-4 py-3"><span className="text-[13px] text-ink-2">Encryption</span><span className="font-mono text-[13px] font-semibold text-emerald-400">Active</span></div>
        <div className="flex justify-between rounded-lg bg-[var(--color-surface-3)] px-4 py-3"><span className="text-[13px] text-ink-2">API version</span><span className="font-mono text-[13px] text-ink-2">{health.version}</span></div></>)}
      </div></Card>
    </div>
  </div>);
}
