import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Search } from "lucide-react";

import { LoadingState } from "@/components/domain/LoadingState";
import { EmptyState } from "@/components/domain/EmptyState";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { queryKeys } from "@/lib/queries/keys";
import { fetchProntuariosConsolidados } from "@/lib/queries/prontuario-consolidado";
import { formatDate } from "@/lib/format";
import type { PacienteTipo } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/prontuarios")({
  head: () => ({ meta: [{ title: "Prontuários · CB MOVE" }] }),
  component: ProntuariosConsolidadosPage,
});

function ProntuariosConsolidadosPage() {
  const [search, setSearch] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: queryKeys.prontuariosConsolidados.list(search),
    queryFn: () => fetchProntuariosConsolidados(search),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Prontuários consolidados</h1>
        <p className="text-sm text-muted-foreground">
          Visão agregada de todos os pacientes — evoluções, relatórios e acesso rápido ao prontuário individual.
        </p>
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
                  <TableCell><TipoBadge value={row.tipo as PacienteTipo} /></TableCell>
                  <TableCell>{row.fisioPrincipal ?? "—"}</TableCell>
                  <TableCell>
                    {row.ultimaEvolucaoData ? formatDate(row.ultimaEvolucaoData) : "—"}
                  </TableCell>
                  <TableCell>{row.totalEvolucoes}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.ultimoRelatorioStatus ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/app/prontuario" search={{ pacienteId: row.pacienteId }}>
                        <FileText className="mr-1 h-3.5 w-3.5" /> Abrir
                      </Link>
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
