import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, History, Search } from "lucide-react";
import { toast } from "sonner";

import { DataToolbarSearch } from "@/components/brand/DataToolbar";
import { DashboardSection } from "@/components/domain/DashboardSection";
import { EmptyState } from "@/components/domain/EmptyState";
import { FilterChip } from "@/components/domain/FilterChip";
import { LoadingState } from "@/components/domain/LoadingState";
import { mesLabel } from "@/components/domain/prontuario/constants";
import { tipoPacienteLabel } from "@/components/domain/prontuario/utils";
import { queryKeys } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import {
  fetchRelatoriosAtendimentoHistorico,
  type RelatorioAtendimentoHistoricoRow,
} from "@/lib/queries/relatorios-atendimento";
import { RelatorioArquivoMenu } from "@/components/domain/RelatorioArquivoMenu";
import { relatorioFormatoBadge } from "@/lib/domain/relatorio-renderers";
import { supabase } from "@/integrations/supabase/client";
import type { PacienteTipo } from "@/lib/types";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

type ConvenioOpcao = { id: string; nome: string };

const TIPO_OPCOES: { value: PacienteTipo | "all"; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "particular", label: "Particular" },
  { value: "judicial", label: "Judicial" },
  { value: "convenio", label: "Convênio" },
  { value: "puc", label: "PUC" },
];

async function fetchConveniosAtivos(): Promise<ConvenioOpcao[]> {
  const { data, error } = await supabase
    .from("convenios")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as ConvenioOpcao[];
}

function modeloRelatorioLabel(row: RelatorioAtendimentoHistoricoRow): string {
  if (row.modelo_pdf === "documento_fisico") return "Documento físico";
  return row.modelo.charAt(0).toUpperCase() + row.modelo.slice(1);
}

function statusBadge(row: RelatorioAtendimentoHistoricoRow) {
  if (row.assinado) {
    return (
      <Badge variant="outline" className="border-[#047857] text-[#047857]">
        Assinado
      </Badge>
    );
  }
  if (row.status) {
    return <Badge variant="secondary">{row.status}</Badge>;
  }
  if (row.pdf_url) {
    return <Badge variant="outline">Gerado</Badge>;
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Sem PDF
    </Badge>
  );
}

export function RelatoriosHistoricoTab() {
  const [tipo, setTipo] = useState<PacienteTipo | "all">("all");
  const [convenioId, setConvenioId] = useState("__all__");
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => ({
      tipo,
      convenioId: tipo === "convenio" && convenioId !== "__all__" ? convenioId : undefined,
      search,
    }),
    [tipo, convenioId, search],
  );

  const historicoQuery = useQuery({
    queryKey: queryKeys.relatorios.historico(filters),
    queryFn: () => fetchRelatoriosAtendimentoHistorico(filters),
  });

  const conveniosQuery = useQuery({
    queryKey: queryKeys.convenios.all,
    queryFn: fetchConveniosAtivos,
    enabled: tipo === "convenio",
  });

  const rows = historicoQuery.data ?? [];

  const filterActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <FilterChip
        prefix="Tipo"
        value={tipo}
        options={TIPO_OPCOES.map((o) => ({ value: o.value, label: o.label }))}
        onChange={(v) => {
          setTipo(v as PacienteTipo | "all");
          setConvenioId("__all__");
        }}
      />

      {tipo === "convenio" && (
        <Select value={convenioId} onValueChange={setConvenioId}>
          <SelectTrigger className="h-9 w-[180px] rounded-lg text-xs">
            <SelectValue placeholder="Convênio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os convênios</SelectItem>
            {(conveniosQuery.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <DataToolbarSearch className="h-9 min-w-[220px] max-w-xs flex-none rounded-lg border border-border bg-background px-2.5">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar paciente…"
          aria-label="Buscar paciente"
          className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </DataToolbarSearch>
    </div>
  );

  return (
    <DashboardSection
      eyebrow="Relatórios"
      accent="cyan"
      title="Histórico de relatórios"
      actions={filterActions}
      noPadding
      bodyClassName="p-0"
    >
      {historicoQuery.isLoading ? (
        <div className="p-6">
          <LoadingState />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<History className="h-8 w-8" />}
            title="Nenhum relatório encontrado"
            description="Altere os filtros ou gere relatórios na aba Gerar."
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Sessões</TableHead>
              <TableHead>Gerado em</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    to="/app/prontuario/$pacienteId"
                    params={{ pacienteId: r.paciente_id }}
                    search={{ tab: "periodizacao-documentos" }}
                    className="font-medium text-cb-cyan-800 hover:underline"
                  >
                    {r.paciente_nome}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">
                  {mesLabel(r.competencia_mes, r.competencia_ano).toLowerCase()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tipoPacienteLabel(r.paciente_tipo, r.convenio_nome)}
                </TableCell>
                <TableCell>{modeloRelatorioLabel(r)}</TableCell>
                <TableCell>{r.num_sessoes ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {relatorioFormatoBadge(
                      r.formato_arquivo as "pdf" | "xlsx" | "dual" | "docx" | null,
                      !!r.xlsx_url,
                    )}
                  </Badge>
                </TableCell>
                <TableCell>{statusBadge(r)}</TableCell>
                <TableCell className="text-right">
                  <RelatorioArquivoMenu
                    pdfUrl={r.pdf_url}
                    xlsxUrl={r.xlsx_url}
                    formatoArquivo={r.formato_arquivo as "pdf" | "xlsx" | "dual" | "docx" | null}
                    onError={(e) => toast.error(e.message)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!historicoQuery.isLoading && rows.some((r) => r.modelo_pdf === "documento_fisico") && (
        <p className="flex items-start gap-2 border-t border-border px-6 py-4 text-xs text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Relatórios importados como documento físico também aparecem neste histórico.
        </p>
      )}
    </DashboardSection>
  );
}
