import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { TranscricaoResult } from "@/components/domain/EvolucaoAudioRecorder";
import { AssinaturaPerfilDialog } from "@/components/domain/AssinaturaPerfilDialog";
import { EmptyState } from "@/components/domain/EmptyState";
import { EvolucaoEditor } from "@/components/domain/EvolucaoEditor";
import { LoadingState } from "@/components/domain/LoadingState";
import { PacientePeriodizacaoTab } from "@/components/domain/PacientePeriodizacaoTab";
import { ProntuarioAvaliacoesTab } from "@/components/domain/prontuario/ProntuarioAvaliacoesTab";
import { ProntuarioDocumentosTab } from "@/components/domain/prontuario/ProntuarioDocumentosTab";
import { ProntuarioEvolucaoDiariaTab } from "@/components/domain/prontuario/ProntuarioEvolucaoDiariaTab";
import { ProntuarioHistoricoStatusTab } from "@/components/domain/prontuario/ProntuarioHistoricoStatusTab";
import { ProntuarioPatientHero } from "@/components/domain/prontuario/ProntuarioPatientHero";
import { ProntuarioToolbar } from "@/components/domain/prontuario/ProntuarioToolbar";
import { TAB_TRIGGER_CLS, type ProntuarioPatientTab } from "@/components/domain/prontuario/schemas";
import { countSessoesRealizadas } from "@/components/domain/prontuario/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/queries";
import { fetchPacientes } from "@/lib/queries/pacientes";
import {
  assinarEvolucao,
  createEvolucao,
  fetchEvolucoes,
  fetchInstrumentosAplicados,
  fetchInstrumentosAtivos,
  fetchPacienteProntuario,
  fetchProfileAssinaturaPath,
  fetchRelatoriosPaciente,
  fetchSessoesProntuario,
  fetchFisioterapeutasAtivos,
  gerarRelatorioMensal,
  solicitarAssinaturaRelatorio,
  updateEvolucao,
  type Evolucao,
  type EvolucaoInsert,
} from "@/lib/queries/prontuario";

type Props = {
  pacienteId: string;
  activeTab: ProntuarioPatientTab;
  onTabChange: (tab: ProntuarioPatientTab | "visao-geral") => void;
  onSelectPaciente: (pacienteId: string, tab?: ProntuarioPatientTab) => void;
};

