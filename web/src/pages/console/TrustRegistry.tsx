import { useState } from "react";
import { ShieldCheck, ShieldQuestion, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { api, type TrustEntry } from "../../lib/api";
import {
  Card, CardHeader, Button, Input, Select, Field, StatusPill, Mono,
  ErrorNote, EmptyState, useAsync,
} from "../../components/ui";

export default function TrustRegistry() {
  const list = useAsync(() => api.trust.entities(), []);

  // register
  const [did, setDid] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("issuer");
  const [types, setTypes] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regOk, setRegOk] = useState(false);

  // check
  const [checkDid, setCheckDid] = useState("");
  const [checkResult, setCheckResult] = useState<{ trusted: boolean; entry: TrustEntry | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  async function handleRegister() {
    setRegistering(true);
    setRegError(null);
    setRegOk(false);
    try {
      await api.trust.register({
        did,
        name,
        category,
        authorizedCredentialTypes: types.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setRegOk(true);
      setDid("");
      setName("");
      setTypes("");
      list.reload();
    } catch (e) {
      setRegError((e as Error).message);
    } finally {
      setRegistering(false);
    }
  }

  async function handleCheck() {
    if (!checkDid) return;
    setChecking(true);
    setCheckError(null);
    setCheckResult(null);
    try {
      const res = await api.trust.check(checkDid);
      setCheckResult({ trusted: res.trusted, entry: res.entry });
    } catch (e) {
      setCheckError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function action(fn: () => Promise<unknown>) {
    try {
      await fn();
      list.reload();
    } catch {
      /* table reload will surface state */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[24px] font-bold text-ink-100">Trust Registry</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">
          The authoritative list of issuers and verifiers the ORBIS network trusts.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Register */}
        <Card>
          <CardHeader title="Register a trusted entity" subtitle="Authorize a DID to issue or verify credentials on the network." />
          <div className="space-y-4 px-5 pb-5">
            <Field label="Entity DID">
              <Input value={did} onChange={(e) => setDid(e.target.value)} placeholder="did:key:z6Mk… or did:web:…" className="font-mono !text-[12px]" />
            </Field>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Government of Estonia · e-Residency" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="issuer">Issuer</option>
                  <option value="verifier">Verifier</option>
                  <option value="both">Both</option>
                </Select>
              </Field>
              <Field label="Authorized credential types" hint="Comma-separated">
                <Input value={types} onChange={(e) => setTypes(e.target.value)} placeholder="IdentityCredential" />
              </Field>
            </div>
            <Button onClick={handleRegister} loading={registering} className="w-full">
              <ShieldCheck size={14} /> Register entity
            </Button>
            {regError && <ErrorNote message={regError} />}
            {regOk && (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3.5 py-2.5 text-[12.5px] text-emerald-300">
                Entity registered in the trust registry.
              </p>
            )}
          </div>
        </Card>

        {/* Check */}
        <Card>
          <CardHeader title="Check trust status" subtitle="Is a DID currently a trusted issuer on this network?" />
          <div className="space-y-4 px-5 pb-5">
            <div className="flex gap-2">
              <Input
                value={checkDid}
                onChange={(e) => setCheckDid(e.target.value)}
                placeholder="did:key:z6Mk…"
                className="font-mono !text-[12px]"
                onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              />
              <Button variant="outline" onClick={handleCheck} loading={checking}>
                <ShieldQuestion size={14} /> Check
              </Button>
            </div>
            {checkError && <ErrorNote message={checkError} />}
            {checkResult && (
              <div
                className={`rounded-xl border px-4 py-3.5 ${
                  checkResult.trusted
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-amber-500/30 bg-amber-500/10"
                }`}
              >
                <p className={`text-[14px] font-semibold ${checkResult.trusted ? "text-emerald-300" : "text-amber-300"}`}>
                  {checkResult.trusted ? "Trusted issuer" : "Not trusted"}
                </p>
                {checkResult.entry ? (
                  <div className="mt-2 space-y-1 text-[12.5px] text-ink-300">
                    <p>{checkResult.entry.name} · <span className="capitalize">{checkResult.entry.category}</span></p>
                    <p className="text-ink-500">
                      Authorized: {checkResult.entry.authorizedCredentialTypes.length ? checkResult.entry.authorizedCredentialTypes.join(", ") : "any type"}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-[12.5px] text-ink-500">This DID has no entry in the trust registry.</p>
                )}
              </div>
            )}
            {!checkResult && !checkError && (
              <EmptyState title="No check run" hint="Enter a DID to query the registry." />
            )}
          </div>
        </Card>
      </div>

      {/* Entities table */}
      <Card>
        <CardHeader title={`Registry entries ${list.data ? `(${list.data.count})` : ""}`} />
        <div className="px-5 pb-5">
          {list.error && <ErrorNote message={list.error} />}
          {list.data && list.data.entities.length === 0 && (
            <EmptyState title="Trust registry is empty" hint="Register your first trusted issuer above." />
          )}
          {list.data && list.data.entities.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                    <th className="py-2.5 pr-4">Name</th>
                    <th className="py-2.5 pr-4">DID</th>
                    <th className="py-2.5 pr-4">Category</th>
                    <th className="py-2.5 pr-4">Authorized types</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {list.data.entities.map((e) => (
                    <tr key={e.id} className="group">
                      <td className="py-3 pr-4 text-[12.5px] font-medium text-ink-100">{e.name}</td>
                      <td className="py-3 pr-4"><Mono value={e.did} /></td>
                      <td className="py-3 pr-4 text-[12px] capitalize text-ink-300">{e.category}</td>
                      <td className="py-3 pr-4 text-[12px] text-ink-500">
                        {e.authorizedCredentialTypes.length ? e.authorizedCredentialTypes.join(", ") : "—"}
                      </td>
                      <td className="py-3 pr-4"><StatusPill status={e.status} /></td>
                      <td className="py-3 text-right">
                        <div className="inline-flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {e.status === "active" ? (
                            <button
                              onClick={() => action(() => api.trust.suspend(e.id))}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium text-amber-300/80 hover:bg-amber-500/12 hover:text-amber-300"
                              title="Suspend"
                            >
                              <PauseCircle size={12} /> Suspend
                            </button>
                          ) : e.status === "suspended" ? (
                            <button
                              onClick={() => action(() => api.trust.reactivate(e.id))}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium text-emerald-300/80 hover:bg-emerald-500/12 hover:text-emerald-300"
                              title="Reactivate"
                            >
                              <PlayCircle size={12} /> Reactivate
                            </button>
                          ) : null}
                          <button
                            onClick={() => action(() => api.trust.remove(e.id))}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium text-red-300/80 hover:bg-red-500/12 hover:text-red-300"
                            title="Remove"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
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
