import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { KpiCard } from "@/components/domain/KpiCard";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { downloadCSV } from "@/lib/csv";
import {
  competenciaLabel,
  extratoToCsvRows,
} from "@/lib/domain/extrato-financeiro";
import { brl } from "@/lib/format";
import { fetchExtratoFinanceiro } from "@/lib/queries/extrato-financeiro";
import { fetchNFsPorPacienteAno } from "@/lib/queries/notas-fiscais";
import { fetchPacientes } from "@/lib/queries/pacientes";
import {
  fetchFinanceiroKpisPorTipo,
  fetchRelatorioReceitaConvenio,
} from "@/lib/queries/financeiro";
import type { PacienteTipo } from "@/lib/types";

import { Button } from "@/components/ui/button";
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

function anosDisponiveis() {
  const now = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => now - i);
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

function TabNFsPorPaciente() {
  const [pacienteId, setPacienteId] = useState<string>("");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [exportando, setExportando] = useState(false);
  const anos = anosDisponiveis();

  const pacientes = useQuery({
    queryKey: queryKeys.pacientes.list({ ativo: true }),
    queryFn: () => fetchPacientes({ ativo: true }),
  });

  const nfsQuery = useQuery({
    queryKey: ["relatorios", "nfs_paciente", pacienteId, ano],
    queryFn: () => fetchNFsPorPacienteAno(pacienteId, ano),
    enabled: !!pacienteId,
  });

  const nfs = nfsQuery.data ?? [];
  const total = nfs.reduce((s, n) => s + n.valor, 0);
  const paciente = pacientes.data?.find((p) => p.id === pacienteId);

  async function exportarIR() {
    if (!pacienteId) return;
    setExportando(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("gerar-relatorio-ir", {
        body: { paciente_id: pacienteId, ano },
      });
      if (error) throw new Error(error.message);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-ir-${paciente?.nome ?? pacienteId}-${ano}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">NFs por paciente — Declaração de IR</h2>
        <div className="flex items-center gap-2">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={pacienteId} onValueChange={setPacienteId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Selecione o paciente…" />
            </SelectTrigger>
            <SelectContent>
              {pacientes.isLoading && (
                <SelectItem value="__loading" disabled>Carregando…</SelectItem>
              )}
              {(pacientes.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {nfs.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportarIR} disabled={exportando}>
              <Download className="h-4 w-4 mr-1" />
              {exportando ? "Exportando…" : "Exportar para IR"}
            </Button>
          )}
        </div>
      </div>

      {!pacienteId ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Selecione um paciente"
          description="Escolha um paciente e o ano para ver as NFs emitidas no período."
        />
      ) : nfsQuery.isLoading ? (
        <LoadingState />
      ) : nfs.length === 0 ? (
        <EmptyState
          title="Sem NFs emitidas"
          description={`Nenhuma nota fiscal emitida para ${paciente?.nome ?? "este paciente"} em ${ano}.`}
        />
      ) : (
        <div className="space-y-2">
          {paciente && (
            <div className="rounded-lg border bg-card px-4 py-3 text-sm flex gap-6 flex-wrap">
              <div>
                <span className="text-muted-foreground">Paciente: </span>
                <span className="font-semibold">{paciente.nome}</span>
              </div>
              {paciente.cpf && (
                <div>
                  <span className="text-muted-foreground">CPF: </span>
                  <span className="font-mono">{paciente.cpf}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Ano: </span>
                <span className="font-semibold">{ano}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold text-cb-cyan-600">{brl(total)}</span>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº NF</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nfs.map((nf) => (
                  <TableRow key={nf.id}>
                    <TableCell className="font-mono text-sm">{nf.numero ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {nf.emissao
                        ? new Date(nf.emissao + "T00:00:00").toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell>{nf.destinatarioNome ?? "—"}</TableCell>
                    <TableCell>
                      <span className="text-xs font-medium capitalize text-muted-foreground">
                        {nf.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{brl(nf.valor)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={4} className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{brl(total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground px-1">
            Documento gerado pela CB MOVE Neuroscience — para fins de declaração anual de imposto de renda.
          </p>
        </div>
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
    const janela = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
    if (!janela) {
      toast.error("Permita pop-ups para imprimir o extrato");
      return;
    }
    janela.document.write(`
      <!DOCTYPE html>
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
      </html>
    `);
    janela.document.close();
    janela.focus();
    janela.print();
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
          <TabsTrigger value="nfs-ir">NFs por paciente (IR)</TabsTrigger>
        </TabsList>

        <TabsContent value="extrato-financeiro" className="mt-4">
          <TabExtratoFinanceiro />
        </TabsContent>

        <TabsContent value="receita-convenio" className="mt-4">
          <TabReceitaConvenio />
        </TabsContent>

        <TabsContent value="nfs-ir" className="mt-4">
          <TabNFsPorPaciente />
        </TabsContent>
      </Tabs>
    </div>
  );
}
