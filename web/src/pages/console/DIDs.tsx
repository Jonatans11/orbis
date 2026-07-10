import { useState } from "react";
import { KeyRound, Globe, Search, ShieldOff } from "lucide-react";
import { api, type DIDCreateResult } from "../../lib/api";
import {
  Card, CardHeader, Button, Input, Field, StatusPill, Mono, CopyButton,
  CodeBlock, ErrorNote, EmptyState, useAsync,
} from "../../components/ui";

export default function DIDs() {
  const list = useAsync(() => api.did.list(), []);

  // create form
  const [method, setMethod] = useState<"key" | "web">("key");
  const [domain, setDomain] = useState("orbis.id");
  const [path, setPath] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<DIDCreateResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // resolver
  const [resolveInput, setResolveInput] = useState("");
  const [resolved, setResolved] = useState<Record<string, unknown> | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    setCreated(null);
    try {
      const res = await api.did.create(method === "key" ? { method } : { method, domain, path: path || undefined });
      setCreated(res);
      list.reload();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleResolve(did?: string) {
    const target = did || resolveInput;
    if (!target) return;
    setResolving(true);
    setResolveError(null);
    setResolved(null);
    if (did) setResolveInput(did);
    try {
      const res = await api.did.resolve(target);
      setResolved(res.didDocument);
    } catch (e) {
      setResolveError((e as Error).message);
    } finally {
      setResolving(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await api.did.revoke(id);
      list.reload();
    } catch {
      /* surface via reload state */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[24px] font-bold text-ink-100">Identifiers</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">
          Create, resolve, and manage W3C Decentralized Identifiers backed by Ed25519 keys.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Create */}
        <Card className="lg:col-span-2">
          <CardHeader title="Create a DID" subtitle="did:key is self-contained; did:web anchors to a domain you control." />
          <div className="space-y-4 px-5 pb-5">
            <div className="grid grid-cols-2 gap-2">
              {(["key", "web"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition-all ${
                    method === m
                      ? "border-orbit-400/60 bg-orbit-500/15 text-orbit-300"
                      : "border-white/10 text-ink-500 hover:border-white/25 hover:text-ink-300"
                  }`}
                >
                  {m === "key" ? <KeyRound size={14} /> : <Globe size={14} />} did:{m}
                </button>
              ))}
            </div>
            {method === "web" && (
              <>
                <Field label="Domain">
                  <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="orbis.id" />
                </Field>
                <Field label="Path (optional)" hint="e.g. issuer/main → did:web:orbis.id:issuer:main">
                  <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="issuer/main" />
                </Field>
              </>
            )}
            <Button onClick={handleCreate} loading={creating} className="w-full">
              Generate identifier
            </Button>
            {createError && <ErrorNote message={createError} />}
            {created && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                  <Mono value={created.did} />
                  <CopyButton value={created.did} />
                </div>
                {created._debug?.publicKey && (
                  <p className="text-[11px] leading-4 text-ink-500">
                    Public key (dev): <span className="font-mono">{created._debug.publicKey.slice(0, 24)}…</span>
                  </p>
                )}
                <CodeBlock data={created.didDocument} maxHeight="14rem" />
              </div>
            )}
          </div>
        </Card>

        {/* Resolver */}
        <Card className="lg:col-span-3">
          <CardHeader title="Resolve a DID" subtitle="Look up any stored DID and inspect its DID Document." />
          <div className="space-y-4 px-5 pb-5">
            <div className="flex gap-2">
              <Input
                value={resolveInput}
                onChange={(e) => setResolveInput(e.target.value)}
                placeholder="did:key:z6Mk…"
                className="font-mono !text-[12px]"
                onKeyDown={(e) => e.key === "Enter" && handleResolve()}
              />
              <Button onClick={() => handleResolve()} loading={resolving} variant="outline">
                <Search size={14} /> Resolve
              </Button>
            </div>
            {resolveError && <ErrorNote message={resolveError} />}
            {resolved ? (
              <CodeBlock data={resolved} maxHeight="24rem" />
            ) : (
              !resolveError && <EmptyState title="No document loaded" hint="Paste a DID above, or click one in the table below." />
            )}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader
          title={`Stored identifiers ${list.data ? `(${list.data.count})` : ""}`}
          subtitle="All DIDs registered with this ORBIS node."
        />
        <div className="px-5 pb-5">
          {list.error && <ErrorNote message={list.error} />}
          {list.data && list.data.dids.length === 0 && (
            <EmptyState title="No identifiers yet" hint="Generate your first DID with the form above." />
          )}
          {list.data && list.data.dids.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                    <th className="py-2.5 pr-4">DID</th>
                    <th className="py-2.5 pr-4">Method</th>
                    <th className="py-2.5 pr-4">Created</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {list.data.dids.map((d) => (
                    <tr key={d.id} className="group">
                      <td className="py-3 pr-4">
                        <button
                          className="text-left hover:underline decoration-orbit-400/50 underline-offset-4"
                          onClick={() => handleResolve(d.did)}
                          title="Resolve this DID"
                        >
                          <Mono value={d.did} />
                        </button>
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-ink-300">did:{d.method}</td>
                      <td className="py-3 pr-4 text-[12px] text-ink-500">{new Date(d.created_at).toLocaleString()}</td>
                      <td className="py-3 pr-4"><StatusPill status={d.status} /></td>
                      <td className="py-3 text-right">
                        {d.status === "active" && (
                          <button
                            onClick={() => handleRevoke(d.id)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-red-300/80 opacity-0 transition-all hover:bg-red-500/12 hover:text-red-300 group-hover:opacity-100"
                          >
                            <ShieldOff size={12} /> Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
