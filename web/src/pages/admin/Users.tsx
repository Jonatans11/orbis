import { useState, useEffect } from "react";
import { Users, ShieldOff, ShieldCheck, RefreshCw, Search } from "lucide-react";
import { Card, CardHeader, Input, Button, Field, StatusPill, Mono, ErrorNote, EmptyState, Table } from "../../components/ui";
function adminFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("orbis_admin_token");
  return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } }).then(r => r.json());
}
export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  function load() { setLoading(true); setError(null); adminFetch("/api/admin/users").then(d => { if (d.success) setUsers(d.users); else setError(d.message); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);
  async function toggleSuspend(id: string, currentStatus: string) {
    const endpoint = currentStatus === "active" ? "suspend" : "activate";
    const d = await adminFetch(`/api/admin/users/${id}/${endpoint}`, { method: "PUT" });
    if (d.success) load(); else setError(d.message);
  }
  const filtered = users.filter(u => !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.display_name?.toLowerCase().includes(search.toLowerCase()) || u.did?.includes(search));
  return (<div className="space-y-7">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-[22px] font-semibold text-ink">Users</h1><p className="mt-1 text-[13.5px] text-ink-3">Manage registered users ({users.length} total).</p></div>
      <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-[var(--color-surface-3)]"><RefreshCw size={13} /> Refresh</button>
    </div>
    <Card><CardHeader title="All registered users" subtitle="Email, DID, admin status, and account status." /><div className="p-4">
      <div className="mb-4"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email, name, or DID…" /></div>
      {error && <ErrorNote message={error} />}
      {loading ? <div className="py-10 text-center text-ink-3">Loading users…</div> : filtered.length === 0 ? <EmptyState title="No users found" /> : (
        <Table head={<><th className="py-2.5 pr-4">Email</th><th className="py-2.5 pr-4">Name</th><th className="py-2.5 pr-4">DID</th><th className="py-2.5 pr-4">Admin</th><th className="py-2.5 pr-4">Verified</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5 pr-4">Created</th><th className="py-2.5 text-right">Actions</th></>}>
          {filtered.map(u => (<tr key={u.id} className="group"><td className="py-3 pr-4 text-[12.5px] text-ink">{u.email}</td>
            <td className="py-3 pr-4 text-[12.5px] text-ink-2">{u.display_name || "—"}</td>
            <td className="py-3 pr-4">{u.did ? <Mono value={u.did} /> : <span className="text-[12px] text-ink-4">—</span>}</td>
            <td className="py-3 pr-4">{u.admin ? <span className="text-amber-400 text-[12px] font-medium">Admin</span> : <span className="text-[12px] text-ink-3">User</span>}</td>
            <td className="py-3 pr-4">{u.verified ? <span className="text-emerald-400 text-[12px]">Yes</span> : <span className="text-[12px] text-ink-3">No</span>}</td>
            <td className="py-3 pr-4"><StatusPill status={u.status} /></td>
            <td className="py-3 pr-4 text-[12px] text-ink-3">{new Date(u.created_at).toLocaleDateString()}</td>
            <td className="py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggleSuspend(u.id, u.status)} className="focusable inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors"
                style={{ color: u.status === "active" ? "#f0cd8a" : "#7fe0ac", background: u.status === "active" ? "rgba(224,168,58,0.1)" : "rgba(53,192,122,0.1)" }}>
                {u.status === "active" ? <><ShieldOff size={12} /> Suspend</> : <><ShieldCheck size={12} /> Activate</>}
              </button>
            </td>
          </tr>))}
        </Table>
      )}
    </div></Card>
  </div>);
}
