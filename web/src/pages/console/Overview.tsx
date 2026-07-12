import { Link } from "react-router-dom";
import { KeyRound, FileBadge2, ShieldCheck, ArrowUpRight, Plus, Fingerprint, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { Card, CardHeader, StatTile, StatusPill, Mono, useAsync, EmptyState } from "../../components/ui";

function credType(raw: string) {
  try { const t = JSON.parse(raw); return Array.isArray(t) ? (t.filter((x: string) => x !== "VerifiableCredential").join(", ") || "VerifiableCredential") : raw; }
  catch { return raw; }
}

export default function Overview() {
  const dids = useAsync(() => api.did.list(), []);
  const creds = useAsync(() => api.vc.list(), []);
  const trust = useAsync(() => api.trust.entities(), []);

  const activeDids = dids.data?.dids.filter(d => d.status === "active").length ?? null;
  const activeTrust = trust.data?.entities.filter(e => e.status === "active").length ?? null;

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Overview</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">Live state of your ORBIS.ID identity infrastructure.</p>
        </div>
        <button
          onClick={() => { dids.reload(); creds.reload(); trust.reload(); }}
          className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-[var(--color-surface-3)] hover:text-ink"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Identifiers" value={dids.data ? dids.data.count : "—"} detail={activeDids !== null ? `${activeDids} active` : undefined} icon={<KeyRound size={15} />} />
        <StatTile label="Credentials" value={creds.data ? creds.data.count : "—"} detail="Ed25519-signed" icon={<FileBadge2 size={15} />} />
        <StatTile label="Trusted entities" value={trust.data ? trust.data.count : "—"} detail={activeTrust !== null ? `${activeTrust} active` : undefined} icon={<ShieldCheck size={15} />} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { to: "/app/dids", icon: KeyRound, t: "Create a DID", d: "Generate a did:key or did:web with an Ed25519 keypair." },
          { to: "/app/credentials", icon: FileBadge2, t: "Issue a credential", d: "Sign a W3C Verifiable Credential from an issuer DID." },
          { to: "/app/trust", icon: ShieldCheck, t: "Register an issuer", d: "Add a trusted entity to the ORBIS trust registry." },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="focusable panel seam group flex items-start gap-3.5 rounded-xl p-5 transition-colors hover:border-[var(--color-line-2)]">
            <span className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2.5 text-[var(--color-accent-hi)]">
              <a.icon size={17} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[13.5px] font-medium text-ink">
                {a.t}
                <ArrowUpRight size={13} className="text-ink-3 opacity-0 transition-all group-hover:opacity-100" />
              </p>
              <p className="mt-1 text-[12.5px] leading-5 text-ink-3">{a.d}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent identifiers"
            action={<Link to="/app/dids" className="focusable inline-flex items-center gap-1 rounded text-[12px] font-medium text-[var(--color-accent-hi)] hover:text-ink"><Plus size={12} /> New</Link>}
          />
          <div className="px-2 py-1.5">
            {dids.data && dids.data.dids.length > 0 ? (
              <ul>
                {dids.data.dids.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]">
                    <div className="min-w-0">
                      <Mono value={d.did} className="block" />
                      <span className="text-[11px] text-ink-4">did:{d.method} · {new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                    <StatusPill status={d.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-3"><EmptyState title="No identifiers yet" hint="Create your first DID from the Identifiers page." icon={<Fingerprint size={20} />} /></div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent credentials"
            action={<Link to="/app/credentials" className="focusable inline-flex items-center gap-1 rounded text-[12px] font-medium text-[var(--color-accent-hi)] hover:text-ink"><Plus size={12} /> Issue</Link>}
          />
          <div className="px-2 py-1.5">
            {creds.data && creds.data.credentials.length > 0 ? (
              <ul>
                {creds.data.credentials.slice(0, 6).map((c) => (
                  <li key={c.credential_id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]">
                    <div className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-ink">{credType(c.type)}</span>
                      <Mono value={c.subject_did} />
                    </div>
                    <StatusPill status={c.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-3"><EmptyState title="No credentials issued" hint="Issue your first verifiable credential." icon={<FileBadge2 size={20} />} /></div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
