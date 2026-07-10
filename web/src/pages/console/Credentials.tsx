import { useState } from "react";
import { Plus, Trash2, BadgeCheck, EyeOff, RefreshCcw, FileBadge2 } from "lucide-react";
import { api, type VerificationCheck } from "../../lib/api";
import {
  Card, CardHeader, Button, Input, TextArea, Field, StatusPill, Mono,
  CodeBlock, CheckRow, ErrorNote, EmptyState, Table, Checkbox, useAsync,
} from "../../components/ui";

type Tab = "issue" | "verify" | "zk";

function credType(raw: string) {
  try { const t = JSON.parse(raw); return Array.isArray(t) ? (t.filter((x: string) => x !== "VerifiableCredential").join(", ") || "VerifiableCredential") : raw; }
  catch { return raw; }
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [{ id: "issue", label: "Issue" }, { id: "verify", label: "Verify" }, { id: "zk", label: "ZK Proofs" }];
  return (
    <div className="inline-flex rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] p-0.5">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className={`focusable rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${tab === t.id ? "bg-[var(--color-surface-3)] text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ClaimsEditor({ claims, setClaims }: { claims: [string, string][]; setClaims: (c: [string, string][]) => void }) {
  return (
    <div className="space-y-2">
      {claims.map(([k, v], i) => (
        <div key={i} className="flex gap-2">
          <Input value={k} placeholder="claim" onChange={(e) => setClaims(claims.map((c, j) => j === i ? [e.target.value, c[1]] : c))} />
          <Input value={v} placeholder="value" onChange={(e) => setClaims(claims.map((c, j) => j === i ? [c[0], e.target.value] : c))} />
          <button onClick={() => setClaims(claims.filter((_, j) => j !== i))} className="focusable shrink-0 rounded-lg border border-[var(--color-line-2)] px-2.5 text-ink-3 hover:border-[rgba(229,100,95,0.4)] hover:text-[#ffb0ad]" aria-label="Remove"><Trash2 size={13} /></button>
        </div>
      ))}
      <button onClick={() => setClaims([...claims, ["", ""]])} className="focusable inline-flex items-center gap-1.5 rounded text-[12px] font-medium text-[var(--color-accent-hi)] hover:text-ink"><Plus size={13} /> Add claim</button>
    </div>
  );
}

function VerifyResult({ verified, checks }: { verified: boolean; checks: VerificationCheck[] }) {
  return (
    <div className="space-y-2.5">
      <div className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 ${verified ? "border-[rgba(53,192,122,0.28)] bg-[rgba(53,192,122,0.08)] text-[#7fe0ac]" : "border-[rgba(229,100,95,0.28)] bg-[rgba(229,100,95,0.08)] text-[#ffb0ad]"}`}>
        <BadgeCheck size={17} /><span className="text-[13.5px] font-semibold">{verified ? "Credential verified" : "Verification failed"}</span>
      </div>
      {checks.map((c) => <CheckRow key={c.name + c.message} check={c} />)}
    </div>
  );
}

