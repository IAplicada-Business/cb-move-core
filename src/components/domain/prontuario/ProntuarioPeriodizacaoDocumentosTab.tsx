import { PacientePeriodizacaoTab } from "@/components/domain/PacientePeriodizacaoTab";
import { ProntuarioDocumentosTab } from "@/components/domain/prontuario/ProntuarioDocumentosTab";
import { ProntuarioHistoricoStatusTab } from "@/components/domain/prontuario/ProntuarioHistoricoStatusTab";
import type { Paciente } from "@/lib/queries/pacientes";
import type { EvolucaoComRelacoes, RelatorioAtendimento } from "@/lib/queries/prontuario";

type Props = {
  pacienteId: string;
  paciente: Paciente;
  readOnly: boolean;
  avaliacoesCount: number;
  relatorios: RelatorioAtendimento[];
  evolucoes: EvolucaoComRelacoes[];
  loadingRelatorios: boolean;
  loadingEvolucoes: boolean;
  competenciaMes: number;
  competenciaAno: number;
  gerandoRelatorio: boolean;
  finalizandoRelatorioId: string | null;
  onGerarRelatorio: () => void;
  onFinalizarRelatorio: (relatorioId: string) => void;
  onNavigateAvaliacoes: () => void;
  onNavigateEvolucao: () => void;
};

export function ProntuarioPeriodizacaoDocumentosTab({
  pacienteId,
  paciente,
  readOnly,
  avaliacoesCount,
  relatorios,
  evolucoes,
  loadingRelatorios,
  loadingEvolucoes,
  competenciaMes,
  competenciaAno,
  gerandoRelatorio,
  finalizandoRelatorioId,
  onGerarRelatorio,
  onFinalizarRelatorio,
  onNavigateAvaliacoes,
  onNavigateEvolucao,
}: Props) {
  return (
    <div className="space-y-8">
      <PacientePeriodizacaoTab
        pacienteId={pacienteId}
        paciente={paciente}
        readOnly={readOnly}
        avaliacoesCount={avaliacoesCount}
        onNavigateTab={(tab) => {
          if (tab === "avaliacoes") onNavigateAvaliacoes();
        }}
      />

      <ProntuarioDocumentosTab
        pacienteId={pacienteId}
        relatorios={relatorios}
        loading={loadingRelatorios}
        canEdit={!readOnly}
        competenciaMes={competenciaMes}
        competenciaAno={competenciaAno}
        gerando={gerandoRelatorio}
        onGerar={onGerarRelatorio}
        onFinalizar={onFinalizarRelatorio}
        finalizandoId={finalizandoRelatorioId}
      />

      <ProntuarioHistoricoStatusTab
        evolucoes={evolucoes}
        relatorios={relatorios}
        loading={loadingEvolucoes || loadingRelatorios}
        competenciaMes={competenciaMes}
        competenciaAno={competenciaAno}
        onOpenEvolucao={onNavigateEvolucao}
      />
    </div>
  );
}
