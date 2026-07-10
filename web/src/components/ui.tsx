import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Copy, Check, Loader2 } from "lucide-react";

// ─── Primitives ──────────────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card rounded-2xl ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div>
        <h3 className="font-display text-[15px] font-semibold text-ink-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, className = "", children, disabled, ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-orbit-400";
  const variants: Record<string, string> = {
    primary:
      "bg-orbit-500 text-white hover:bg-orbit-400 active:scale-[0.98] shadow-[0_0_20px_rgba(57,135,229,0.25)]",
    ghost: "text-ink-300 hover:text-ink-100 hover:bg-white/5",
    outline: "border border-white/15 text-ink-100 hover:border-orbit-400/60 hover:bg-orbit-500/10",
    danger: "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-white/10 bg-space-900 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500/60 focus:border-orbit-400/70 focus:outline-none focus:ring-2 focus:ring-orbit-500/20 ${props.className || ""}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-white/10 bg-space-900 px-3 py-2 font-mono text-[12px] leading-5 text-ink-100 placeholder:text-ink-500/60 focus:border-orbit-400/70 focus:outline-none focus:ring-2 focus:ring-orbit-500/20 ${props.className || ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-white/10 bg-space-900 px-3 py-2 text-[13px] text-ink-100 focus:border-orbit-400/70 focus:outline-none ${props.className || ""}`}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium tracking-wide text-ink-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-500">{hint}</span>}
    </label>
  );
}

// ─── Status ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  ok: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  revoked: "bg-red-500/12 text-red-300 border-red-500/25",
  expired: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  suspended: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  deactivated: "bg-slate-500/12 text-slate-300 border-slate-500/25",
  sent: "bg-orbit-500/12 text-orbit-300 border-orbit-500/25",
  delivered: "bg-aurora-400/12 text-aurora-400 border-aurora-400/25",
  read: "bg-slate-500/12 text-slate-300 border-slate-500/25",
};

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "bg-slate-500/12 text-slate-300 border-slate-500/25";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function CheckRow({ check }: { check: { name: string; passed: boolean; message: string } }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/8 bg-space-900/60 px-3.5 py-2.5">
      {check.passed ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
      ) : (
        <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
      )}
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold capitalize text-ink-100">{check.name.replace(/-/g, " ")}</p>
        <p className="text-[12px] leading-5 text-ink-500">{check.message}</p>
      </div>
    </div>
  );
}

// ─── Mono / code display ─────────────────────────────────────────────────────

export function Mono({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`font-mono text-[11.5px] text-ink-300 ${className}`} title={value}>
      {value.length > 42 ? `${value.slice(0, 26)}…${value.slice(-10)}` : value}
    </span>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-white/8 hover:text-ink-100"
      title="Copy"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

export function CodeBlock({ data, maxHeight = "22rem" }: { data: unknown; maxHeight?: string }) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div className="relative rounded-xl border border-white/10 bg-[#080d18]">
      <div className="absolute right-1.5 top-1.5 z-10">
        <CopyButton value={text} />
      </div>
      <pre className="overflow-auto p-4 font-mono text-[11.5px] leading-[1.65] text-[#9fc1ea]" style={{ maxHeight }}>
        {text}
      </pre>
    </div>
  );
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-200">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 py-10 text-center">
      <p className="text-[13px] font-medium text-ink-300">{title}</p>
      {hint && <p className="text-[12px] text-ink-500">{hint}</p>}
    </div>
  );
}

// ─── Stat tile (dataviz: hero-number form) ───────────────────────────────────

export function StatTile({ label, value, detail, accent = "text-ink-100" }: { label: string; value: ReactNode; detail?: string; accent?: string }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className={`mt-1.5 font-display text-[28px] font-bold leading-none tabular-nums ${accent}`}>{value}</p>
      {detail && <p className="mt-1.5 text-[12px] text-ink-500">{detail}</p>}
    </Card>
  );
}

// ─── Async data hook ─────────────────────────────────────────────────────────

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
