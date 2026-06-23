import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { DollarSign, Clock, AlertTriangle, FileCheck2 } from "lucide-react";
import { KpiCard } from "@/components/domain/KpiCard";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { fetchAllCobrancas, fetchRecentCobrancas } from "@/lib/queries/cobrancas";
import { countNotasMonth } from "@/lib/queries/notas-fiscais";
import { queryKeys } from "@/lib/queries";
import { agregarPorMes, calcularKpis } from "@/lib/domain/faturamento";
import { brl, formatDate } from "@/lib/format";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard · CB MOVE" }] }),
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const all = useQuery({ queryKey: queryKeys.cobrancas.all, queryFn: fetchAllCobrancas });
  const recent = useQuery({ queryKey: queryKeys.cobrancas.recent(10), queryFn: () => fetchRecentCobrancas(10) });
  const nfCount = useQuery({
    queryKey: queryKeys.notasFiscais.monthCount(now.getFullYear(), now.getMonth()),
    queryFn: () => countNotasMonth(now.getFullYear(), now.getMonth()),
  });

  const kpis = calcularKpis(all.data ?? []);
  const chartData = agregarPorMes(all.data ?? [], 6);
  const hasChartData = chartData.some((d) => d.total > 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do mês corrente</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Receita do mês" value={brl(kpis.receita)} accent="cyan" icon={<DollarSign className="h-4 w-4 text-cb-cyan-600" />} />
        <KpiCard label="A receber" value={brl(kpis.aReceber)} accent="orange" icon={<Clock className="h-4 w-4 text-cb-orange" />} />
        <KpiCard label="Inadimplência" value={brl(kpis.inadimplencia)} accent="magenta" icon={<AlertTriangle className="h-4 w-4 text-cb-magenta" />} />
        <KpiCard label="NFs emitidas" value={nfCount.data ?? 0} accent="lime" icon={<FileCheck2 className="h-4 w-4" style={{ color: "var(--cb-lime)" }} />} />
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Receita por mês × tipo</h2>
        {all.isLoading ? (
          <LoadingState />
        ) : !hasChartData ? (
          <EmptyState title="Sem faturamento" description="Quando houver cobranças, o gráfico aparece aqui." />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cb-line)" />
                <XAxis dataKey="mes" stroke="var(--cb-muted)" fontSize={12} />
                <YAxis stroke="var(--cb-muted)" fontSize={12} tickFormatter={(v) => brl(v).replace("R$", "")} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend />
                <Bar dataKey="particular" stackId="a" fill="var(--cb-cyan-600)" name="Particular" />
                <Bar dataKey="judicial" stackId="a" fill="var(--cb-magenta)" name="Judicial" />
                <Bar dataKey="convenio" stackId="a" fill="var(--cb-purple)" name="Convênio" />
                <Bar dataKey="puc" stackId="a" fill="var(--cb-orange)" name="PUC" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card shadow-sm">
        <header className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Últimas cobranças</h2>
        </header>
        {recent.isLoading ? (
          <div className="p-5"><LoadingState /></div>
        ) : (recent.data ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sem cobranças" description="Crie a primeira cobrança em Financeiro › Cobranças." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recent.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.pacienteNome ?? "—"}</TableCell>
                  <TableCell><TipoBadge value={c.tipo} /></TableCell>
                  <TableCell>{brl(c.valor)}</TableCell>
                  <TableCell>{formatDate(c.vencimento)}</TableCell>
                  <TableCell><StatusBadge value={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
