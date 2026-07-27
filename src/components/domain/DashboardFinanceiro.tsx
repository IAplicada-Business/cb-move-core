import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
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
} from "@/lib/domain/extrato-financeiro";
import { brl } from "@/lib/format";
import { fetchExtratoFinanceiro } from "@/lib/queries/extrato-financeiro";
import {
  fetchFinanceiroKpisPorTipo,
  fetchRelatorioReceitaConvenio,
} from "@/lib/queries/financeiro";
import type { PacienteTipo } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
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

export function DashboardFinanceiro() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
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
  const linhas = extrato?.linhas ?? [];
  const kpiMap = Object.fromEntries(kpis.map((k) => [k.tipo, k]));
  const totalReceita = kpis.reduce((s, k) => s + k.valor, 0);

  function exportarCsv() {
    if (!extrato || linhas.length === 0) return;
    const mesNome = MESES_ABREV[mes - 1] ?? String(mes);
    downloadCSV(`extrato-financeiro-${mesNome}-${ano}.csv`, extratoToCsvRows(extrato));
    toast.success("Extrato exportado em CSV");
  }

  async function exportarXlsx() {
    if (!extrato || linhas.length === 0) return;
    const mesNome = MESES_ABREV[mes - 1] ?? String(mes);
    const blob = await extratoToXlsxBlob(extrato);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-financeiro-${mesNome}-${ano}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Extrato exportado em XLSX");
  }

  function imprimir() {
    if (!printRef.current) return;
    const conteudo = printRef.current.innerHTML;
    const geradoEm = new Date().toLocaleDateString("pt-BR");
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
    </style>
  </head>
  <body>
    <div class="brand-header">
      <div class="brand-mark">${buildBrandRingSvg(28)}</div>
      <div class="brand-word"><b>CB MOVE</b><span>Neuroscience</span></div>
      <div class="brand-doc-title"><b>Extrato Financeiro</b><span>${competenciaLabel(mes, ano)}</span></div>
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

  const loadingKpis = kpisQuery.isLoading;
  const loadingReceita = receitaQuery.isLoading;
  const loadingExtrato = extratoQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold">Financeiro</h2>
          <p className="text-sm text-muted-foreground">
            Receita total, por convênio e extrato exportável
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
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void exportarXlsx().catch((e: Error) => toast.error(e.message));
            }}
            disabled={!extrato || linhas.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar XLSX
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={imprimir}
            disabled={!extrato || linhas.length === 0}
          >
            <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
          </Button>
        </div>
      </div>

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
        <h3 className="text-sm font-semibold text-foreground">Receita por convênio</h3>
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
                {receita.map((d) => (
                  <TableRow key={d.convenio}>
                    <TableCell className="font-medium">{d.convenio}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.pacientes}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.sessoes}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.nfsEmitidas}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(d.faturado)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {brl(d.recebido)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Extrato financeiro detalhado</h3>
        {loadingExtrato ? (
          <LoadingState />
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
          Frequência e dias vêm da cobrança ou do cadastro do paciente. Edite em Pacientes ou ao
          criar a cobrança.
        </p>
      </section>
    </div>
  );
}
