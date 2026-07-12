import { useState, useEffect } from "react";
import { KeyRound, RefreshCw, Search } from "lucide-react";
import { Card, CardHeader, Input, StatusPill, Mono, ErrorNote, EmptyState, Table, CodeBlock, Button } from "../../components/ui";
function adminFetch(path: string) { const t = localStorage.getItem("orbis_admin_token"); return fetch(path, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()); }
export default function AdminDIDs() {
  const [dids, setDids] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  function load() { setLoading(true); setError(null); adminFetch(`/api/admin/dids?limit=${limit}&offset=${offset}`).then(d => { if (d.success) { setDids(d.dids); setTotal(d.total); } else setError(d.message); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, [limit, offset]);
  async function showDetail(did: string) {
    const d = await adminFetch(`/api/did/resolve/${encodeURIComponent(did)}`);
    if (d.success) setSelected(d.didDocument);
  }
  return (<div className="space-y-7">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-[22px] font-semibold text-ink">DIDs</h1><p className="mt-1 text-[13.5px] text-ink-3">All Decentralized Identifiers ({total} total).</p></div>
      <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-[var(--color-surface-3)]"><RefreshCw size={13} /> Refresh</button>
    </div>
    {error && <ErrorNote message={error} />}
    {loading ? <div className="py-10 text-center text-ink-3">Loading DIDs…</div> : dids.length === 0 ? <EmptyState title="No DIDs found" /> : (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><Card><CardHeader title="All DIDs" /><div className="p-2"><Table head={<><th className="py-2.5 pr-4">DID</th><th className="py-2.5 pr-4">Method</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5 pr-4">Created</th><th className="py-2.5 text-right">Actions</th></>}>
          {dids.map((d: any) => (<tr key={d.id} className="group"><td className="py-3 pr-4"><button onClick={() => showDetail(d.did)} className="text-left hover:text-ink"><Mono value={d.did} /></button></td>
            <td className="py-3 pr-4 text-[12px] text-ink-2">did:{d.method}</td><td className="py-3 pr-4"><StatusPill status={d.status} /></td>
            <td className="py-3 pr-4 text-[12px] text-ink-3">{new Date(d.created_at).toLocaleString()}</td>
            <td className="py-3 text-right"><button onClick={() => showDetail(d.did)} className="focusable text-[11px] text-[var(--color-accent-hi)] hover:text-ink">View</button></td>
          </tr>))}
        </Table></div></Card></div>
        <div><Card><CardHeader title="DID Document" /><div className="p-4">{selected ? <CodeBlock data={selected} maxHeight="28rem" /> : <div className="py-10 text-center text-[12px] text-ink-3">Click a DID to view its document.</div>}</div></Card></div>
      </div>
    )}
    {total > limit && <div className="flex justify-center gap-3"><Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>Previous</Button><span className="self-center text-[12px] text-ink-3">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span><Button variant="secondary" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(o => o + limit)}>Next</Button></div>}
  </div>);
}
