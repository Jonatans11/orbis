import { useState, useEffect } from "react";
import { FileBadge2, RefreshCw } from "lucide-react";
import { Card, CardHeader, StatusPill, Mono, ErrorNote, EmptyState, Table, Button, CodeBlock } from "../../components/ui";
function adminFetch(path: string) { const t = localStorage.getItem("orbis_admin_token"); return fetch(path, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()); }
function credType(raw: string) { try { const t = JSON.parse(raw); return Array.isArray(t) ? (t.filter((x: string) => x !== "VerifiableCredential").join(", ") || "VerifiableCredential") : raw; } catch { return raw; } }
export default function AdminCredentials() {
  const [creds, setCreds] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  function load() { setLoading(true); setError(null); adminFetch(`/api/admin/credentials?limit=${limit}&offset=${offset}`).then(d => { if (d.success) { setCreds(d.credentials); setTotal(d.total); } else setError(d.message); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, [limit, offset]);
  async function showDetail(credId: string) {
    const d = await adminFetch(`/api/vc/credentials/${encodeURIComponent(credId)}/verifications`);
    if (d.success) setSelected(d);
  }
  return (<div className="space-y-7">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-[22px] font-semibold text-ink">Credentials</h1><p className="mt-1 text-[13.5px] text-ink-3">All Verifiable Credentials ({total} total).</p></div>
      <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-[var(--color-surface-3)]"><RefreshCw size={13} /> Refresh</button>
    </div>
    {error && <ErrorNote message={error} />}
    {loading ? <div className="py-10 text-center text-ink-3">Loading credentials…</div> : creds.length === 0 ? <EmptyState title="No credentials found" /> : (
      <div className="grid gap-4 lg:grid-cols-3"><div className="lg:col-span-2"><Card><CardHeader title="All Credentials" /><div className="p-2"><Table head={<><th className="py-2.5 pr-4">Type</th><th className="py-2.5 pr-4">Issuer</th><th className="py-2.5 pr-4">Subject</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5 pr-4">Issued</th><th className="py-2.5 text-right">Actions</th></>}>
          {creds.map((c: any) => (<tr key={c.credential_id || c.id} className="group"><td className="py-3 pr-4 text-[12.5px] text-ink">{credType(c.type)}</td>
            <td className="py-3 pr-4"><Mono value={c.issuer_did} /></td><td className="py-3 pr-4"><Mono value={c.subject_did} /></td>
            <td className="py-3 pr-4"><StatusPill status={c.status} /></td><td className="py-3 pr-4 text-[12px] text-ink-3">{new Date(c.issuance_date || c.created_at).toLocaleString()}</td>
            <td className="py-3 text-right"><button onClick={() => showDetail(c.credential_id || c.id)} className="focusable text-[11px] text-[var(--color-accent-hi)]">Verifications</button></td>
          </tr>))}
        </Table></div></Card></div>
        <div><Card><CardHeader title="Verification Details" /><div className="p-4">{selected ? <CodeBlock data={selected} maxHeight="28rem" /> : <div className="py-10 text-center text-[12px] text-ink-3">Click a credential to view verifications.</div>}</div></Card></div>
      </div>
    )}
    {total > limit && <div className="flex justify-center gap-3"><Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>Previous</Button><span className="self-center text-[12px] text-ink-3">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span><Button variant="secondary" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(o => o + limit)}>Next</Button></div>}
  </div>);
}
