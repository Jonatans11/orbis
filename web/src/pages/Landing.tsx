import { Link } from "react-router-dom";
import {
  Fingerprint, Users, Landmark, Coins, Vote, ShieldCheck, Globe2, KeyRound,
  FileBadge2, EyeOff, MessageSquareLock, ArrowRight, Lock, Scale,
} from "lucide-react";

// ─── Content (from the ORBIS.ID Global Structure Executive Summary) ──────────

const STATS = [
  { value: "50%", label: "Member economic ownership" },
  { value: "100%", label: "Member control of data privacy" },
  { value: "100B", label: "Orbis Coin total supply" },
  { value: "5", label: "Regional operating hubs" },
];

const DIFFERENTIATORS = [
  {
    icon: Users,
    title: "True member ownership",
    text: "Members own 50% of the operating company, receive quarterly cash distributions, and accumulate long-term wealth in the Liberty Fund.",
  },
  {
    icon: Landmark,
    title: "Perpetual structure",
    text: "A South Dakota Dynasty Trust designed for multi-generational operation — protected from creditors and built to exist forever.",
  },
  {
    icon: Globe2,
    title: "Global scalability",
    text: "Multi-jurisdictional compliance from day one: GDPR, MiCA, CCPA, PIPL — with regional hubs across Europe, Asia, the Americas, the Middle East, and Africa.",
  },
  {
    icon: Coins,
    title: "Economic benefits",
    text: "Members earn from platform success through a fair distribution formula, the native Orbis Coin, and vested Liberty Fund accumulation.",
  },
];

const TECH = [
  {
    icon: KeyRound,
    title: "Decentralized Identifiers",
    text: "W3C-standard DIDs (did:key and did:web) with Ed25519 keys — identity you hold, not an account someone grants you.",
  },
  {
    icon: FileBadge2,
    title: "Verifiable Credentials",
    text: "Cryptographically signed credentials for identity, finance, education, employment, health, and reputation — verifiable anywhere.",
  },
  {
    icon: EyeOff,
    title: "Zero-knowledge proofs",
    text: "Selective disclosure lets you prove a fact — over 18, licensed, accredited — without revealing the underlying data.",
  },
  {
    icon: MessageSquareLock,
    title: "DIDComm messaging",
    text: "End-to-end encrypted, DID-addressed messaging with authenticated envelopes and out-of-band invitations.",
  },
];

const DISTRIBUTION = [
  { pct: 30, label: "Individual activity" },
  { pct: 25, label: "Equal share to all members" },
  { pct: 25, label: "Country transaction volume" },
  { pct: 10, label: "Low-income members" },
  { pct: 10, label: "Country-weighted equity" },
];

const PHASES = [
  { phase: "Phase 1", years: "Years 1–2", title: "Foundation", text: "US and EU launch, 10M members, first partnerships." },
  { phase: "Phase 2", years: "Years 3–5", title: "Growth", text: "Asia-Pacific, Middle East, Latin America. 100M members, break-even operations." },
  { phase: "Phase 3", years: "Years 6–10", title: "Acceleration", text: "Global presence, 500M members, dominant market position." },
  { phase: "Phase 4", years: "Years 11+", title: "Maturity", text: "1B+ members — the global standard for identity, in perpetual sustainable operation." },
];

const COMPLIANCE = ["GDPR", "MiCA", "CCPA / CPRA", "PIPL", "LGPD", "eIDAS 2.0", "GENIUS Act"];

// ─── Page ────────────────────────────────────────────────────────────────────

function OrbitalHero() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* radial glow */}
      <div className="absolute left-1/2 top-[-20%] h-[720px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(57,135,229,0.16),transparent)]" />
      {/* orbital rings */}
      <svg className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 opacity-45" width="1200" height="1200" viewBox="0 0 1200 1200" fill="none">
        <g className="animate-orbit">
          <ellipse cx="600" cy="600" rx="430" ry="430" stroke="rgba(125,180,240,0.14)" strokeWidth="1" />
          <circle cx="1030" cy="600" r="4" fill="#3987e5" />
        </g>
        <g className="animate-orbit-rev">
          <ellipse cx="600" cy="600" rx="310" ry="310" stroke="rgba(45,212,191,0.12)" strokeWidth="1" />
          <circle cx="600" cy="290" r="3" fill="#2dd4bf" />
        </g>
        <g className="animate-orbit" style={{ animationDuration: "120s" }}>
          <ellipse cx="600" cy="600" rx="560" ry="560" stroke="rgba(144,133,233,0.10)" strokeWidth="1" />
          <circle cx="600" cy="1160" r="3.5" fill="#9085e9" />
        </g>
      </svg>
      {/* star field */}
      <div className="absolute inset-0 bg-[radial-gradient(1.5px_1.5px_at_18%_28%,rgba(234,241,251,0.35),transparent),radial-gradient(1px_1px_at_74%_18%,rgba(234,241,251,0.3),transparent),radial-gradient(1.5px_1.5px_at_86%_60%,rgba(234,241,251,0.25),transparent),radial-gradient(1px_1px_at_32%_74%,rgba(234,241,251,0.28),transparent)]" />
    </div>
  );
}

