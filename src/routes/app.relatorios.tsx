import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Briefcase,
  Building2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Gavel,
  GraduationCap,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { KpiCard } from "@/components/domain/KpiCard";
import { LoadingState } from "@/components/domain/LoadingState";
import { MonthPicker } from "@/components/domain/MonthPicker";
import { queryKeys } from "@/lib/queries";
import { downloadCSV } from "@/lib/csv";
import {
  competenciaLabel,
  extratoToCsvRows,
} from "@/lib/domain/extrato-financeiro";
import { brl } from "@/lib/format";
import { fetchExtratoFinanceiro } from "@/lib/queries/extrato-financeiro";
import { fetchPacientes } from "@/lib/queries/pacientes";
import { gerarRelatorioMensal } from "@/lib/queries/prontuario";
import {
  fetchFinanceiroKpisPorTipo,
  fetchRelatorioReceitaConvenio,
} from "@/lib/queries/financeiro";
import type { PacienteTipo } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · CB MOVE" }] }),
  component: RelatoriosPage,
});

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPO_KPI: Record<PacienteTipo, { label: string; accent: "cyan" | "magenta" | "purple" | "orange" }> = {
  particular: { label: "Particular", accent: "cyan" },
  judicial: { label: "Judicial", accent: "magenta" },
  convenio: { label: "Convênio", accent: "purple" },
  puc: { label: "PUC", accent: "orange" },
};

const TIPO_RELATORIO: Record<
  PacienteTipo,
  { label: string; descricao: string; icon: typeof Briefcase; accent: string }
> = {
  particular: {
    label: "Particular",
    descricao: "Modelo convencional de relatório de atendimento",
    icon: Briefcase,
    accent: "text-cb-cyan-600 bg-cb-cyan-050",
  },
  judicial: {
    label: "Judicial",
    descricao: "Modelo para processos judiciais",
    icon: Gavel,
    accent: "text-cb-magenta bg-[#FDF2F8]",
  },
  convenio: {
    label: "Convênio",
    descricao: "Modelo Unimed / convênios",
    icon: Building2,
    accent: "text-purple-600 bg-purple-50",
  },
  puc: {
    label: "PUC",
    descricao: "Modelo institucional PUC",
    icon: GraduationCap,
    accent: "text-cb-orange bg-[#FFF7ED]",
  },
};

function competenciaOpcoes() {
  const now = new Date();
  const opts: { label: string; mes: number; ano: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      label: `${MESES_ABREV[d.getMonth()]}/${d.getFullYear()}`,
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
    });
  }
  return opts;
}

