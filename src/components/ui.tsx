import type { ReactNode } from "react";
import clsx from "clsx";

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-secondary">{description}</p>}
    </div>
  );
}

export function Card({ children, className, title, subtitle }: { children: ReactNode; className?: string; title?: string; subtitle?: string }) {
  return (
    <div className={clsx("rounded-xl border border-border-strong bg-surface p-4 md:p-5", className)}>
      {title && (
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  delta,
  deltaLabel,
  deltaGood,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaLabel?: string;
  deltaGood?: boolean;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={clsx("rounded-xl border border-border-strong bg-surface p-4 transition-all duration-300", className)}>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={clsx("mt-1.5 text-2xl font-semibold tabular-nums text-ink", valueClassName)}>{value}</p>
      {delta && (
        <p className={clsx("mt-1 text-xs font-medium", deltaGood ? "text-status-good" : "text-status-critical")}>
          {delta} {deltaLabel && <span className="text-ink-muted font-normal">{deltaLabel}</span>}
        </p>
      )}
    </div>
  );
}

type StatusVariant = "good" | "warning" | "serious" | "critical" | "neutral";

const STATUS_STYLES: Record<StatusVariant, string> = {
  good: "bg-status-good/10 text-status-good",
  warning: "bg-status-warning/15 text-[#8a5a00]",
  serious: "bg-status-serious/15 text-[#9c4322]",
  critical: "bg-status-critical/10 text-status-critical",
  neutral: "bg-ink-muted/10 text-ink-secondary",
};

export function StatusBadge({ label, variant, icon }: { label: string; variant: StatusVariant; icon?: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[variant])}>
      {icon}
      {label}
    </span>
  );
}

export function riskVariant(level: "Low" | "Medium" | "High" | "Critical"): StatusVariant {
  if (level === "Critical") return "critical";
  if (level === "High") return "serious";
  if (level === "Medium") return "warning";
  return "good";
}
