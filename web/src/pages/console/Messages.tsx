import { useState } from "react";
import { Send, Inbox, Radio, Link2 } from "lucide-react";
import { api, type DIDCommMessage } from "../../lib/api";
import {
  Card, CardHeader, Button, Input, TextArea, Field, StatusPill, Mono,
  CodeBlock, ErrorNote, EmptyState, CopyButton,
} from "../../components/ui";

export default function Messages() {
  // send
  const [fromDID, setFromDID] = useState("");
  const [toDID, setToDID] = useState("");
  const [senderKey, setSenderKey] = useState("");
  const [bodyText, setBodyText] = useState('{ "content": "Hello from ORBIS" }');
  const [sending, setSending] = useState(false);
  const [sendOk, setSendOk] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // inbox
  const [inboxDID, setInboxDID] = useState("");
  const [messages, setMessages] = useState<DIDCommMessage[] | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  // oob
  const [oobFrom, setOobFrom] = useState("");
  const [oobLabel, setOobLabel] = useState("ORBIS connection invitation");
  const [oobUrl, setOobUrl] = useState<string | null>(null);
  const [oobError, setOobError] = useState<string | null>(null);
  const [oobCreating, setOobCreating] = useState(false);

  async function handleSend(ping = false) {
    setSending(true);
    setSendError(null);
    setSendOk(null);
    try {
      let res;
      if (ping) {
        res = await api.didcomm.trustPing({ fromDID, toDID, senderSecretKey: senderKey.trim() });
      } else {
        const body = JSON.parse(bodyText);
        res = await api.didcomm.send({ fromDID, toDID, body, senderSecretKey: senderKey.trim() });
      }
      setSendOk(`Message ${res.messageId} ${ping ? "(trust ping) " : ""}sent — encrypted end-to-end.`);
    } catch (e) {
      setSendError(e instanceof SyntaxError ? "Body must be valid JSON." : (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function loadInbox() {
    if (!inboxDID) return;
    setInboxLoading(true);
    setInboxError(null);
    try {
      const res = await api.didcomm.inbox(inboxDID);
      setMessages(res.messages);
    } catch (e) {
      setInboxError((e as Error).message);
    } finally {
      setInboxLoading(false);
    }
  }

  async function handleOob() {
    setOobCreating(true);
    setOobError(null);
    setOobUrl(null);
    try {
      const res = await api.didcomm.oobCreate({ fromDID: oobFrom, label: oobLabel });
      setOobUrl(res.invitationUrl);
    } catch (e) {
      setOobError((e as Error).message);
    } finally {
      setOobCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[24px] font-bold text-ink-100">Messages</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">
          DIDComm v2 — end-to-end encrypted messaging addressed by DID, not by phone number or email.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Send */}
        <Card>
          <CardHeader title="Send an encrypted message" subtitle="Authcrypt envelope: the recipient can authenticate the sender." />
          <div className="space-y-4 px-5 pb-5">
            <Field label="From DID">
              <Input value={fromDID} onChange={(e) => setFromDID(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" />
            </Field>
            <Field label="To DID">
              <Input value={toDID} onChange={(e) => setToDID(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" />
            </Field>
            <Field label="Sender secret key (hex)">
              <Input value={senderKey} onChange={(e) => setSenderKey(e.target.value)} type="password" className="font-mono !text-[12px]" />
            </Field>
            <Field label="Message body (JSON)">
              <TextArea rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button onClick={() => handleSend(false)} loading={sending} className="flex-1">
                <Send size={14} /> Send message
              </Button>
              <Button variant="outline" onClick={() => handleSend(true)} disabled={sending}>
                <Radio size={14} /> Trust ping
              </Button>
            </div>
            {sendError && <ErrorNote message={sendError} />}
            {sendOk && (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3.5 py-2.5 text-[12.5px] text-emerald-300">{sendOk}</p>
            )}
          </div>
        </Card>

        {/* OOB */}
        <Card>
          <CardHeader title="Out-of-band invitation" subtitle="Create a connection invitation URL to share over any channel." />
          <div className="space-y-4 px-5 pb-5">
            <Field label="Inviter DID">
              <Input value={oobFrom} onChange={(e) => setOobFrom(e.target.value)} placeholder="did:key:z6Mk…" className="font-mono !text-[12px]" />
            </Field>
            <Field label="Label">
              <Input value={oobLabel} onChange={(e) => setOobLabel(e.target.value)} />
            </Field>
            <Button onClick={handleOob} loading={oobCreating} className="w-full">
              <Link2 size={14} /> Create invitation
            </Button>
            {oobError && <ErrorNote message={oobError} />}
            {oobUrl && (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-space-900 px-3 py-2.5">
                <span className="break-all font-mono text-[11px] leading-5 text-ink-300">{oobUrl}</span>
                <CopyButton value={oobUrl} />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Inbox */}
      <Card>
        <CardHeader title="Inbox" subtitle="Retrieve messages addressed to a DID." />
        <div className="space-y-4 px-5 pb-5">
          <div className="flex gap-2">
            <Input
              value={inboxDID}
              onChange={(e) => setInboxDID(e.target.value)}
              placeholder="did:key:z6Mk… (recipient)"
              className="font-mono !text-[12px]"
              onKeyDown={(e) => e.key === "Enter" && loadInbox()}
            />
            <Button variant="outline" onClick={loadInbox} loading={inboxLoading}>
              <Inbox size={14} /> Load inbox
            </Button>
          </div>
          {inboxError && <ErrorNote message={inboxError} />}
          {messages && messages.length === 0 && <EmptyState title="Inbox is empty" />}
          {messages && messages.length > 0 && (
            <ul className="space-y-2.5">
              {messages.map((m) => (
                <li key={m.id} className="rounded-xl border border-white/8 bg-space-900/60 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[12px] text-ink-500">
                      <Mono value={m.from_did} /> → <Mono value={m.to_did} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-ink-500">{new Date(m.created_at).toLocaleString()}</span>
                      <StatusPill status={m.status} />
                    </div>
                  </div>
                  <p className="mb-2 font-mono text-[10.5px] text-ink-500">{m.msg_type}</p>
                  <CodeBlock data={m.body} maxHeight="10rem" />
                </li>
              ))}
            </ul>
          )}
          {!messages && !inboxError && (
            <EmptyState title="No inbox loaded" hint="Enter a recipient DID to fetch its encrypted messages." />
          )}
        </div>
      </Card>
    </div>
  );
}
