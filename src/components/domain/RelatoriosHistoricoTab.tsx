import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, FileText, History, Search } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { MonthPicker } from "@/components/domain/MonthPicker";
import { mesLabel } from "@/components/domain/prontuario/constants";
import { tipoPacienteLabel } from "@/components/domain/prontuario/utils";
import { queryKeys } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import {
  fetchRelatoriosAtendimentoHistorico,
  type RelatorioAtendimentoHistoricoRow,
} from "@/lib/queries/relatorios-atendimento";
import { openRelatorioArquivo } from "@/lib/relatorio-pdf-url";
import { relatorioFormatoBadge } from "@/lib/domain/relatorio-renderers";
import { supabase } from "@/integrations/supabase/client";
import type { PacienteTipo } from "@/lib/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [tipo, setTipo] = useState<PacienteTipo | "all">("all");
  const [convenioId, setConvenioId] = useState("__all__");
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => ({
      mes,
      ano,
      tipo,
      convenioId: tipo === "convenio" && convenioId !== "__all__" ? convenioId : undefined,
      search,
    }),
    [mes, ano, tipo, convenioId, search],
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
  const assinados = rows.filter((r) => r.assinado).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Competência</label>
          <MonthPicker
            mes={mes}
            ano={ano}
            onChange={(m, a) => {
              setMes(m);
              setAno(a);
            }}
            className="w-[200px]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tipo</label>
          <Select
            value={tipo}
            onValueChange={(v) => {
              setTipo(v as PacienteTipo | "all");
              setConvenioId("__all__");
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPO_OPCOES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tipo === "convenio" && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Convênio</label>
            <Select value={convenioId} onValueChange={setConvenioId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos os convênios" />
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
          </div>
        )}

        <div className="min-w-[220px] flex-1 space-y-1.5">
          <label className="text-sm font-medium">Buscar paciente</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome do paciente…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {!historicoQuery.isLoading && rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {rows.length} relatório(s) em {mesLabel(mes, ano).toLowerCase()}
          {assinados > 0 && ` · ${assinados} assinado(s)`}
        </p>
      )}

      {historicoQuery.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<History className="h-8 w-8" />}
          title="Nenhum relatório nesta competência"
          description="Altere os filtros ou gere relatórios na aba Gerar."
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
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
                      to="/app/prontuario"
                      search={{ pacienteId: r.paciente_id, tab: "documentos" }}
                      className="font-medium text-cb-cyan-800 hover:underline"
                    >
                      {r.paciente_nome}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tipoPacienteLabel(r.paciente_tipo, r.convenio_nome)}
                  </TableCell>
                  <TableCell>{modeloRelatorioLabel(r)}</TableCell>
                  <TableCell>{r.num_sessoes ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {relatorioFormatoBadge(
                        r.formato_arquivo as "pdf" | "xlsx" | "dual" | null,
                        !!r.xlsx_url,
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>{statusBadge(r)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.pdf_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => {
                            void openRelatorioArquivo(r.pdf_url).catch((e: Error) =>
                              toast.error(e.message),
                            );
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      )}
                      {r.xlsx_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => {
                            void openRelatorioArquivo(r.xlsx_url).catch((e: Error) =>
                              toast.error(e.message),
                            );
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          XLSX
                        </Button>
                      )}
                      {!r.pdf_url && !r.xlsx_url && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!historicoQuery.isLoading && rows.some((r) => r.modelo_pdf === "documento_fisico") && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Relatórios importados como documento físico também aparecem neste histórico.
        </p>
      )}
    </div>
  );
}
