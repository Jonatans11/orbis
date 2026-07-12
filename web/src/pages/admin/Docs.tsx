import { useState, useEffect } from "react";
import { BookOpen, Search, ChevronRight } from "lucide-react";
import { Card, CardHeader, Input } from "../../components/ui";

const DOC_FILES = [
  { id: "ARCHITECTURE", file: "ARCHITECTURE.md", title: "Architecture Overview", desc: "System architecture, components, and data flow." },
  { id: "API-GUIDE", file: "API-GUIDE.md", title: "API Reference Guide", desc: "Complete API reference with request/response examples." },
  { id: "INTEGRATION-GUIDE", file: "INTEGRATION-GUIDE.md", title: "Integration Guide", desc: "How to integrate with ORBIS.ID SSI." },
  { id: "QUICKSTART", file: "QUICKSTART.md", title: "Quickstart", desc: "Get up and running in 5 minutes." },
  { id: "SECURITY-AUDIT", file: "SECURITY-AUDIT.md", title: "Security Audit", desc: "Security analysis and recommendations." },
  { id: "DEPLOYMENT", file: "DEPLOYMENT.md", title: "Deployment Guide", desc: "Production deployment and scaling." },
  { id: "ADMIN-GUIDE", file: "ADMIN-GUIDE.md", title: "Admin Guide", desc: "Admin and operations guide." },
  { id: "WALLET-INTEGRATION", file: "WALLET-INTEGRATION.md", title: "Wallet Integration", desc: "Identity wallet integration guide." },
  { id: "THIRD-PARTY", file: "INTEGRATION-THIRD-PARTY.md", title: "3rd Party Integration", desc: "Third-party service integration." },
  { id: "DEVELOPER-QUICKSTART", file: "DEVELOPER-QUICKSTART.md", title: "Developer Quickstart", desc: "SDK setup and first steps." },
];

export default function AdminDocs() {
  const [selected, setSelected] = useState(DOC_FILES[0]);
  const [content, setContent] = useState<string>("Select a document from the sidebar.");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadDoc(doc: typeof DOC_FILES[0]) {
    setSelected(doc); setLoading(true);
    setContent(`# ${doc.title}\n\n*This document is available in the repository at \`docs/${doc.file}\`.*\n\n*For full rendering, the backend document serving endpoint needs to be connected.*\n\n## Overview\n\n${doc.desc}\n\n### Available Documents\n\nThe ORBIS.ID documentation suite includes:\n\n- **Architecture** — System design, components, data flow\n- **API Reference** — Complete endpoint documentation\n- **Quickstart** — 5-minute getting started tutorial\n- **Integration Guide** — Full integration walkthrough\n- **Wallet Integration** — Identity wallet connection guide\n- **Security Audit** — Security analysis\n- **Deployment** — Production deployment\n- **Admin Guide** — Operations and administration\n- **3rd Party Integration** — External service integration`);
    setLoading(false);
  }

  useEffect(() => { loadDoc(DOC_FILES[0]); }, []);

  const filtered = DOC_FILES.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-[22px] font-semibold text-ink">Documentation</h1><p className="mt-1 text-[13.5px] text-ink-3">Browse the ORBIS.ID technical documentation suite.</p></div>
      </div>
      <div className="relative max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search docs…" className="pl-9" /></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-1">
          {filtered.map(doc => (
            <button key={doc.id} onClick={() => loadDoc(doc)}
              className={`focusable w-full text-left rounded-lg px-4 py-3 transition-colors ${
                selected.id === doc.id ? "bg-amber-500/10 border border-amber-500/20" : "bg-[var(--color-surface-2)]/50 border border-transparent hover:bg-[var(--color-surface-3)]"
              }`}>
              <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-ink">{doc.title}</span><ChevronRight size={14} className="text-ink-3" /></div>
              <p className="mt-0.5 text-[11.5px] text-ink-3">{doc.desc}</p>
            </button>
          ))}
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title={selected.title} subtitle={`docs/${selected.file}`} icon={<BookOpen size={15} />} />
            <div className="max-h-[75vh] overflow-y-auto p-5">
              {loading ? <div className="py-10 text-center text-ink-3">Loading…</div> : (
                <div className="prose prose-invert max-w-none space-y-4">
                  <p className="text-[13px] leading-7 text-ink-2 whitespace-pre-wrap">{content}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
