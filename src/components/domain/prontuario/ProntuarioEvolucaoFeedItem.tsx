import { Mic } from "lucide-react";

import {
  evolucaoStatus,
  formatDataEvolucao,
  formatHoraSessao,
} from "@/components/domain/prontuario/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EvolucaoComRelacoes } from "@/lib/queries/prontuario";

function SoapRow({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2 text-sm">
      <span className="font-semibold text-foreground">{label}</span>
      <span className="text-foreground/90 whitespace-pre-wrap">{value}</span>
    </div>
  );
}

export function ProntuarioEvolucaoFeedItem({
  evolucao,
  canEdit,
  onEdit,
}: {
  evolucao: EvolucaoComRelacoes;
  canEdit: boolean;
  onEdit: (ev: EvolucaoComRelacoes) => void;
}) {
  const status = evolucaoStatus(evolucao);
  const isRascunho = status === "rascunho";
  const hora = evolucao.created_at
    ? new Date(evolucao.created_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const sessaoLabel = evolucao.sessoes
    ? `${evolucao.sessoes.sigla} ${formatHoraSessao(evolucao.sessoes.hora)}`
    : null;

  const showTranscricaoOnly =
    isRascunho &&
    evolucao.transcricao_raw?.trim() &&
    !evolucao.subjetivo?.trim() &&
    !evolucao.objetivo?.trim() &&
    !evolucao.plano?.trim();

  return (
    <article className="border-b border-border py-5 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatDataEvolucao(evolucao.data)}</span>
          <span>·</span>
          <span>{hora}</span>
          {evolucao.fisioterapeutas?.nome && (
            <>
              <span>·</span>
              <span>{evolucao.fisioterapeutas.nome}</span>
            </>
          )}
          {sessaoLabel && (
            <>
              <span>·</span>
              <span className="font-mono text-xs">{sessaoLabel}</span>
            </>
          )}
          {evolucao.fonte === "audio_ia" && (
            <span className="inline-flex items-center gap-1 text-xs text-cb-cyan-800">
              <Mic className="h-3 w-3" />
              transcrição
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              status === "registrada"
                ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                : "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
            )}
          >
            {status === "registrada" ? "Registrada" : "Rascunho · revisar"}
          </span>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onEdit(evolucao)}
            >
              {isRascunho ? "Estruturar e revisar" : "Editar"}
            </Button>
          )}
        </div>
      </div>

      {showTranscricaoOnly ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Transcrição
          </p>
          <blockquote className="border-l-2 border-cb-cyan-200 pl-4 text-sm italic text-muted-foreground whitespace-pre-wrap">
            &ldquo;{evolucao.transcricao_raw}&rdquo;
          </blockquote>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          <SoapRow label="SUBJETIVO" value={evolucao.subjetivo} />
          <SoapRow label="OBJETIVO" value={evolucao.objetivo} />
          <SoapRow label="PLANO" value={evolucao.plano} />
        </div>
      )}
    </article>
  );
}
