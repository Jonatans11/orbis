import { useState } from "react";
import { Code2, KeySquare, BarChart3, BookOpen, Webhook } from "lucide-react";
import { api, type UsageStats, type ApiKeyInfo, type WebhookInfo } from "../../lib/api";
import {
  Card, CardHeader, Button, Input, Field, Mono, CopyButton, CodeBlock,
  ErrorNote, EmptyState, StatTile, useAsync,
} from "../../components/ui";

const WEBHOOK_EVENTS = ["credential.issued", "credential.verified"] as const;

/** Usage-by-endpoint — single-series horizontal bars, direct value labels. */
function EndpointBars({ byEndpoint }: { byEndpoint: Record<string, number> }) {
  const entries = Object.entries(byEndpoint).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length === 0) return <EmptyState title="No usage recorded yet" hint="Calls made with your API key appear here." icon={<BarChart3 size={20} />} />;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="space-y-3.5" role="img" aria-label="API requests by endpoint">
      {entries.map(([endpoint, count]) => (
        <div key={endpoint} title={`${endpoint}: ${count} request${count === 1 ? "" : "s"}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate font-mono text-[11.5px] text-ink-2">{endpoint}</span>
            <span className="font-mono text-[11.5px] tabular-nums text-ink">{count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${Math.max((count / max) * 100, 2)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Developer() {
  const scopes = useAsync(() => api.gateway.scopes(), []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registering, setRegistering] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [keys, setKeys] = useState<ApiKeyInfo[] | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [loadingPanel, setLoadingPanel] = useState(false);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookInfo[] | null>(null);
  const [whLoading, setWhLoading] = useState(false);
  const [whRegistering, setWhRegistering] = useState(false);
  const [whError, setWhError] = useState<string | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleRegister() {
    setRegistering(true); setRegError(null); setRawKey(null);
    try { const res = await api.gateway.register({ name, email }); setRawKey(res.raw_key); setApiKey(res.raw_key); }
    catch (e) { setRegError((e as Error).message); } finally { setRegistering(false); }
  }

  async function loadPanel() {
    if (!apiKey.trim()) return;
    setLoadingPanel(true); setPanelError(null);
    try {
      const [k, s] = await Promise.all([api.gateway.keys(apiKey.trim()), api.gateway.stats(apiKey.trim())]);
      setKeys(k.keys); setUsage(s.usage);
    } catch (e) { setPanelError((e as Error).message); setKeys(null); setUsage(null); } finally { setLoadingPanel(false); }
  }

  async function loadWebhooks() {
    if (!apiKey.trim()) return;
    setWhLoading(true); setWhError(null);
    try {
      const res = await api.gateway.webhooks.list(apiKey.trim());
      setWebhooks(res.webhooks);
    } catch (e) { setWhError((e as Error).message); setWebhooks(null); } finally { setWhLoading(false); }
  }

  async function handleRegisterWebhook() {
    if (!apiKey.trim() || !webhookUrl.trim() || selectedEvents.length === 0) return;
    setWhRegistering(true); setWhError(null);
    try {
      await api.gateway.webhooks.create(apiKey.trim(), { url: webhookUrl.trim(), events: selectedEvents });
      setWebhookUrl(""); setSelectedEvents([]);
      await loadWebhooks();
    } catch (e) { setWhError((e as Error).message); } finally { setWhRegistering(false); }
  }

  async function handleDeleteWebhook(id: string) {
    if (!apiKey.trim()) return;
    try {
      await api.gateway.webhooks.remove(apiKey.trim(), id);
      setWebhooks((prev) => prev ? prev.filter((w) => w.id !== id) : null);
    } catch (e) { setWhError((e as Error).message); }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) => prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]);
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Developer</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">API keys, usage analytics, webhooks, and scopes for building on the ORBIS SSI gateway.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Get an API key" subtitle="Registers a full-scope developer key. Shown once — save it." />
          <div className="space-y-4 p-5">
            <Field label="Project / developer name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Wallet App" /></Field>
            <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dev@example.com" type="email" /></Field>
            <Button onClick={handleRegister} loading={registering} className="w-full"><KeySquare size={14} /> Create API key</Button>
            {regError && <ErrorNote message={regError} />}
            {rawKey && (
              <div className="rounded-lg border border-[rgba(224,168,58,0.3)] bg-[rgba(224,168,58,0.07)] p-4">
                <p className="mb-2 text-[12px] font-semibold text-[#f0cd8a]">Save this key now — it will not be shown again.</p>
                <div className="flex items-center justify-between gap-2 rounded-md bg-[#06070a] px-3 py-2.5">
                  <span className="break-all font-mono text-[11.5px] text-ink">{rawKey}</span><CopyButton value={rawKey} />
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Scopes & endpoints" subtitle="Every key carries explicit scopes; out-of-scope requests are rejected." />
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-1.5">
              {scopes.data?.scopes.map((s) => (
                <span key={s} className="rounded-md border border-[rgba(77,124,255,0.28)] bg-[rgba(77,124,255,0.08)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-accent-hi)]">{s}</span>
              ))}
              {!scopes.data && <span className="text-[12px] text-ink-3">Loading scopes…</span>}
            </div>
            <CodeBlock maxHeight="15rem" data={`# Authenticate with your key
curl https://api.orbis.id/api/did/list \\
  -H "Authorization: Bearer orb_xxxxxxxx"

# Core endpoints
POST /api/did/create        # mint a did:key / did:web
POST /api/vc/issue          # sign a verifiable credential
POST /api/vc/verify         # run the verification suite
POST /api/vc/zk/prove       # selective-disclosure proof
GET  /api/trust/issuers     # trusted issuer list
POST /api/didcomm/send      # encrypted DIDComm message`} />
            <p className="flex items-center gap-2 text-[12px] text-ink-3"><BookOpen size={13} /> Full OpenAPI 3.1 spec ships in the repo: <span className="font-mono text-ink-2">openapi.yaml</span></p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Usage & keys" subtitle="Paste an API key to inspect its keys, quota, and last-24h usage." />
        <div className="space-y-5 p-5">
          <div className="flex gap-2">
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="orb_…" type="password" className="font-mono !text-[12px]" onKeyDown={(e) => e.key === "Enter" && loadPanel()} />
            <Button variant="secondary" onClick={loadPanel} loading={loadingPanel}><BarChart3 size={14} /> Load stats</Button>
          </div>
          {panelError && <ErrorNote message={panelError} />}

          {usage && (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <StatTile label="Requests (24h)" value={usage.totalRequests} />
                <StatTile label="Success" value={usage.successCount} accent="text-[#7fe0ac]" />
                <StatTile label="Errors" value={usage.errorCount} accent={usage.errorCount > 0 ? "text-[#ffb0ad]" : "text-ink"} />
                <StatTile label="Avg response" value={`${Math.round(usage.avgResponseTimeMs)}ms`} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Requests by endpoint</h4>
                  <EndpointBars byEndpoint={usage.byEndpoint} />
                </div>
                <div>
                  <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Keys on this account</h4>
                  {keys && keys.length > 0 ? (
                    <ul className="space-y-2">
                      {keys.map((k) => (
                        <li key={k.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]/50 px-3.5 py-2.5">
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-ink">{k.name}</p>
                            <p className="text-[11px] text-ink-3">Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleString()}` : " · never used"}</p>
                          </div>
                          <Mono value={k.id} />
                        </li>
                      ))}
                    </ul>
                  ) : <EmptyState title="No keys visible" />}
                </div>
              </div>
            </>
          )}
          {!usage && !panelError && <EmptyState title="No key loaded" hint="Create a key above or paste an existing one to see live usage analytics." icon={<BarChart3 size={20} />} />}
        </div>
      </Card>

      {/* ── Webhooks ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Webhooks"
          subtitle="Register endpoints to receive credential events in real time."
          icon={<Webhook size={16} />}
          action={
            apiKey.trim() ? (
              <Button variant="secondary" size="sm" onClick={loadWebhooks} loading={whLoading}>
                <Webhook size={13} /> Refresh
              </Button>
            ) : undefined
          }
        />
        <div className="space-y-5 p-5">
          {/* Register form */}
          {apiKey.trim() && (
            <div className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)]/30 p-4">
              <h4 className="mb-3 text-[12px] font-medium text-ink-2">Register a webhook</h4>
              <div className="space-y-3">
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-service.com/webhook"
                />
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map((evt) => (
                    <label
                      key={evt}
                      className={`cursor-pointer rounded-md border px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                        selectedEvents.includes(evt)
                          ? "border-[var(--color-accent)] bg-[rgba(77,124,255,0.12)] text-[var(--color-accent-hi)]"
                          : "border-[var(--color-line-2)] text-ink-3 hover:border-ink-2 hover:text-ink-2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selectedEvents.includes(evt)}
                        onChange={() => toggleEvent(evt)}
                      />
                      {evt}
                    </label>
                  ))}
                </div>
                <Button
                  onClick={handleRegisterWebhook}
                  loading={whRegistering}
                  disabled={!webhookUrl.trim() || selectedEvents.length === 0}
                  size="sm"
                >
                  <Webhook size={13} /> Register webhook
                </Button>
              </div>
            </div>
          )}

          {whError && <ErrorNote message={whError} />}

          {/* Webhook list */}
          {webhooks && webhooks.length > 0 ? (
            <div className="space-y-2">
              {webhooks.map((wh) => {
                const eventList = wh.events.split(",");
                return (
                  <div
                    key={wh.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]/50 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-[12px] text-ink">{wh.url}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {eventList.map((evt) => (
                          <span
                            key={evt}
                            className="inline-block rounded-full bg-[rgba(77,124,255,0.1)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--color-accent-hi)]"
                          >
                            {evt}
                          </span>
                        ))}
                        <span className="text-[11px] text-ink-3">
                          {wh.active ? "Active" : "Inactive"} · Created {new Date(wh.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteWebhook(wh.id)}
                      className="shrink-0 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-ink-3 transition-colors hover:bg-red-500/15 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          ) : webhooks && webhooks.length === 0 ? (
            <EmptyState title="No webhooks registered" hint="Register a webhook above to receive credential events." icon={<Webhook size={20} />} />
          ) : !apiKey.trim() ? (
            <EmptyState title="Enter an API key" hint="Paste or create an API key above to manage webhooks." icon={<Webhook size={20} />} />
          ) : null}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-[12px] text-ink-3">
        <span className="flex items-center gap-2"><Code2 size={13} /> The gateway enforces per-key rate limits (token bucket), logs usage for the stats above, and delivers webhooks for credential events.</span>
        <a href="/test.html" target="_blank" className="focusable inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-1.5 font-medium text-ink-2 transition-colors hover:bg-[var(--color-surface-3)] hover:text-ink">
          <Code2 size={13} /> End-to-end test page
        </a>
      </div>
    </div>
  );
}