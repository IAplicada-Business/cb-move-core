import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import type { TranscricaoResult } from "@/components/domain/EvolucaoAudioRecorder";
import { EmptyState } from "@/components/domain/EmptyState";
import { EvolucaoEditor } from "@/components/domain/EvolucaoEditor";
import { ProntuarioAvaliacoesTab } from "@/components/domain/prontuario/ProntuarioAvaliacoesTab";
import { ProntuarioDocumentosTab } from "@/components/domain/prontuario/ProntuarioDocumentosTab";
import { ProntuarioEvolucaoDiariaTab } from "@/components/domain/prontuario/ProntuarioEvolucaoDiariaTab";
import { ProntuarioHistoricoStatusTab } from "@/components/domain/prontuario/ProntuarioHistoricoStatusTab";
import { ProntuarioPatientHero } from "@/components/domain/prontuario/ProntuarioPatientHero";
import { ProntuarioToolbar } from "@/components/domain/prontuario/ProntuarioToolbar";
import { countSessoesRealizadas, filterSessoesPorCompetencia } from "@/components/domain/prontuario/utils";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/queries";
import { fetchPacientes } from "@/lib/queries/pacientes";
import {
  createEvolucao,
  fetchEvolucoes,
  fetchHistoricoStatus,
  fetchInstrumentosAplicados,
  fetchInstrumentosAtivos,
  fetchPacienteProntuario,
  fetchRelatoriosPaciente,
  fetchSessoesProntuario,
  fetchFisioterapeutasAtivos,
  gerarRelatorioMensal,
  updateEvolucao,
  type Evolucao,
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
import { cn } from "@/lib/utils";

const prontuarioSearchSchema = z.object({
  pacienteId: z.string().uuid().optional(),
});

const TAB_TRIGGER_CLS = cn(
  "rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 shadow-none",
  "data-[state=active]:border-cb-cyan-600 data-[state=active]:text-cb-cyan-800 data-[state=active]:shadow-none",
  "text-muted-foreground font-medium",
);

export const Route = createFileRoute("/app/prontuario")({
  head: () => ({ meta: [{ title: "Prontuário · CB MOVE" }] }),
  validateSearch: prontuarioSearchSchema,
  component: ProntuarioPage,
});

function ProntuarioPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pacienteId: pacienteIdFromUrl } = Route.useSearch();
  const { roles, user } = useAuth();
  const canEdit = can.editProntuario(roles);

  const now = new Date();
  const [selectedId, setSelectedId] = useState<string | null>(pacienteIdFromUrl ?? null);

  const [evolucaoDialogOpen, setEvolucaoDialogOpen] = useState(false);
  const [editingEvolucao, setEditingEvolucao] = useState<Evolucao | null>(null);
  const [draftEvolucao, setDraftEvolucao] = useState<Partial<Evolucao> | null>(null);

  const [competenciaMes, setCompetenciaMes] = useState(now.getMonth() + 1);
  const [competenciaAno, setCompetenciaAno] = useState(now.getFullYear());
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);

  const { data: pacientesLista = [], isLoading: loadPacientesLista } = useQuery({
    queryKey: queryKeys.pacientes.list({ ativo: true }),
    queryFn: () => fetchPacientes({ ativo: true }),
  });

  const { data: paciente } = useQuery({
    queryKey: queryKeys.prontuario.paciente(selectedId ?? ""),
    queryFn: () => fetchPacienteProntuario(selectedId!),
    enabled: !!selectedId,
  });

  const { data: sessoes = [], isLoading: loadSessoes } = useQuery({
    queryKey: queryKeys.prontuario.sessoes(selectedId ?? ""),
    queryFn: () => fetchSessoesProntuario(selectedId!),
    enabled: !!selectedId,
  });

  const { data: evolucoes = [], isLoading: loadEvolucoes } = useQuery({
    queryKey: queryKeys.prontuario.evolucoes(selectedId ?? ""),
    queryFn: () => fetchEvolucoes(selectedId!),
    enabled: !!selectedId,
  });

  const { data: relatorios = [], isLoading: loadRelatorios } = useQuery({
    queryKey: queryKeys.prontuario.relatorios(selectedId ?? ""),
    queryFn: () => fetchRelatoriosPaciente(selectedId!),
    enabled: !!selectedId,
  });

  const { data: historico = [], isLoading: loadHistorico } = useQuery({
    queryKey: queryKeys.prontuario.historico(selectedId ?? ""),
    queryFn: () => fetchHistoricoStatus(selectedId!),
    enabled: !!selectedId,
  });

  const { data: fisios = [] } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ativos,
    queryFn: fetchFisioterapeutasAtivos,
    enabled: !!selectedId && canEdit,
  });

  const { data: instrumentosAtivos = [] } = useQuery({
    queryKey: [...queryKeys.instrumentos.all, "ativos"],
    queryFn: fetchInstrumentosAtivos,
    enabled: !!selectedId,
  });

  const { data: instrumentosAplicados = [], isLoading: loadAvaliacoes } = useQuery({
    queryKey: queryKeys.prontuario.avaliacoes(selectedId ?? ""),
    queryFn: () => fetchInstrumentosAplicados(selectedId!),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (pacienteIdFromUrl && pacienteIdFromUrl !== selectedId) {
      setSelectedId(pacienteIdFromUrl);
    }
  }, [pacienteIdFromUrl, selectedId]);

  const createEvolucaoMutation = useMutation({
    mutationFn: (ev: Partial<Evolucao>) => createEvolucao(ev),
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

  function selectPacienteId(id: string) {
    setSelectedId(id);
    navigate({ to: "/app/prontuario", search: { pacienteId: id } });
  }

  function openNovaEvolucao(draft?: Partial<Evolucao>) {
    setEditingEvolucao(null);
    setDraftEvolucao(draft ?? null);
    setEvolucaoDialogOpen(true);
  }

  function handleTranscricao(result: TranscricaoResult) {
    openNovaEvolucao({
      subjetivo: result.subjetivo || null,
      objetivo: result.objetivo || null,
      plano: result.plano || null,
      transcricao_raw: result.transcricao_raw,
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
      });
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

  const evolucaoLoading =
    createEvolucaoMutation.isPending || updateEvolucaoMutation.isPending;

  const sessoesRealizadas = countSessoesRealizadas(sessoes);
  const sessoesFiltradas = filterSessoesPorCompetencia(sessoes, competenciaMes, competenciaAno);

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
      onSelectPaciente={selectPacienteId}
      competenciaMes={competenciaMes}
      competenciaAno={competenciaAno}
      onCompetenciaChange={handleCompetenciaChange}
    />
  );

  if (!selectedId || !paciente) {
    return (
      <div className="space-y-6">
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
          <p className="text-sm text-muted-foreground">Selecione um paciente para abrir o prontuário clínico.</p>
        </header>

        {toolbar}

        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Nenhum paciente selecionado"
          description="Selecione um paciente na lista ou abra a partir da ficha em Pacientes."
        />
      </div>
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

      {toolbar}

      <Tabs defaultValue="evolucao-diaria" className="space-y-5">
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="evolucao-diaria" className={TAB_TRIGGER_CLS}>
            Evolução diária
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className={TAB_TRIGGER_CLS}>
            Avaliações clínicas
          </TabsTrigger>
          <TabsTrigger value="documentos" className={TAB_TRIGGER_CLS}>
            Documentos
          </TabsTrigger>
          <TabsTrigger value="historico" className={TAB_TRIGGER_CLS}>
            Histórico de status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evolucao-diaria" className="mt-0">
          <ProntuarioEvolucaoDiariaTab
            evolucoes={evolucoes}
            loading={loadEvolucoes}
            canEdit={canEdit}
            pacienteId={selectedId}
            mesFiltro={competenciaMes}
            anoFiltro={competenciaAno}
            onEdit={(e) => {
              setEditingEvolucao(e);
              setDraftEvolucao(null);
              setEvolucaoDialogOpen(true);
            }}
            onTranscricao={handleTranscricao}
          />
        </TabsContent>

        <TabsContent value="avaliacoes" className="mt-0">
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
        </TabsContent>

        <TabsContent value="documentos" className="mt-0">
          <ProntuarioDocumentosTab
            relatorios={relatorios}
            loading={loadRelatorios}
            canEdit={canEdit}
            competenciaMes={competenciaMes}
            competenciaAno={competenciaAno}
            gerando={gerandoRelatorio}
            onGerar={handleGerarRelatorio}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-0">
          <ProntuarioHistoricoStatusTab
            historico={historico}
            sessoes={sessoesFiltradas}
            loadingHistorico={loadHistorico}
            loadingSessoes={loadSessoes}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={evolucaoDialogOpen} onOpenChange={(v) => { if (!v) closeEvolucaoDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvolucao ? "Editar evolução" : "Nova evolução clínica"}
            </DialogTitle>
            <DialogDescription>
              Registre a evolução SOAP do dia. Use o microfone para transcrever e estruturar com IA, ou preencha manualmente.
            </DialogDescription>
          </DialogHeader>
          {selectedId && canEdit && (
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
    </div>
  );
}
