import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileText, Search, Users, X } from "lucide-react";

import {
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { EmptyState } from "@/components/domain/EmptyState";
import { KpiCard } from "@/components/domain/KpiCard";
import { LoadingState } from "@/components/domain/LoadingState";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ALL = "__all__";
const SEM_FISIO = "__sem_fisio__";
const SEM_RELATORIO = "__sem_relatorio__";

function isRecentDate(isoDate: string | null, days = 30): boolean {
  if (!isoDate) return false;
  const date = new Date(`${isoDate}T12:00:00`);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

export function ProntuarioVisaoGeralTab({ onOpenPaciente }: Props) {
  const [search, setSearch] = useState("");
  const [pacienteId, setPacienteId] = useState(ALL);
  const [fisio, setFisio] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: queryKeys.prontuariosConsolidados.list(),
    queryFn: () => fetchProntuariosConsolidados(),
  });

  const fisioOptions = useMemo(() => {
    const nomes = new Set<string>();
    for (const row of rows) if (row.fisioPrincipal) nomes.add(row.fisioPrincipal);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const valores = new Set<string>();
    for (const row of rows) if (row.ultimoRelatorioStatus) valores.add(row.ultimoRelatorioStatus);
    return [...valores].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const temFiltro =
    search.trim() !== "" ||
    pacienteId !== ALL ||
    fisio !== ALL ||
    status !== ALL ||
    dataDe !== "" ||
    dataAte !== "";

  function limparFiltros() {
    setSearch("");
    setPacienteId(ALL);
    setFisio(ALL);
    setStatus(ALL);
    setDataDe("");
    setDataAte("");
  }

  /** Filtro de período aplicado sobre a data da última evolução. */
  const filteredRows = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (termo && !row.pacienteNome.toLowerCase().includes(termo)) return false;
      if (pacienteId !== ALL && row.pacienteId !== pacienteId) return false;

      if (fisio === SEM_FISIO) {
        if (row.fisioPrincipal) return false;
      } else if (fisio !== ALL && row.fisioPrincipal !== fisio) {
        return false;
      }

      if (status === SEM_RELATORIO) {
        if (row.ultimoRelatorioStatus) return false;
      } else if (status !== ALL && row.ultimoRelatorioStatus !== status) {
        return false;
      }

      if (dataDe || dataAte) {
        if (!row.ultimaEvolucaoData) return false;
        if (dataDe && row.ultimaEvolucaoData < dataDe) return false;
        if (dataAte && row.ultimaEvolucaoData > dataAte) return false;
      }

      return true;
    });
  }, [rows, search, pacienteId, fisio, status, dataDe, dataAte]);

  const kpis = useMemo(() => {
    const totalEvolucoes = filteredRows.reduce((sum, row) => sum + row.totalEvolucoes, 0);
    const comEvolucao = filteredRows.filter((row) => row.totalEvolucoes > 0).length;
    const evolucaoRecente = filteredRows.filter((row) =>
      isRecentDate(row.ultimaEvolucaoData),
    ).length;
    const semRelatorio = filteredRows.filter((row) => !row.ultimoRelatorioStatus).length;

    return {
      totalPacientes: filteredRows.length,
      totalEvolucoes,
      comEvolucao,
      evolucaoRecente,
      semRelatorio,
    };
  }, [filteredRows]);

  return (
    <div className="space-y-8">
      <KpiGrid columns={4}>
        <KpiCard
          label="Pacientes ativos"
          value={kpis.totalPacientes}
          accent="cyan"
          icon={<Users className="h-5 w-5" />}
        />
        <KpiCard
          label="Evoluções registradas"
          value={kpis.totalEvolucoes}
          accent="purple"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <KpiCard
          label="Com evolução (30 dias)"
          value={kpis.evolucaoRecente}
          accent="lime"
          icon={<FileText className="h-5 w-5" />}
          hint={`${kpis.comEvolucao} pacientes com histórico`}
        />
        <KpiCard
          label="Sem relatório gerado"
          value={kpis.semRelatorio}
          accent="orange"
          icon={<FileText className="h-5 w-5" />}
        />
      </KpiGrid>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-1.5 sm:max-w-sm">
          <label className="text-sm font-medium" htmlFor="prontuario-busca">
            Buscar
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="prontuario-busca"
              className="pl-9"
              placeholder="Buscar paciente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Paciente</label>
          <Select value={pacienteId} onValueChange={setPacienteId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os pacientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os pacientes</SelectItem>
              {rows.map((row) => (
                <SelectItem key={row.pacienteId} value={row.pacienteId}>
                  {row.pacienteNome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Fisioterapeuta</label>
          <Select value={fisio} onValueChange={setFisio}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os fisios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os fisioterapeutas</SelectItem>
              <SelectItem value={SEM_FISIO}>Sem fisio principal</SelectItem>
              {fisioOptions.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="prontuario-data-de">
            Última evolução
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="prontuario-data-de"
              type="date"
              className="w-[150px]"
              value={dataDe}
              max={dataAte || undefined}
              onChange={(e) => setDataDe(e.target.value)}
              aria-label="Última evolução — data inicial"
            />
            <span className="text-sm text-muted-foreground">até</span>
            <Input
              type="date"
              className="w-[150px]"
              value={dataAte}
              min={dataDe || undefined}
              onChange={(e) => setDataAte(e.target.value)}
              aria-label="Última evolução — data final"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Status do prontuário</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os status</SelectItem>
              <SelectItem value={SEM_RELATORIO}>Sem relatório gerado</SelectItem>
              {statusOptions.map((valor) => (
                <SelectItem key={valor} value={valor}>
                  {valor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {temFiltro && (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={limparFiltros}>
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title="Nenhum paciente"
          description={
            temFiltro
              ? "Nenhum prontuário corresponde aos filtros aplicados."
              : "Não há pacientes ativos para exibir."
          }
        />
      ) : (
        <DashboardSection
          eyebrow="Prontuário"
          accent="purple"
          title="Visão geral por paciente"
          badge={
            <DashboardSectionBadge accent="purple">{filteredRows.length}</DashboardSectionBadge>
          }
          noPadding
        >
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
              {filteredRows.map((row) => (
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
        </DashboardSection>
      )}
    </div>
  );
}