export function ProntuarioPacienteView({
  pacienteId,
  activeTab,
  onTabChange,
  onSelectPaciente,
}: Props) {
  const qc = useQueryClient();
  const { roles, user, fisioterapeutaId } = useAuth();
  const canEdit = can.editProntuario(roles);

  const now = new Date();
  const [evolucaoDialogOpen, setEvolucaoDialogOpen] = useState(false);
  const [editingEvolucao, setEditingEvolucao] = useState<Evolucao | null>(null);
  const [draftEvolucao, setDraftEvolucao] = useState<Partial<Evolucao> | null>(null);
  const [competenciaMes, setCompetenciaMes] = useState(now.getMonth() + 1);
  const [competenciaAno, setCompetenciaAno] = useState(now.getFullYear());
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [finalizandoRelatorioId, setFinalizandoRelatorioId] = useState<string | null>(null);
  const [assinandoEvolucaoId, setAssinandoEvolucaoId] = useState<string | null>(null);
  const [evolucaoParaAssinar, setEvolucaoParaAssinar] = useState<Evolucao | null>(null);
  const [assinaturaPerfilOpen, setAssinaturaPerfilOpen] = useState(false);

  const { data: pacientesLista = [], isLoading: loadPacientesLista } = useQuery({
    queryKey: queryKeys.pacientes.list({ ativo: true }),
    queryFn: () => fetchPacientes({ ativo: true }),
  });

  const {
    data: paciente,
    isLoading: loadPaciente,
    isError: pacienteError,
    error: pacienteErr,
  } = useQuery({
    queryKey: queryKeys.prontuario.paciente(pacienteId),
    queryFn: () => fetchPacienteProntuario(pacienteId),
  });

  const { data: sessoes = [] } = useQuery({
    queryKey: queryKeys.prontuario.sessoes(pacienteId),
    queryFn: () => fetchSessoesProntuario(pacienteId),
  });

  const { data: evolucoes = [], isLoading: loadEvolucoes } = useQuery({
    queryKey: queryKeys.prontuario.evolucoes(pacienteId),
    queryFn: () => fetchEvolucoes(pacienteId),
    enabled: activeTab === "evolucao-diaria" || activeTab === "historico",
  });

  const { data: relatorios = [], isLoading: loadRelatorios } = useQuery({
    queryKey: queryKeys.prontuario.relatorios(pacienteId),
    queryFn: () => fetchRelatoriosPaciente(pacienteId),
    enabled: activeTab === "documentos" || activeTab === "historico",
  });

  const { data: instrumentosAplicados = [], isLoading: loadAvaliacoes } = useQuery({
    queryKey: queryKeys.prontuario.avaliacoes(pacienteId),
    queryFn: () => fetchInstrumentosAplicados(pacienteId),
    enabled: activeTab === "avaliacoes" || activeTab === "periodizacao",
  });

  const { data: fisios = [] } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ativos,
    queryFn: fetchFisioterapeutasAtivos,
    enabled: canEdit && (activeTab === "evolucao-diaria" || evolucaoDialogOpen),
  });

  const { data: instrumentosAtivos = [] } = useQuery({
    queryKey: [...queryKeys.instrumentos.all, "ativos"],
    queryFn: fetchInstrumentosAtivos,
    enabled: activeTab === "avaliacoes",
  });

  const { data: profileAssinaturaPath } = useQuery({
    queryKey: ["profile-assinatura", user?.id ?? ""],
    queryFn: () => fetchProfileAssinaturaPath(user!.id),
    enabled: !!user?.id && canEdit,
  });

  const assinarEvolucaoMutation = useMutation({
    mutationFn: assinarEvolucao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.evolucoes(pacienteId) });
      toast.success("Evolução assinada");
      setEvolucaoParaAssinar(null);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setAssinandoEvolucaoId(null),
  });

  const createEvolucaoMutation = useMutation({
    mutationFn: createEvolucao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.evolucoes(pacienteId) });
      toast.success("Evolução registrada");
      closeEvolucaoDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEvolucaoMutation = useMutation({
    mutationFn: ({ id, ev }: { id: string; ev: Partial<Evolucao> }) => updateEvolucao(id, ev),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.evolucoes(pacienteId) });
      toast.success("Evolução atualizada");
      closeEvolucaoDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function closeEvolucaoDialog() {
    setEvolucaoDialogOpen(false);
    setEditingEvolucao(null);
    setDraftEvolucao(null);
  }

  function handleTabChange(tab: string) {
    if (tab === "visao-geral") {
      onTabChange("visao-geral");
      return;
    }
    onTabChange(tab as ProntuarioPatientTab);
  }

  function openNovaEvolucao(draft?: Partial<Evolucao>) {
    setEditingEvolucao(null);
    setDraftEvolucao(draft ?? null);
    setEvolucaoDialogOpen(true);
  }

  function handleTranscricao(result: TranscricaoResult) {
    const transcricao = result.transcricao_raw?.trim() ?? "";
    openNovaEvolucao({
      subjetivo: result.subjetivo?.trim() || null,
      objetivo: result.objetivo?.trim() || null,
      plano: result.plano?.trim() || null,
      transcricao_raw: transcricao || null,
      fonte: "audio_ia",
      data: new Date().toISOString().split("T")[0],
    });
  }

  function handleSaveEvolucao(ev: Partial<Evolucao>) {
    if (editingEvolucao) {
      updateEvolucaoMutation.mutate({ id: editingEvolucao.id, ev });
    } else {
      createEvolucaoMutation.mutate({
        ...ev,
        paciente_id: pacienteId,
        criado_por: user?.id ?? null,
      } as EvolucaoInsert);
    }
  }

  async function handleGerarRelatorio() {
    setGerandoRelatorio(true);
    try {
      const data = await gerarRelatorioMensal({
        pacienteId,
        mes: competenciaMes,
        ano: competenciaAno,
      });
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.relatorios(pacienteId) });
      toast.success(`Relatório gerado: ${data.competencia} — ${data.total_sessoes} sessões`);
      if (data.aviso) toast.info(data.aviso);
      if (data.relatorio_id && canEdit) {
        toast.info('Use "Finalizar / assinar" no documento para solicitar assinatura digital.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar relatório";
      if (msg.includes("501") || msg.toLowerCase().includes("credencial")) {
        toast.info("Aguardando credenciais para geração de PDF");
      } else {
        toast.error(msg);
      }
    } finally {
      setGerandoRelatorio(false);
    }
  }

  function handleAssinarEvolucao(ev: Evolucao) {
    if (!profileAssinaturaPath) {
      setAssinaturaPerfilOpen(true);
      toast.info("Cadastre sua assinatura no menu do usuário antes de assinar.");
      return;
    }
    setEvolucaoParaAssinar(ev);
  }

  function confirmarAssinaturaEvolucao() {
    if (!evolucaoParaAssinar) return;
    setAssinandoEvolucaoId(evolucaoParaAssinar.id);
    assinarEvolucaoMutation.mutate(evolucaoParaAssinar.id);
  }

  async function handleFinalizarRelatorio(relatorioId: string) {
    setFinalizandoRelatorioId(relatorioId);
    try {
      const res = await solicitarAssinaturaRelatorio(relatorioId);
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.relatorios(pacienteId) });
      if (res.aviso) toast.info(res.aviso);
      else if (res.status === "aguardando_assinatura")
        toast.success("Solicitação de assinatura enviada");
      else toast.success("Relatório atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao finalizar relatório");
    } finally {
      setFinalizandoRelatorioId(null);
    }
  }

  const evolucaoLoading = createEvolucaoMutation.isPending || updateEvolucaoMutation.isPending;
  const sessoesRealizadas = countSessoesRealizadas(sessoes);
  const pacientesOptions = pacientesLista.map((p) => ({ id: p.id, nome: p.nome }));

  if (loadPaciente && !paciente) {
    return <LoadingState label="Carregando prontuário do paciente…" />;
  }

  if (pacienteError || !paciente) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="Não foi possível abrir o prontuário"
        description={
          pacienteErr instanceof Error
            ? pacienteErr.message
            : "Paciente não encontrado ou sem permissão de acesso."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <ProntuarioPatientHero
        paciente={paciente}
        sessoesRealizadas={sessoesRealizadas}
        canEdit={canEdit}
        onGravarEvolucao={() => openNovaEvolucao()}
      />

      <ProntuarioToolbar
        pacientes={pacientesOptions}
        pacientesLoading={loadPacientesLista}
        selectedPacienteId={pacienteId}
        onSelectPaciente={(id) => onSelectPaciente(id, activeTab)}
        competenciaMes={competenciaMes}
        competenciaAno={competenciaAno}
        onCompetenciaChange={(mes, ano) => {
          setCompetenciaMes(mes);
          setCompetenciaAno(ano);
        }}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="visao-geral" className={TAB_TRIGGER_CLS}>
            Visão Geral Prontuários
          </TabsTrigger>
          <TabsTrigger value="evolucao-diaria" className={TAB_TRIGGER_CLS}>
            Evolução diária
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className={TAB_TRIGGER_CLS}>
            Avaliações clínicas
          </TabsTrigger>
          <TabsTrigger value="documentos" className={TAB_TRIGGER_CLS}>
            Documentos
          </TabsTrigger>
          <TabsTrigger value="periodizacao" className={TAB_TRIGGER_CLS}>
            Periodização
          </TabsTrigger>
          <TabsTrigger value="historico" className={TAB_TRIGGER_CLS}>
            Histórico de documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evolucao-diaria" className="mt-0">
          <ProntuarioEvolucaoDiariaTab
            evolucoes={evolucoes}
            loading={loadEvolucoes}
            canEdit={canEdit}
            fisioAuthorId={fisioterapeutaId}
            pacienteId={pacienteId}
            mesFiltro={competenciaMes}
            anoFiltro={competenciaAno}
            assinandoId={assinandoEvolucaoId}
            onEdit={(e) => {
              if (e.assinado_em) {
                toast.info("Evolução assinada não pode ser editada.");
                return;
              }
              setEditingEvolucao(e);
              setDraftEvolucao(null);
              setEvolucaoDialogOpen(true);
            }}
            onAssinar={handleAssinarEvolucao}
            onTranscricao={handleTranscricao}
          />
        </TabsContent>

        <TabsContent value="avaliacoes" className="mt-0">
          <ProntuarioAvaliacoesTab
            aplicados={instrumentosAplicados}
            instrumentos={instrumentosAtivos}
            pacienteId={pacienteId}
            loading={loadAvaliacoes}
            canEdit={canEdit}
            aplicadoPor={user?.id}
            onSaved={() =>
              qc.invalidateQueries({ queryKey: queryKeys.prontuario.avaliacoes(pacienteId) })
            }
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-0">
          <ProntuarioDocumentosTab
            pacienteId={pacienteId}
            relatorios={relatorios}
            loading={loadRelatorios}
            canEdit={canEdit}
            competenciaMes={competenciaMes}
            competenciaAno={competenciaAno}
            gerando={gerandoRelatorio}
            onGerar={handleGerarRelatorio}
            onFinalizar={handleFinalizarRelatorio}
            finalizandoId={finalizandoRelatorioId}
          />
        </TabsContent>

        <TabsContent value="periodizacao" className="mt-0">
          <PacientePeriodizacaoTab
            pacienteId={pacienteId}
            paciente={paciente}
            readOnly={!canEdit}
            avaliacoesCount={instrumentosAplicados.length}
            onNavigateTab={(tab) => handleTabChange(tab)}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-0">
          <ProntuarioHistoricoStatusTab
            evolucoes={evolucoes}
            relatorios={relatorios}
            loading={loadEvolucoes || loadRelatorios}
            competenciaMes={competenciaMes}
            competenciaAno={competenciaAno}
            onOpenDocumentos={() => handleTabChange("documentos")}
            onOpenEvolucao={() => handleTabChange("evolucao-diaria")}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={evolucaoDialogOpen}
        onOpenChange={(v) => {
          if (!v) closeEvolucaoDialog();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvolucao ? "Editar evolução" : "Nova evolução clínica"}
            </DialogTitle>
            <DialogDescription>
              Registre a evolução SOAP do dia. Use o microfone para transcrever e estruturar com IA,
              ou preencha manualmente.
            </DialogDescription>
          </DialogHeader>
          {canEdit && (
            <EvolucaoEditor
              key={editingEvolucao?.id ?? draftEvolucao?.transcricao_raw ?? "nova"}
              evolucao={editingEvolucao ?? draftEvolucao ?? undefined}
              fisios={fisios}
              pacienteId={pacienteId}
              defaultFisioterapeutaId={paciente.fisioterapeutaId}
              onSave={handleSaveEvolucao}
              onCancel={closeEvolucaoDialog}
              loading={evolucaoLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!evolucaoParaAssinar}
        onOpenChange={(open) => {
          if (!open) setEvolucaoParaAssinar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Assinar esta evolução? Após assinar, o conteúdo não poderá ser editado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarAssinaturaEvolucao}>
              Confirmar assinatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssinaturaPerfilDialog open={assinaturaPerfilOpen} onOpenChange={setAssinaturaPerfilOpen} />
    </div>
  );
}
