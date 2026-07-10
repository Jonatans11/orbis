import { Link } from "react-router-dom";
import { KeyRound, FileBadge2, ShieldCheck, ArrowRight, Plus } from "lucide-react";
import { api } from "../../lib/api";
import { Card, CardHeader, StatTile, StatusPill, Mono, useAsync, EmptyState } from "../../components/ui";

export default function Overview() {
  const dids = useAsync(() => api.did.list(), []);
  const creds = useAsync(() => api.vc.list(), []);
  const trust = useAsync(() => api.trust.entities(), []);

  const activeDids = dids.data?.dids.filter((d) => d.status === "active").length ?? null;
  const activeTrust = trust.data?.entities.filter((e) => e.status === "active").length ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[24px] font-bold text-ink-100">Overview</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">Live state of your ORBIS.ID identity infrastructure.</p>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Decentralized identifiers"
          value={dids.data ? dids.data.count : "—"}
          detail={activeDids !== null ? `${activeDids} active` : undefined}
        />
        <StatTile
          label="Credentials issued"
          value={creds.data ? creds.data.count : "—"}
          detail="Ed25519-signed verifiable credentials"
        />
        <StatTile
          label="Trusted entities"
          value={trust.data ? trust.data.count : "—"}
          detail={activeTrust !== null ? `${activeTrust} active in registry` : undefined}
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { to: "/app/dids", icon: KeyRound, title: "Create a DID", text: "Generate a did:key or did:web identifier with an Ed25519 keypair." },
          { to: "/app/credentials", icon: FileBadge2, title: "Issue a credential", text: "Sign a W3C Verifiable Credential from one of your issuer DIDs." },
          { to: "/app/trust", icon: ShieldCheck, title: "Register an issuer", text: "Add a trusted entity to the ORBIS trust registry." },
        ].map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="card group flex items-start gap-4 rounded-2xl p-5 transition-all hover:border-orbit-400/40"
          >
            <div className="rounded-xl bg-orbit-500/12 p-2.5 text-orbit-300">
              <a.icon size={18} strokeWidth={1.9} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-100">
                {a.title}
                <ArrowRight size={13} className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </p>
              <p className="mt-1 text-[12.5px] leading-5 text-ink-500">{a.text}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent tables */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent identifiers"
            action={
              <Link to="/app/dids" className="inline-flex items-center gap-1 text-[12px] font-medium text-orbit-300 hover:text-orbit-400">
                <Plus size={13} /> New
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {dids.data && dids.data.dids.length > 0 ? (
              <ul className="divide-y divide-white/6">
                {dids.data.dids.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Mono value={d.did} className="block" />
                      <span className="text-[11px] text-ink-500">did:{d.method} · {new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                    <StatusPill status={d.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No identifiers yet" hint="Create your first DID from the Identifiers page." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent credentials"
            action={
              <Link to="/app/credentials" className="inline-flex items-center gap-1 text-[12px] font-medium text-orbit-300 hover:text-orbit-400">
                <Plus size={13} /> Issue
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {creds.data && creds.data.credentials.length > 0 ? (
              <ul className="divide-y divide-white/6">
                {creds.data.credentials.slice(0, 6).map((c) => (
                  <li key={c.credential_id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-ink-100">
                        {(() => { try { const t = JSON.parse(c.type); return Array.isArray(t) ? t.filter((x: string) => x !== "VerifiableCredential").join(", ") || "VerifiableCredential" : c.type; } catch { return c.type; } })()}
                      </span>
                      <Mono value={c.subject_did} />
                    </div>
                    <StatusPill status={c.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No credentials issued" hint="Issue your first verifiable credential." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
