import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { PacienteTipo } from "@/lib/types";

type BrandBadgeTone =
  | "particular"
  | "judicial"
  | "convenio"
  | "puc"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const TONE_CLS: Record<BrandBadgeTone, string> = {
  particular: "bg-[rgba(45,131,136,0.12)] text-[var(--t-particular)]",
  judicial: "bg-[rgba(217,70,160,0.13)] text-[var(--t-judicial)]",
  convenio: "bg-[rgba(123,79,181,0.13)] text-[var(--t-convenio)]",
  puc: "bg-[rgba(245,138,31,0.15)] text-[var(--t-puc)]",
  success: "bg-[rgba(16,185,129,0.13)] text-[#047857]",
  warning: "bg-[rgba(245,138,31,0.15)] text-[var(--cb-orange)]",
  danger: "bg-[rgba(225,29,72,0.13)] text-[#B91C1C]",
  info: "bg-[rgba(123,79,181,0.13)] text-[var(--cb-purple)]",
  neutral: "bg-muted text-cb-muted",
};

const TIPO_TONE: Record<PacienteTipo, BrandBadgeTone> = {
  particular: "particular",
  judicial: "judicial",
  convenio: "convenio",
  puc: "puc",
};

type BrandBadgeProps = {
  children: ReactNode;
  tone?: BrandBadgeTone;
  className?: string;
};

/**
 * Badge pill uppercase — padrão `.badge` do mockup.
 * Staged — substituir TipoBadge/StatusBadge após autorização.
 */
export function BrandBadge({ children, tone = "neutral", className }: BrandBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
        "text-[10.5px] font-bold uppercase tracking-[0.08em]",
        TONE_CLS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BrandBadgeTipo({ value }: { value: PacienteTipo }) {
  const labels: Record<PacienteTipo, string> = {
    particular: "Particular",
    judicial: "Judicial",
    convenio: "Convênio",
    puc: "PUC",
  };

  return <BrandBadge tone={TIPO_TONE[value]}>{labels[value]}</BrandBadge>;
}
