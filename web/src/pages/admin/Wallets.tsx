import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Smartphone, Search, RefreshCw, HardDrive, Key, ShieldAlert,
  AlertTriangle, User, Wifi,
} from "lucide-react";
import {
  Card, CardHeader, Input, Button, StatusPill, Mono, ErrorNote, EmptyState, Table, StatTile,
} from "../../components/ui";

function adminFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("orbis_admin_token");
  return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } }).then(r => r.json());
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

export default function AdminWallets() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [wipeModal, setWipeModal] = useState<{ walletId: string; deviceName: string } | null>(null);
  const [wipeReason, setWipeReason] = useState("");
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);

  function load() {
    setLoading(true); setError(null);
    adminFetch("/api/wallet/admin/users")
      .then(d => { if (d.success) setItems(d.items); else setError(d.message); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const grouped = items.reduce<Record<string, any[]>>((acc, item) => {
    if (!acc[item.user_id]) acc[item.user_id] = [];
    acc[item.user_id].push(item);
    return acc;
  }, {});

  const filtered = search
    ? Object.entries(grouped).filter(([uid, devices]) =>
        uid.toLowerCase().includes(search.toLowerCase()) ||
        devices.some(d =>
          d.device_name?.toLowerCase().includes(search.toLowerCase()) ||
          d.wallet_id?.toLowerCase().includes(search.toLowerCase()) ||
          d.platform?.toLowerCase().includes(search.toLowerCase())
        )
      ).reduce<Record<string, any[]>>((acc, [uid, devices]) => ({ ...acc, [uid]: devices }), {})
    : grouped;

  const allDevices = items;
  const totalDevices = allDevices.length;
  const activeDevices = allDevices.filter(d => !d.wiped).length;
  const totalVaultRecords = allDevices.reduce((s, d) => s + (d.vault_count || 0), 0);
  const totalGrants = allDevices.reduce((s, d) => s + (d.grant_count || 0), 0);

  async function handleWipe() {
    if (!wipeModal || wipeConfirm !== "CONFIRM WIPE") return;
    setWiping(true); setWipeError(null);
    const d = await adminFetch(`/api/wallet/admin/remote-wipe/${wipeModal.walletId}`, {
      method: "DELETE",
      body: JSON.stringify({ reason: wipeReason }),
    });
    if (d.success) { setWipeModal(null); setWipeReason(""); setWipeConfirm(""); load(); }
    else setWipeError(d.message);
    setWiping(false);
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-ink">Wallets</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">
            Wallet devices grouped by user ({Object.keys(grouped).length} users, {totalDevices} devices).
          </p>
        </div>
        <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-[var(--color-surface-3)]">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total Devices" value={totalDevices} icon={<Smartphone size={16} />} />
        <StatTile label="Active Wallets" value={activeDevices} detail={`${totalDevices - activeDevices} wiped`} accent="text-emerald-400" icon={<Wifi size={16} />} />
        <StatTile label="Vault Records" value={totalVaultRecords} icon={<HardDrive size={16} />} />
        <StatTile label="Active Grants" value={totalGrants} icon={<Key size={16} />} />
      </div>

      {/* Privacy strip */}
      <div className="rounded-lg border border-[rgba(77,124,255,0.15)] bg-[rgba(77,124,255,0.05)] px-4 py-3 text-[12.5px] leading-6 text-ink-2">
        <span className="font-medium text-[var(--color-accent)]">Admin visibility:</span> Admins see device metadata (name, platform, wallet ID, last seen, vault record count, quota usage) and grant metadata (scope, expiry, access counts). <span className="font-medium">Vault contents, credential data, message contents, and private keys are end-to-end encrypted and are never visible to admins or ORBIS servers.</span>
      </div>


      {error && <ErrorNote message={error} />}

      <Card>
        <CardHeader title="Wallet Devices" subtitle="Devices grouped by user. Click a wallet ID to view details." />
        <div className="p-4">
          <div className="mb-4">
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user ID, device name, wallet ID, or platform…" />
          </div>

          {loading ? (
            <div className="py-10 text-center text-ink-3">Loading wallet devices…</div>
          ) : Object.keys(filtered).length === 0 ? (
            <EmptyState title="No wallets found" hint={search ? "Try a different search term." : undefined} />
          ) : (
            <div className="space-y-6">
              {Object.entries(filtered).map(([userId, devices]) => (
                <div key={userId}>
                  <div className="mb-2 flex items-center gap-2">
                    <User size={14} className="text-ink-3" />
                    <span className="text-[12px] font-medium text-ink-2">User: <Mono value={userId} /></span>
                    <span className="rounded-md bg-[var(--color-surface-3)] px-2 py-0.5 text-[11px] text-ink-3">{devices.length} device{devices.length !== 1 ? "s" : ""}</span>
                  </div>
                  <Table head={<><th className="py-2.5 pr-4">Wallet ID</th><th className="py-2.5 pr-4">Device</th><th className="py-2.5 pr-4">Platform</th><th className="py-2.5 pr-4">Vault</th><th className="py-2.5 pr-4">Grants</th><th className="py-2.5 pr-4">Quota Used</th><th className="py-2.5 pr-4">Last Seen</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5 text-right">Actions</th></>}>
                    {devices.map(d => (
                      <tr key={d.wallet_id} className="group">
                        <td className="py-3 pr-4">
                          <button onClick={() => navigate(`/admin/wallets/${d.wallet_id}`)} className="focusable text-[12.5px] font-medium text-[var(--color-accent)] hover:underline"><Mono value={d.wallet_id} /></button>
                        </td>
                        <td className="py-3 pr-4 text-[12.5px] text-ink">{d.device_name || "—"}</td>
                        <td className="py-3 pr-4 text-[12px] text-ink-2 capitalize">{d.platform || "—"}</td>
                        <td className="py-3 pr-4 text-[12px] text-ink-2">{d.vault_count || 0}</td>
                        <td className="py-3 pr-4 text-[12px] text-ink-2">{d.grant_count || 0}</td>
                        <td className="py-3 pr-4 text-[12px] font-mono text-ink-2">{formatBytes(d.quota_used_bytes || 0)}</td>
                        <td className="py-3 pr-4 text-[12px] text-ink-3">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleDateString() : "Never"}</td>
                        <td className="py-3 pr-4">{d.wiped ? <StatusPill status="deactivated" /> : <StatusPill status="active" />}</td>
                        <td className="py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-end gap-1">
                            {!d.wiped && (
                              <button onClick={() => { setWipeModal({ walletId: d.wallet_id, deviceName: d.device_name || "Unknown device" }); setWipeReason(""); setWipeConfirm(""); setWipeError(null); }}
                                className="focusable inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors text-[#ffb0ad] hover:bg-[rgba(229,100,95,0.15)]">
                                <ShieldAlert size={11} /> Wipe
                              </button>
                            )}
                            <button onClick={() => navigate(`/admin/wallets/${d.wallet_id}`)}
                              className="focusable inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors text-ink-3 hover:bg-white/[0.06] hover:text-ink-2">View</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {wipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setWipeModal(null)}>
          <div className="mx-4 w-full max-w-md rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(229,100,95,0.15)]"><AlertTriangle size={20} className="text-[#ffb0ad]" /></div>
              <div><h2 className="text-[16px] font-semibold text-ink">Remote Wipe</h2><p className="text-[12.5px] text-ink-3">{wipeModal.deviceName}</p></div>
            </div>
            <div className="mb-5 space-y-3 rounded-lg border border-[rgba(229,100,95,0.2)] bg-[rgba(229,100,95,0.06)] p-3.5">
              <p className="text-[12.5px] font-medium text-[#ffb0ad]">This action cannot be undone.</p>
              <ul className="space-y-1 text-[12px] leading-5 text-ink-2">
                <li>• All wallet credentials will be permanently deleted from this device.</li>
                <li>• Encrypted backup data will remain on the server but inaccessible without the device key.</li>
                <li>• The user will be signed out and must re-register their wallet.</li>
                <li>• This action is logged in the audit trail.</li>
              </ul>
            </div>
            {wipeError && <ErrorNote message={wipeError} />}
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Reason for wipe *</span>
                <textarea value={wipeReason} onChange={e => setWipeReason(e.target.value)} placeholder="e.g. Device reported stolen, account compromise detected"
                  className="focusable w-full rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] px-3 py-2 text-[13px] text-ink placeholder:text-ink-4 transition-colors focus:border-[rgba(77,124,255,0.55)] resize-none" rows={2} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Type CONFIRM WIPE to proceed *</span>
                <input value={wipeConfirm} onChange={e => setWipeConfirm(e.target.value)} placeholder="CONFIRM WIPE"
                  className="focusable w-full rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] px-3 py-2 text-[13px] text-ink placeholder:text-ink-4 transition-colors focus:border-[rgba(77,124,255,0.55)]" />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setWipeModal(null)}>Cancel</Button>
              <Button variant="danger" loading={wiping} disabled={!wipeReason.trim() || wipeConfirm !== "CONFIRM WIPE"} onClick={handleWipe}>
                <ShieldAlert size={14} /> Remote Wipe Device
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
