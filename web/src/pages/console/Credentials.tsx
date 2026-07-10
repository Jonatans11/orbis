import { useState } from "react";
import { Plus, Trash2, BadgeCheck, EyeOff, RefreshCcw } from "lucide-react";
import { api, type VerificationCheck } from "../../lib/api";
import {
  Card, CardHeader, Button, Input, TextArea, Field, StatusPill, Mono,
  CodeBlock, CheckRow, ErrorNote, EmptyState, useAsync,
} from "../../components/ui";

type Tab = "issue" | "verify" | "zk";

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "issue", label: "Issue" },
    { id: "verify", label: "Verify" },
    { id: "zk", label: "ZK Proofs" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-space-900 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`rounded-lg px-4 py-1.5 text-[12.5px] font-semibold transition-all ${
            tab === t.id ? "bg-orbit-500/20 text-orbit-300" : "text-ink-500 hover:text-ink-300"
          }`}
        >
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
          <Input
            value={k}
            placeholder="claim (e.g. name)"
            onChange={(e) => setClaims(claims.map((c, j) => (j === i ? [e.target.value, c[1]] : c)))}
          />
          <Input
            value={v}
            placeholder="value"
            onChange={(e) => setClaims(claims.map((c, j) => (j === i ? [c[0], e.target.value] : c)))}
          />
          <button
            onClick={() => setClaims(claims.filter((_, j) => j !== i))}
            className="shrink-0 rounded-lg border border-white/10 px-2.5 text-ink-500 hover:border-red-500/40 hover:text-red-300"
            aria-label="Remove claim"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => setClaims([...claims, ["", ""]])}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-orbit-300 hover:text-orbit-400"
      >
        <Plus size={13} /> Add claim
      </button>
    </div>
  );
}

