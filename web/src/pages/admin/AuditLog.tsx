import { useState, useEffect } from "react";
import { ScrollText, RefreshCw, Filter } from "lucide-react";
import { Card, CardHeader, Input, Button, Field, ErrorNote, EmptyState, CodeBlock, useAsync } from "../../components/ui";
function adminFetch(path: string) {
  const token = localStorage.getItem("orbis_admin_token");
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}
export default function AdminAuditLog() {
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actorFilter, setActorFilter] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  function load() {
    setLoading(true); setError(null);
    let url = `/api/admin/audit-log?limit=${limit}&offset=${offset}`;
    if (actorFilter.trim()) url += `&actor_id=${encodeURIComponent(actorFilter.trim())}`;
    adminFetch(url).then(d => { if (d.success) { setEntries(d.entries); setTotal(d.total); } else setError(d.message); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [limit, offset]);
  return (<div className="space-y-7">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-[22px] font-semibold text-ink">Audit Log</h1><p className="mt-1 text-[13.5px] text-ink-3">{total} total entries.</p></div>
      <div className="flex items-center gap-2"><Input value={actorFilter} onChange={e => setActorFilter(e.target.value)} placeholder="Actor ID filter" className="w-48" /><Button variant="secondary" size="sm" onClick={load} loading={loading}><Filter size={13} /> Filter</Button></div>
    </div>
    {error && <ErrorNote message={error} />}
    {loading ? <div className="py-10 text-center text-ink-3">Loading audit log…</div> : entries.length === 0 ? <EmptyState title="No audit entries" /> : (
      <div className="space-y-2">{entries.map((e: any) => (
        <div key={e.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-[12px]"><span className="font-mono text-[11px] text-ink-4">{e.id?.slice(0, 8)}</span><span className="rounded-md bg-[var(--color-surface-3)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-accent)]">{e.action}</span><span className="text-ink-3">{e.entity_type}/{e.entity_id?.slice(0, 8)}</span></div>
            <span className="text-[11px] text-ink-4">{new Date(e.timestamp).toLocaleString()}</span>
          </div>
          <p className="text-[12.5px] text-ink-2">{e.message || e.result}</p>
          <div className="flex gap-3 mt-1.5 text-[11px] text-ink-4"><span>Actor: <span className="font-mono text-ink-3">{e.actor_type}/{e.actor_id?.slice(0, 12) || "?"}</span></span>{e.ip_address && <span>IP: {e.ip_address}</span>}</div>
        </div>
      ))}</div>
    )}
    {total > limit && <div className="flex justify-center gap-3"><Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>Previous</Button><span className="self-center text-[12px] text-ink-3">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span><Button variant="secondary" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(o => o + limit)}>Next</Button></div>}
  </div>);
}
