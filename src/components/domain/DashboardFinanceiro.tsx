import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  X,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { EmptyState } from "@/components/domain/EmptyState";
import { KpiCard } from "@/components/domain/KpiCard";
import {
  HorizontalMetricBars,
  StatusDistributionBar,
  TIPO_BAR_COLORS,
} from "@/components/domain/MetricVisuals";
import { LoadingState } from "@/components/domain/LoadingState";
import { CompetenciaFilterChip } from "@/components/domain/CompetenciaFilterChip";
import { ReceitaMensalChart, ReceitaMensalLegend } from "@/components/domain/ReceitaMensalChart";
import {
  RecebimentoGaugeChart,
  RecebimentoPorConvenioPie,
} from "@/components/domain/charts/RecebimentoCharts";
import { TopConveniosBarChart } from "@/components/domain/charts/TopConveniosBarChart";
import { CobrancaTrendLineChart } from "@/components/domain/charts/TrendLineCharts";
import { DataToolbar } from "@/components/brand/DataToolbar";
import {
  BrandTable,
  BrandTableBody,
  BrandTableCell,
  BrandTableHead,
  BrandTableHeader,
  BrandTableNumCell,
  BrandTableRow,
} from "@/components/brand/BrandTable";
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
import {
  competenciaAtual,
  competenciaLabel as competenciaCurta,
  mesAbrev,
  parseCompetencia,
} from "@/lib/competencia";
import { financeiroKpisHistoricoOptions, receitaMensalOptions } from "@/lib/queries/options";
import { fetchExtratoFinanceiro } from "@/lib/queries/extrato-financeiro";
import {
  fetchFinanceiroKpis,
  fetchFinanceiroKpisPorTipo,
  fetchRelatorioReceitaConvenio,
} from "@/lib/queries/financeiro";
import type { PacienteTipo } from "@/lib/types";

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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

