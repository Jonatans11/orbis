import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, KeyRound, FileBadge2, EyeOff, MessagesSquare,
  Users, Landmark, Globe2, Coins, Vote, Lock, Fingerprint,
} from "lucide-react";
import { BrandLink, Mark } from "../components/brand";

// ── Content (ORBIS.ID Global Structure — Executive Summary) ──────────────────

const STATS = [
  { v: "50%", l: "Member economic ownership" },
  { v: "100%", l: "Member control of data privacy" },
  { v: "100B", l: "Orbis Coin total supply" },
  { v: "5", l: "Regional operating hubs" },
];

const PILLARS = [
  { icon: Users, t: "True member ownership", d: "Members own 50% of the operating company, receive quarterly cash distributions, and accumulate long-term wealth in the Liberty Fund." },
  { icon: Landmark, t: "Perpetual structure", d: "A South Dakota Dynasty Trust built for multi-generational operation — creditor-protected and designed to exist in perpetuity." },
  { icon: Globe2, t: "Global by design", d: "Multi-jurisdictional compliance from day one — GDPR, MiCA, CCPA, PIPL — across Europe, Asia, the Americas, the Middle East, and Africa." },
  { icon: Coins, t: "Aligned economics", d: "A fair distribution formula, the native Orbis Coin, and vested Liberty Fund accumulation mean members earn from the platform's success." },
];

const TECH = [
  { icon: KeyRound, t: "Decentralized Identifiers", d: "W3C did:key and did:web with Ed25519 keys — identity you hold, not an account you're granted." },
  { icon: FileBadge2, t: "Verifiable Credentials", d: "Cryptographically signed credentials for identity, finance, education, health, and reputation — verifiable anywhere." },
  { icon: EyeOff, t: "Zero-knowledge proofs", d: "Selective disclosure proves a fact — over 18, licensed, accredited — without revealing the underlying data." },
  { icon: MessagesSquare, t: "DIDComm v2 messaging", d: "End-to-end encrypted, DID-addressed messaging with authenticated envelopes and out-of-band invitations." },
];

const DISTRIBUTION = [
  { pct: 30, l: "Individual activity" },
  { pct: 25, l: "Equal share to all members" },
  { pct: 25, l: "Country transaction volume" },
  { pct: 10, l: "Low-income members" },
  { pct: 10, l: "Country-weighted equity" },
];

const ENTITIES = [
  { n: "ORBIS.ID SSI Trust", s: "South Dakota · IP, governance, 51% coin reserve", tone: "var(--color-iris)" },
  { n: "Global Holdings LLC", s: "Delaware · operating company · 50% member-owned", tone: "var(--color-accent)" },
  { n: "Member Trust", s: "South Dakota · distributions · 100% privacy control", tone: "var(--color-aqua)" },
  { n: "Liberty Fund LP", s: "Delaware · long-term member wealth, vested 5–15 yrs", tone: "var(--color-warn)" },
  { n: "Regional Subsidiaries", s: "Europe · Asia-Pacific · Americas · Middle East · Africa", tone: "var(--color-ink-3)" },
];

const PHASES = [
  { p: "01", y: "Years 1–2", t: "Foundation", d: "US and EU launch, 10M members, first partnerships." },
  { p: "02", y: "Years 3–5", t: "Growth", d: "Asia-Pacific, Middle East, Latin America. 100M members, break-even." },
  { p: "03", y: "Years 6–10", t: "Acceleration", d: "Global presence, 500M members, dominant market position." },
  { p: "04", y: "Years 11+", t: "Maturity", d: "1B+ members — the global standard for identity, in perpetual operation." },
];

const COMPLIANCE = ["GDPR", "MiCA", "CCPA / CPRA", "PIPL", "LGPD", "eIDAS 2.0", "GENIUS Act"];

// ── Fragments ────────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--color-accent-hi)]">{children}</p>;
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink md:text-[38px]">{title}</h2>
      {sub && <p className="mt-4 text-[15px] leading-7 text-ink-3">{sub}</p>}
    </div>
  );
}

