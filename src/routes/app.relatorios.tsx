import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  FileText,
  Gavel,
  GraduationCap,
  Loader2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { MonthPicker } from "@/components/domain/MonthPicker";
import { RelatorioArquivoMenu } from "@/components/domain/RelatorioArquivoMenu";
import { RelatoriosHistoricoTab } from "@/components/domain/RelatoriosHistoricoTab";
import { KpiCard } from "@/components/domain/KpiCard";
import { DashboardPage, DashboardSection, KpiGrid } from "@/components/domain/DashboardSection";
import { PageHeader } from "@/components/brand/PageHeader";
import { queryKeys } from "@/lib/queries";
import {
  filterPacientesRelatorioLote,
  mensagemEscopoRelatorioLote,
  podeGerarLoteRelatorio,
} from "@/lib/domain/relatorio-lote";
import { fetchPacientes } from "@/lib/queries/pacientes";
import { gerarRelatorioMensal, gerarRelatorioMensalLote } from "@/lib/queries/prontuario";
import { supabase } from "@/integrations/supabase/client";
import type { PacienteTipo } from "@/lib/types";
import { assertFinanceAccess } from "@/lib/route-access";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · CB MOVE" }] }),
  beforeLoad: () => assertFinanceAccess(),
  component: RelatoriosPage,
});

const TIPO_RELATORIO: Record<
  PacienteTipo,
  { label: string; descricao: string; icon: typeof Briefcase; accent: string }
> = {
  particular: {
    label: "Particular",
    descricao: "Modelo convencional — gere para todos os particulares ou um paciente",
    icon: Briefcase,
    accent: "text-cb-cyan-600 bg-cb-cyan-050",
  },
  judicial: {
    label: "Judicial",
    descricao: "Judicial — PDF ou XLSX SharePoint, escolha ao abrir",
    icon: Gavel,
    accent: "text-cb-magenta bg-[#FDF2F8]",
  },
  convenio: {
    label: "Convênio",
    descricao: "Modelo Unimed / convênios — selecione o convênio e gere para todos os pacientes",
    icon: Building2,
    accent: "text-purple-600 bg-purple-50",
  },
  puc: {
    label: "PUC",
    descricao: "Modelo institucional PUC — gere para todos os pacientes PUC ou um paciente",
    icon: GraduationCap,
    accent: "text-cb-orange bg-[#FFF7ED]",
  },
};

type RelatorioGerado = {
  relatorio_id: string;
  modelo: string;
  paciente_nome: string;
  competencia: string;
  total_sessoes: number;
  pdf_url?: string;
  xlsx_url?: string;
  formato_arquivo?: "pdf" | "xlsx" | "dual" | "docx";
};

type ConvenioOpcao = { id: string; nome: string };

async function fetchConveniosAtivos(): Promise<ConvenioOpcao[]> {
  const { data, error } = await supabase
    .from("convenios")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as ConvenioOpcao[];
}

type LoteResultado = {
  pacienteId: string;
  pacienteNome: string;
  status: "ok" | "erro";
  detalhe: string;
  pdfUrl?: string;
  xlsxUrl?: string;
};

