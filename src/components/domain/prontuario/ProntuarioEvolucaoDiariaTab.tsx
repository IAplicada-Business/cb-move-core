import type { TranscricaoResult } from "@/components/domain/EvolucaoAudioRecorder";
import { ProntuarioAudioBanner } from "@/components/domain/prontuario/ProntuarioAudioBanner";
import { ProntuarioEvolucaoFeedItem } from "@/components/domain/prontuario/ProntuarioEvolucaoFeedItem";
import { MESES_ABREV } from "@/components/domain/prontuario/constants";
import { countEvolucoesMes, filterPorCompetencia } from "@/components/domain/prontuario/utils";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import type { EvolucaoComRelacoes } from "@/lib/queries/prontuario";

type Props = {
  evolucoes: EvolucaoComRelacoes[];
  loading: boolean;
  canEdit: boolean;
  fisioAuthorId: string | null;
  pacienteId: string;
  mesFiltro: number;
  anoFiltro: number;
  assinandoId?: string | null;
  onEdit: (ev: EvolucaoComRelacoes) => void;
  onAssinar?: (ev: EvolucaoComRelacoes) => void;
  onTranscricao: (result: TranscricaoResult) => void;
};

export function ProntuarioEvolucaoDiariaTab({
  evolucoes,
  loading,
  canEdit,
  fisioAuthorId,
  pacienteId,
  mesFiltro,
  anoFiltro,
  assinandoId,
  onEdit,
  onAssinar,
  onTranscricao,
}: Props) {
  const entradasMes = countEvolucoesMes(evolucoes, mesFiltro, anoFiltro);
  const evolucoesFiltradas = filterPorCompetencia(evolucoes, mesFiltro, anoFiltro);
  const mesLabel = `${MESES_ABREV[mesFiltro - 1] ?? ""}/${anoFiltro}`.toUpperCase();

  return (
    <div className="space-y-5">
      <ProntuarioAudioBanner
        pacienteId={pacienteId}
        canEdit={canEdit}
        onTranscricao={onTranscricao}
      />

      <div className="rounded-xl border bg-card px-5 py-2">
        <div className="flex items-center justify-between border-b border-border py-3 mb-1">
          <h2 className="text-base font-semibold text-foreground">Últimas evoluções</h2>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {entradasMes} entradas em {mesLabel}
          </span>
        </div>

        {loading ? (
          <LoadingState />
        ) : evolucoesFiltradas.length === 0 ? (
          <div className="py-8">
            <EmptyState
              title="Nenhuma evolução neste período"
              description={`Não há registros em ${mesLabel}. Altere o mês no calendário ou documente uma nova sessão.`}
            />
          </div>
        ) : (
          <div>
            {evolucoesFiltradas.map((ev) => (
              <ProntuarioEvolucaoFeedItem
                key={ev.id}
                evolucao={ev}
                canEdit={canEdit}
                isAuthor={!!fisioAuthorId && ev.fisioterapeuta_id === fisioAuthorId}
                onEdit={onEdit}
                onAssinar={onAssinar}
                assinando={assinandoId === ev.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