function CtaPrimary({ children }: { children: React.ReactNode }) {
  return (
    <Link to="/app" className="focusable group inline-flex items-center gap-2 rounded-lg border border-[rgba(122,160,255,0.32)] bg-[var(--color-accent)] px-5 py-2.5 text-[13.5px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_10px_30px_-8px_rgba(77,124,255,0.6)] transition-all hover:bg-[var(--color-accent-hi)]">
      {children}
      <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-base">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[rgba(8,9,11,0.72)] backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <BrandLink />
          <div className="hidden items-center gap-8 text-[13px] text-ink-2 md:flex">
            <a href="#why" className="focusable rounded transition-colors hover:text-ink">Structure</a>
            <a href="#tech" className="focusable rounded transition-colors hover:text-ink">Technology</a>
            <a href="#members" className="focusable rounded transition-colors hover:text-ink">Members</a>
            <a href="#roadmap" className="focusable rounded transition-colors hover:text-ink">Roadmap</a>
          </div>
          <Link to="/app" className="focusable inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-[var(--color-surface-3)]">
            Launch console <ArrowRight size={13} />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0 h-[560px]" aria-hidden />
        <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(77,124,255,0.14),transparent)]" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-20 text-center md:pt-28">
          <div className="fade-up mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--color-line-2)] bg-[var(--color-surface)]/80 px-3 py-1 text-[12px] text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-aqua)] pulse-dot" />
            Member-owned self-sovereign identity
          </div>
          <h1 className="fade-up d1 text-[42px] font-semibold leading-[1.04] tracking-[-0.04em] text-ink md:text-[66px]">
            Own your identity.
            <br />
            <span className="accent-text">Share the value it creates.</span>
          </h1>
          <p className="fade-up d2 mx-auto mt-6 max-w-xl text-[16px] leading-8 text-ink-2">
            ORBIS.ID is a self-sovereign identity platform structured as a member-owned
            organization — standards-compliant W3C DIDs and Verifiable Credentials,
            democratic governance, and a perpetual trust.
          </p>
          <div className="fade-up d3 mt-9 flex flex-wrap items-center justify-center gap-3">
            <CtaPrimary><Fingerprint size={15} /> Open the identity console</CtaPrimary>
            <a href="#why" className="focusable inline-flex items-center gap-2 rounded-lg border border-[var(--color-line-2)] px-5 py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-white/[0.04]">
              Explore the structure
            </a>
          </div>
        </div>

        {/* API terminal card */}
        <div className="fade-up d4 relative mx-auto -mb-px max-w-3xl px-6">
          <div className="panel seam overflow-hidden rounded-xl">
            <div className="flex items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface-2)]/50 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[rgba(229,100,95,0.7)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[rgba(224,168,58,0.7)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[rgba(53,192,122,0.7)]" />
              <span className="ml-2 font-mono text-[11px] text-ink-3">POST /api/did/create</span>
            </div>
            <pre className="overflow-x-auto bg-[#06070a] p-5 font-mono text-[12px] leading-[1.75] text-[#aebfe0]">
{`$ curl -X POST https://api.orbis.id/api/did/create \\
    -H "Content-Type: application/json" \\
    -d '{ "method": "key" }'

`}<span className="text-[#7fe0ac]">{`{
  "success": true,
  "did": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpb…",
  "didDocument": { "@context": [ "https://www.w3.org/ns/did/v1" ], … }
}`}</span>
            </pre>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)]/40">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-[var(--color-line)] md:grid-cols-4 md:divide-y-0">
          {STATS.map((s) => (
            <div key={s.l} className="px-6 py-7">
              <dd className="font-mono text-[28px] font-semibold tracking-[-0.02em] tabular-nums text-ink">{s.v}</dd>
              <dt className="mt-1.5 text-[12.5px] leading-5 text-ink-3">{s.l}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* Why / Structure */}
      <section id="why" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHead
          eyebrow="Why ORBIS"
          title="Identity, restructured around its owners"
          sub="Unlike corporate-controlled platforms, ORBIS.ID is engineered so the people who create the network's value are the ones who own it."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.t} className="panel seam group rounded-xl p-6 transition-colors hover:border-[var(--color-line-2)]">
              <div className="mb-4 inline-flex rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2.5 text-[var(--color-accent-hi)]">
                <p.icon size={19} strokeWidth={1.7} />
              </div>
              <h3 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">{p.t}</h3>
              <p className="mt-2 text-[13.5px] leading-6 text-ink-3">{p.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Global structure</Eyebrow>
            <h3 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">A perpetual trust, five entities, one purpose</h3>
            <p className="mt-4 text-[14px] leading-7 text-ink-3">
              The SSI Trust holds all intellectual property and perpetual governance authority.
              Global Holdings runs the platform — 50% Member Trust, 49% XFabrix, 1% SSI Trust —
              with regional subsidiaries in the Netherlands, Singapore, Delaware, the UAE, and
              Mauritius. The Liberty Fund compounds long-term member wealth on a sovereign-wealth model.
            </p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {COMPLIANCE.map((c) => (
                <span key={c} className="rounded-md border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11.5px] font-medium text-ink-2">{c}</span>
              ))}
            </div>
          </div>
          <div className="panel rounded-xl p-4">
            {ENTITIES.map((e, i) => (
              <div key={e.n}>
                {i > 0 && <div className="mx-5 h-3 w-px bg-[var(--color-line-2)]" />}
                <div className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]/60 px-4 py-3">
                  <span className="h-8 w-1 rounded-full" style={{ background: e.tone }} />
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">{e.n}</p>
                    <p className="text-[11.5px] text-ink-3">{e.s}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section id="tech" className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead
            eyebrow="Technology"
            title="Standards-based, privacy-first infrastructure"
            sub="Built on W3C DIDs and Verifiable Credentials with Ed25519 cryptography — interoperable with global SSI systems, with no personal data on chain."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TECH.map((t) => (
              <div key={t.t} className="panel seam rounded-xl p-5 transition-colors hover:border-[var(--color-line-2)]">
                <div className="mb-4 inline-flex rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2.5 text-[var(--color-aqua-hi)]">
                  <t.icon size={18} strokeWidth={1.7} />
                </div>
                <h3 className="text-[14.5px] font-semibold text-ink">{t.t}</h3>
                <p className="mt-2 text-[12.5px] leading-6 text-ink-3">{t.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Members */}
      <section id="members" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHead
          eyebrow="Member benefits"
          title="The network's upside, distributed"
          sub="Quarterly distributions flow to members through a formula designed for fairness — with 50% automatically invested in the Liberty Fund, vested over 5–15 years."
        />
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="panel seam rounded-xl p-6 lg:col-span-3">
            <h3 className="text-[14.5px] font-semibold text-ink">Quarterly distribution formula</h3>
            <p className="mb-6 mt-1 text-[12.5px] text-ink-3">Share of Member Trust distributions</p>
            <div className="space-y-4">
              {DISTRIBUTION.map((d) => (
                <div key={d.l}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[12.5px] text-ink-2">{d.l}</span>
                    <span className="font-mono text-[12px] tabular-nums text-ink">{d.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-lo)] to-[var(--color-accent-hi)]" style={{ width: `${(d.pct / 30) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 lg:col-span-2">
            {[
              { icon: Coins, tone: "var(--color-warn)", t: "Orbis Coin", d: "A 100-billion-supply utility token. 50 coins per verified member, a 20% fee discount, governance power, and staking — MiCA & GENIUS Act compliant." },
              { icon: Vote, tone: "var(--color-iris)", t: "Multi-tier democracy", d: "One member, one vote. Elect the Member Trust Board and SSI Trust directors, veto privacy changes, submit proposals." },
              { icon: Lock, tone: "var(--color-aqua)", t: "Data sovereignty", d: "Complete control of personal data: ZK proofs, selective disclosure, local storage, and the right to be forgotten." },
            ].map((c) => (
              <div key={c.t} className="panel rounded-xl p-5">
                <div className="mb-2.5 inline-flex items-center gap-2.5">
                  <span className="inline-flex rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] p-2" style={{ color: c.tone }}>
                    <c.icon size={16} strokeWidth={1.8} />
                  </span>
                  <h3 className="text-[14px] font-semibold text-ink">{c.t}</h3>
                </div>
                <p className="text-[12.5px] leading-6 text-ink-3">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead eyebrow="Roadmap" title="From launch to global standard" />
          <ol className="grid gap-4 md:grid-cols-4">
            {PHASES.map((p) => (
              <li key={p.p} className="panel seam rounded-xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-[22px] font-semibold tracking-[-0.03em] text-[var(--color-accent-hi)]">{p.p}</span>
                  <span className="text-[11px] text-ink-3">{p.y}</span>
                </div>
                <h3 className="text-[14.5px] font-semibold text-ink">{p.t}</h3>
                <p className="mt-1.5 text-[12.5px] leading-6 text-ink-3">{p.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-[var(--color-line)]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(77,124,255,0.12),transparent)]" aria-hidden />
        <div className="relative mx-auto max-w-2xl px-6 py-24 text-center">
          <Mark size={40} className="mx-auto mb-6 drift" />
          <h2 className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[40px]">
            The way digital identity <span className="accent-text">should be</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-ink-3">
            Member-owned rather than corporate-controlled. Perpetual rather than exit-driven.
            Privacy-preserving by design. Try the console against the live ORBIS SSI API.
          </p>
          <div className="mt-8 flex justify-center">
            <CtaPrimary><Fingerprint size={15} /> Launch console</CtaPrimary>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-line)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-[12px] text-ink-3 md:flex-row">
          <BrandLink size={13} markSize={20} />
          <p className="flex items-center gap-1.5">
            © 2026 ORBIS.ID — Global SSI Trust · W3C DIDs · Verifiable Credentials · DIDComm v2
          </p>
          <a href="mailto:info@orbis.id" className="focusable inline-flex items-center gap-1 rounded transition-colors hover:text-ink">
            info@orbis.id <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>
    </div>
  );
}
