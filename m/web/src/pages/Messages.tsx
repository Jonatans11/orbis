export default function Messages() {
  return (
    <>
      <h1 className="title1 mb-1">Messages</h1>
      <p className="text-muted caption mb-6">Secure messaging</p>

      <div className="card text-center py-12" style={{ borderStyle: "dashed" }}>
        <svg className="w-10 h-10 mx-auto mb-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h2 className="headline text-secondary mb-2">Coming Soon</h2>
        <p className="body text-muted max-w-xs mx-auto" style={{ lineHeight: 1.6 }}>
          End-to-end encrypted messaging is in development.
          <br />
          <span className="caption">Peer-to-peer DIDComm messaging with authenticated envelopes will be available in a future release.</span>
        </p>
      </div>
    </>
  );
}