import { useState, useEffect } from "react";
import { KeySquare, RefreshCw, ShieldOff } from "lucide-react";
import { Card, CardHeader, StatusPill, Mono, ErrorNote, EmptyState, Table, Button, useAsync, StatTile } from "../../components/ui";
function adminFetch(path: string, init?: RequestInit) { const t = localStorage.getItem("orbis_admin_token"); return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, ...init?.headers } }).then(r => r.json()); }
export default function AdminApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  function load() { setLoading(true); setError(null); adminFetch("/api/admin/api-keys").then(d => { if (d.success) setKeys(d.keys); else setError(d.message); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);
  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key?")) return;
    const d = await adminFetch(`/api/admin/api-keys/${id}/revoke`, { method: "PUT" });
    if (d.success) load(); else setError(d.message);
  }
  const activeCount = keys.filter(k => k.status !== "revoked").length;
  return (<div className="space-y-7">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-[22px] font-semibold text-ink">API Keys</h1><p className="mt-1 text-[13.5px] text-ink-3">All developer API keys ({keys.length} total, {activeCount} active).</p></div>
      <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-[var(--color-surface-3)]"><RefreshCw size={13} /> Refresh</button>
    </div>
    <div className="grid gap-4 sm:grid-cols-4">
      <StatTile label="Total Keys" value={keys.length} icon={<KeySquare size={15} />} />
      <StatTile label="Active" value={activeCount} accent="text-emerald-400" />
      <StatTile label="Revoked" value={keys.filter(k => k.status === "revoked").length} accent={keys.filter(k => k.status === "revoked").length > 0 ? "text-red-400" : "text-ink"} />
      <StatTile label="Total Requests" value={keys.reduce((s, k) => s + (k.total_requests || 0), 0)} />
    </div>
    {error && <ErrorNote message={error} />}
    {loading ? <div className="py-10 text-center text-ink-3">Loading API keys…</div> : keys.length === 0 ? <EmptyState title="No API keys found" /> : (
      <Card><CardHeader title="All API Keys" subtitle="Usage, scopes, and status for every registered key." /><div className="p-2">
        <Table head={<><th className="py-2.5 pr-4">Name</th><th className="py-2.5 pr-4">Email</th><th className="py-2.5 pr-4">Scopes</th><th className="py-2.5 pr-4">Tier</th><th className="py-2.5 pr-4">Requests</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5 pr-4">Created</th><th className="py-2.5 text-right">Actions</th></>}>
          {keys.map((k: any) => (<tr key={k.id} className="group"><td className="py-3 pr-4 text-[12.5px] text-ink">{k.company_name || k.name}</td>
            <td className="py-3 pr-4 text-[12px] text-ink-3">{k.contact_email || k.email || "—"}</td>
            <td className="py-3 pr-4"><div className="flex flex-wrap gap-1">{k.scopes?.map((s: string) => <span key={s} className="rounded-full bg-indigo-500/20 px-2 py-px text-[10px] font-medium text-indigo-300">{s}</span>)}</div></td>
            <td className="py-3 pr-4 text-[12px]"><span className="capitalize text-ink-2">{k.rate_limit_tier || "basic"}</span></td>
            <td className="py-3 pr-4 font-mono text-[13px] text-ink">{k.total_requests ?? 0}</td>
            <td className="py-3 pr-4"><StatusPill status={k.status} /></td>
            <td className="py-3 pr-4 text-[12px] text-ink-3">{new Date(k.created_at).toLocaleDateString()}</td>
            <td className="py-3 text-right">{k.status !== "revoked" && <button onClick={() => revokeKey(k.id)} className="focusable opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-red-400/80 transition-all hover:bg-red-500/10"><ShieldOff size={12} /> Revoke</button>}</td>
          </tr>))}
        </Table>
      </div></Card>
    )}
  </div>);
}
