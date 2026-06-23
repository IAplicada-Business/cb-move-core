import { cn } from "@/lib/utils";
import type { CobrancaStatus, NfStatus } from "@/lib/types";

const COBRANCA: Record<CobrancaStatus, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100" },
  pago:     { label: "Pago",     cls: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" },
  atrasado: { label: "Atrasado", cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]" },
  cancelado:{ label: "Cancelado",cls: "bg-muted text-muted-foreground border-border" },
};

const NF: Record<NfStatus, { label: string; cls: string }> = {
  pendente:  { label: "Pendente",  cls: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100" },
  emitida:   { label: "Emitida",   cls: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({
  kind = "cobranca",
  value,
}: {
  kind?: "cobranca" | "nf";
  value: CobrancaStatus | NfStatus;
}) {
  const cfg = kind === "nf" ? NF[value as NfStatus] : COBRANCA[value as CobrancaStatus];
  if (!cfg) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  );
}
