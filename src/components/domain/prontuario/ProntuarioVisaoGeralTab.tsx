import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileText, Search, Users } from "lucide-react";

import { EmptyState } from "@/components/domain/EmptyState";
import { KpiCard } from "@/components/domain/KpiCard";
import { LoadingState } from "@/components/domain/LoadingState";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/queries/keys";
import { fetchProntuariosConsolidados } from "@/lib/queries/prontuario-consolidado";
import type { PacienteTipo } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  onOpenPaciente: (pacienteId: string) => void;
};

function isRecentDate(isoDate: string | null, days = 30): boolean {
  if (!isoDate) return false;
  const date = new Date(`${isoDate}T12:00:00`);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

export function ProntuarioVisaoGeralTab({ onOpenPaciente }: Props) {
  const [search, setSearch] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: queryKeys.prontuariosConsolidados.list(search),
    queryFn: () => fetchProntuariosConsolidados(search),
  });

  const kpis = useMemo(() => {
    const totalEvolucoes = rows.reduce((sum, row) => sum + row.totalEvolucoes, 0);
    const comEvolucao = rows.filter((row) => row.totalEvolucoes > 0).length;
    const evolucaoRecente = rows.filter((row) => isRecentDate(row.ultimaEvolucaoData)).length;
    const semRelatorio = rows.filter((row) => !row.ultimoRelatorioStatus).length;

    return {
      totalPacientes: rows.length,
      totalEvolucoes,
      comEvolucao,
      evolucaoRecente,
      semRelatorio,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pacientes ativos"
          value={kpis.totalPacientes}
          accent="cyan"
          icon={<Users className="h-4 w-4 text-cb-cyan-600" />}
        />
        <KpiCard
          label="Evoluções registradas"
          value={kpis.totalEvolucoes}
          accent="purple"
          icon={<ClipboardList className="h-4 w-4 text-cb-purple" />}
        />
        <KpiCard
          label="Com evolução (30 dias)"
          value={kpis.evolucaoRecente}
          accent="lime"
          icon={<FileText className="h-4 w-4 text-cb-lime" />}
          hint={`${kpis.comEvolucao} pacientes com histórico`}
        />
        <KpiCard
          label="Sem relatório gerado"
          value={kpis.semRelatorio}
          accent="orange"
          icon={<FileText className="h-4 w-4 text-cb-orange" />}
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar paciente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum paciente" description="Não há pacientes ativos para exibir." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fisio principal</TableHead>
                <TableHead>Última evolução</TableHead>
                <TableHead>Evoluções</TableHead>
                <TableHead>Relatório</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.pacienteId}>
                  <TableCell className="font-medium">{row.pacienteNome}</TableCell>
                  <TableCell>
                    <TipoBadge value={row.tipo as PacienteTipo} />
                  </TableCell>
                  <TableCell>{row.fisioPrincipal ?? "—"}</TableCell>
                  <TableCell>
                    {row.ultimaEvolucaoData ? formatDate(row.ultimaEvolucaoData) : "—"}
                  </TableCell>
                  <TableCell>{row.totalEvolucoes}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.ultimoRelatorioStatus ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenPaciente(row.pacienteId)}
                    >
                      <FileText className="mr-1 h-3.5 w-3.5" /> Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
