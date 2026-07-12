import { Puzzle, ExternalLink, CheckSquare, Shield, Webhook, Wallet, Server } from "lucide-react";
import { Card, CardHeader, CodeBlock } from "../../components/ui";

const WEBHOOK_EXAMPLE = `// Webhook payload format (POST)
{
  "event": "credential.issued",
  "credential_id": "abc123...",
  "issuer_did": "did:key:z6Mk...",
  "subject_did": "did:key:z6Mk...",
  "type": ["VerifiableCredential", "IdentityCredential"],
  "timestamp": "2026-07-10T12:00:00Z"
}

// Register a webhook
curl -X POST https://api.orbis.id/api/gateway/webhooks \\
  -H "Authorization: Bearer orb_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://my-app.com/webhooks/orbis",
    "events": ["credential.issued", "credential.verified"]
  }'`;

const CHECKLIST = [
  { step: "Register an account", done: true, detail: "Create your developer account on the ORBIS.ID platform." },
  { step: "Generate an API key", done: true, detail: "Get your API key from the Developer console. Save it securely." },
  { step: "Choose integration method", done: false, detail: "REST API, SDK (JS/Python), or DIDComm messaging." },
  { step: "Implement DID creation", done: false, detail: "Generate did:key or did:web for identity operations." },
  { step: "Issue test credentials", done: false, detail: "Use the test suite to verify issuance flows." },
  { step: "Configure webhooks", done: false, detail: "Set up webhook endpoints for credential event notifications." },
  { step: "Production deployment", done: false, detail: "Switch to production API keys and verify trust registry." },
];

export default function AdminIntegrations() {
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold text-ink">Integrations</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">Guides and resources for integrating with the ORBIS.ID SSI platform.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card seam className="p-5">
          <div className="flex items-center gap-3 mb-3"><span className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2 text-indigo-400"><Server size={16} /></span><h3 className="text-[13.5px] font-semibold text-ink">REST API Integration</h3></div>
          <p className="text-[12.5px] leading-5 text-ink-3 mb-3">Direct HTTP integration with the ORBIS.ID SSI backend. All functionality is available via REST endpoints.</p>
          <ul className="space-y-1 text-[12px] text-ink-2">
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> DID management (create, resolve, revoke)</li>
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> VC issuance and verification</li>
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> Trust registry queries</li>
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> ZK selective disclosure proofs</li>
          </ul>
        </Card>
        <Card seam className="p-5">
          <div className="flex items-center gap-3 mb-3"><span className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2 text-cyan-400"><Wallet size={16} /></span><h3 className="text-[13.5px] font-semibold text-ink">Wallet Integration</h3></div>
          <p className="text-[12.5px] leading-5 text-ink-3 mb-3">Integrate identity wallets with the SSI platform for credential management.</p>
          <ul className="space-y-1 text-[12px] text-ink-2">
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> DIDComm v2 messaging</li>
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> Encrypted message envelopes</li>
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> Credential offer/presentation</li>
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> Out-of-band invitations</li>
          </ul>
        </Card>
        <Card seam className="p-5">
          <div className="flex items-center gap-3 mb-3"><span className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2 text-amber-400"><Shield size={16} /></span><h3 className="text-[13.5px] font-semibold text-ink">3rd Party Wallet Support</h3></div>
          <p className="text-[12.5px] leading-5 text-ink-3 mb-3">Connect with third-party identity wallets and verifiers using W3C standards.</p>
          <ul className="space-y-1 text-[12px] text-ink-2">
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> W3C Verifiable Credential format</li>
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> Ed25519Signature2020 proofs</li>
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> DIDComm v2 compatibility</li>
            <li className="flex items-center gap-2"><CheckSquare size={12} className="text-emerald-400" /> Trust registry validation</li>
          </ul>
        </Card>
      </div>

      <Card><CardHeader title="Webhook Configuration" subtitle="Receive real-time notifications for credential events." icon={<Webhook size={15} />} />
        <div className="p-5 space-y-4">
          <p className="text-[13px] leading-6 text-ink-2">Webhooks deliver HTTP POST requests to your endpoint when credential events occur. Configure webhooks via the gateway API.</p>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[12.5px] text-amber-400">
            <strong>Supported events:</strong> <code className="font-mono">credential.issued</code>, <code className="font-mono">credential.verified</code>, <code className="font-mono">credential.revoked</code>, <code className="font-mono">did.created</code>
          </div>
          <CodeBlock data={WEBHOOK_EXAMPLE} maxHeight="18rem" />
        </div>
      </Card>

      <Card><CardHeader title="Integration Checklist" subtitle="Step-by-step guide to a complete integration." icon={<CheckSquare size={15} />} />
        <div className="p-5 space-y-3">
          {CHECKLIST.map((item, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-lg p-4 ${item.done ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-[var(--color-surface-2)]/50 border border-[var(--color-line)]"}`}>
              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${item.done ? "bg-emerald-500/20 text-emerald-400" : "bg-[var(--color-surface-3)] text-ink-3"}`}>{i + 1}</div>
              <div><p className="text-[13px] font-medium text-ink">{item.step}</p><p className="mt-0.5 text-[12px] text-ink-3">{item.detail}</p></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
