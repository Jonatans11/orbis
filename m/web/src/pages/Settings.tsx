import { useState, useEffect } from "react";
import { api } from "../lib/api";

export default function Settings() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ version: "unknown" }));
  }, []);

  return (
    <>
      <h1 className="title1 mb-1">Settings</h1>
      <p className="text-muted caption mb-6">Wallet configuration</p>

      <div className="flex flex-col gap-3">
        <div className="card">
          <h2 className="headline mb-3">Security</h2>
          <div className="flex items-center justify-between py-2">
            <span className="body text-secondary">Biometric Auth</span>
            <div className="w-10 h-6 rounded-full bg-[#1A2236] p-0.5">
              <div className="w-[18px] h-[18px] rounded-full bg-[#475569]" />
            </div>
          </div>
          <p className="caption text-muted mt-1">Face ID / fingerprint unlock</p>
        </div>

        <div className="card">
          <h2 className="headline mb-3">Data & Privacy</h2>
          <p className="body text-secondary" style={{ lineHeight: 1.6 }}>
            Your keys, credentials, and personal data are encrypted with AES-256-GCM and stored on-device. On-device key generation is in development; currently keys are generated server-side under strict security controls.
          </p>
        </div>

        <div className="card">
          <h2 className="headline mb-3">App Info</h2>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-muted">Version</span>
              <span className="text-secondary font-mono">1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted">Backend</span>
              <span className="badge badge-success">{health ? `v${health.version}` : "checking..."}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted">Network</span>
              <span className="text-secondary">ORBIS.ID</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: "8px" }}>
          <h2 className="headline mb-3">Links</h2>
          <div className="flex flex-col gap-2">
            <a href="/m/credentials" className="btn-secondary" style={{ justifyContent: "flex-start" }}>View Credentials</a>
            <a href="/docs" target="_blank" className="btn-secondary" style={{ justifyContent: "flex-start" }}>Documentation</a>
            <a href="https://orbis.ctonew.app" target="_blank" className="btn-secondary" style={{ justifyContent: "flex-start" }}>ORBIS.ID Website</a>
          </div>
        </div>
      </div>
    </>
  );
}