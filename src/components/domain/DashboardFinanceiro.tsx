import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { KpiCard } from "@/components/domain/KpiCard";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { downloadCSV } from "@/lib/csv";
import {
  competenciaLabel,
  extratoToCsvRows,
  extratoToXlsxBlob,
  filtrarExtratoPorConvenio,
  receitaConvenioToCsvRows,
  receitaConvenioToXlsxBlob,
} from "@/lib/domain/extrato-financeiro";
import { brl } from "@/lib/format";
import { fetchExtratoFinanceiro } from "@/lib/queries/extrato-financeiro";
import {
  fetchFinanceiroKpisPorTipo,
  fetchRelatorioReceitaConvenio,
} from "@/lib/queries/financeiro";
import type { PacienteTipo } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// Anel de 5 arcos sólidos da marca CB MOVE — mesma geometria usada no PDF de
// "Relatórios por tipo". SVG puro porque drivers de impressão (Microsoft Print
// to PDF, etc.) não renderizam máscaras CSS/conic-gradient corretamente.
const RING_SEGMENTS = [
  { color: "#D946A0", start: 130, end: 202 },
  { color: "#F58A1F", start: 202, end: 274 },
  { color: "#C5D932", start: 274, end: 346 },
  { color: "#3FB5BC", start: 346, end: 418 },
  { color: "#7B4FB5", start: 418, end: 490 },
];

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildBrandRingSvg(size: number): string {
  const r = size / 2 - 3;
  const c = size / 2;
  const arcs = RING_SEGMENTS.map((seg) => {
    const start = polarPoint(c, c, r, seg.start);
    const end = polarPoint(c, c, r, seg.end);
    return `<path d="M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}" stroke="${seg.color}" stroke-width="${(size * 0.13).toFixed(2)}" fill="none" stroke-linecap="round" />`;
  }).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}</svg>`;
}

const TIPO_KPI: Record<
  PacienteTipo,
  { label: string; accent: "cyan" | "magenta" | "purple" | "orange" }
> = {
  particular: { label: "Particular", accent: "cyan" },
  judicial: { label: "Judicial", accent: "magenta" },
  convenio: { label: "Convênio", accent: "purple" },
  puc: { label: "PUC", accent: "orange" },
};

type ExportOpcao =
  "receita-csv" | "receita-xlsx" | "receita-pdf" | "extrato-csv" | "extrato-xlsx" | "extrato-pdf";

const PRINT_DOC_STYLES = `
  body { font-family: Calibri, Arial, sans-serif; font-size: 11px; margin: 24px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 700; }
  .num { text-align: right; white-space: nowrap; }
  .total td { font-weight: 700; background: #f9fafb; }
  .mes-titulo { text-align: center; font-weight: 700; background: #eef2ff; padding: 8px; margin-bottom: 12px; }

  .brand-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .brand-mark { flex: 0 0 auto; line-height: 0; }
  .brand-word { display: flex; flex-direction: column; line-height: 1.15; }
  .brand-word b { font-size: 13px; letter-spacing: 0.2px; color: #2c2c2c; }
  .brand-word span { font-size: 7.5px; letter-spacing: 1.4px; text-transform: uppercase; color: #6b7280; }
  .brand-doc-title { margin-left: auto; text-align: right; }
  .brand-doc-title b { font-size: 12px; display: block; color: #2c2c2c; }
  .brand-doc-title span { font-size: 10px; color: #6b7280; }
  .brand-bar { height: 3px; background: #2D8388; border-radius: 2px; margin: 8px 0 18px; }
  .brand-footer { display: flex; height: 3px; border-radius: 2px; overflow: hidden; margin-top: 28px; }
  .brand-footer span { flex: 1; }
  .brand-footer .m { background: #D946A0; }
  .brand-footer .o { background: #F58A1F; }
  .brand-footer .l { background: #C5D932; }
  .brand-footer .c { background: #3FB5BC; }
  .brand-footer .p { background: #7B4FB5; }
  .footer-text { font-size: 8.5px; color: #6b7280; text-align: center; margin-top: 6px; }
`;

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imprimirDocumentoHtml(docTitulo: string, docSubtitulo: string, conteudo: string) {
  const geradoEm = new Date().toLocaleDateString("pt-BR");
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(docTitulo)} · ${escapeHtml(docSubtitulo)}</title>
    <style>${PRINT_DOC_STYLES}</style>
  </head>
  <body>
    <div class="brand-header">
      <div class="brand-mark">${buildBrandRingSvg(28)}</div>
      <div class="brand-word"><b>CB MOVE</b><span>Neuroscience</span></div>
      <div class="brand-doc-title"><b>${escapeHtml(docTitulo)}</b><span>${escapeHtml(docSubtitulo)}</span></div>
    </div>
    <div class="brand-bar"></div>
    ${conteudo}
    <div class="brand-footer"><span class="m"></span><span class="o"></span><span class="l"></span><span class="c"></span><span class="p"></span></div>
    <p class="footer-text">Documento gerado pela CB MOVE Neuroscience em ${geradoEm}</p>
  </body>
</html>`;

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

function slugArquivo(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

export function DashboardFinanceiro() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [filtroConvenio, setFiltroConvenio] = useState<string | null>(null);
  const [exportSelectKey, setExportSelectKey] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);
  const compOpts = competenciaOpcoes();

  const kpisQuery = useQuery({
    queryKey: queryKeys.financeiro.kpisPorTipo(ano, mes),
    queryFn: () => fetchFinanceiroKpisPorTipo(mes, ano),
  });
  const receitaQuery = useQuery({
    queryKey: queryKeys.financeiro.receitaConvenio(ano, mes),
    queryFn: () => fetchRelatorioReceitaConvenio(mes, ano),
  });
  const extratoQuery = useQuery({
    queryKey: queryKeys.financeiro.extrato(ano, mes),
    queryFn: () => fetchExtratoFinanceiro(mes, ano),
  });

  const kpis = kpisQuery.data ?? [];
  const receita = receitaQuery.data ?? [];
  const extrato = extratoQuery.data;
  const extratoVisivel = useMemo(
    () => (extrato ? filtrarExtratoPorConvenio(extrato, filtroConvenio) : undefined),
    [extrato, filtroConvenio],
  );
  const receitaVisivel = useMemo(
    () => (filtroConvenio ? receita.filter((r) => r.convenio === filtroConvenio) : receita),
    [receita, filtroConvenio],
  );
  const linhas = extratoVisivel?.linhas ?? [];
  const kpiMap = Object.fromEntries(kpis.map((k) => [k.tipo, k]));
  const totalReceita = kpis.reduce((s, k) => s + k.valor, 0);
  const receitaSelecionada = filtroConvenio
    ? receita.find((r) => r.convenio === filtroConvenio)
    : null;
  const mesNome = MESES_ABREV[mes - 1] ?? String(mes);
  const sufixoArquivo = filtroConvenio ? slugArquivo(filtroConvenio) : "todos";

  useEffect(() => {
    setFiltroConvenio(null);
  }, [mes, ano]);

  const podeExportarReceita = receitaVisivel.length > 0;
  const podeExportarExtrato = Boolean(extratoVisivel && linhas.length > 0);

  function executarExportacao(opcao: ExportOpcao) {
    switch (opcao) {
      case "receita-csv":
        exportarCsvReceita();
        break;
      case "receita-xlsx":
        void exportarXlsxReceita().catch((e: Error) => toast.error(e.message));
        break;
      case "receita-pdf":
        imprimirReceita();
        break;
      case "extrato-csv":
        exportarCsvExtrato();
        break;
      case "extrato-xlsx":
        void exportarXlsxExtrato().catch((e: Error) => toast.error(e.message));
        break;
      case "extrato-pdf":
        imprimirExtrato();
        break;
    }
    setExportSelectKey((k) => k + 1);
  }

  function exportarCsvExtrato() {
    if (!extratoVisivel || linhas.length === 0) return;
    downloadCSV(
      `extrato-financeiro-${mesNome}-${ano}-${sufixoArquivo}.csv`,
      extratoToCsvRows(extratoVisivel),
    );
    toast.success(
      filtroConvenio ? `Extrato de ${filtroConvenio} exportado em CSV` : "Extrato exportado em CSV",
    );
  }

  async function exportarXlsxExtrato() {
    if (!extratoVisivel || linhas.length === 0) return;
    const blob = await extratoToXlsxBlob(extratoVisivel);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-financeiro-${mesNome}-${ano}-${sufixoArquivo}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      filtroConvenio
        ? `Extrato de ${filtroConvenio} exportado em XLSX`
        : "Extrato exportado em XLSX",
    );
  }

  function exportarCsvReceita() {
    if (receitaVisivel.length === 0) return;
    downloadCSV(
      `receita-convenio-${mesNome}-${ano}-${sufixoArquivo}.csv`,
      receitaConvenioToCsvRows(receitaVisivel),
    );
    toast.success(
      filtroConvenio
        ? `Receita de ${filtroConvenio} exportada em CSV`
        : "Receita por convênio exportada em CSV",
    );
  }

  async function exportarXlsxReceita() {
    if (receitaVisivel.length === 0) return;
    const blob = await receitaConvenioToXlsxBlob(receitaVisivel);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receita-convenio-${mesNome}-${ano}-${sufixoArquivo}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      filtroConvenio
        ? `Receita de ${filtroConvenio} exportada em XLSX`
        : "Receita por convênio exportada em XLSX",
    );
  }

  function imprimirReceita() {
    if (receitaVisivel.length === 0) return;

    const totalFaturado = receitaVisivel.reduce((s, r) => s + r.faturado, 0);
    const totalRecebidoVal = receitaVisivel.reduce((s, r) => s + r.recebido, 0);
    const linhasTabela = receitaVisivel
      .map(
        (d) => `<tr>
      <td>${escapeHtml(d.convenio)}</td>
      <td class="num">${d.pacientes}</td>
      <td class="num">${d.sessoes}</td>
      <td class="num">${d.nfsEmitidas}</td>
      <td class="num">${escapeHtml(brl(d.faturado))}</td>
      <td class="num">${escapeHtml(brl(d.recebido))}</td>
    </tr>`,
      )
      .join("");

    const subtitulo = filtroConvenio
      ? `${competenciaLabel(mes, ano)} · ${filtroConvenio}`
      : competenciaLabel(mes, ano);

    const conteudo = `
      <div class="mes-titulo">${escapeHtml(competenciaLabel(mes, ano))}</div>
      <table>
        <thead>
          <tr>
            <th>Convênio</th>
            <th class="num">Pacientes</th>
            <th class="num">Sessões</th>
            <th class="num">NFs emitidas</th>
            <th class="num">Faturado</th>
            <th class="num">Recebido</th>
          </tr>
        </thead>
        <tbody>
          ${linhasTabela}
          <tr class="total">
            <td>Total</td>
            <td class="num">—</td>
            <td class="num">—</td>
            <td class="num">—</td>
            <td class="num">${escapeHtml(brl(totalFaturado))}</td>
            <td class="num">${escapeHtml(brl(totalRecebidoVal))}</td>
          </tr>
        </tbody>
      </table>`;

    imprimirDocumentoHtml("Receita por Convênio", subtitulo, conteudo);
    toast.success(
      filtroConvenio
        ? `Receita de ${filtroConvenio} enviada para impressão`
        : "Receita por convênio enviada para impressão",
    );
  }

  function imprimirExtrato() {
    if (!printRef.current) return;
    const subtitulo = filtroConvenio
      ? `${competenciaLabel(mes, ano)} · ${filtroConvenio}`
      : competenciaLabel(mes, ano);
    imprimirDocumentoHtml("Extrato Financeiro", subtitulo, printRef.current.innerHTML);
  }

  const loadingKpis = kpisQuery.isLoading;
  const loadingReceita = receitaQuery.isLoading;
  const loadingExtrato = extratoQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold">Financeiro</h2>
          <p className="text-sm text-muted-foreground">
            Receita total, receita por convênio e extrato exportável — selecione um convênio para
            filtrar e exportar
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
          <Select
            key={exportSelectKey}
            onValueChange={(v) => executarExportacao(v as ExportOpcao)}
            disabled={!podeExportarReceita && !podeExportarExtrato}
          >
            <SelectTrigger className="w-[168px] gap-2">
              <Download className="h-4 w-4 shrink-0 opacity-70" />
              <SelectValue placeholder="Exportar…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Receita por convênio</SelectLabel>
                <SelectItem value="receita-csv" disabled={!podeExportarReceita}>
                  CSV
                </SelectItem>
                <SelectItem value="receita-xlsx" disabled={!podeExportarReceita}>
                  XLSX
                </SelectItem>
                <SelectItem value="receita-pdf" disabled={!podeExportarReceita}>
                  Imprimir / PDF
                </SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Extrato</SelectLabel>
                <SelectItem value="extrato-csv" disabled={!podeExportarExtrato}>
                  CSV
                </SelectItem>
                <SelectItem value="extrato-xlsx" disabled={!podeExportarExtrato}>
                  XLSX
                </SelectItem>
                <SelectItem value="extrato-pdf" disabled={!podeExportarExtrato}>
                  Imprimir / PDF
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtroConvenio && receitaSelecionada && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <Badge variant="secondary" className="font-normal">
            Filtro: {filtroConvenio}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Faturado {brl(receitaSelecionada.faturado)} · Recebido{" "}
            {brl(receitaSelecionada.recebido)} · {receitaSelecionada.pacientes} paciente(s)
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1"
            onClick={() => setFiltroConvenio(null)}
          >
            <X className="h-3.5 w-3.5" />
            Ver receita total
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loadingKpis ? (
          <div className="col-span-full">
            <LoadingState />
          </div>
        ) : (
          <>
            <KpiCard
              label="Receita total"
              value={brl(totalReceita)}
              accent="lime"
              hint={competenciaLabel(mes, ano)}
            />
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
          </>
        )}
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Receita por convênio</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Clique em uma linha para filtrar o extrato e exportar só aquele convênio ou tipo.
          </p>
        </div>
        {loadingReceita ? (
          <LoadingState />
        ) : receita.length === 0 ? (
          <EmptyState
            title="Sem dados"
            description="Não há cobranças de convênio nesta competência."
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
                {receita.map((d) => {
                  const selecionado = filtroConvenio === d.convenio;
                  return (
                    <TableRow
                      key={d.convenio}
                      className={`cursor-pointer transition-colors hover:bg-muted/40 ${selecionado ? "bg-primary/5" : ""}`}
                      onClick={() =>
                        setFiltroConvenio((atual) => (atual === d.convenio ? null : d.convenio))
                      }
                    >
                      <TableCell className="font-medium">
                        {d.convenio}
                        {selecionado && (
                          <Badge variant="outline" className="ml-2 text-[10px] py-0">
                            filtrado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.pacientes}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.sessoes}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.nfsEmitidas}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(d.faturado)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {brl(d.recebido)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {filtroConvenio ? `Extrato · ${filtroConvenio}` : "Extrato da competência"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtroConvenio
              ? "Linhas filtradas conforme a receita selecionada acima."
              : "Todas as cobranças do mês. Selecione um convênio na tabela para exportar por grupo."}
          </p>
        </div>
        {loadingExtrato ? (
          <LoadingState />
        ) : linhas.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-8 w-8" />}
            title={
              filtroConvenio
                ? `Sem cobranças para ${filtroConvenio}`
                : "Sem cobranças nesta competência"
            }
            description={
              filtroConvenio
                ? "Não há linhas de extrato para este convênio ou tipo no período."
                : "Não há linhas para gerar o extrato financeiro do período selecionado."
            }
          />
        ) : (
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <div ref={printRef}>
              <div className="px-4 py-3 border-b bg-muted/30 print:block">
                <h3 className="font-bold text-sm">{competenciaLabel(mes, ano)}</h3>
                <p className="text-xs text-muted-foreground">
                  CB MOVE Neuroscience · Relatório Financeiro
                  {filtroConvenio ? ` · ${filtroConvenio}` : ""}
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
                      <TableCell className="font-medium whitespace-nowrap">
                        {l.pacienteNome}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {l.avaliacao ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{l.frequencia ?? "—"}</TableCell>
                      <TableCell className="text-sm">{l.diasSemana ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.numSessoes ?? "—"}
                      </TableCell>
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
                    <TableCell colSpan={7} className="font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {brl(extratoVisivel!.totalPrevisto)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {brl(extratoVisivel!.totalRecebido)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground px-1">
          Frequência e dias vêm da cobrança ou do cadastro do paciente. Edite em Pacientes ou ao
          criar a cobrança.
        </p>
      </section>
    </div>
  );
}
