import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import type { TranscricaoResult } from "@/components/domain/EvolucaoAudioRecorder";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { EvolucaoEditor } from "@/components/domain/EvolucaoEditor";
import { ProntuarioAvaliacoesTab } from "@/components/domain/prontuario/ProntuarioAvaliacoesTab";
import { ProntuarioDocumentosTab } from "@/components/domain/prontuario/ProntuarioDocumentosTab";
import { ProntuarioEvolucaoDiariaTab } from "@/components/domain/prontuario/ProntuarioEvolucaoDiariaTab";
import { ProntuarioHistoricoStatusTab } from "@/components/domain/prontuario/ProntuarioHistoricoStatusTab";
import { ProntuarioPatientHero } from "@/components/domain/prontuario/ProntuarioPatientHero";
import { ProntuarioVisaoGeralTab } from "@/components/domain/prontuario/ProntuarioVisaoGeralTab";
import { PacientePeriodizacaoTab } from "@/components/domain/PacientePeriodizacaoTab";
import { ProntuarioToolbar } from "@/components/domain/prontuario/ProntuarioToolbar";
import { AssinaturaPerfilDialog } from "@/components/domain/AssinaturaPerfilDialog";
import { countSessoesRealizadas } from "@/components/domain/prontuario/utils";
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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

const prontuarioTabSchema = z.enum([
  "visao-geral",
  "evolucao-diaria",
  "avaliacoes",
  "documentos",
  "periodizacao",
  "historico",
]);

const prontuarioSearchSchema = z.object({
  pacienteId: z.string().uuid().optional(),
  tab: prontuarioTabSchema.optional(),
});

type ProntuarioTab = z.infer<typeof prontuarioTabSchema>;

const TAB_TRIGGER_CLS = cn(
  "rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 shadow-none",
  "data-[state=active]:border-cb-cyan-600 data-[state=active]:text-cb-cyan-800 data-[state=active]:shadow-none",
  "text-muted-foreground font-medium",
);

function resolveTab(tab: ProntuarioTab | undefined, pacienteId: string | undefined): ProntuarioTab {
  if (tab) return tab;
  return pacienteId ? "evolucao-diaria" : "visao-geral";
}

export const Route = createFileRoute("/app/prontuario")({
  head: () => ({ meta: [{ title: "Prontuário · CB MOVE" }] }),
  validateSearch: prontuarioSearchSchema,
  component: ProntuarioPage,
});

function ProntuarioPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pacienteId: pacienteIdFromUrl, tab: tabFromUrl } = Route.useSearch();
  const { roles, user, fisioterapeutaId } = useAuth();
  const canEdit = can.editProntuario(roles);

  const now = new Date();
  const [selectedId, setSelectedId] = useState<string | null>(pacienteIdFromUrl ?? null);
  const activeTab = resolveTab(tabFromUrl, pacienteIdFromUrl);

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
    queryKey: queryKeys.prontuario.paciente(selectedId ?? ""),
    queryFn: () => fetchPacienteProntuario(selectedId!),
    enabled: !!selectedId && activeTab !== "visao-geral",
  });

  const { data: sessoes = [] } = useQuery({
    queryKey: queryKeys.prontuario.sessoes(selectedId ?? ""),
    queryFn: () => fetchSessoesProntuario(selectedId!),
    enabled: !!selectedId && activeTab !== "visao-geral",
  });

  const { data: evolucoes = [], isLoading: loadEvolucoes } = useQuery({
    queryKey: queryKeys.prontuario.evolucoes(selectedId ?? ""),
    queryFn: () => fetchEvolucoes(selectedId!),
    enabled: !!selectedId && activeTab === "evolucao-diaria",
  });

  const { data: relatorios = [], isLoading: loadRelatorios } = useQuery({
    queryKey: queryKeys.prontuario.relatorios(selectedId ?? ""),
    queryFn: () => fetchRelatoriosPaciente(selectedId!),
    enabled: !!selectedId && activeTab === "documentos",
  });

  const { data: instrumentosAplicados = [], isLoading: loadAvaliacoes } = useQuery({
    queryKey: queryKeys.prontuario.avaliacoes(selectedId ?? ""),
    queryFn: () => fetchInstrumentosAplicados(selectedId!),
    enabled: !!selectedId && (activeTab === "avaliacoes" || activeTab === "periodizacao"),
  });

  const { data: fisios = [] } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ativos,
    queryFn: fetchFisioterapeutasAtivos,
    enabled: !!selectedId && canEdit && (activeTab === "evolucao-diaria" || evolucaoDialogOpen),
  });

  const { data: instrumentosAtivos = [] } = useQuery({
    queryKey: [...queryKeys.instrumentos.all, "ativos"],
    queryFn: fetchInstrumentosAtivos,
    enabled: !!selectedId && activeTab === "avaliacoes",
  });

  const { data: profileAssinaturaPath } = useQuery({
    queryKey: ["profile-assinatura", user?.id ?? ""],
    queryFn: () => fetchProfileAssinaturaPath(user!.id),
    enabled: !!user?.id && canEdit,
  });

  const assinarEvolucaoMutation = useMutation({
    mutationFn: assinarEvolucao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.evolucoes(selectedId!) });
      toast.success("Evolução assinada");
      setEvolucaoParaAssinar(null);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setAssinandoEvolucaoId(null),
  });

  useEffect(() => {
    if (pacienteIdFromUrl && pacienteIdFromUrl !== selectedId) {
      setSelectedId(pacienteIdFromUrl);
    }
    if (!pacienteIdFromUrl && selectedId) {
      setSelectedId(null);
    }
  }, [pacienteIdFromUrl, selectedId]);

  const createEvolucaoMutation = useMutation({
    mutationFn: createEvolucao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.evolucoes(selectedId!) });
      toast.success("Evolução registrada");
      closeEvolucaoDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEvolucaoMutation = useMutation({
    mutationFn: ({ id, ev }: { id: string; ev: Partial<Evolucao> }) => updateEvolucao(id, ev),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.evolucoes(selectedId!) });
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

  function navigateProntuario(next: { pacienteId?: string; tab: ProntuarioTab }) {
    navigate({
      to: "/app/prontuario",
      search: {
        pacienteId: next.pacienteId,
        tab: next.tab,
      },
    });
  }

  function selectPacienteId(id: string, tab: ProntuarioTab = "evolucao-diaria") {
    setSelectedId(id);
    navigateProntuario({ pacienteId: id, tab });
  }

  function handleTabChange(tab: string) {
    const nextTab = tab as ProntuarioTab;
    if (nextTab === "visao-geral") {
      setSelectedId(null);
      navigateProntuario({ tab: "visao-geral" });
      return;
    }
    if (!selectedId) {
      navigateProntuario({ tab: nextTab });
      return;
    }
    navigateProntuario({
      pacienteId: selectedId,
      tab: nextTab,
    });
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
    if (!selectedId) return;
    if (editingEvolucao) {
      updateEvolucaoMutation.mutate({ id: editingEvolucao.id, ev });
    } else {
      createEvolucaoMutation.mutate({
        ...ev,
        paciente_id: selectedId,
        criado_por: user?.id ?? null,
      } as EvolucaoInsert);
    }
  }

  async function handleGerarRelatorio() {
    if (!selectedId) return;
    setGerandoRelatorio(true);
    try {
      const data = await gerarRelatorioMensal({
        pacienteId: selectedId,
        mes: competenciaMes,
        ano: competenciaAno,
      });
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.relatorios(selectedId) });
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
    if (!selectedId) return;
    setFinalizandoRelatorioId(relatorioId);
    try {
      const res = await solicitarAssinaturaRelatorio(relatorioId);
      qc.invalidateQueries({ queryKey: queryKeys.prontuario.relatorios(selectedId) });
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

  function handleCompetenciaChange(mes: number, ano: number) {
    setCompetenciaMes(mes);
    setCompetenciaAno(ano);
  }

  const pacientesOptions = pacientesLista.map((p) => ({ id: p.id, nome: p.nome }));

  const toolbar = (
    <ProntuarioToolbar
      pacientes={pacientesOptions}
      pacientesLoading={loadPacientesLista}
      selectedPacienteId={selectedId}
      onSelectPaciente={(id) => selectPacienteId(id)}
      competenciaMes={competenciaMes}
      competenciaAno={competenciaAno}
      onCompetenciaChange={handleCompetenciaChange}
    />
  );

  const isVisaoGeralTab = activeTab === "visao-geral";
  const isPatientContext = !isVisaoGeralTab;
  const showPatientHero =
    isPatientContext && !!selectedId && !!paciente && !loadPaciente && !pacienteError;

  function renderPatientRequired() {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="Nenhum paciente selecionado"
        description="Selecione um paciente na barra acima ou abra a partir da Visão Geral."
      />
    );
  }

  function renderPatientLoading() {
    return <LoadingState label="Carregando prontuário do paciente…" />;
  }

  function renderPatientError() {
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
      {isVisaoGeralTab && (
        <header className="space-y-2">
          <Breadcrumb>
            <BreadcrumbList className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/app">Operação</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground">Prontuário</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-bold text-foreground">Prontuário</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de todos os prontuários — KPIs e acesso rápido ao prontuário
            individual.
          </p>
        </header>
      )}

      {showPatientHero && (
        <ProntuarioPatientHero
          paciente={paciente}
          sessoesRealizadas={sessoesRealizadas}
          canEdit={canEdit}
          onGravarEvolucao={() => openNovaEvolucao()}
        />
      )}

      {isPatientContext && toolbar}

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

        <TabsContent value="visao-geral" className="mt-0">
          <ProntuarioVisaoGeralTab onOpenPaciente={(id) => selectPacienteId(id)} />
        </TabsContent>

        <TabsContent value="evolucao-diaria" className="mt-0">
          {!selectedId ? (
            renderPatientRequired()
          ) : loadPaciente ? (
            renderPatientLoading()
          ) : pacienteError || !paciente ? (
            renderPatientError()
          ) : (
            <ProntuarioEvolucaoDiariaTab
              evolucoes={evolucoes}
              loading={loadEvolucoes}
              canEdit={canEdit}
              fisioAuthorId={fisioterapeutaId}
              pacienteId={selectedId}
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
          )}
        </TabsContent>

        <TabsContent value="avaliacoes" className="mt-0">
          {!selectedId ? (
            renderPatientRequired()
          ) : loadPaciente ? (
            renderPatientLoading()
          ) : pacienteError || !paciente ? (
            renderPatientError()
          ) : (
            <ProntuarioAvaliacoesTab
              aplicados={instrumentosAplicados}
              instrumentos={instrumentosAtivos}
              pacienteId={selectedId}
              loading={loadAvaliacoes}
              canEdit={canEdit}
              aplicadoPor={user?.id}
              onSaved={() =>
                qc.invalidateQueries({ queryKey: queryKeys.prontuario.avaliacoes(selectedId) })
              }
            />
          )}
        </TabsContent>

        <TabsContent value="documentos" className="mt-0">
          {!selectedId ? (
            renderPatientRequired()
          ) : loadPaciente ? (
            renderPatientLoading()
          ) : pacienteError || !paciente ? (
            renderPatientError()
          ) : (
            <ProntuarioDocumentosTab
              pacienteId={selectedId}
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
          )}
        </TabsContent>

        <TabsContent value="periodizacao" className="mt-0">
          {!selectedId ? (
            renderPatientRequired()
          ) : loadPaciente ? (
            renderPatientLoading()
          ) : pacienteError || !paciente ? (
            renderPatientError()
          ) : (
            <PacientePeriodizacaoTab
              pacienteId={selectedId}
              paciente={paciente ?? undefined}
              readOnly={!canEdit}
              avaliacoesCount={instrumentosAplicados.length}
              onNavigateTab={(tab) => handleTabChange(tab)}
            />
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-0">
          {!selectedId ? (
            renderPatientRequired()
          ) : (
            <ProntuarioHistoricoStatusTab onOpenDocumentos={() => handleTabChange("documentos")} />
          )}
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
          {selectedId && paciente && canEdit && (
            <EvolucaoEditor
              key={editingEvolucao?.id ?? draftEvolucao?.transcricao_raw ?? "nova"}
              evolucao={editingEvolucao ?? draftEvolucao ?? undefined}
              fisios={fisios}
              pacienteId={selectedId}
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