function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/orbis.svg" width={size} height={size} alt="" />
      <span className="font-display text-[17px] font-bold tracking-tight text-ink-100">
        ORBIS<span className="text-orbit-400">.ID</span>
      </span>
    </span>
  );
}

function SectionTitle({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-orbit-300">{kicker}</p>
      <h2 className="font-display text-[32px] font-bold leading-tight tracking-tight text-ink-100 md:text-[38px]">{title}</h2>
      {text && <p className="mt-4 text-[15px] leading-7 text-ink-500">{text}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen">
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-40 border-b border-white/6 bg-space-950/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#top" aria-label="ORBIS.ID home"><Logo /></a>
          <div className="hidden items-center gap-7 text-[13px] font-medium text-ink-300 md:flex">
            <a className="transition-colors hover:text-ink-100" href="#why">Why ORBIS</a>
            <a className="transition-colors hover:text-ink-100" href="#technology">Technology</a>
            <a className="transition-colors hover:text-ink-100" href="#members">Members</a>
            <a className="transition-colors hover:text-ink-100" href="#roadmap">Roadmap</a>
          </div>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-lg bg-orbit-500 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_0_24px_rgba(57,135,229,0.35)] transition-all hover:bg-orbit-400"
          >
            Launch Console <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      {/* ─── Hero ─── */}
      <section id="top" className="relative overflow-hidden">
        <OrbitalHero />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 text-center md:pt-32">
          <p className="rise-in mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-orbit-500/30 bg-orbit-500/10 px-4 py-1.5 text-[12px] font-medium text-orbit-300">
            <ShieldCheck size={13} /> The member-owned global identity platform
          </p>
          <h1 className="rise-in rise-in-1 mx-auto max-w-4xl font-display text-[44px] font-bold leading-[1.06] tracking-tight text-ink-100 md:text-[68px]">
            Own your identity.
            <br />
            <span className="glow-text">Share the value it creates.</span>
          </h1>
          <p className="rise-in rise-in-2 mx-auto mt-6 max-w-2xl text-[16px] leading-8 text-ink-300">
            ORBIS.ID is a self-sovereign identity platform structured as a member-owned
            organization. Standards-compliant W3C DIDs and Verifiable Credentials, democratic
            governance, and a perpetual trust — where members control their data, benefit
            economically, and govern democratically.
          </p>
          <div className="rise-in rise-in-3 mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-xl bg-orbit-500 px-6 py-3 text-[14px] font-semibold text-white shadow-[0_0_36px_rgba(57,135,229,0.4)] transition-all hover:bg-orbit-400 hover:shadow-[0_0_48px_rgba(57,135,229,0.55)]"
            >
              <Fingerprint size={16} /> Open the Identity Console
            </Link>
            <a
              href="#why"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-[14px] font-semibold text-ink-100 transition-colors hover:border-orbit-400/50 hover:bg-orbit-500/10"
            >
              Explore the structure
            </a>
          </div>

          {/* Stats strip */}
          <dl className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/8 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-space-900/90 px-6 py-6">
                <dd className="font-display text-[30px] font-bold tabular-nums text-ink-100">{s.value}</dd>
                <dt className="mt-1 text-[12px] leading-5 text-ink-500">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ─── Why ORBIS ─── */}
      <section id="why" className="relative border-t border-white/6 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle
            kicker="Why ORBIS"
            title="Identity, restructured around its owners"
            text="Unlike corporate-controlled platforms, ORBIS.ID is designed so that the people who create the network's value are the ones who own it."
          />
          <div className="grid gap-5 md:grid-cols-2">
            {DIFFERENTIATORS.map((d) => (
              <div key={d.title} className="glass group rounded-2xl p-7 transition-all duration-200 hover:border-orbit-400/35 hover:shadow-[0_8px_40px_rgba(57,135,229,0.12)]">
                <div className="mb-4 inline-flex rounded-xl bg-orbit-500/12 p-3 text-orbit-300 transition-colors group-hover:bg-orbit-500/20">
                  <d.icon size={22} strokeWidth={1.8} />
                </div>
                <h3 className="font-display text-[18px] font-semibold text-ink-100">{d.title}</h3>
                <p className="mt-2 text-[13.5px] leading-6 text-ink-500">{d.text}</p>
              </div>
            ))}
          </div>

          {/* Structure */}
          <div className="mt-20 grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-orbit-300">Global structure</p>
              <h3 className="font-display text-[28px] font-bold leading-tight text-ink-100">
                A perpetual trust, five entities, one purpose
              </h3>
              <p className="mt-4 text-[14px] leading-7 text-ink-500">
                The SSI Trust holds all intellectual property and perpetual governance authority.
                Global Holdings runs the platform — owned 50% by the Member Trust, 49% by XFabrix,
                and 1% by the SSI Trust — with regional subsidiaries in the Netherlands, Singapore,
                Delaware, the UAE, and Mauritius. The Liberty Fund accumulates long-term member
                wealth on a sovereign-wealth-fund model.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {COMPLIANCE.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/4 px-3 py-1 text-[11.5px] font-medium text-ink-300">
                    <Scale size={11} className="text-aurora-400" /> {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="card rounded-2xl p-6">
              {[
                { name: "ORBIS.ID SSI Trust", sub: "South Dakota · IP, governance, 51% coin reserve", tone: "border-nova-400/40" },
                { name: "Global Holdings LLC", sub: "Delaware · operating company · 50% member-owned", tone: "border-orbit-400/40" },
                { name: "Member Trust", sub: "South Dakota · distributions · 100% privacy control", tone: "border-aurora-400/40" },
                { name: "Liberty Fund LP", sub: "Delaware · long-term member wealth, vested 5–15 yrs", tone: "border-amber-400/40" },
                { name: "Regional Subsidiaries", sub: "Europe · Asia-Pacific · Americas · Middle East · Africa", tone: "border-white/20" },
              ].map((e, i) => (
                <div key={e.name}>
                  {i > 0 && <div className="mx-auto h-4 w-px bg-white/12" />}
                  <div className={`rounded-xl border-l-2 ${e.tone} bg-space-900/80 px-4 py-3`}>
                    <p className="text-[13.5px] font-semibold text-ink-100">{e.name}</p>
                    <p className="text-[11.5px] text-ink-500">{e.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Technology ─── */}
      <section id="technology" className="relative border-t border-white/6 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle
            kicker="Technology"
            title="Standards-based, privacy-first infrastructure"
            text="Built on W3C DIDs and Verifiable Credentials with Ed25519 cryptography — interoperable with global SSI systems, with no personal data on chain."
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {TECH.map((t) => (
              <div key={t.title} className="card rounded-2xl p-6 transition-all duration-200 hover:border-aurora-400/30">
                <div className="mb-4 inline-flex rounded-xl bg-aurora-400/10 p-2.5 text-aurora-400">
                  <t.icon size={20} strokeWidth={1.8} />
                </div>
                <h3 className="text-[15px] font-semibold text-ink-100">{t.title}</h3>
                <p className="mt-2 text-[12.5px] leading-6 text-ink-500">{t.text}</p>
              </div>
            ))}
          </div>

          {/* live API teaser */}
          <div className="mt-14 overflow-hidden rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 border-b border-white/8 bg-space-900 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-2 font-mono text-[11px] text-ink-500">POST /api/did/create</span>
            </div>
            <pre className="overflow-x-auto bg-[#080d18] p-5 font-mono text-[12px] leading-6 text-[#9fc1ea]">
{`$ curl -X POST https://api.orbis.id/api/did/create \\
    -H "Content-Type: application/json" \\
    -d '{ "method": "key" }'

{
  "success": true,
  "did": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "didDocument": { "@context": ["https://www.w3.org/ns/did/v1"], ... }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* ─── Members ─── */}
      <section id="members" className="relative border-t border-white/6 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle
            kicker="Member benefits"
            title="The network's upside, distributed"
            text="Quarterly distributions flow to members through a formula designed for fairness — with 50% automatically invested in the Liberty Fund and vested over 5–15 years."
          />
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Distribution formula — horizontal bars (magnitude → bar form) */}
            <div className="card rounded-2xl p-7">
              <h3 className="mb-1 font-display text-[16px] font-semibold text-ink-100">Quarterly distribution formula</h3>
              <p className="mb-6 text-[12.5px] text-ink-500">Share of Member Trust distributions</p>
              <div className="space-y-4">
                {DISTRIBUTION.map((d) => (
                  <div key={d.label}>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-[12.5px] font-medium text-ink-300">{d.label}</span>
                      <span className="font-mono text-[12px] tabular-nums text-ink-100">{d.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/6">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orbit-600 to-orbit-400"
                        style={{ width: `${(d.pct / 30) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Orbis Coin + governance */}
            <div className="flex flex-col gap-5">
              <div className="glass rounded-2xl p-7">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-xl bg-amber-400/12 p-2.5 text-amber-300"><Coins size={20} strokeWidth={1.8} /></div>
                  <h3 className="font-display text-[16px] font-semibold text-ink-100">Orbis Coin</h3>
                </div>
                <p className="text-[13px] leading-6 text-ink-500">
                  A 100-billion-supply utility token. 50 coins to each verified member, a 20%
                  discount on transaction fees, governance voting power, and staking for enhanced
                  services — MiCA and GENIUS Act compliant.
                </p>
              </div>
              <div className="glass rounded-2xl p-7">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-xl bg-nova-400/12 p-2.5 text-nova-400"><Vote size={20} strokeWidth={1.8} /></div>
                  <h3 className="font-display text-[16px] font-semibold text-ink-100">Multi-tier democracy</h3>
                </div>
                <p className="text-[13px] leading-6 text-ink-500">
                  One member, one vote. Members elect the Member Trust Board and SSI Trust
                  directors, hold veto power over privacy changes, and submit proposals — from
                  direct voting to representative governance to operational management.
                </p>
              </div>
              <div className="glass rounded-2xl p-7">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-xl bg-aurora-400/12 p-2.5 text-aurora-400"><Lock size={20} strokeWidth={1.8} /></div>
                  <h3 className="font-display text-[16px] font-semibold text-ink-100">Data sovereignty</h3>
                </div>
                <p className="text-[13px] leading-6 text-ink-500">
                  Complete control over personal data: zero-knowledge proofs, selective disclosure,
                  local storage, and the right to be forgotten — GDPR and CCPA compliant by design.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Roadmap ─── */}
      <section id="roadmap" className="relative border-t border-white/6 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle kicker="Roadmap" title="From launch to global standard" />
          <ol className="relative grid gap-6 md:grid-cols-4">
            {PHASES.map((p, i) => (
              <li key={p.phase} className="card relative rounded-2xl p-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold text-orbit-300">{p.phase}</span>
                  <span className="text-[11px] text-ink-500">{p.years}</span>
                </div>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-orbit-500/40 bg-orbit-500/12 font-display text-[13px] font-bold text-orbit-300">
                    {i + 1}
                  </span>
                  <h3 className="font-display text-[16px] font-semibold text-ink-100">{p.title}</h3>
                </div>
                <p className="text-[12.5px] leading-6 text-ink-500">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative border-t border-white/6 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="hairline mb-14" />
          <h2 className="font-display text-[34px] font-bold leading-tight tracking-tight text-ink-100 md:text-[42px]">
            The way digital identity <span className="glow-text">should be</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-ink-500">
            Member-owned rather than corporate-controlled. Perpetual rather than exit-driven.
            Privacy-preserving by design. Try the identity console against the live ORBIS SSI API.
          </p>
          <Link
            to="/app"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-orbit-500 px-7 py-3.5 text-[14px] font-semibold text-white shadow-[0_0_36px_rgba(57,135,229,0.4)] transition-all hover:bg-orbit-400"
          >
            <Fingerprint size={16} /> Launch Console
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-[12px] text-ink-500 md:flex-row">
          <Logo size={22} />
          <p>© 2026 ORBIS.ID — Global SSI Trust. W3C DIDs · Verifiable Credentials · DIDComm v2.</p>
          <a href="mailto:info@orbis.id" className="transition-colors hover:text-ink-100">info@orbis.id</a>
        </div>
      </footer>
    </div>
  );
}