function VerifyResult({ verified, checks }: { verified: boolean; checks: VerificationCheck[] }) {
  return (
    <div className="space-y-2.5">
      <div
        className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${
          verified
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-red-500/30 bg-red-500/10 text-red-300"
        }`}
      >
        <BadgeCheck size={18} />
        <span className="text-[14px] font-semibold">{verified ? "Credential verified" : "Verification failed"}</span>
      </div>
      {checks.map((c) => (
        <CheckRow key={c.name + c.message} check={c} />
      ))}
    </div>
  );
}

export default function Credentials() {
  const [tab, setTab] = useState<Tab>("issue");
  const list = useAsync(() => api.vc.list(), []);

  // ── Issue state
  const [issuerDID, setIssuerDID] = useState("");
  const [issuerKey, setIssuerKey] = useState("");
  const [subjectDID, setSubjectDID] = useState("");
  const [credType, setCredType] = useState("IdentityCredential");
  const [claims, setClaims] = useState<[string, string][]>([["name", ""]]);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<Record<string, unknown> | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  // ── Verify state
  const [verifyJson, setVerifyJson] = useState("");
  const [checkTrust, setCheckTrust] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; checks: VerificationCheck[] } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // ── ZK state
  const [zkCredJson, setZkCredJson] = useState("");
  const [holderDID, setHolderDID] = useState("");
  const [holderKey, setHolderKey] = useState("");
  const [hideFields, setHideFields] = useState("");
  const [zkProving, setZkProving] = useState(false);
  const [zkProof, setZkProof] = useState<Record<string, unknown> | null>(null);
  const [zkError, setZkError] = useState<string | null>(null);
  const [zkVerifyResult, setZkVerifyResult] = useState<{ verified: boolean; checks: VerificationCheck[] } | null>(null);

  async function handleIssue() {
    setIssuing(true);
    setIssueError(null);
    setIssued(null);
    try {
      const claimObj = Object.fromEntries(claims.filter(([k]) => k.trim()));
      const res = await api.vc.issue({
        issuerDID,
        issuerSecretKey: issuerKey.trim(),
        subjectDID,
        claims: claimObj,
        type: ["VerifiableCredential", ...(credType.trim() ? [credType.trim()] : [])],
      });
      setIssued(res.credential);
      list.reload();
    } catch (e) {
      setIssueError((e as Error).message);
    } finally {
      setIssuing(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const credential = JSON.parse(verifyJson);
      const res = await api.vc.verify({ credential, checkTrustRegistry: checkTrust });
      setVerifyResult({ verified: res.verified, checks: res.checks });
    } catch (e) {
      setVerifyError(e instanceof SyntaxError ? "Invalid JSON — paste the full signed credential." : (e as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleZkProve() {
    setZkProving(true);
    setZkError(null);
    setZkProof(null);
    setZkVerifyResult(null);
    try {
      const credential = JSON.parse(zkCredJson);
      const res = await api.vc.zkProve({
        credential,
        holderDID,
        holderSecretKey: holderKey.trim(),
        hideFields: hideFields.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setZkProof(res.proof);
    } catch (e) {
      setZkError(e instanceof SyntaxError ? "Invalid JSON — paste the full signed credential." : (e as Error).message);
    } finally {
      setZkProving(false);
    }
  }

  async function handleZkVerify() {
    if (!zkProof) return;
    setZkError(null);
    try {
      const res = await api.vc.zkVerify({ proof: zkProof });
      setZkVerifyResult({ verified: res.verified, checks: res.checks });
    } catch (e) {
      setZkError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-bold text-ink-100">Credentials</h1>
          <p className="mt-1 text-[13.5px] text-ink-500">
            Issue, verify, and selectively disclose W3C Verifiable Credentials.
          </p>
        </div>
        <TabBar tab={tab} setTab={setTab} />
      </div>

      {tab === "issue" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Issue a credential" subtitle="Signed with Ed25519Signature2020 by the issuer's key." />
            <div className="space-y-4 px-5 pb-5">
              <Field label="Issuer DID" hint="Create one on the Identifiers page — its dev public key pairs with the secret key you hold.">
                <Input value={issuerDID} onChange={(e) => setIssuerDID(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" />
              </Field>
              <Field label="Issuer secret key (hex, 32 bytes)">
                <Input value={issuerKey} onChange={(e) => setIssuerKey(e.target.value)} placeholder="a1b2c3…" type="password" className="font-mono !text-[12px]" />
              </Field>
              <Field label="Subject DID">
                <Input value={subjectDID} onChange={(e) => setSubjectDID(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" />
              </Field>
              <Field label="Credential type">
                <Input value={credType} onChange={(e) => setCredType(e.target.value)} placeholder="IdentityCredential" />
              </Field>
              <Field label="Claims">
                <ClaimsEditor claims={claims} setClaims={setClaims} />
              </Field>
              <Button onClick={handleIssue} loading={issuing} className="w-full">Issue credential</Button>
              {issueError && <ErrorNote message={issueError} />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Signed credential" subtitle="The issued VC, ready to hand to its subject." />
            <div className="px-5 pb-5">
              {issued ? (
                <CodeBlock data={issued} maxHeight="30rem" />
              ) : (
                <EmptyState title="Nothing issued yet" hint="Fill in the form and issue a credential to see it here." />
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "verify" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Verify a credential" subtitle="Checks structure, expiration, issuer DID, and proof signature." />
            <div className="space-y-4 px-5 pb-5">
              <Field label="Credential JSON">
                <TextArea rows={14} value={verifyJson} onChange={(e) => setVerifyJson(e.target.value)} placeholder='{ "@context": […], "proof": { … } }' />
              </Field>
              <label className="flex items-center gap-2.5 text-[13px] text-ink-300">
                <input
                  type="checkbox"
                  checked={checkTrust}
                  onChange={(e) => setCheckTrust(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-space-900 accent-[#3987e5]"
                />
                Also check issuer against the trust registry
              </label>
              <Button onClick={handleVerify} loading={verifying} className="w-full">Run verification</Button>
              {verifyError && <ErrorNote message={verifyError} />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Verification result" />
            <div className="px-5 pb-5">
              {verifyResult ? (
                <VerifyResult verified={verifyResult.verified} checks={verifyResult.checks} />
              ) : (
                <EmptyState title="No verification run" hint="Paste a signed credential and run verification." />
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "zk" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Create a selective-disclosure proof"
              subtitle="Hide fields from the credential; verifiers see commitments, not values."
            />
            <div className="space-y-4 px-5 pb-5">
              <Field label="Signed credential JSON">
                <TextArea rows={8} value={zkCredJson} onChange={(e) => setZkCredJson(e.target.value)} placeholder='{ "@context": […], "proof": { … } }' />
              </Field>
              <Field label="Holder DID">
                <Input value={holderDID} onChange={(e) => setHolderDID(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" />
              </Field>
              <Field label="Holder secret key (hex)">
                <Input value={holderKey} onChange={(e) => setHolderKey(e.target.value)} type="password" className="font-mono !text-[12px]" />
              </Field>
              <Field label="Fields to hide" hint="Comma-separated claim names, e.g. dateOfBirth, email">
                <Input value={hideFields} onChange={(e) => setHideFields(e.target.value)} placeholder="dateOfBirth, email" />
              </Field>
              <Button onClick={handleZkProve} loading={zkProving} className="w-full">
                <EyeOff size={14} /> Create ZK proof
              </Button>
              {zkError && <ErrorNote message={zkError} />}
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Proof & verification"
              action={
                zkProof ? (
                  <Button variant="outline" onClick={handleZkVerify} className="!px-3 !py-1.5">
                    <RefreshCcw size={13} /> Verify proof
                  </Button>
                ) : undefined
              }
            />
            <div className="space-y-4 px-5 pb-5">
              {zkVerifyResult && <VerifyResult verified={zkVerifyResult.verified} checks={zkVerifyResult.checks} />}
              {zkProof ? (
                <CodeBlock data={zkProof} maxHeight="22rem" />
              ) : (
                <EmptyState title="No proof created" hint="Create a proof from a signed credential to inspect and verify it." />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Ledger */}
      <Card>
        <CardHeader title={`Issued credentials ${list.data ? `(${list.data.count})` : ""}`} subtitle="Metadata ledger — credential contents never leave the holder." />
        <div className="px-5 pb-5">
          {list.error && <ErrorNote message={list.error} />}
          {list.data && list.data.credentials.length === 0 && (
            <EmptyState title="No credentials issued yet" />
          )}
          {list.data && list.data.credentials.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                    <th className="py-2.5 pr-4">Type</th>
                    <th className="py-2.5 pr-4">Issuer</th>
                    <th className="py-2.5 pr-4">Subject</th>
                    <th className="py-2.5 pr-4">Issued</th>
                    <th className="py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {list.data.credentials.map((c) => (
                    <tr key={c.credential_id}>
                      <td className="py-3 pr-4 text-[12.5px] font-medium text-ink-100">
                        {(() => { try { const t = JSON.parse(c.type); return Array.isArray(t) ? t.filter((x: string) => x !== "VerifiableCredential").join(", ") || "VerifiableCredential" : c.type; } catch { return c.type; } })()}
                      </td>
                      <td className="py-3 pr-4"><Mono value={c.issuer_did} /></td>
                      <td className="py-3 pr-4"><Mono value={c.subject_did} /></td>
                      <td className="py-3 pr-4 text-[12px] text-ink-500">{new Date(c.issuance_date).toLocaleString()}</td>
                      <td className="py-3"><StatusPill status={c.status} /></td>
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
