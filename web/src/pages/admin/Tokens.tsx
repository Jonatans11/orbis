import { useState, useEffect } from "react";
import { Key, Plus, ShieldOff, RefreshCw, Copy, Check, Eye, EyeOff, X } from "lucide-react";
import { Card, CardHeader, Button, Input, Field, Select, StatusPill, Mono, ErrorNote, SuccessNote, EmptyState, Table, StatTile, Checkbox } from "../../components/ui";

const SCOPES = ["did:read", "did:write", "vc:issue", "vc:verify", "trust:read", "trust:write"];

function adminFetch(path: string, init?: RequestInit) {
  const t = localStorage.getItem("orbis_admin_token");
  return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, ...init?.headers } }).then(r => r.json());
}

export default function AdminTokens() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Create form
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["did:read", "vc:verify"]);
  const [rateTier, setRateTier] = useState("basic");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function load() { setLoading(true); setError(null); adminFetch("/api/admin/api-keys").then(d => { if (d.success) setKeys(d.keys); else setError(d.message); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!companyName) { setCreateError("Company name is required"); return; }
    if (!contactEmail) { setCreateError("Contact email is required"); return; }
    setCreating(true); setCreateError(null); setRawKey(null);
    try {
      const d = await adminFetch("/api/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({ company_name: companyName, contact_email: contactEmail, scopes: selectedScopes, rate_limit_tier: rateTier, expires_at: expiresAt || null })
      });
      if (d.success) { setRawKey(d.raw_key); setShowCreate(true); load(); }
      else setCreateError(d.message);
    } catch (e) { setCreateError((e as Error).message); }
    finally { setCreating(false); }
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    const d = await adminFetch(`/api/admin/api-keys/${id}/revoke`, { method: "PUT" });
    if (d.success) load(); else setError(d.message);
  }

  const toggleScope = (s: string) => {
    setSelectedScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const activeCount = keys.filter(k => k.status !== "revoked").length;

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-[22px] font-semibold text-ink">Access Tokens</h1><p className="mt-1 text-[13.5px] text-ink-3">{keys.length} total · {activeCount} active.</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-[var(--color-surface-3)]"><RefreshCw size={13} /> Refresh</button>
          <button onClick={() => { setShowCreate(!showCreate); setRawKey(null); }} className="focusable inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/20 px-3 py-1.5 text-[12px] font-medium text-amber-400 hover:bg-amber-500/25"><Plus size={13} /> New Token</button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardHeader title={rawKey ? "Token Created" : "Create a new API token"} subtitle={rawKey ? "This is the only time you'll see the raw token." : "For third-party developers integrating with the platform."}
            action={rawKey ? null : <button onClick={() => { setShowCreate(false); setRawKey(null); }} className="text-ink-3 hover:text-ink"><X size={16} /></button>} />
          <div className="p-5 space-y-4">
            {rawKey ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-amber-400"><Key size={15} /> Save this token now</p>
                  <p className="text-[12px] text-ink-3 mb-3">It will not be shown again. If you lose it, you'll need to create a new token.</p>
                  <div className="flex items-center justify-between gap-2 rounded-md bg-[#06070a] px-3 py-2.5">
                    <span className="break-all font-mono text-[12px] text-[var(--color-accent-hi)]">{rawKey}</span>
                    <button onClick={() => { navigator.clipboard.writeText(rawKey).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="focusable shrink-0 rounded-md p-1.5 text-ink-3 hover:bg-white/[0.06] hover:text-ink">
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <Button onClick={() => { setShowCreate(false); setRawKey(null); setCompanyName(""); setContactEmail(""); }} className="w-full">Done — return to token list</Button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Company / app name"><Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="My Wallet App" /></Field>
                  <Field label="Contact email"><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="dev@company.com" type="email" /></Field>
                </div>
                <Field label="Scopes">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {SCOPES.map(s => (
                      <label key={s} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        selectedScopes.includes(s) ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300" : "border-[var(--color-line-2)] text-ink-3 hover:text-ink-2"
                      }`}>
                        <input type="checkbox" checked={selectedScopes.includes(s)} onChange={() => toggleScope(s)} className="sr-only" />
                        {s}
                      </label>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Rate limit tier"><Select value={rateTier} onChange={e => setRateTier(e.target.value)}>
                    <option value="basic">Basic — 100 req/min</option><option value="pro">Pro — 1000 req/min</option><option value="enterprise">Enterprise — 10000 req/min</option>
                  </Select></Field>
                  <Field label="Expiration" hint="Optional. Leave blank for no expiry."><Input value={expiresAt} onChange={e => setExpiresAt(e.target.value)} type="date" /></Field>
                </div>
                {createError && <ErrorNote message={createError} />}
                <Button onClick={handleCreate} loading={creating} className="w-full"><Key size={14} /> Generate token</Button>
              </>
            )}
          </div>
        </Card>
      )}

      {error && <ErrorNote message={error} />}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="Total Tokens" value={keys.length} icon={<Key size={15} />} />
        <StatTile label="Active" value={activeCount} accent="text-emerald-400" />
        <StatTile label="Revoked" value={keys.filter(k => k.status === "revoked").length} accent={keys.filter(k => k.status === "revoked").length > 0 ? "text-red-400" : "text-ink"} />
        <StatTile label="Total Requests" value={keys.reduce((s, k) => s + (k.total_requests || 0), 0)} />
      </div>

      {loading ? <div className="py-10 text-center text-ink-3">Loading tokens…</div> : keys.length === 0 ? <EmptyState title="No tokens created" hint="Create your first access token above." icon={<Key size={20} />} /> : (
        <Card><CardHeader title="All Access Tokens" subtitle="Manage third-party API keys and their permissions." />
          <div className="p-2"><Table head={<><th className="py-2.5 pr-4">Company</th><th className="py-2.5 pr-4">Email</th><th className="py-2.5 pr-4">Scopes</th><th className="py-2.5 pr-4">Tier</th><th className="py-2.5 pr-4">Requests</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5 pr-4">Expires</th><th className="py-2.5 text-right">Actions</th></>}>
            {keys.map((k: any) => (<tr key={k.id} className="group">
              <td className="py-3 pr-4 text-[12.5px] text-ink">{k.company_name || k.name}</td>
              <td className="py-3 pr-4 text-[12px] text-ink-3">{k.contact_email || k.email || "—"}</td>
              <td className="py-3 pr-4"><div className="flex flex-wrap gap-1">{k.scopes?.map((s: string) => <span key={s} className="rounded-full bg-indigo-500/20 px-2 py-px text-[10px] font-medium text-indigo-300">{s}</span>)}</div></td>
              <td className="py-3 pr-4 text-[12px] capitalize text-ink-2">{k.rate_limit_tier || "basic"}</td>
              <td className="py-3 pr-4 font-mono text-[13px] text-ink">{k.total_requests ?? 0}</td>
              <td className="py-3 pr-4"><StatusPill status={k.status} /></td>
              <td className="py-3 pr-4 text-[12px] text-ink-3">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Never"}</td>
              <td className="py-3 text-right">{k.status !== "revoked" && <button onClick={() => revokeKey(k.id)} className="focusable opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-red-400/80 transition-all hover:bg-red-500/10"><ShieldOff size={12} /> Revoke</button>}</td>
            </tr>))}
          </Table></div>
        </Card>
      )}
    </div>
  );
}
