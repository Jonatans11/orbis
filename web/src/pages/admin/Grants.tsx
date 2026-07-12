import { useState, useEffect } from "react";
import { Key, Search, RefreshCw, Eye, X } from "lucide-react";
import { Card, CardHeader, Input, Button, StatusPill, Mono, ErrorNote, EmptyState, Table, StatTile } from "../../components/ui";

function adminFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("orbis_admin_token");
  return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } }).then(r => r.json());
}

export default function AdminGrants() {
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [accessLog, setAccessLog] = useState<{ grantId: string; logs: any[]; loading: boolean } | null>(null);

  function load() {
    setLoading(true); setError(null);
    adminFetch("/api/wallet/admin/grants")
      .then(d => { if (d.success) setGrants(d.grants); else setError(d.message); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const filtered = grants.filter(g =>
    !search ||
    g.grant_id?.toLowerCase().includes(search.toLowerCase()) ||
    g.grantee_did?.toLowerCase().includes(search.toLowerCase()) ||
    g.owner_user_id?.toLowerCase().includes(search.toLowerCase()) ||
    g.scope?.toLowerCase().includes(search.toLowerCase())
  );

  async function loadAccessLog(grantId: string) {
    setAccessLog({ grantId, logs: [], loading: true });
    const d = await adminFetch(`/api/wallet/admin/grants/${grantId}/access-log`);
    if (d.success) setAccessLog({ grantId, logs: d.logs, loading: false });
    else setAccessLog(null);
  }

  const activeGrants = grants.filter(g => !g.revoked).length;
  const revokedGrants = grants.filter(g => g.revoked).length;
  const totalAccesses = grants.reduce((s, g) => s + (g.access_count || 0), 0);

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-ink">Consent Grants</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">Data-sharing consent grants across all users ({grants.length} total).</p>
        </div>
        <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-[var(--color-surface-3)]">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Active Grants" value={activeGrants} accent="text-emerald-400" icon={<Key size={16} />} />
        <StatTile label="Revoked" value={revokedGrants} accent="text-ink-2" icon={<X size={16} />} />
        <StatTile label="Total Access Events" value={totalAccesses} icon={<Eye size={16} />} />

      {/* Privacy strip */}
      <div className="rounded-lg border border-[rgba(77,124,255,0.15)] bg-[rgba(77,124,255,0.05)] px-4 py-3 text-[12.5px] leading-6 text-ink-2">
        <span className="font-medium text-[var(--color-accent)]">Admin visibility:</span> Admins see grant metadata — who shared with whom, scope, expiry, access counts, and price. <span className="font-medium">Vault contents, credential data, message contents, and private keys are end-to-end encrypted and are never visible to admins or ORBIS servers.</span>
      </div>

      </div>

      {error && <ErrorNote message={error} />}

      <Card>
        <CardHeader title="All Data-Sharing Grants" subtitle="Consent grants: owner, grantee, scope, expiry, and access count. Click access count to view the access log sheet." />
        <div className="p-4">
          <div className="mb-4">
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by grant ID, grantee DID, owner ID, or scope…" />
          </div>

          {loading ? (
            <div className="py-10 text-center text-ink-3">Loading grants…</div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No grants found" hint={search ? "Try a different search term." : undefined} />
          ) : (
            <Table head={<><th className="py-2.5 pr-4">Grant ID</th><th className="py-2.5 pr-4">Owner</th><th className="py-2.5 pr-4">Grantee DID</th><th className="py-2.5 pr-4">Scope</th><th className="py-2.5 pr-4">Price</th><th className="py-2.5 pr-4">Expires</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5 pr-4">Created</th><th className="py-2.5 text-right">Access</th></>}>
              {filtered.map(g => (
                <tr key={g.grant_id} className="group">
                  <td className="py-3 pr-4"><Mono value={g.grant_id} /></td>
                  <td className="py-3 pr-4"><Mono value={g.owner_user_id} /></td>
                  <td className="py-3 pr-4"><Mono value={g.grantee_did} /></td>
                  <td className="py-3 pr-4 text-[12.5px] text-ink capitalize">{g.scope || "—"}</td>
                  <td className="py-3 pr-4 text-[12px] text-ink-2">{g.price_amount ? `${g.price_amount} ${g.price_currency || ""}` : "Free"}</td>
                  <td className="py-3 pr-4 text-[12px] text-ink-3">{g.expires_at ? new Date(g.expires_at).toLocaleDateString() : "Never"}</td>
                  <td className="py-3 pr-4">{g.revoked ? <StatusPill status="revoked" /> : <StatusPill status="active" />}</td>
                  <td className="py-3 pr-4 text-[12px] text-ink-3">{new Date(g.created_at).toLocaleDateString()}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => loadAccessLog(g.grant_id)} className="focusable inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--color-accent)] hover:bg-[rgba(77,124,255,0.1)]">
                      <Eye size={12} /> {g.access_count || 0}
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </Card>

      {/* Grant access log sheet */}
      {accessLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAccessLog(null)}>
          <div className="mx-4 w-full max-w-lg rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-ink">Grant Access Log</h2>
                <p className="mt-0.5 text-[12px] text-ink-3"><Mono value={accessLog.grantId} /></p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAccessLog(null)}>Close</Button>
            </div>
            {accessLog.loading ? (
              <div className="py-8 text-center text-ink-3">Loading access log…</div>
            ) : accessLog.logs.length === 0 ? (
              <EmptyState title="No access events" hint="This grant has not been accessed yet." />
            ) : (
              <Table head={<><th className="py-2.5 pr-4">Accessed By (DID)</th><th className="py-2.5 pr-4">Timestamp</th></>}>
                {accessLog.logs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="py-3 pr-4"><Mono value={log.accessed_by_did} /></td>
                    <td className="py-3 pr-4 text-[12px] text-ink-3">{new Date(log.accessed_at).toLocaleString()}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
