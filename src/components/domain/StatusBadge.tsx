import { cn } from "@/lib/utils";
import type { CobrancaStatus, NfStatus, StatusAgendamento } from "@/lib/types";

const COBRANCA: Record<CobrancaStatus, { label: string; cls: string }> = {
  pendente:                { label: "Pendente",          cls: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100" },
  pago:                    { label: "Pago",              cls: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" },
  atrasado:                { label: "Atrasado",          cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]" },
  vencido:                 { label: "Vencido",           cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]" },
  cancelado:               { label: "Cancelado",         cls: "bg-muted text-muted-foreground border-border" },
  aguardando_convenio:     { label: "Aguard. convênio",  cls: "bg-[#F3F0FF] text-[#6D28D9] border-[#DDD6FE]" },
  aguardando_alvara:       { label: "Aguard. alvará",    cls: "bg-[#F3F0FF] text-[#6D28D9] border-[#DDD6FE]" },
  regularizar_retroativa:  { label: "Regularizar",       cls: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" },
};

const NF: Record<NfStatus, { label: string; cls: string }> = {
  pendente:               { label: "Pendente",           cls: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100" },
  processando:            { label: "Processando",        cls: "bg-[#F3F0FF] text-[#6D28D9] border-[#DDD6FE]" },
  emitida:                { label: "Emitida",            cls: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" },
  cancelada:              { label: "Cancelada",          cls: "bg-muted text-muted-foreground border-border" },
  erro:                   { label: "Erro",               cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]" },
  regularizada_retroativa:{ label: "Regularizada",       cls: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" },
};

const AGENDA: Record<StatusAgendamento, { label: string; cls: string }> = {
  agendado:   { label: "Agendado",   cls: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100" },
  confirmado: { label: "Confirmado", cls: "bg-[#F7FEE7] text-cb-lime border-[#BEF264]" },
  realizado:  { label: "Realizado",  cls: "bg-muted text-muted-foreground border-border" },
  faltou:     { label: "Faltou",     cls: "bg-[#FDF2F8] text-cb-magenta border-[#FBCFE8]" },
  cancelado:  { label: "Cancelado",  cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]" },
  remarcacao: { label: "Remarcação", cls: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" },
};

export function StatusBadge({
  kind = "cobranca",
  value,
}: {
  kind?: "cobranca" | "nf" | "agenda";
  value: CobrancaStatus | NfStatus | StatusAgendamento;
}) {
  const cfg =
    kind === "nf"
      ? NF[value as NfStatus]
      : kind === "agenda"
        ? AGENDA[value as StatusAgendamento]
        : COBRANCA[value as CobrancaStatus];
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
