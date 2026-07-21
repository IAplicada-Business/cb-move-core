import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Stethoscope, CalendarClock, AlertOctagon, TrendingUp } from "lucide-react";

import { KpiCard } from "@/components/domain/KpiCard";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { dashboardHomeOptions } from "@/lib/queries/options";
import { formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard · CB MOVE" }] }),
  loader: ({ context }) => {
    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;
    return context.queryClient.ensureQueryData(dashboardHomeOptions(ano, mes));
  },
  pendingComponent: () => <LoadingState />,
  pendingMs: 200,
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const { data, isLoading } = useQuery(dashboardHomeOptions(ano, mes));

  const kpis = data?.kpis;
  const proximas = data?.proximasAgendas ?? [];
  const divergencias = data?.divergencias ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão operacional — pacientes, equipe, agendas e conformidade do prontuário
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link to="/app/financeiro">
            <TrendingUp className="h-4 w-4" />
            Dashboard Financeiro
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pacientes ativos"
          value={kpis?.totalPacientesAtivos ?? 0}
          accent="cyan"
          icon={<Users className="h-4 w-4 text-cb-cyan-600" />}
        />
        <KpiCard
          label="Fisioterapeutas ativos"
          value={kpis?.totalFisiosAtivos ?? 0}
          accent="purple"
          icon={<Stethoscope className="h-4 w-4 text-cb-purple" />}
        />
        <KpiCard
          label="Agendas próximas (7 dias)"
          value={kpis?.agendasProximas ?? 0}
          accent="orange"
          icon={<CalendarClock className="h-4 w-4 text-cb-orange" />}
          hint="Agendado ou confirmado"
        />
        <KpiCard
          label="Divergência prontuário × agenda"
          value={kpis?.divergenciaProntuario ?? 0}
          accent="magenta"
          icon={<AlertOctagon className="h-4 w-4 text-cb-magenta" />}
          hint="Realizadas no mês sem evolução"
        />
      </div>

      {(kpis?.divergenciaProntuario ?? 0) > 0 && (
        <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
          <strong>{kpis?.divergenciaProntuario}</strong> sessão(ões) marcada(s) como realizada(s) neste mês
          ainda não têm evolução registrada no prontuário. Confira a lista abaixo ou{" "}
          <Link to="/app/prontuario" className="font-medium underline">abrir prontuários</Link>.
        </div>
      )}

      <section className="rounded-xl border bg-card shadow-sm">
        <header className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Próximas agendas (7 dias)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agendamentos com status agendado ou confirmado
          </p>
        </header>
        {isLoading ? (
          <div className="p-5"><LoadingState /></div>
        ) : proximas.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nenhuma agenda nos próximos 7 dias"
              description="Novos agendamentos aparecerão aqui."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/hora</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Fisioterapeuta</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proximas.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTime(a.inicio)}
                  </TableCell>
                  <TableCell className="font-medium">{a.pacienteNome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.fisioNome}</TableCell>
                  <TableCell>
                    <StatusBadge value={a.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <footer className="border-t px-5 py-3">
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link to="/app/agenda">Ver agenda completa</Link>
          </Button>
        </footer>
      </section>

      <section className="rounded-xl border bg-card shadow-sm">
        <header className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Divergências prontuário × agenda</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sessões realizadas neste mês sem evolução registrada no mesmo dia
          </p>
        </header>
        {isLoading ? (
          <div className="p-5"><LoadingState /></div>
        ) : divergencias.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nenhuma divergência no mês"
              description="Todas as sessões realizadas têm evolução correspondente no prontuário."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {divergencias.map((d) => (
                <TableRow key={`${d.pacienteId}_${d.data}`}>
                  <TableCell className="whitespace-nowrap">{formatDate(d.data)}</TableCell>
                  <TableCell className="font-medium">{d.pacienteNome}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <Link to="/app/prontuario" search={{ pacienteId: d.pacienteId }}>
                        Abrir prontuário
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
