import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

// ─── Hero section ────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
      {/* Glow effects using brand halo gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-80 dark:opacity-100"
          style={{ background: "var(--gradient-halo)" }}
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orbis-border/30 bg-orbis-primary/5 px-4 py-1.5 text-xs font-medium text-orbis-primary dark:border-orbis-border/60 dark:text-orbis-accent">
            <span className="h-2 w-2 rounded-full bg-orbis-accent animate-pulse" />
            Self-Sovereign Identity Platform
          </div>

          <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="text-gray-900 dark:text-white">You control</span>
            <br />
            <span className="text-orbis-gradient">your identity</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-600 dark:text-gray-400 sm:text-xl lg:mx-0">
            A member-owned platform where every person and entity controls a single,
            verifiable digital identity — without surveillance, without a central data
            honeypot, and with the ability to prove claims without disclosing personal data.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
            <Link
              to="/wallet"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-orbis-gradient px-8 text-sm font-semibold text-white shadow-lg shadow-orbis-primary/25 transition-all hover:shadow-xl hover:shadow-orbis-primary/30 hover:scale-105"
            >
              Launch Wallet
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#features"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-gray-300 px-8 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-100 dark:border-orbis-border dark:text-gray-300 dark:hover:bg-orbis-surface"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Hero illustration from design team */}
        <div className="hidden lg:block">
          <img
            src="/illustrations/hero-network.svg"
            alt="ORBIS.ID network illustration — your identity at the center of a trusted network"
            className="h-auto w-full max-w-lg mx-auto"
          />
        </div>
      </div>
    </section>
  );
}

// ─── Stats / Trust badges ────────────────────────────────────────────────────
function StatsRow() {
  return (
    <section className="border-y border-gray-200/60 bg-gray-50 dark:border-orbis-border/60 dark:bg-orbis-surface">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="text-center">
            <div className="text-lg font-bold text-orbis-primary dark:text-orbis-accent sm:text-2xl">100%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">User-Owned</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orbis-primary dark:text-orbis-accent sm:text-2xl">ZK Proofs</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">Privacy Preserving</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orbis-primary dark:text-orbis-accent sm:text-2xl">W3C</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">Standards Compliant</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orbis-primary dark:text-orbis-accent sm:text-2xl">Self-Custodied</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">Keys Never Leave</div>
          </div>
        </div>
        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <img src="/components/badge-ssi.svg" alt="Self-Sovereign Identity" className="h-12 w-auto" />
          <img src="/components/badge-w3c.svg" alt="W3C Compliant" className="h-12 w-auto" />
          <img src="/components/badge-encrypted.svg" alt="Encrypted" className="h-12 w-auto" />
          <img src="/components/badge-zero-knowledge.svg" alt="Zero Knowledge" className="h-12 w-auto" />
        </div>
      </div>
    </section>
  );
}

