import { Code2, ExternalLink, Terminal, FileJson, BookOpen, Mail } from "lucide-react";
import { Card, CardHeader, CodeBlock } from "../../components/ui";

const CURL_EXAMPLE = `# Create a DID
curl -X POST https://api.orbis.id/api/did/create \\
  -H "Authorization: Bearer orb_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"method":"key"}'

# Issue a credential
curl -X POST https://api.orbis.id/api/vc/issue \\
  -H "Authorization: Bearer orb_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "issuerDID": "did:key:z6Mk...",
    "issuerSecretKey": "a1b2c3...",
    "subjectDID": "did:key:z6Mk...",
    "claims": {"name": "Alice"},
    "type": ["VerifiableCredential", "IdentityCredential"]
  }'

# Verify a credential
curl -X POST https://api.orbis.id/api/vc/verify \\
  -H "Authorization: Bearer orb_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"credential": { ... signed credential JSON ... }}'`;

const JS_EXAMPLE = `// Install: npm install @orbis-id/sdk
import { OrbisClient } from '@orbis-id/sdk';

const client = new OrbisClient({
  apiKey: 'orb_xxxxxxxx',
});

// Create a DID
const { did, didDocument } = await client.did.create('key');
console.log('Created DID:', did);

// Issue a credential
const { credential } = await client.vc.issue({
  issuerDID: did,
  claims: { name: 'Alice', email: 'alice@example.com' },
});
console.log('Credential:', credential);`;

const PYTHON_EXAMPLE = `# Install: pip install orbisid-sdk
from orbisid import OrbisClient

client = OrbisClient(api_key="orb_xxxxxxxx")

# Create a DID
result = client.did.create(method="key")
print(f"Created DID: {result.did}")

# Issue a verifiable credential
vc = client.vc.issue(
    issuer_did=result.did,
    claims={"name": "Alice", "email": "alice@example.com"},
)
print(f"Credential ID: {vc.credential_id}")`;

export default function AdminDevelopers() {
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold text-ink">Developer Support</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">Resources, examples, and tools for building on ORBIS.ID.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <a href="/test.html" target="_blank" className="panel seam group flex items-start gap-3.5 rounded-xl p-5 transition-colors hover:border-[var(--color-line-2)]">
          <span className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2.5 text-emerald-400"><Terminal size={17} strokeWidth={1.8} /></span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[13.5px] font-medium text-ink">End-to-end test page <ExternalLink size={13} className="text-ink-3" /></p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-3">Interactive test suite for DID creation, VC issuance, and verification.</p>
          </div>
        </a>
        <a href="/api/openapi.json" target="_blank" className="panel seam group flex items-start gap-3.5 rounded-xl p-5 transition-colors hover:border-[var(--color-line-2)]">
          <span className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2.5 text-indigo-400"><FileJson size={17} strokeWidth={1.8} /></span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[13.5px] font-medium text-ink">OpenAPI 3.1 Spec <ExternalLink size={13} className="text-ink-3" /></p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-3">Machine-readable API specification for code generation.</p>
          </div>
        </a>
        <a href="/docs" className="panel seam group flex items-start gap-3.5 rounded-xl p-5 transition-colors hover:border-[var(--color-line-2)]">
          <span className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2.5 text-cyan-400"><BookOpen size={17} strokeWidth={1.8} /></span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[13.5px] font-medium text-ink">Developer Docs <ExternalLink size={13} className="text-ink-3" /></p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-3">Full documentation portal with integration guides.</p>
          </div>
        </a>
      </div>

      <Card><CardHeader title="API Base URL" subtitle="All endpoints are relative to this base URL." icon={<Code2 size={15} />} />
        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-[var(--color-line-2)] bg-[rgba(77,124,255,0.08)] px-4 py-3 font-mono text-[14px] text-[var(--color-accent-hi)]">https://api.orbis.id</div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[12.5px] text-amber-400">
            <strong>Authentication:</strong> All API requests require an <code className="font-mono text-[12px]">Authorization: Bearer orb_xxxxxxxx</code> header. Generate an API key from the Developer console.
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader title="cURL" icon={<Terminal size={15} />} /><div className="p-4"><CodeBlock data={CURL_EXAMPLE} maxHeight="22rem" /></div></Card>
        <Card><CardHeader title="JavaScript / TypeScript" icon={<Code2 size={15} />} /><div className="p-4"><CodeBlock data={JS_EXAMPLE} maxHeight="22rem" /></div></Card>
        <Card><CardHeader title="Python" icon={<Code2 size={15} />} /><div className="p-4"><CodeBlock data={PYTHON_EXAMPLE} maxHeight="22rem" /></div></Card>
      </div>

      <Card><CardHeader title="Support" icon={<Mail size={15} />} />
        <div className="p-5 space-y-3 text-[13px] text-ink-2">
          <p>For developer support and API questions:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Email: <span className="font-mono text-[var(--color-accent-hi)]">developers@orbis.id</span></li>
            <li>Documentation: <span className="font-mono text-[var(--color-accent-hi)]">docs.orbis.id</span></li>
            <li>GitHub: <span className="font-mono text-[var(--color-accent-hi)]">github.com/orbisid</span></li>
            <li>Status: <span className="font-mono text-[var(--color-accent-hi)]">status.orbis.id</span></li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
