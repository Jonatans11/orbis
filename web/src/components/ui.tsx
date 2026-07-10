import {
  useEffect, useState, type ReactNode, type ButtonHTMLAttributes,
  type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes,
} from "react";
import { Check, Copy, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Surfaces
// ─────────────────────────────────────────────────────────────────────────────

export function Card({ children, className = "", seam = false }: { children: ReactNode; className?: string; seam?: boolean }) {
  return (
    <div className={`panel ${seam ? "seam" : ""} rounded-xl ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-ink-3">{icon}</div>}
        <div>
          <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
          {subtitle && <p className="mt-1 text-[12.5px] leading-5 text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">{children}</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────────────────────

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className = "", children, disabled, ...rest }: ButtonProps) {
  const base =
    "focus-ring relative inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-[-0.01em] transition-all duration-150 disabled:opacity-45 disabled:pointer-events-none select-none";
  const sizes = {
    sm: "px-3 py-1.5 text-[12.5px]",
    md: "px-4 py-2 text-[13px]",
  };
  const variants: Record<string, string> = {
    primary:
      "text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hi)] border border-[rgba(122,160,255,0.3)] shadow-[0_1px_0_rgba(255,255,255,0.14)_inset,0_6px_20px_-6px_rgba(77,124,255,0.6)] active:translate-y-px",
    secondary:
      "text-ink bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-line-2)]",
    ghost: "text-ink-2 hover:text-ink hover:bg-white/[0.05] border border-transparent",
    danger:
      "text-[#ffb4b1] bg-[rgba(229,100,95,0.1)] hover:bg-[rgba(229,100,95,0.18)] border border-[rgba(229,100,95,0.28)]",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form controls
// ─────────────────────────────────────────────────────────────────────────────

const fieldBase =
  "focusable w-full rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-3)] px-3 py-2 text-[13px] text-ink placeholder:text-ink-4 transition-colors focus:border-[rgba(77,124,255,0.55)]";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${props.className || ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldBase} font-mono !text-[12px] leading-5 resize-y ${props.className || ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${fieldBase} appearance-none pr-9 ${props.className || ""}`} />
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-4 text-ink-3">{hint}</span>}
    </label>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2 select-none">
      <span
        onClick={() => onChange(!checked)}
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-all ${
          checked ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-line-2)] bg-[var(--color-surface-3)]"
        }`}
      >
        {checked && <Check size={12} strokeWidth={3} className="text-white" />}
      </span>
      {label}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status + verification
// ─────────────────────────────────────────────────────────────────────────────

const STATUS: Record<string, { dot: string; text: string; bg: string }> = {
  active: { dot: "bg-[var(--color-pos)]", text: "text-[#7fe0ac]", bg: "bg-[rgba(53,192,122,0.1)] border-[rgba(53,192,122,0.22)]" },
  ok: { dot: "bg-[var(--color-pos)]", text: "text-[#7fe0ac]", bg: "bg-[rgba(53,192,122,0.1)] border-[rgba(53,192,122,0.22)]" },
  revoked: { dot: "bg-[var(--color-neg)]", text: "text-[#ffb0ad]", bg: "bg-[rgba(229,100,95,0.1)] border-[rgba(229,100,95,0.22)]" },
  expired: { dot: "bg-[var(--color-warn)]", text: "text-[#f0cd8a]", bg: "bg-[rgba(224,168,58,0.1)] border-[rgba(224,168,58,0.22)]" },
  suspended: { dot: "bg-[var(--color-warn)]", text: "text-[#f0cd8a]", bg: "bg-[rgba(224,168,58,0.1)] border-[rgba(224,168,58,0.22)]" },
  deactivated: { dot: "bg-ink-3", text: "text-ink-2", bg: "bg-white/[0.04] border-[var(--color-line-2)]" },
  sent: { dot: "bg-[var(--color-accent)]", text: "text-[#a9c2ff]", bg: "bg-[rgba(77,124,255,0.1)] border-[rgba(77,124,255,0.22)]" },
  delivered: { dot: "bg-[var(--color-aqua)]", text: "text-[#8fe6da]", bg: "bg-[rgba(53,208,192,0.1)] border-[rgba(53,208,192,0.22)]" },
  read: { dot: "bg-ink-3", text: "text-ink-2", bg: "bg-white/[0.04] border-[var(--color-line-2)]" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] || STATUS.deactivated;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

export function CheckRow({ check }: { check: { name: string; passed: boolean; message: string } }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-3)]/60 px-3.5 py-2.5">
      {check.passed
        ? <CheckCircle2 size={15} className="mt-px shrink-0 text-[var(--color-pos)]" />
        : <XCircle size={15} className="mt-px shrink-0 text-[var(--color-neg)]" />}
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium capitalize text-ink">{check.name.replace(/-/g, " ")}</p>
        <p className="text-[12px] leading-5 text-ink-3">{check.message}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mono / code
// ─────────────────────────────────────────────────────────────────────────────

export function Mono({ value, className = "" }: { value: string; className?: string }) {
  const display = value.length > 40 ? `${value.slice(0, 24)}…${value.slice(-9)}` : value;
  return <span className={`font-mono text-[11.5px] text-ink-2 ${className}`} title={value}>{display}</span>;
}

export function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1300); }}
      className={`focusable rounded-md p-1.5 text-ink-3 transition-colors hover:bg-white/[0.06] hover:text-ink ${className}`}
      title="Copy" aria-label="Copy"
    >
      {copied ? <Check size={13} className="text-[var(--color-pos)]" /> : <Copy size={13} />}
    </button>
  );
}

export function CodeBlock({ data, maxHeight = "22rem" }: { data: unknown; maxHeight?: string }) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--color-line)] bg-[#06070a]">
      <div className="absolute right-2 top-2 z-10"><CopyButton value={text} /></div>
      <pre className="overflow-auto p-4 font-mono text-[11.5px] leading-[1.7] text-[#aebfe0]" style={{ maxHeight }}>{text}</pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback
// ─────────────────────────────────────────────────────────────────────────────

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-[rgba(229,100,95,0.28)] bg-[rgba(229,100,95,0.08)] px-3.5 py-2.5 text-[12.5px] leading-5 text-[#ffb0ad]">
      <AlertTriangle size={14} className="mt-px shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-[rgba(53,192,122,0.26)] bg-[rgba(53,192,122,0.08)] px-3.5 py-2.5 text-[12.5px] leading-5 text-[#7fe0ac]">
      <CheckCircle2 size={14} className="mt-px shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-line-2)] py-10 text-center">
      {icon && <div className="text-ink-4">{icon}</div>}
      <p className="text-[13px] font-medium text-ink-2">{title}</p>
      {hint && <p className="max-w-xs text-[12px] leading-5 text-ink-3">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────────────────────

export function StatTile({ label, value, detail, accent = "text-ink", icon }: { label: string; value: ReactNode; detail?: ReactNode; accent?: string; icon?: ReactNode }) {
  return (
    <Card seam className="px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">{label}</p>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <p className={`mt-2 font-mono text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${accent}`}>{value}</p>
      {detail && <p className="mt-2 text-[12px] text-ink-3">{detail}</p>}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table primitives
// ─────────────────────────────────────────────────────────────────────────────

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">{head}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">{children}</tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Async hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fn().then(d => alive && setData(d)).catch((e: Error) => alive && setError(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, reload: () => setTick(t => t + 1) };
}
