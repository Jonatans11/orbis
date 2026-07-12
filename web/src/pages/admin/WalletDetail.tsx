import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Smartphone, HardDrive, Key, Clock, ShieldAlert, Eye, AlertTriangle } from "lucide-react";
import { Card, CardHeader, Button, StatusPill, Mono, ErrorNote, EmptyState, Table, SectionLabel, CopyButton } from "../../components/ui";

function adminFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("orbis_admin_token");
  return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } }).then(r => r.json());
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0; let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

export default function AdminWalletDetail() {
  const { walletId } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAccessLog, setShowAccessLog] = useState<string | null>(null);
  const [accessLog, setAccessLog] = useState<any[]>([]);
  const [accessLogLoading, setAccessLogLoading] = useState(false);

  function load() {
    setLoading(true); setError(null);
    Promise.all([
      adminFetch("/api/wallet/admin/users"),
      adminFetch("/api/wallet/admin/credentials?userId="),
      adminFetch("/api/wallet/admin/grants"),
    ]).then(([usersRes, credsRes, grantsRes]) => {
      if (!usersRes.success) { setError(usersRes.message); return; }
      const d = usersRes.items.find((i: any) => i.wallet_id === walletId);
      if (!d) { setError("Device not found"); return; }
      setDevice(d);
      if (credsRes.success) setBackups(credsRes.items.filter((b: any) => b.user_id === d.user_id));
      if (grantsRes.success) setGrants(grantsRes.grants.filter((g: any) => g.owner_user_id === d.user_id));
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { if (walletId) load(); }, [walletId]);

  async function loadAccessLog(grantId: string) {
    setAccessLogLoading(true);
    const d = await adminFetch(`/api/wallet/admin/grants/${grantId}/access-log`);
    if (d.success) { setAccessLog(d.logs); setShowAccessLog(grantId); }
    setAccessLogLoading(false);
  }

  if (loading) return <div className="py-20 text-center text-ink-3">Loading wallet details…</div>;
  if (error) return <div className="space-y-4"><ErrorNote message={error} /><Button variant="secondary" onClick={() => navigate("/admin/wallets")}><ArrowLeft size={14} /> Back to Wallets</Button></div>;
  if (!device) return null;

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/wallets")} className="focusable rounded-lg p-1.5 text-ink-3 hover:bg-white/[0.06] hover:text-ink"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-[22px] font-semibold text-ink">Wallet Detail</h1>
            <p className="mt-0.5 text-[13px] text-ink-3"><Mono value={device.wallet_id} /></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {device.wiped ? <StatusPill status="deactivated" /> : <StatusPill status="active" />}
          <CopyButton value={device.wallet_id} />
        </div>
      </div>

      {/* Device info */}
      <Card>
        <CardHeader title="Device Information" icon={<Smartphone size={16} />} />
        <div className="grid grid-cols-2 gap-4 p-5">
          <div><SectionLabel>Device Name</SectionLabel><p className="mt-1 text-[13px] text-ink">{device.device_name || "—"}</p></div>
          <div><SectionLabel>Platform</SectionLabel><p className="mt-1 text-[13px] text-ink capitalize">{device.platform || "—"}</p></div>
          <div><SectionLabel>User ID</SectionLabel><p className="mt-1 text-[13px] font-mono text-ink-2">{device.user_id}</p></div>
          <div><SectionLabel>Registered</SectionLabel><p className="mt-1 text-[13px] text-ink-2">{new Date(device.created_at).toLocaleString()}</p></div>
          <div><SectionLabel>Last Seen</SectionLabel><p className="mt-1 text-[13px] text-ink-2">{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Never"}</p></div>
          <div><SectionLabel>Vault Usage</SectionLabel><p className="mt-1 text-[13px] text-ink-2">{device.vault_count || 0} records ({formatBytes(device.quota_used_bytes || 0)})</p></div>
        </div>
      </Card>

      {/* Encrypted Backups */}
      <Card>
        <CardHeader title="Encrypted Backups" icon={<HardDrive size={16} />}
          subtitle="Metadata only — backed-up data is end-to-end encrypted. Contents are not visible to admins or server operators." />
        <div className="p-5">
          {backups.length === 0 ? (
            <EmptyState title="No backup records found" hint="Data stored in this wallet's encrypted vault." />
          ) : (
            <Table head={<><th className="py-2.5 pr-4">Record ID</th><th className="py-2.5 pr-4">Category</th><th className="py-2.5 pr-4">Size</th><th className="py-2.5 pr-4">Last Updated</th></>}>
              {backups.map(b => (
                <tr key={b.local_id}>
                  <td className="py-3 pr-4"><Mono value={b.local_id} /></td>
                  <td className="py-3 pr-4 text-[12.5px] text-ink capitalize">{b.category || "General"}</td>
                  <td className="py-3 pr-4 text-[12px] font-mono text-ink-2">{formatBytes(b.size || 0)}</td>
                  <td className="py-3 pr-4 text-[12px] text-ink-3">{new Date(b.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </Card>

      {/* Grants */}
      <Card>
        <CardHeader title="Data Sharing Grants" icon={<Key size={16} />}
          subtitle="Active and revoked consent grants. Click access count to view the access log." />
        <div className="p-5">
          {grants.length === 0 ? (
            <EmptyState title="No grants" hint="This user has not created any data-sharing grants." />
          ) : (
            <Table head={<><th className="py-2.5 pr-4">Grant ID</th><th className="py-2.5 pr-4">Grantee DID</th><th className="py-2.5 pr-4">Scope</th><th className="py-2.5 pr-4">Price</th><th className="py-2.5 pr-4">Expires</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5 pr-4">Access Count</th></>}>
              {grants.map(g => (
                <tr key={g.grant_id}>
                  <td className="py-3 pr-4"><Mono value={g.grant_id} /></td>
                  <td className="py-3 pr-4"><Mono value={g.grantee_did} /></td>
                  <td className="py-3 pr-4 text-[12.5px] text-ink capitalize">{g.scope || "—"}</td>
                  <td className="py-3 pr-4 text-[12px] text-ink-2">{g.price_amount ? `${g.price_amount} ${g.price_currency || ""}` : "Free"}</td>
                  <td className="py-3 pr-4 text-[12px] text-ink-3">{g.expires_at ? new Date(g.expires_at).toLocaleDateString() : "Never"}</td>
                  <td className="py-3 pr-4">{g.revoked ? <StatusPill status="revoked" /> : <StatusPill status="active" />}</td>
                  <td className="py-3 pr-4">
                    <button onClick={() => loadAccessLog(g.grant_id)} className="focusable inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-accent)] hover:underline">
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
      {showAccessLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAccessLog(null)}>
          <div className="mx-4 w-full max-w-lg rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-ink">Grant Access Log</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowAccessLog(null)}>Close</Button>
            </div>
            {accessLogLoading ? (
              <div className="py-8 text-center text-ink-3">Loading access log…</div>
            ) : accessLog.length === 0 ? (
              <EmptyState title="No access events" hint="This grant has not been accessed yet." />
            ) : (
              <Table head={<><th className="py-2.5 pr-4">Accessed By (DID)</th><th className="py-2.5 pr-4">Timestamp</th></>}>
                {accessLog.map((log: any) => (
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

      {/* Audit link */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-3)]/50 px-4 py-3">
        <Clock size={14} className="text-ink-3" />
        <span className="text-[12.5px] text-ink-3">View audit trail for this wallet in the </span>
        <button onClick={() => navigate("/admin/audit-log")} className="text-[12.5px] font-medium text-[var(--color-accent)] hover:underline">Audit Log</button>
      </div>
    </div>
  );
}
