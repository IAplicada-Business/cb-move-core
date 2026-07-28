import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { classeNfFluxo, labelNfFluxo, type NfFluxoStatus } from "@/lib/domain/cobranca-nf-fluxo";

type Props = {
  fluxo: NfFluxoStatus;
  className?: string;
  showLink?: boolean;
};

export function CobrancaNfFluxoBadge({ fluxo, className, showLink = true }: Props) {
  if (fluxo === "nao_aplica") return null;

  const label = labelNfFluxo(fluxo);
  const cls = classeNfFluxo(fluxo);

  return (
    <div className={cn("rounded-md border px-3 py-2 text-xs", cls, className)}>
      <span className="font-medium">{label}</span>
      {fluxo === "aguardando_nf" && showLink && (
        <>
          {" — emita em "}
          <Link to="/app/notas-fiscais" className="underline font-medium">
            Notas Fiscais
          </Link>
          {" antes de marcar como paga."}
        </>
      )}
      {fluxo === "nf_em_processamento" && (
        <span className="block mt-0.5 opacity-90">
          Aguarde a autorização na Focus ou corrija erros em Notas Fiscais.
        </span>
      )}
      {fluxo === "aguardando_pagamento" && (
        <span className="block mt-0.5 opacity-90">NF emitida — pode registrar o pagamento.</span>
      )}
    </div>
  );
}

export function CobrancaNfFluxoChip({ fluxo }: { fluxo: NfFluxoStatus }) {
  if (fluxo === "nao_aplica") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        classeNfFluxo(fluxo),
      )}
    >
      {labelNfFluxo(fluxo)}
    </span>
  );
}
