import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ClipboardList, FileText, Search, Users, X } from "lucide-react";

import {
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { EmptyState } from "@/components/domain/EmptyState";
import { KpiCard } from "@/components/domain/KpiCard";
import { LoadingState } from "@/components/domain/LoadingState";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { DataToolbar, DataToolbarSearch } from "@/components/brand/DataToolbar";
import { FilterChip } from "@/components/domain/FilterChip";
import type { FilterChipOption } from "@/components/domain/FilterChip";
import { filterChipTriggerClass } from "@/components/domain/filter-chip-style";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeSearchText } from "@/lib/search-text";
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
const PRONTUARIO_PREVIEW_LIMIT = 5;

function isRecentDate(isoDate: string | null, days = 30): boolean {
  if (!isoDate) return false;
  const date = new Date(`${isoDate}T12:00:00`);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function periodoLabel(de: string, ate: string): string {
  if (de && ate) return `${formatDate(de)} – ${formatDate(ate)}`;
  if (de) return `desde ${formatDate(de)}`;
  if (ate) return `até ${formatDate(ate)}`;
  return "Todas";
}

/** Chip de intervalo de datas — mesmo gatilho do FilterChip, com campos de data no popover. */
function PeriodoFilterChip({
  de,
  ate,
  onChange,
}: {
  de: string;
  ate: string;
  onChange: (de: string, ate: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={filterChipTriggerClass}>
          Última evolução: {periodoLabel(de, ate)} <span className="text-muted-foreground">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-8 w-[150px]"
            value={de}
            max={ate || undefined}
            onChange={(e) => onChange(e.target.value, ate)}
            aria-label="Última evolução — data inicial"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            className="h-8 w-[150px]"
            value={ate}
            min={de || undefined}
            onChange={(e) => onChange(de, e.target.value)}
            aria-label="Última evolução — data final"
          />
        </div>
        {(de || ate) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => onChange("", "")}
          >
            Limpar período
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ProntuarioVisaoGeralTab({ onOpenPaciente }: Props) {
  const [search, setSearch] = useState("");
  const [pacienteId, setPacienteId] = useState(ALL);
  const [fisio, setFisio] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);

  useEffect(() => {
    setShowAllRows(false);
  }, [search, pacienteId, fisio, status, dataDe, dataAte]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: queryKeys.prontuariosConsolidados.list(),
    queryFn: () => fetchProntuariosConsolidados(),
  });

  const pacienteOptions = useMemo<FilterChipOption[]>(
    () => [
      { value: ALL, label: "Todos" },
      ...rows.map((row) => ({ value: row.pacienteId, label: row.pacienteNome })),
    ],
    [rows],
  );

  const fisioOptions = useMemo<FilterChipOption[]>(() => {
    const nomes = new Set<string>();
    for (const row of rows) if (row.fisioPrincipal) nomes.add(row.fisioPrincipal);
    return [
      { value: ALL, label: "Todos" },
      { value: SEM_FISIO, label: "Sem fisio principal" },
      ...[...nomes]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((nome) => ({ value: nome, label: nome })),
    ];
  }, [rows]);

  const statusOptions = useMemo<FilterChipOption[]>(() => {
    const valores = new Set<string>();
    for (const row of rows) if (row.ultimoRelatorioStatus) valores.add(row.ultimoRelatorioStatus);
    return [
      { value: ALL, label: "Todos" },
      { value: SEM_RELATORIO, label: "Sem relatório" },
      ...[...valores]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((valor) => ({ value: valor, label: valor })),
    ];
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
    const termo = search.trim();
    const termoNorm = termo ? normalizeSearchText(termo) : "";
    return rows.filter((row) => {
      if (termoNorm && !normalizeSearchText(row.pacienteNome).includes(termoNorm)) return false;
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

  const hasMoreRows = filteredRows.length > PRONTUARIO_PREVIEW_LIMIT;
  const visibleRows = showAllRows ? filteredRows : filteredRows.slice(0, PRONTUARIO_PREVIEW_LIMIT);

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

      <DataToolbar>
        <DataToolbarSearch>
          <Search className="h-4 w-4 shrink-0 text-cb-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </DataToolbarSearch>

        <FilterChip
          prefix="Paciente"
          value={pacienteId}
          options={pacienteOptions}
          onChange={setPacienteId}
        />
        <FilterChip prefix="Fisio" value={fisio} options={fisioOptions} onChange={setFisio} />
        <PeriodoFilterChip
          de={dataDe}
          ate={dataAte}
          onChange={(de, ate) => {
            setDataDe(de);
            setDataAte(ate);
          }}
        />
        <FilterChip prefix="Status" value={status} options={statusOptions} onChange={setStatus} />

        {temFiltro && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-full px-3 text-xs"
            onClick={limparFiltros}
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </DataToolbar>

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
              {visibleRows.map((row) => (
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
          {hasMoreRows && !showAllRows && (
            <div className="border-t border-border/40 px-5 py-4 text-center sm:px-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowAllRows(true)}
              >
                Ver mais
                <ChevronDown className="h-4 w-4" />
                <span className="text-cb-muted">
                  ({filteredRows.length - PRONTUARIO_PREVIEW_LIMIT} restantes)
                </span>
              </Button>
            </div>
          )}
        </DashboardSection>
      )}
    </div>
  );
}