function GerarRelatorioDialog({ tipo, onClose }: { tipo: PacienteTipo; onClose: () => void }) {
  const cfg = TIPO_RELATORIO[tipo];
  const now = new Date();
  const [convenioId, setConvenioId] = useState("");
  const [pacienteId, setPacienteId] = useState("");
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [resultado, setResultado] = useState<RelatorioGerado | null>(null);
  const [lote, setLote] = useState<LoteResultado[] | null>(null);
  const [loteRodando, setLoteRodando] = useState(false);
  const [modoLegado, setModoLegado] = useState(false);
  const loteAbortRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    loteAbortRef.current = false;
    return () => {
      loteAbortRef.current = true;
    };
  }, []);

  function tentarFecharDialog() {
    if (loteRodando) {
      toast.warning("Aguarde o término da geração em lote ou mantenha esta janela aberta.");
      return;
    }
    onClose();
  }

  const conveniosQuery = useQuery({
    queryKey: queryKeys.convenios.all,
    queryFn: fetchConveniosAtivos,
    enabled: tipo === "convenio",
  });

  const pacientesQuery = useQuery({
    queryKey: queryKeys.pacientes.list({ tipo, ativo: true }),
    queryFn: () => fetchPacientes({ tipo, ativo: true }),
  });

  const pacientesFiltrados = filterPacientesRelatorioLote(
    pacientesQuery.data ?? [],
    tipo,
    convenioId,
  );

  const gerarMutation = useMutation({
    mutationFn: () =>
      gerarRelatorioMensal({
        pacienteId,
        mes,
        ano,
        ...(modoLegado ? { modeloPdf: "legado" as const } : {}),
      }),
    onSuccess: (data) => {
      setResultado(data as RelatorioGerado);
      void queryClient.invalidateQueries({ queryKey: queryKeys.relatorios.byPaciente(pacienteId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.relatorios.all });
      toast.success("Relatório gerado com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function gerarEmLote() {
    if (pacientesFiltrados.length === 0 || loteRodando) return;
    loteAbortRef.current = false;
    setLoteRodando(true);
    setLote([]);
    setResultado(null);
    try {
      const data = await gerarRelatorioMensalLote({
        tipo,
        convenioId: convenioId || undefined,
        mes,
        ano,
      });
      if (loteAbortRef.current) return;
      const resultados: LoteResultado[] = data.resultados.map((r) => ({
        pacienteId: r.paciente_id,
        pacienteNome: r.paciente_nome,
        status: r.status,
        detalhe: r.detalhe,
        pdfUrl: r.pdf_url,
        xlsxUrl: r.xlsx_url,
      }));
      setLote(resultados);
      void queryClient.invalidateQueries({ queryKey: queryKeys.relatorios.all });
      void queryClient.invalidateQueries({ queryKey: ["prontuario", "relatorios"] });
      if (data.ok === data.total) toast.success(`${data.ok} relatório(s) gerado(s) com sucesso`);
      else if (data.ok > 0) {
        toast.warning(`${data.ok}/${data.total} relatório(s) gerado(s) — verifique os erros`);
      } else {
        toast.error("Nenhum relatório foi gerado — verifique os erros");
      }
    } catch (e) {
      if (!loteAbortRef.current) {
        toast.error(e instanceof Error ? e.message : "Erro ao gerar lote");
      }
    } finally {
      if (!loteAbortRef.current) setLoteRodando(false);
    }
  }

  const paciente = pacientesQuery.data?.find((p) => p.id === pacienteId);
  const convenioSelecionado = conveniosQuery.data?.find((c) => c.id === convenioId);
  const podeGerarLote = podeGerarLoteRelatorio(pacientesFiltrados, tipo, convenioId);
  const escopoMensagem = mensagemEscopoRelatorioLote({
    isLoading: pacientesQuery.isLoading,
    tipo,
    convenioId,
    count: pacientesFiltrados.length,
    tipoLabel: cfg.label,
  });
  const loteLabel =
    tipo === "convenio"
      ? `Gerar para todos os ${pacientesFiltrados.length} pacientes de ${convenioSelecionado?.nome ?? "este convênio"}`
      : `Gerar para todos os ${pacientesFiltrados.length} pacientes ${cfg.label.toLowerCase()}`;

  return (
    <Dialog open onOpenChange={(open) => !open && tentarFecharDialog()}>
      <DialogContent
        className={`sm:max-w-md${loteRodando ? " [&>button]:pointer-events-none [&>button]:opacity-30" : ""}`}
        onInteractOutside={(e) => {
          if (loteRodando) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (loteRodando) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <cfg.icon className="h-5 w-5" />
            Relatório de atendimento — {cfg.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{cfg.descricao}</p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Competência</label>
            <MonthPicker
              mes={mes}
              ano={ano}
              onChange={(m, a) => {
                setMes(m);
                setAno(a);
                setResultado(null);
                setLote(null);
              }}
              className="w-full"
            />
          </div>

          {tipo === "convenio" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Convênio</label>
              <Select
                value={convenioId}
                onValueChange={(v) => {
                  setConvenioId(v);
                  setPacienteId("");
                  setResultado(null);
                  setLote(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o convênio…" />
                </SelectTrigger>
                <SelectContent>
                  {(conveniosQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            {escopoMensagem}
          </p>

          {loteRodando && (
            <p className="text-xs text-amber-700">
              Gerando {pacientesFiltrados.length} relatório(s) no servidor — pode levar alguns
              minutos. Mantenha esta janela aberta.
            </p>
          )}

          {podeGerarLote && (
            <Button className="w-full" disabled={loteRodando} onClick={gerarEmLote}>
              {loteRodando ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1.5" />
              )}
              {loteRodando ? "Gerando no servidor…" : loteLabel}
            </Button>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Paciente específico (opcional)</label>
            <Select
              value={pacienteId}
              onValueChange={(v) => {
                setPacienteId(v);
                setResultado(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o paciente…" />
              </SelectTrigger>
              <SelectContent>
                {pacientesQuery.isLoading && (
                  <SelectItem value="__loading" disabled>
                    Carregando…
                  </SelectItem>
                )}
                {pacientesFiltrados.length === 0 && (
                  <SelectItem value="__empty" disabled>
                    Nenhum paciente encontrado
                  </SelectItem>
                )}
                {pacientesFiltrados.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
            <Checkbox
              id="modo-legado"
              checked={modoLegado}
              onCheckedChange={(v) => setModoLegado(v === true)}
            />
            <Label htmlFor="modo-legado" className="text-sm font-normal cursor-pointer">
              Modo legado (PDF com evolução clínica em texto)
            </Label>
          </div>

          {resultado && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Paciente:</span>{" "}
                <span className="font-medium">{resultado.paciente_nome}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Competência:</span> {resultado.competencia}
              </p>
              <p>
                <span className="text-muted-foreground">Sessões no período:</span>{" "}
                {resultado.total_sessoes}
              </p>
              {(resultado.pdf_url || resultado.xlsx_url) && (
                <div className="mt-2">
                  <RelatorioArquivoMenu
                    pdfUrl={resultado.pdf_url}
                    xlsxUrl={resultado.xlsx_url}
                    formatoArquivo={resultado.formato_arquivo ?? "pdf"}
                    variant="outline"
                    onError={(e) => toast.error(e.message)}
                  />
                </div>
              )}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            disabled={!pacienteId || gerarMutation.isPending || loteRodando}
            onClick={() => gerarMutation.mutate()}
          >
            <FileText className="h-4 w-4 mr-1.5" />
            {gerarMutation.isPending ? "Gerando…" : "Gerar só deste paciente"}
          </Button>

          {lote && lote.length > 0 && (
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {lote.map((r) => (
                <div key={r.pacienteId} className="flex items-center gap-2 text-sm">
                  {r.status === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#047857]" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span className="flex-1 truncate">{r.pacienteNome}</span>
                  {r.pdfUrl || r.xlsxUrl ? (
                    <RelatorioArquivoMenu
                      pdfUrl={r.pdfUrl}
                      xlsxUrl={r.xlsxUrl}
                      variant="link"
                      onError={(e) => toast.error(e.message)}
                    />
                  ) : (
                    <span
                      className="shrink-0 truncate text-xs text-muted-foreground"
                      title={r.detalhe}
                    >
                      {r.detalhe}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {paciente && !paciente.email && (
            <p className="text-xs text-muted-foreground">
              Dica: cadastre um e-mail para este paciente para poder enviar o relatório
              automaticamente.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RelatoriosPage() {
  const [tipoSelecionado, setTipoSelecionado] = useState<PacienteTipo | null>(null);
  const [aba, setAba] = useState<"gerar" | "historico">("gerar");

  const { data: pacientes = [] } = useQuery({
    queryKey: queryKeys.pacientes.all,
    queryFn: () => fetchPacientes(),
  });

  const stats = useMemo(() => {
    const ativos = pacientes.filter((p) => p.ativo);
    return {
      total: ativos.length,
      particular: ativos.filter((p) => p.tipo === "particular").length,
      convenio: ativos.filter((p) => p.tipo === "convenio").length,
      judicial: ativos.filter((p) => p.tipo === "judicial").length,
      puc: ativos.filter((p) => p.tipo === "puc").length,
    };
  }, [pacientes]);

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Financeiro" }, { label: "Relatórios" }]}
        title="Relatórios de atendimento"
        description="Gere relatórios mensais por tipo de atendimento ou consulte o histórico da competência."
        actions={
          <Button variant="outline" asChild className="gap-2">
            <Link to="/app/financeiro">
              <TrendingUp className="h-4 w-4" /> Dashboard Financeiro
            </Link>
          </Button>
        }
      />

      <KpiGrid columns={4}>
        <KpiCard
          label="Pacientes ativos"
          value={stats.total}
          accent="cyan"
          icon={<FileText className="h-5 w-5" />}
        />
        <KpiCard
          label="Particular"
          value={stats.particular}
          accent="cyan"
          icon={<Briefcase className="h-5 w-5" />}
        />
        <KpiCard
          label="Convênio"
          value={stats.convenio}
          accent="purple"
          icon={<Building2 className="h-5 w-5" />}
        />
        <KpiCard
          label="Judicial + PUC"
          value={stats.judicial + stats.puc}
          accent="magenta"
          icon={<Gavel className="h-5 w-5" />}
        />
      </KpiGrid>

      <Tabs value={aba} onValueChange={(v) => setAba(v as "gerar" | "historico")}>
        <TabsList className="h-auto bg-cb-cyan-050/60 p-1">
          <TabsTrigger value="gerar" className="data-[state=active]:bg-white">
            Gerar
          </TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-white">
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gerar" className="mt-6">
          <DashboardSection
            eyebrow="Relatórios"
            accent="purple"
            title="Gerar por tipo"
            description="Lote por convênio, judicial, PUC ou particular — ou um paciente específico."
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(TIPO_RELATORIO) as PacienteTipo[]).map((tipo) => {
                const cfg = TIPO_RELATORIO[tipo];
                const count =
                  tipo === "particular"
                    ? stats.particular
                    : tipo === "convenio"
                      ? stats.convenio
                      : tipo === "judicial"
                        ? stats.judicial
                        : stats.puc;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoSelecionado(tipo)}
                    className="rounded-[10px] border border-border bg-background/50 p-5 text-left shadow-[0_1px_2px_rgba(15,75,80,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(15,75,80,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-cyan-600"
                  >
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${cfg.accent}`}
                    >
                      <cfg.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-bold text-cb-ink">{cfg.label}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-cb-muted">{cfg.descricao}</p>
                    <p className="mt-3 text-sm font-semibold tabular-nums text-cb-cyan-800">
                      {count} paciente{count !== 1 ? "s" : ""} ativo{count !== 1 ? "s" : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </DashboardSection>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <DashboardSection
            eyebrow="Relatórios"
            accent="cyan"
            title="Histórico de relatórios"
            noPadding
            bodyClassName="p-6"
          >
            <RelatoriosHistoricoTab />
          </DashboardSection>
        </TabsContent>
      </Tabs>

      {tipoSelecionado && (
        <GerarRelatorioDialog tipo={tipoSelecionado} onClose={() => setTipoSelecionado(null)} />
      )}
    </DashboardPage>
  );
}