function slugArquivo(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

function convenioInitials(nome: string) {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

function formatCount(n: number) {
  return n > 0 ? String(n) : "—";
}

function recebimentoPct(faturado: number, recebido: number) {
  if (faturado <= 0) return 0;
  return Math.min(100, Math.round((recebido / faturado) * 100));
}

const FINANCE_WIDGET_BODY = "flex h-[220px] w-full items-center justify-center px-4 pb-4 pt-3";

type ReceitaConvenioRow = {
  convenio: string;
  pacientes: number;
  sessoes: number;
  nfsEmitidas: number;
  faturado: number;
  recebido: number;
};

function ReceitaConvenioPanel({
  receita,
  filtroConvenio,
  onSelectConvenio,
}: {
  receita: ReceitaConvenioRow[];
  filtroConvenio: string | null;
  onSelectConvenio: (convenio: string | null) => void;
}) {
  const mostrarSessoes = receita.some((r) => r.sessoes > 0);
  const totalFaturado = receita.reduce((s, r) => s + r.faturado, 0);
  const totalRecebido = receita.reduce((s, r) => s + r.recebido, 0);
  const totalPacientes = receita.reduce((s, r) => s + r.pacientes, 0);
  const totalNfs = receita.reduce((s, r) => s + r.nfsEmitidas, 0);
  const totalSessoes = receita.reduce((s, r) => s + r.sessoes, 0);

  return (
    <BrandTable>
      <BrandTableHeader>
        <BrandTableRow>
          <BrandTableHead className="min-w-[180px]">Convênio</BrandTableHead>
          <BrandTableHead className="w-20 text-right">Pac.</BrandTableHead>
          {mostrarSessoes && <BrandTableHead className="w-20 text-right">Sess.</BrandTableHead>}
          <BrandTableHead className="w-20 text-right">NFs</BrandTableHead>
          <BrandTableHead className="min-w-[120px] text-right">Faturado</BrandTableHead>
          <BrandTableHead className="min-w-[120px] text-right">Recebido</BrandTableHead>
          <BrandTableHead className="min-w-[140px]">Recebimento</BrandTableHead>
        </BrandTableRow>
      </BrandTableHeader>
      <BrandTableBody>
        {receita.map((d) => {
          const selecionado = filtroConvenio === d.convenio;
          const pct = recebimentoPct(d.faturado, d.recebido);
          return (
            <BrandTableRow
              key={d.convenio}
              data-state={selecionado ? "selected" : undefined}
              className={cn(
                "cursor-pointer",
                selecionado && "border-l-[3px] border-l-cb-cyan-600 bg-cb-cyan-050",
              )}
              onClick={() => onSelectConvenio(filtroConvenio === d.convenio ? null : d.convenio)}
            >
              <BrandTableCell>
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cb-cyan-050 text-[11px] font-bold text-cb-cyan-800 ring-1 ring-cb-cyan-100">
                    {convenioInitials(d.convenio)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-cb-ink">{d.convenio}</p>
                    {selecionado && (
                      <p className="text-[11px] font-medium text-cb-cyan-700">Filtrando extrato</p>
                    )}
                  </div>
                </div>
              </BrandTableCell>
              <BrandTableNumCell className="text-cb-muted">
                {formatCount(d.pacientes)}
              </BrandTableNumCell>
              {mostrarSessoes && (
                <BrandTableNumCell className="text-cb-muted">
                  {formatCount(d.sessoes)}
                </BrandTableNumCell>
              )}
              <BrandTableNumCell className="text-cb-muted">
                {formatCount(d.nfsEmitidas)}
              </BrandTableNumCell>
              <BrandTableNumCell className="font-medium text-cb-ink">
                {brl(d.faturado)}
              </BrandTableNumCell>
              <BrandTableNumCell
                className={cn("font-semibold", d.recebido > 0 ? "text-[#059669]" : "text-cb-muted")}
              >
                {brl(d.recebido)}
              </BrandTableNumCell>
              <BrandTableCell>
                <div className="flex items-center gap-2.5">
                  <div className="h-2 min-w-[72px] flex-1 overflow-hidden rounded-full bg-muted/50">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct >= 80
                          ? "bg-[#34C759]"
                          : pct >= 40
                            ? "bg-cb-orange"
                            : pct > 0
                              ? "bg-cb-magenta"
                              : "bg-muted",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-cb-muted">
                    {pct}%
                  </span>
                </div>
              </BrandTableCell>
            </BrandTableRow>
          );
        })}
        <BrandTableRow className="bg-muted/30 hover:bg-muted/30">
          <BrandTableCell className="font-bold text-cb-ink">Total</BrandTableCell>
          <BrandTableNumCell className="font-semibold text-cb-ink">
            {totalPacientes}
          </BrandTableNumCell>
          {mostrarSessoes && (
            <BrandTableNumCell className="font-semibold text-cb-ink">
              {totalSessoes > 0 ? totalSessoes : "—"}
            </BrandTableNumCell>
          )}
          <BrandTableNumCell className="font-semibold text-cb-ink">
            {totalNfs > 0 ? totalNfs : "—"}
          </BrandTableNumCell>
          <BrandTableNumCell className="font-bold text-cb-ink">
            {brl(totalFaturado)}
          </BrandTableNumCell>
          <BrandTableNumCell className="font-bold text-[#059669]">
            {brl(totalRecebido)}
          </BrandTableNumCell>
          <BrandTableCell>
            <span className="text-xs font-semibold tabular-nums text-cb-muted">
              {recebimentoPct(totalFaturado, totalRecebido)}% do faturado
            </span>
          </BrandTableCell>
        </BrandTableRow>
      </BrandTableBody>
    </BrandTable>
  );
}

export function DashboardFinanceiro() {
  const now = new Date();
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const parsedComp = parseCompetencia(competencia);
  const mes = parsedComp?.mes ?? now.getMonth() + 1;
  const ano = parsedComp?.ano ?? now.getFullYear();
  const [filtroConvenio, setFiltroConvenio] = useState<string | null>(null);
  const [exportSelectKey, setExportSelectKey] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const kpisQuery = useQuery({
    queryKey: queryKeys.financeiro.kpisPorTipo(ano, mes),
    queryFn: () => fetchFinanceiroKpisPorTipo(mes, ano),
  });
  const statusKpisQuery = useQuery({
    queryKey: queryKeys.financeiro.kpis(ano, mes),
    queryFn: () => fetchFinanceiroKpis(mes, ano),
  });
  const receitaMensalQuery = useQuery(receitaMensalOptions(now.getFullYear()));
  const historicoQuery = useQuery(financeiroKpisHistoricoOptions());
  const receitaQuery = useQuery({
    queryKey: queryKeys.financeiro.receitaConvenio(ano, mes),
    queryFn: () => fetchRelatorioReceitaConvenio(mes, ano),
  });
  const extratoQuery = useQuery({
    queryKey: queryKeys.financeiro.extrato(ano, mes),
    queryFn: () => fetchExtratoFinanceiro(mes, ano),
  });

  const kpis = kpisQuery.data ?? [];
  const statusKpis = statusKpisQuery.data;
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
  const mesSlug = mesAbrev(mes);
  const sufixoArquivo = filtroConvenio ? slugArquivo(filtroConvenio) : "todos";

  const totalFaturadoConvenio = receitaVisivel.reduce((s, r) => s + r.faturado, 0);
  const totalRecebidoConvenio = receitaVisivel.reduce((s, r) => s + r.recebido, 0);

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
      `extrato-financeiro-${mesSlug}-${ano}-${sufixoArquivo}.csv`,
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
    a.download = `extrato-financeiro-${mesSlug}-${ano}-${sufixoArquivo}.xlsx`;
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
      `receita-convenio-${mesSlug}-${ano}-${sufixoArquivo}.csv`,
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
    a.download = `receita-convenio-${mesSlug}-${ano}-${sufixoArquivo}.xlsx`;
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

  const loadingKpis =
    !kpisQuery.data && !statusKpisQuery.data && (kpisQuery.isPending || statusKpisQuery.isPending);
  const kpisError = kpisQuery.isError || statusKpisQuery.isError;
  const loadingReceita = !receitaQuery.data && receitaQuery.isPending;
  const loadingExtrato = !extratoQuery.data && extratoQuery.isPending;

  const tipoBarItems = (["particular", "judicial", "convenio", "puc"] as PacienteTipo[]).map(
    (tipo) => ({
      label: TIPO_KPI[tipo].label,
      value: kpiMap[tipo]?.valor ?? 0,
      colorClass: TIPO_BAR_COLORS[tipo],
    }),
  );

  const recebimentoPctMeta =
    totalFaturadoConvenio > 0
      ? Math.min(100, Math.round((totalRecebidoConvenio / totalFaturadoConvenio) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <DataToolbar className="justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-cb-muted">
            Competência ·{" "}
            <span className="font-semibold capitalize text-cb-ink">
              {competenciaLabel(mes, ano)}
            </span>
          </p>
          {filtroConvenio && receitaSelecionada && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Badge variant="secondary" className="font-normal">
                Convênio · {filtroConvenio}
              </Badge>
              <span className="text-xs text-cb-muted">
                {brl(receitaSelecionada.faturado)} faturado · {brl(receitaSelecionada.recebido)}{" "}
                recebido
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setFiltroConvenio(null)}
              >
                <X className="h-3.5 w-3.5" />
                Limpar
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CompetenciaFilterChip value={competencia} onChange={setCompetencia} />
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
      </DataToolbar>

      {loadingKpis ? (
        <LoadingState />
      ) : kpisError ? (
        <EmptyState
          title="Não foi possível carregar os KPIs"
          description="Tente recarregar a página ou alterar a competência."
        />
      ) : (
        <>
          <KpiGrid columns={4}>
            <KpiCard
              label="Total faturado"
              value={brl(statusKpis?.total ?? totalReceita)}
              accent="cyan"
              icon={<TrendingUp className="h-5 w-5" />}
              hint={competenciaLabel(mes, ano)}
              share={100}
            />
            <KpiCard
              label="Pago"
              value={brl(statusKpis?.pago ?? 0)}
              accent="lime"
              icon={<CheckCircle2 className="h-5 w-5" />}
              hint={`${statusKpis?.qtdPago ?? 0} cobrança(s)`}
              share={
                (statusKpis?.total ?? 0) > 0
                  ? ((statusKpis?.pago ?? 0) / (statusKpis?.total ?? 1)) * 100
                  : 0
              }
            />
            <KpiCard
              label="Pendente"
              value={brl(statusKpis?.pendente ?? 0)}
              accent="orange"
              icon={<Clock className="h-5 w-5" />}
              hint={`${statusKpis?.qtdPendente ?? 0} cobrança(s)`}
              share={
                (statusKpis?.total ?? 0) > 0
                  ? ((statusKpis?.pendente ?? 0) / (statusKpis?.total ?? 1)) * 100
                  : 0
              }
            />
            <KpiCard
              label="Vencido"
              value={brl(statusKpis?.vencido ?? 0)}
              accent="magenta"
              icon={<AlertTriangle className="h-5 w-5" />}
              hint={`${statusKpis?.qtdVencido ?? 0} cobrança(s)`}
              share={
                (statusKpis?.total ?? 0) > 0
                  ? ((statusKpis?.vencido ?? 0) / (statusKpis?.total ?? 1)) * 100
                  : 0
              }
            />
          </KpiGrid>

          {(statusKpis?.total ?? 0) > 0 && (
            <StatusDistributionBar
              totalLabel={`Status cobrança · ${competenciaLabel(mes, ano)}`}
              segments={[
                { label: "Pago", value: statusKpis?.pago ?? 0, colorClass: "bg-cb-lime" },
                { label: "Pendente", value: statusKpis?.pendente ?? 0, colorClass: "bg-cb-orange" },
                { label: "Vencido", value: statusKpis?.vencido ?? 0, colorClass: "bg-cb-magenta" },
              ]}
            />
          )}
        </>
      )}

      <DashboardSection
        eyebrow="Financeiro"
        accent="purple"
        title="Receita mensal por tipo"
        description="Últimos 6 meses — janela rolling, independente da competência selecionada"
        actions={<ReceitaMensalLegend />}
        noPadding
        bodyClassName="px-4 pb-4 pt-2 sm:px-6"
      >
        <ReceitaMensalChart data={receitaMensalQuery.data ?? []} />
      </DashboardSection>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardSection
          eyebrow="Recebimento"
          accent="lime"
          title="Meta de recebimento"
          badge={
            <DashboardSectionBadge accent="lime">
              {competenciaCurta(mes, ano)}
            </DashboardSectionBadge>
          }
          compact
          noPadding
          bodyClassName={FINANCE_WIDGET_BODY}
        >
          {loadingReceita ? (
            <LoadingState compact />
          ) : (
            <RecebimentoGaugeChart
              recebido={totalRecebidoConvenio}
              faturado={totalFaturadoConvenio}
              className="h-full w-full"
            />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Share"
          title="Recebimento por convênio"
          badge={
            <DashboardSectionBadge accent="purple">
              {recebimentoPctMeta}% recebido
            </DashboardSectionBadge>
          }
          accent="purple"
          compact
          noPadding
          bodyClassName={FINANCE_WIDGET_BODY}
        >
          {loadingReceita ? (
            <LoadingState compact />
          ) : (
            <RecebimentoPorConvenioPie
              className="h-[200px] w-full"
              rows={receitaVisivel.map((r) => ({ convenio: r.convenio, recebido: r.recebido }))}
            />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Convênios"
          accent="cyan"
          title="Top convênios (faturado)"
          badge={
            <DashboardSectionBadge accent="cyan">
              {competenciaCurta(mes, ano)}
            </DashboardSectionBadge>
          }
          compact
          noPadding
          bodyClassName={FINANCE_WIDGET_BODY}
        >
          {loadingReceita ? (
            <LoadingState compact />
          ) : (
            <TopConveniosBarChart className="h-[200px] w-full" rows={receitaVisivel} />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Histórico"
          accent="orange"
          title="Pago vs pendente"
          badge={<DashboardSectionBadge accent="orange">6 meses</DashboardSectionBadge>}
          compact
          noPadding
          bodyClassName={FINANCE_WIDGET_BODY}
        >
          <CobrancaTrendLineChart className="h-[220px] w-full" data={historicoQuery.data ?? []} />
        </DashboardSection>
      </div>

      {!loadingKpis && totalReceita > 0 ? (
        <DashboardSection
          eyebrow="Composição"
          title="Receita por tipo"
          badge={<DashboardSectionBadge accent="orange">{brl(totalReceita)}</DashboardSectionBadge>}
          accent="orange"
          noPadding
          bodyClassName="p-6"
        >
          <HorizontalMetricBars title="" items={tipoBarItems} formatValue={brl} />
        </DashboardSection>
      ) : !loadingKpis ? (
        <DashboardSection
          eyebrow="Composição"
          accent="orange"
          title="Receita por tipo"
          badge={
            <DashboardSectionBadge accent="orange">
              {competenciaCurta(mes, ano)}
            </DashboardSectionBadge>
          }
          noPadding
          bodyClassName="flex min-h-[120px] items-center justify-center p-6"
        >
          <p className="text-sm text-cb-muted">Sem receita na competência selecionada.</p>
        </DashboardSection>
      ) : null}

      <DashboardSection
        eyebrow="Financeiro"
        title="Receita por convênio"
        badge={
          <DashboardSectionBadge accent="cyan">{competenciaCurta(mes, ano)}</DashboardSectionBadge>
        }
        description="Clique em uma linha para filtrar o extrato e exportar só aquele convênio ou tipo."
        accent="cyan"
        actions={
          !loadingReceita && receita.length > 0 ? (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cb-muted">
                Faturado
              </p>
              <p className="text-lg font-bold tabular-nums text-cb-ink">
                {brl(totalFaturadoConvenio)}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-[#059669]">
                {brl(totalRecebidoConvenio)} recebido
              </p>
            </div>
          ) : undefined
        }
        noPadding
        bodyClassName="overflow-x-auto"
      >
        {loadingReceita ? (
          <div className="p-6">
            <LoadingState />
          </div>
        ) : receita.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Sem dados"
              description="Não há cobranças de convênio nesta competência."
            />
          </div>
        ) : (
          <ReceitaConvenioPanel
            receita={receita}
            filtroConvenio={filtroConvenio}
            onSelectConvenio={setFiltroConvenio}
          />
        )}
      </DashboardSection>

      <DashboardSection
        eyebrow="Detalhamento"
        title={filtroConvenio ? `Extrato · ${filtroConvenio}` : "Extrato da competência"}
        badge={
          <DashboardSectionBadge accent="purple">
            {competenciaLabel(mes, ano)}
          </DashboardSectionBadge>
        }
        description={
          filtroConvenio
            ? "Linhas filtradas conforme a receita selecionada acima."
            : "Todas as cobranças do mês. Selecione um convênio na tabela para exportar por grupo."
        }
        accent="purple"
        actions={
          !loadingExtrato && linhas.length > 0 ? (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cb-muted">
                Cobranças
              </p>
              <p className="text-lg font-bold tabular-nums text-cb-ink">{linhas.length}</p>
              {extratoVisivel && (
                <p className="mt-0.5 text-xs tabular-nums text-[#059669]">
                  {brl(extratoVisivel.totalRecebido)} recebido
                </p>
              )}
            </div>
          ) : undefined
        }
        noPadding
        bodyClassName="overflow-x-auto"
      >
        {loadingExtrato ? (
          <div className="p-6">
            <LoadingState />
          </div>
        ) : linhas.length === 0 ? (
          <div className="p-6">
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
          </div>
        ) : (
          <div ref={printRef}>
            <div className="hidden print:block px-6 py-4 border-b bg-cb-cyan-050/50">
              <h3 className="font-bold text-sm">{competenciaLabel(mes, ano)}</h3>
              <p className="text-xs text-muted-foreground">
                CB MOVE Neuroscience · Relatório Financeiro
                {filtroConvenio ? ` · ${filtroConvenio}` : ""}
              </p>
            </div>
            <Table>
              <TableHeader className="bg-cb-cyan-050 dark:bg-secondary">
                <TableRow>
                  <TableHead className="text-[10.5px] font-bold uppercase tracking-wide text-cb-muted">
                    Nome do Paciente
                  </TableHead>
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
        )}
        <p className="border-t px-6 py-3 text-xs text-cb-muted">
          Frequência e dias vêm da cobrança ou do cadastro do paciente. Edite em Pacientes ou ao
          criar a cobrança.
        </p>
      </DashboardSection>
    </div>
  );
}
