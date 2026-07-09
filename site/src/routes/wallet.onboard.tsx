import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/wallet/onboard")({
  component: Onboarding,
});

type Tier = "basic" | "verified" | "premium" | "enterprise";
type Step = "intro" | "tier" | "generate" | "complete";

const tierDetails: Record<Tier, { name: string; price: string; color: string; features: string[] }> = {
  basic: {
    name: "Basic",
    price: "Free",
    color: "from-gray-400 to-gray-500",
    features: ["Self-custodied DID", "Credential inbox (3)", "Basic verification QR", "Governance voting"],
  },
  verified: {
    name: "Verified",
    price: "$5/mo",
    color: "from-orbis-primary to-orbis-secondary",
    features: ["Basic features", "Unlimited credentials", "Gov-ID verification", "ZK proof generation"],
  },
  premium: {
    name: "Premium",
    price: "$15/mo",
    color: "from-orbis-secondary to-cyan-400",
    features: ["Verified features", "Multi-DID management", "DIDComm messaging", "Revenue sharing"],
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    color: "from-purple-500 to-orbis-primary",
    features: ["Premium features", "Bulk credential issuance", "Custom integration", "SLA & dedicated support"],
  },
};

function Onboarding() {
  const [step, setStep] = useState<Step>("intro");
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);

  if (step === "intro") {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orbis-gradient shadow-lg shadow-orbis-primary/25">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Create Your ORBIS.ID Identity
          </h1>
          <p className="mb-8 text-gray-600 dark:text-gray-400">
            Your keys are generated in your browser and never leave your device. This is a
            self-custodied identity — only you can control it.
          </p>
          <div className="mb-8 rounded-xl border border-amber-200/60 bg-amber-50 p-4 text-left text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-300">
            <strong>⚠️ Important:</strong> You are creating a self-sovereign identity.
            There is no password reset. If you lose your keys, your identity cannot
            be recovered. Store your recovery phrase securely.
          </div>
          <button
            onClick={() => setStep("tier")}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-orbis-gradient px-8 text-sm font-semibold text-white shadow-lg shadow-orbis-primary/25 transition-all hover:shadow-xl"
          >
            Get Started
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <div className="mt-4">
            <Link to="/wallet" className="text-sm text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              Back to wallet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "tier") {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-4xl">
          {/* Progress */}
          <div className="mb-10 flex items-center justify-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orbis-primary text-xs font-bold text-white">1</span>
            <span className="text-gray-900 dark:text-white">Choose Tier</span>
            <span className="mx-2 text-gray-300">→</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-500 dark:bg-orbis-surface-light dark:text-gray-400">2</span>
            <span className="text-gray-400">Generate</span>
            <span className="mx-2 text-gray-300">→</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-500 dark:bg-orbis-surface-light dark:text-gray-400">3</span>
            <span className="text-gray-400">Complete</span>
          </div>

          <h2 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white">
            Choose Your Membership Tier
          </h2>
          <p className="mb-10 text-center text-gray-600 dark:text-gray-400">
            All tiers are member-owned. You can upgrade or downgrade anytime.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.entries(tierDetails) as [Tier, typeof tierDetails[Tier]][]).map(([key, tier]) => (
              <button
                key={key}
                onClick={() => { setSelectedTier(key); setStep("generate"); }}
                className={`card-hover rounded-2xl border p-5 text-left transition-all ${
                  selectedTier === key
                    ? "border-orbis-primary bg-orbis-primary/5 dark:border-orbis-secondary"
                    : "border-gray-200/60 bg-white dark:border-orbis-border/60 dark:bg-orbis-surface"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tier.name}</h3>
                  <span className="text-sm font-semibold text-orbis-primary dark:text-orbis-secondary">{tier.price}</span>
                </div>
                <ul className="space-y-1.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <svg className="h-3 w-3 shrink-0 text-orbis-primary dark:text-orbis-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === "generate") {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-md text-center">
          {/* Progress */}
          <div className="mb-10 flex items-center justify-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orbis-primary text-xs font-bold text-white">✓</span>
            <span className="text-gray-400">Choose Tier</span>
            <span className="mx-2 text-gray-300">→</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orbis-primary text-xs font-bold text-white">2</span>
            <span className="text-gray-900 dark:text-white">Generate</span>
            <span className="mx-2 text-gray-300">→</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-500 dark:bg-orbis-surface-light dark:text-gray-400">3</span>
            <span className="text-gray-400">Complete</span>
          </div>

          <div className="mx-auto mb-6 flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-orbis-primary/10">
            <svg className="h-10 w-10 text-orbis-primary dark:text-orbis-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            Generate Your Key Pair
          </h2>
          <p className="mb-8 text-gray-600 dark:text-gray-400">
            Your browser will generate a cryptographic key pair using the Web Crypto API.
            Your private key never leaves this device.
          </p>

          <button
            onClick={() => setStep("complete")}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-orbis-gradient px-8 text-sm font-semibold text-white shadow-lg shadow-orbis-primary/25 transition-all hover:shadow-xl"
          >
            Generate Identity
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Complete step
  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-lg text-center">
        {/* Progress */}
        <div className="mb-10 flex items-center justify-center gap-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">✓</span>
          <span className="text-gray-400">Choose Tier</span>
          <span className="mx-2 text-gray-300">→</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">✓</span>
          <span className="text-gray-400">Generate</span>
          <span className="mx-2 text-gray-300">→</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orbis-primary text-xs font-bold text-white">3</span>
          <span className="text-gray-900 dark:text-white">Complete</span>
        </div>

        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
          Identity Created!
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Your did:key identifier has been generated and stored in your browser.
        </p>

        <div className="mb-8 rounded-xl border border-amber-200/60 bg-amber-50 p-4 text-left text-sm dark:border-amber-800/30 dark:bg-amber-900/20">
          <p className="mb-2 font-semibold text-amber-800 dark:text-amber-300">
            🔑 Save Your Recovery Phrase
          </p>
          <p className="text-amber-700 dark:text-amber-400">
            Write down or store the following recovery phrase in a secure location.
            This is the <strong>only</strong> way to recover your identity if you
            lose access to this device.
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-gray-200/60 bg-gray-50 p-4 dark:border-orbis-border/60 dark:bg-orbis-surface">
          <code className="break-all font-mono text-xs text-gray-700 dark:text-gray-300">
            abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid...
          </code>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/wallet"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-orbis-gradient px-6 text-sm font-semibold text-white shadow-lg shadow-orbis-primary/25 transition-all hover:shadow-xl"
          >
            Go to Wallet
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <button
            onClick={() => {/* Copy phrase logic */}}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-gray-300 px-6 text-sm font-semibold text-gray-700 dark:border-orbis-border dark:text-gray-300"
          >
            Copy Phrase
          </button>
        </div>
      </div>
    </div>
  );
}