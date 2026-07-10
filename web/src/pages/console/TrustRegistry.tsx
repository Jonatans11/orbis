import { useState } from "react";
import { ShieldCheck, ShieldQuestion, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { api, type TrustEntry } from "../../lib/api";
import {
  Card, CardHeader, Button, Input, Select, Field, StatusPill, Mono,
  ErrorNote, SuccessNote, EmptyState, Table, useAsync,
} from "../../components/ui";

export default function TrustRegistry() {
  const list = useAsync(() => api.trust.entities(), []);

  const [did, setDid] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("issuer");
  const [types, setTypes] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regOk, setRegOk] = useState(false);

  const [checkDid, setCheckDid] = useState("");
  const [checkResult, setCheckResult] = useState<{ trusted: boolean; entry: TrustEntry | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  async function handleRegister() {
    setRegistering(true); setRegError(null); setRegOk(false);
    try {
      await api.trust.register({ did, name, category, authorizedCredentialTypes: types.split(",").map(s => s.trim()).filter(Boolean) });
      setRegOk(true); setDid(""); setName(""); setTypes(""); list.reload();
    } catch (e) { setRegError((e as Error).message); } finally { setRegistering(false); }
  }

  async function handleCheck() {
    if (!checkDid) return;
    setChecking(true); setCheckError(null); setCheckResult(null);
    try { const res = await api.trust.check(checkDid); setCheckResult({ trusted: res.trusted, entry: res.entry }); }
    catch (e) { setCheckError((e as Error).message); } finally { setChecking(false); }
  }

  async function action(fn: () => Promise<unknown>) { try { await fn(); list.reload(); } catch { /* reload */ } }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Trust Registry</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">The authoritative list of issuers and verifiers the ORBIS network trusts.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Register a trusted entity" subtitle="Authorize a DID to issue or verify credentials on the network." />
          <div className="space-y-4 p-5">
            <Field label="Entity DID"><Input value={did} onChange={(e) => setDid(e.target.value)} placeholder="did:key:z6Mk… or did:web:…" className="font-mono !text-[12px]" /></Field>
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Government of Estonia · e-Residency" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="issuer">Issuer</option><option value="verifier">Verifier</option><option value="both">Both</option></Select></Field>
              <Field label="Authorized types" hint="Comma-separated"><Input value={types} onChange={(e) => setTypes(e.target.value)} placeholder="IdentityCredential" /></Field>
            </div>
            <Button onClick={handleRegister} loading={registering} className="w-full"><ShieldCheck size={14} /> Register entity</Button>
            {regError && <ErrorNote message={regError} />}
            {regOk && <SuccessNote message="Entity registered in the trust registry." />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Check trust status" subtitle="Is a DID currently a trusted issuer on this network?" />
          <div className="space-y-4 p-5">
            <div className="flex gap-2">
              <Input value={checkDid} onChange={(e) => setCheckDid(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" onKeyDown={(e) => e.key === "Enter" && handleCheck()} />
              <Button variant="secondary" onClick={handleCheck} loading={checking}><ShieldQuestion size={14} /> Check</Button>
            </div>
            {checkError && <ErrorNote message={checkError} />}
            {checkResult && (
              <div className={`rounded-lg border px-4 py-3.5 ${checkResult.trusted ? "border-[rgba(53,192,122,0.28)] bg-[rgba(53,192,122,0.07)]" : "border-[rgba(224,168,58,0.28)] bg-[rgba(224,168,58,0.07)]"}`}>
                <p className={`text-[13.5px] font-semibold ${checkResult.trusted ? "text-[#7fe0ac]" : "text-[#f0cd8a]"}`}>{checkResult.trusted ? "Trusted issuer" : "Not trusted"}</p>
                {checkResult.entry ? (
                  <div className="mt-2 space-y-1 text-[12.5px] text-ink-2">
                    <p>{checkResult.entry.name} · <span className="capitalize">{checkResult.entry.category}</span></p>
                    <p className="text-ink-3">Authorized: {checkResult.entry.authorizedCredentialTypes.length ? checkResult.entry.authorizedCredentialTypes.join(", ") : "any type"}</p>
                  </div>
                ) : <p className="mt-1 text-[12.5px] text-ink-3">This DID has no entry in the trust registry.</p>}
              </div>
            )}
            {!checkResult && !checkError && <EmptyState title="No check run" hint="Enter a DID to query the registry." icon={<ShieldQuestion size={20} />} />}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={`Registry entries${list.data ? ` · ${list.data.count}` : ""}`} />
        <div className="p-2">
          {list.error && <div className="p-3"><ErrorNote message={list.error} /></div>}
          {list.data && list.data.entities.length === 0 && <div className="p-3"><EmptyState title="Trust registry is empty" hint="Register your first trusted issuer above." icon={<ShieldCheck size={20} />} /></div>}
          {list.data && list.data.entities.length > 0 && (
            <div className="px-3 pb-1">
              <Table head={<><th className="py-2.5 pr-4">Name</th><th className="py-2.5 pr-4">DID</th><th className="py-2.5 pr-4">Category</th><th className="py-2.5 pr-4">Authorized types</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5 text-right">Actions</th></>}>
                {list.data.entities.map((e) => (
                  <tr key={e.id} className="group">
                    <td className="py-3 pr-4 text-[12.5px] font-medium text-ink">{e.name}</td>
                    <td className="py-3 pr-4"><Mono value={e.did} /></td>
                    <td className="py-3 pr-4 text-[12px] capitalize text-ink-2">{e.category}</td>
                    <td className="py-3 pr-4 text-[12px] text-ink-3">{e.authorizedCredentialTypes.length ? e.authorizedCredentialTypes.join(", ") : "—"}</td>
                    <td className="py-3 pr-4"><StatusPill status={e.status} /></td>
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {e.status === "active" ? (
                          <button onClick={() => action(() => api.trust.suspend(e.id))} className="focusable inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium text-[#f0cd8a]/80 hover:bg-[rgba(224,168,58,0.1)] hover:text-[#f0cd8a]" title="Suspend"><PauseCircle size={12} /> Suspend</button>
                        ) : e.status === "suspended" ? (
                          <button onClick={() => action(() => api.trust.reactivate(e.id))} className="focusable inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium text-[#7fe0ac]/80 hover:bg-[rgba(53,192,122,0.1)] hover:text-[#7fe0ac]" title="Reactivate"><PlayCircle size={12} /> Reactivate</button>
                        ) : null}
                        <button onClick={() => action(() => api.trust.remove(e.id))} className="focusable inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium text-[#e5645f]/80 hover:bg-[rgba(229,100,95,0.1)] hover:text-[#ffb0ad]" title="Remove"><Trash2 size={12} /> Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