function TabReceitaConvenio() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const compOpts = competenciaOpcoes();

  const kpisQuery = useQuery({
    queryKey: queryKeys.financeiro.kpisPorTipo(ano, mes),
    queryFn: () => fetchFinanceiroKpisPorTipo(mes, ano),
  });

  const tabelaQuery = useQuery({
    queryKey: queryKeys.financeiro.receitaConvenio(ano, mes),
    queryFn: () => fetchRelatorioReceitaConvenio(mes, ano),
  });

  const kpis = kpisQuery.data ?? [];
  const dados = tabelaQuery.data ?? [];
  const loading = kpisQuery.isLoading || tabelaQuery.isLoading;

  const kpiMap = Object.fromEntries(kpis.map((k) => [k.tipo, k]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">Receita por convênio</h2>
        <Select
          value={`${mes}-${ano}`}
          onValueChange={(v) => {
            const [m, a] = v.split("-");
            setMes(Number(m));
            setAno(Number(a));
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {compOpts.map((o) => (
              <SelectItem key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(["particular", "judicial", "convenio", "puc"] as PacienteTipo[]).map((tipo) => {
          const cfg = TIPO_KPI[tipo];
          const k = kpiMap[tipo];
          return (
            <KpiCard
              key={tipo}
              label={cfg.label}
              value={brl(k?.valor ?? 0)}
              accent={cfg.accent}
              hint={`${k?.pacientes ?? 0} paciente(s)`}
            />
          );
        })}
      </div>

      {loading ? (
        <LoadingState />
      ) : dados.length === 0 ? (
        <EmptyState
          title="Sem dados"
          description="Não há cobranças registradas para esta competência."
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Convênio</TableHead>
                <TableHead className="text-right">Pacientes</TableHead>
                <TableHead className="text-right">Sessões</TableHead>
                <TableHead className="text-right">NFs emitidas</TableHead>
                <TableHead className="text-right">Faturado</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.map((d) => (
                <TableRow key={d.convenio}>
                  <TableCell className="font-medium">{d.convenio}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.pacientes}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.sessoes}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.nfsEmitidas}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(d.faturado)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{brl(d.recebido)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

type RelatorioGerado = {
  relatorio_id: string;
  modelo: string;
  paciente_nome: string;
  competencia: string;
  total_sessoes: number;
  pdf_url?: string;
};

function GerarRelatorioDialog({
  tipo,
  onClose,
}: {
  tipo: PacienteTipo;
  onClose: () => void;
}) {
  const cfg = TIPO_RELATORIO[tipo];
  const now = new Date();
  const [pacienteId, setPacienteId] = useState("");
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [resultado, setResultado] = useState<RelatorioGerado | null>(null);
  const queryClient = useQueryClient();

  const pacientesQuery = useQuery({
    queryKey: queryKeys.pacientes.list({ tipo, ativo: true }),
    queryFn: () => fetchPacientes({ tipo, ativo: true }),
  });

  const gerarMutation = useMutation({
    mutationFn: () => gerarRelatorioMensal({ pacienteId, mes, ano }),
    onSuccess: (data) => {
      setResultado(data as RelatorioGerado);
      void queryClient.invalidateQueries({ queryKey: queryKeys.relatorios.byPaciente(pacienteId) });
      toast.success("Relatório gerado com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paciente = pacientesQuery.data?.find((p) => p.id === pacienteId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <cfg.icon className="h-5 w-5" />
            Relatório de atendimento — {cfg.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{cfg.descricao}</p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Paciente</label>
            <Select value={pacienteId} onValueChange={(v) => { setPacienteId(v); setResultado(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o paciente…" />
              </SelectTrigger>
              <SelectContent>
                {pacientesQuery.isLoading && (
                  <SelectItem value="__loading" disabled>Carregando…</SelectItem>
                )}
                {pacientesQuery.data?.length === 0 && (
                  <SelectItem value="__empty" disabled>Nenhum paciente do tipo {cfg.label}</SelectItem>
                )}
                {(pacientesQuery.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Competência</label>
            <MonthPicker
              mes={mes}
              ano={ano}
              onChange={(m, a) => { setMes(m); setAno(a); setResultado(null); }}
              className="w-full"
            />
          </div>

          {resultado && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Paciente:</span> <span className="font-medium">{resultado.paciente_nome}</span></p>
              <p><span className="text-muted-foreground">Competência:</span> {resultado.competencia}</p>
              <p><span className="text-muted-foreground">Sessões no período:</span> {resultado.total_sessoes}</p>
              {resultado.pdf_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={() => window.open(resultado.pdf_url, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir PDF
                </Button>
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!pacienteId || gerarMutation.isPending}
            onClick={() => gerarMutation.mutate()}
          >
            <FileText className="h-4 w-4 mr-1.5" />
            {gerarMutation.isPending ? "Gerando…" : "Gerar relatório"}
          </Button>

          {paciente && !paciente.email && (
            <p className="text-xs text-muted-foreground">
              Dica: cadastre um e-mail para este paciente para poder enviar o relatório automaticamente.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabRelatoriosPorTipo() {
  const [tipoSelecionado, setTipoSelecionado] = useState<PacienteTipo | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Relatórios por tipo de atendimento</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o tipo de paciente para gerar o relatório de atendimento no modelo correspondente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(TIPO_RELATORIO) as PacienteTipo[]).map((tipo) => {
          const cfg = TIPO_RELATORIO[tipo];
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => setTipoSelecionado(tipo)}
              className="rounded-xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${cfg.accent}`}>
                <cfg.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-semibold">{cfg.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{cfg.descricao}</p>
            </button>
          );
        })}
      </div>

      {tipoSelecionado && (
        <GerarRelatorioDialog tipo={tipoSelecionado} onClose={() => setTipoSelecionado(null)} />
      )}
    </div>
  );
}

function TabExtratoFinanceiro() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const printRef = useRef<HTMLDivElement>(null);
  const compOpts = competenciaOpcoes();

  const extratoQuery = useQuery({
    queryKey: queryKeys.financeiro.extrato(ano, mes),
    queryFn: () => fetchExtratoFinanceiro(mes, ano),
  });

  const extrato = extratoQuery.data;
  const linhas = extrato?.linhas ?? [];
  const loading = extratoQuery.isLoading;

  function exportarCsv() {
    if (!extrato || linhas.length === 0) return;
    const mesNome = MESES_ABREV[mes - 1] ?? String(mes);
    downloadCSV(`extrato-financeiro-${mesNome}-${ano}.csv`, extratoToCsvRows(extrato));
    toast.success("Extrato exportado em CSV");
  }

  function imprimir() {
    if (!printRef.current) return;
    const conteudo = printRef.current.innerHTML;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Extrato financeiro · ${competenciaLabel(mes, ano)}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; font-size: 11px; margin: 24px; color: #111; }
      h1 { font-size: 16px; margin: 0 0 4px; }
      p { margin: 0 0 16px; color: #555; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f3f4f6; font-weight: 700; }
      .num { text-align: right; white-space: nowrap; }
      .total td { font-weight: 700; background: #f9fafb; }
      .mes-titulo { text-align: center; font-weight: 700; background: #eef2ff; }
    </style>
  </head>
  <body>${conteudo}</body>
</html>`;

    // Impressão via iframe oculto na própria página — evita bloqueio de pop-up
    // e problemas de document.write/blob em novas abas.
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toast.error("Não foi possível preparar a impressão");
      cleanup();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow;
    win?.addEventListener("afterprint", cleanup);
    window.setTimeout(() => {
      win?.focus();
      win?.print();
    }, 150);
    window.setTimeout(cleanup, 60_000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold">Extrato financeiro mensal</h2>
          <p className="text-sm text-muted-foreground">
            Formato alinhado ao Relatório Financeiro 2026 da clínica
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={`${mes}-${ano}`}
            onValueChange={(v) => {
              const [m, a] = v.split("-");
              setMes(Number(m));
              setAno(Number(a));
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {compOpts.map((o) => (
                <SelectItem key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={exportarCsv}
            disabled={!extrato || linhas.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={imprimir}
            disabled={!extrato || linhas.length === 0}
          >
            <Printer className="h-4 w-4 mr-1" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {extrato && linhas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="R$ Previsto"
            value={brl(extrato.totalPrevisto)}
            accent="cyan"
            hint={`${extrato.qtdLinhas} linha(s)`}
          />
          <KpiCard
            label="R$ Recebido"
            value={brl(extrato.totalRecebido)}
            accent="purple"
            hint={
              extrato.totalPrevisto > 0
                ? `${Math.round((extrato.totalRecebido / extrato.totalPrevisto) * 100)}% do previsto`
                : "—"
            }
          />
          <KpiCard
            label="A receber"
            value={brl(Math.max(extrato.totalPrevisto - extrato.totalRecebido, 0))}
            accent="orange"
            hint={competenciaLabel(mes, ano)}
          />
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : extratoQuery.isError ? (
        <EmptyState
          title="Erro ao carregar extrato"
          description={extratoQuery.error instanceof Error ? extratoQuery.error.message : "Tente novamente."}
        />
      ) : linhas.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-8 w-8" />}
          title="Sem cobranças nesta competência"
          description="Não há linhas para gerar o extrato financeiro do período selecionado."
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <div ref={printRef}>
            <div className="px-4 py-3 border-b bg-muted/30 print:block">
              <h3 className="font-bold text-sm">{competenciaLabel(mes, ano)}</h3>
              <p className="text-xs text-muted-foreground">
                CB MOVE Neuroscience · Relatório Financeiro
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Paciente</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Dias da Semana</TableHead>
                  <TableHead className="text-right">Nº Sessões</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">R$ Sessão/Mês</TableHead>
                  <TableHead className="text-right">R$ Previsto</TableHead>
                  <TableHead className="text-right">R$ Recebido</TableHead>
                  <TableHead>SITUAÇÃO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.cobrancaId}>
                    <TableCell className="font-medium whitespace-nowrap">{l.pacienteNome}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{l.avaliacao ?? "—"}</TableCell>
                    <TableCell className="text-sm">{l.frequencia ?? "—"}</TableCell>
                    <TableCell className="text-sm">{l.diasSemana ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.numSessoes ?? "—"}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{l.plano}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {l.valorUnitario != null ? brl(l.valorUnitario) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium whitespace-nowrap">
                      {l.valorPrevisto > 0 ? brl(l.valorPrevisto) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {l.valorRecebido != null ? brl(l.valorRecebido) : ""}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs">{l.situacao}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={7} className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {brl(extrato!.totalPrevisto)}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {brl(extrato!.totalRecebido)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground px-1">
        Frequência e dias vêm da cobrança ou do cadastro do paciente. Edite em Pacientes ou ao criar a cobrança.
      </p>
    </div>
  );
}

function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Relatórios consolidados</h1>
        <p className="text-sm text-muted-foreground">Análises e exportações financeiras</p>
      </header>

      <Tabs defaultValue="extrato-financeiro">
        <TabsList>
          <TabsTrigger value="extrato-financeiro">Extrato financeiro</TabsTrigger>
          <TabsTrigger value="receita-convenio">Receita por convênio</TabsTrigger>
          <TabsTrigger value="relatorios-tipo">Relatórios por tipo</TabsTrigger>
        </TabsList>

        <TabsContent value="extrato-financeiro" className="mt-4">
          <TabExtratoFinanceiro />
        </TabsContent>

        <TabsContent value="receita-convenio" className="mt-4">
          <TabReceitaConvenio />
        </TabsContent>

        <TabsContent value="relatorios-tipo" className="mt-4">
          <TabRelatoriosPorTipo />
        </TabsContent>
      </Tabs>
    </div>
  );
}