// ─── Features section ────────────────────────────────────────────────────────
const features = [
  {
    illustration: "/illustrations/feature-zk.svg",
    title: "Self-Custodied Identity",
    description: "Your private keys are generated and stored in your browser using Web Crypto API. They never leave your device. You are the sole owner of your digital identity.",
  },
  {
    illustration: "/illustrations/feature-zk.svg",
    title: "Zero-Knowledge Proofs",
    description: "Prove you are over 18, a citizen of a country, or a member of an organization without revealing your birth date, passport number, or any personal data.",
  },
  {
    illustration: "/illustrations/feature-portable.svg",
    title: "Verifiable Credentials",
    description: "Receive and present W3C-compliant verifiable credentials from trusted issuers. Your credentials are cryptographically signed and instantly verifiable.",
  },
  {
    illustration: "/illustrations/feature-member-owned.svg",
    title: "Member Governance",
    description: "As a member-owned cooperative, every identity holder has a voice in platform governance. Share in the economics of the identity network you help build.",
  },
  {
    illustration: "/illustrations/feature-portable.svg",
    title: "Interoperable by Design",
    description: "Built on open W3C standards (DID, VC, DIDComm). Your identity works across ecosystems — not locked into a single vendor's walled garden.",
  },
  {
    illustration: "/illustrations/feature-member-owned.svg",
    title: "Real-Time Verification",
    description: "QR-based instant credential verification. Present your credentials to any verifier with a quick scan — zero configuration, maximum privacy.",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Identity that works{" "}
            <span className="text-orbis-gradient">for you</span>
          </h2>
          <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-400">
            ORBIS.ID puts you in control of your digital identity with a suite of
            privacy-preserving tools built on open standards.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="card-hover group rounded-2xl border border-gray-200/60 bg-white p-6 dark:border-orbis-border/60 dark:bg-orbis-surface"
            >
              <div className="mb-4 flex h-24 w-full items-center justify-center rounded-xl bg-orbis-primary/5 dark:bg-orbis-primary/10">
                <img
                  src={f.illustration}
                  alt=""
                  className="h-16 w-auto opacity-80"
                />
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Tiers section ───────────────────────────────────────────────────────────
const tiers = [
  {
    name: "Basic",
    price: "Free",
    description: "For individuals starting their self-sovereign identity journey.",
    features: [
      "Self-custodied DID",
      "Credential inbox (3 credentials)",
      "Basic verification QR codes",
      "Community governance voting",
    ],
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Verified",
    price: "$5",
    description: "For individuals needing verified credentials and broader use.",
    features: [
      "Everything in Basic",
      "Unlimited credential storage",
      "Government-ID linked verification",
      "Zero-knowledge proof generation",
      "24/7 support",
    ],
    cta: "Go Verified",
    featured: true,
  },
  {
    name: "Premium",
    price: "$15",
    description: "Power users and professionals with advanced identity needs.",
    features: [
      "Everything in Verified",
      "Multi-DID management",
      "DIDComm messaging",
      "Advanced analytics & audit log",
      "Priority support & onboarding",
      "Revenue sharing on data consents",
    ],
    cta: "Go Premium",
    featured: false,
  },
];

function TiersSection() {
  return (
    <section id="tiers" className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Choose your{" "}
            <span className="text-orbis-gradient">identity tier</span>
          </h2>
          <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-400">
            Start free. Upgrade as your identity needs grow. All tiers are
            member-owned — you always control your keys.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl border p-6 ${
                tier.featured
                  ? "border-orbis-primary bg-orbis-primary/5 shadow-xl shadow-orbis-primary/10 dark:border-orbis-accent dark:bg-orbis-primary/10"
                  : "border-gray-200/60 bg-white dark:border-orbis-border/60 dark:bg-orbis-surface"
              }`}
            >
              {tier.featured && (
                <div className="mb-4 inline-block rounded-full bg-orbis-gradient px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {tier.name}
              </h3>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {tier.price}
                </span>
                {tier.price !== "Free" && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
                )}
              </div>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                {tier.description}
              </p>
              <ul className="mb-8 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-orbis-primary dark:text-orbis-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/wallet"
                className={`flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                  tier.featured
                    ? "bg-orbis-gradient text-white shadow-lg shadow-orbis-primary/25 hover:shadow-xl hover:shadow-orbis-primary/30"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-orbis-border dark:text-gray-300 dark:hover:bg-orbis-surface-light"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA section ─────────────────────────────────────────────────────────────
function CtaSection() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <div className="orbis-glow rounded-3xl bg-orbis-dark px-8 py-16 sm:px-16">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to own your identity?
          </h2>
          <p className="mb-8 text-gray-400">
            Join the identity revolution. Your keys, your data, your rules — no
            surveillance, no middlemen, no compromises.
          </p>
          <Link
            to="/wallet"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-orbis-primary shadow-lg transition-all hover:shadow-xl hover:scale-105"
          >
            Create Your Identity
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Page composition ────────────────────────────────────────────────────────
function Home() {
  return (
    <>
      <Hero />
      <StatsRow />
      <FeaturesSection />
      <TiersSection />
      <CtaSection />
    </>
  );
}