export default function Credentials() {
  const [tab, setTab] = useState<Tab>("issue");
  const list = useAsync(() => api.vc.list(), []);

  const [issuerDID, setIssuerDID] = useState("");
  const [issuerKey, setIssuerKey] = useState("");
  const [subjectDID, setSubjectDID] = useState("");
  const [credTypeInput, setCredTypeInput] = useState("IdentityCredential");
  const [claims, setClaims] = useState<[string, string][]>([["name", ""]]);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<Record<string, unknown> | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  const [verifyJson, setVerifyJson] = useState("");
  const [checkTrust, setCheckTrust] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; checks: VerificationCheck[] } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [zkCredJson, setZkCredJson] = useState("");
  const [holderDID, setHolderDID] = useState("");
  const [holderKey, setHolderKey] = useState("");
  const [hideFields, setHideFields] = useState("");
  const [zkProving, setZkProving] = useState(false);
  const [zkProof, setZkProof] = useState<Record<string, unknown> | null>(null);
  const [zkError, setZkError] = useState<string | null>(null);
  const [zkVerifyResult, setZkVerifyResult] = useState<{ verified: boolean; checks: VerificationCheck[] } | null>(null);

  async function handleIssue() {
    setIssuing(true); setIssueError(null); setIssued(null);
    try {
      const claimObj = Object.fromEntries(claims.filter(([k]) => k.trim()));
      const res = await api.vc.issue({ issuerDID, issuerSecretKey: issuerKey.trim(), subjectDID, claims: claimObj, type: ["VerifiableCredential", ...(credTypeInput.trim() ? [credTypeInput.trim()] : [])] });
      setIssued(res.credential); list.reload();
    } catch (e) { setIssueError((e as Error).message); } finally { setIssuing(false); }
  }

  async function handleVerify() {
    setVerifying(true); setVerifyError(null); setVerifyResult(null);
    try { const credential = JSON.parse(verifyJson); const res = await api.vc.verify({ credential, checkTrustRegistry: checkTrust }); setVerifyResult({ verified: res.verified, checks: res.checks }); }
    catch (e) { setVerifyError(e instanceof SyntaxError ? "Invalid JSON — paste the full signed credential." : (e as Error).message); } finally { setVerifying(false); }
  }

  async function handleZkProve() {
    setZkProving(true); setZkError(null); setZkProof(null); setZkVerifyResult(null);
    try {
      const credential = JSON.parse(zkCredJson);
      const res = await api.vc.zkProve({ credential, holderDID, holderSecretKey: holderKey.trim(), hideFields: hideFields.split(",").map(s => s.trim()).filter(Boolean) });
      setZkProof(res.proof);
    } catch (e) { setZkError(e instanceof SyntaxError ? "Invalid JSON — paste the full signed credential." : (e as Error).message); } finally { setZkProving(false); }
  }

  async function handleZkVerify() {
    if (!zkProof) return;
    setZkError(null);
    try { const res = await api.vc.zkVerify({ proof: zkProof }); setZkVerifyResult({ verified: res.verified, checks: res.checks }); }
    catch (e) { setZkError((e as Error).message); }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Credentials</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">Issue, verify, and selectively disclose W3C Verifiable Credentials.</p>
        </div>
        <TabBar tab={tab} setTab={setTab} />
      </div>

      {tab === "issue" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Issue a credential" subtitle="Signed with Ed25519Signature2020 by the issuer's key." />
            <div className="space-y-4 p-5">
              <Field label="Issuer DID" hint="Create one on Identifiers — its dev public key pairs with the secret key you hold."><Input value={issuerDID} onChange={(e) => setIssuerDID(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" /></Field>
              <Field label="Issuer secret key (hex, 32 bytes)"><Input value={issuerKey} onChange={(e) => setIssuerKey(e.target.value)} placeholder="a1b2c3…" type="password" className="font-mono !text-[12px]" /></Field>
              <Field label="Subject DID"><Input value={subjectDID} onChange={(e) => setSubjectDID(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" /></Field>
              <Field label="Credential type"><Input value={credTypeInput} onChange={(e) => setCredTypeInput(e.target.value)} placeholder="IdentityCredential" /></Field>
              <Field label="Claims"><ClaimsEditor claims={claims} setClaims={setClaims} /></Field>
              <Button onClick={handleIssue} loading={issuing} className="w-full">Issue credential</Button>
              {issueError && <ErrorNote message={issueError} />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Signed credential" subtitle="The issued VC, ready to hand to its subject." />
            <div className="p-5">{issued ? <CodeBlock data={issued} maxHeight="30rem" /> : <EmptyState title="Nothing issued yet" hint="Fill in the form and issue a credential." icon={<FileBadge2 size={20} />} />}</div>
          </Card>
        </div>
      )}

      {tab === "verify" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Verify a credential" subtitle="Checks structure, expiration, issuer DID, and proof signature." />
            <div className="space-y-4 p-5">
              <Field label="Credential JSON"><TextArea rows={14} value={verifyJson} onChange={(e) => setVerifyJson(e.target.value)} placeholder='{ "@context": […], "proof": { … } }' /></Field>
              <Checkbox checked={checkTrust} onChange={setCheckTrust} label="Also check issuer against the trust registry" />
              <Button onClick={handleVerify} loading={verifying} className="w-full">Run verification</Button>
              {verifyError && <ErrorNote message={verifyError} />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Verification result" />
            <div className="p-5">{verifyResult ? <VerifyResult verified={verifyResult.verified} checks={verifyResult.checks} /> : <EmptyState title="No verification run" hint="Paste a signed credential and run verification." icon={<BadgeCheck size={20} />} />}</div>
          </Card>
        </div>
      )}

      {tab === "zk" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Create a selective-disclosure proof" subtitle="Hide fields; verifiers see commitments, not values." />
            <div className="space-y-4 p-5">
              <Field label="Signed credential JSON"><TextArea rows={8} value={zkCredJson} onChange={(e) => setZkCredJson(e.target.value)} placeholder='{ "@context": […], "proof": { … } }' /></Field>
              <Field label="Holder DID"><Input value={holderDID} onChange={(e) => setHolderDID(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" /></Field>
              <Field label="Holder secret key (hex)"><Input value={holderKey} onChange={(e) => setHolderKey(e.target.value)} type="password" className="font-mono !text-[12px]" /></Field>
              <Field label="Fields to hide" hint="Comma-separated claim names, e.g. dateOfBirth, email"><Input value={hideFields} onChange={(e) => setHideFields(e.target.value)} placeholder="dateOfBirth, email" /></Field>
              <Button onClick={handleZkProve} loading={zkProving} className="w-full"><EyeOff size={14} /> Create ZK proof</Button>
              {zkError && <ErrorNote message={zkError} />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Proof & verification" action={zkProof ? <Button variant="secondary" size="sm" onClick={handleZkVerify}><RefreshCcw size={13} /> Verify proof</Button> : undefined} />
            <div className="space-y-4 p-5">
              {zkVerifyResult && <VerifyResult verified={zkVerifyResult.verified} checks={zkVerifyResult.checks} />}
              {zkProof ? <CodeBlock data={zkProof} maxHeight="22rem" /> : <EmptyState title="No proof created" hint="Create a proof from a signed credential to inspect and verify it." icon={<EyeOff size={20} />} />}
            </div>
          </Card>
        </div>
      )}

      {/* Ledger */}
      <Card>
        <CardHeader title={`Issued credentials${list.data ? ` · ${list.data.count}` : ""}`} subtitle="Metadata ledger — credential contents never leave the holder." />
        <div className="p-2">
          {list.error && <div className="p-3"><ErrorNote message={list.error} /></div>}
          {list.data && list.data.credentials.length === 0 && <div className="p-3"><EmptyState title="No credentials issued yet" icon={<FileBadge2 size={20} />} /></div>}
          {list.data && list.data.credentials.length > 0 && (
            <div className="px-3 pb-1">
              <Table head={<><th className="py-2.5 pr-4">Type</th><th className="py-2.5 pr-4">Issuer</th><th className="py-2.5 pr-4">Subject</th><th className="py-2.5 pr-4">Issued</th><th className="py-2.5">Status</th></>}>
                {list.data.credentials.map((c) => (
                  <tr key={c.credential_id}>
                    <td className="py-3 pr-4 text-[12.5px] font-medium text-ink">{credType(c.type)}</td>
                    <td className="py-3 pr-4"><Mono value={c.issuer_did} /></td>
                    <td className="py-3 pr-4"><Mono value={c.subject_did} /></td>
                    <td className="py-3 pr-4 text-[12px] text-ink-3">{new Date(c.issuance_date).toLocaleString()}</td>
                    <td className="py-3"><StatusPill status={c.status} /></td>
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
