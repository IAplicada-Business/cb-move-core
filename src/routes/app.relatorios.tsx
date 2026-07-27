import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Gavel,
  GraduationCap,
  Loader2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { MonthPicker } from "@/components/domain/MonthPicker";
import { queryKeys } from "@/lib/queries";
import { fetchPacientes } from "@/lib/queries/pacientes";
import { gerarRelatorioMensal } from "@/lib/queries/prontuario";
import { openRelatorioPdf } from "@/lib/relatorio-pdf-url";
import { supabase } from "@/integrations/supabase/client";
import type { PacienteTipo } from "@/lib/types";
import { assertFinanceAccess } from "@/lib/route-access";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · CB MOVE" }] }),
  beforeLoad: () => assertFinanceAccess(),
  component: RelatoriosPage,
});

const TIPO_RELATORIO: Record<
  PacienteTipo,
  { label: string; descricao: string; icon: typeof Briefcase; accent: string }
> = {
  particular: {
    label: "Particular",
    descricao: "Modelo convencional de relatório de atendimento",
    icon: Briefcase,
    accent: "text-cb-cyan-600 bg-cb-cyan-050",
  },
  judicial: {
    label: "Judicial",
    descricao: "Modelo para processos judiciais",
    icon: Gavel,
    accent: "text-cb-magenta bg-[#FDF2F8]",
  },
  convenio: {
    label: "Convênio",
    descricao: "Modelo Unimed / convênios — gere para 1 paciente ou para todos de uma vez",
    icon: Building2,
    accent: "text-purple-600 bg-purple-50",
  },
  puc: {
    label: "PUC",
    descricao: "Modelo institucional PUC",
    icon: GraduationCap,
    accent: "text-cb-orange bg-[#FFF7ED]",
  },
};

type RelatorioGerado = {
  relatorio_id: string;
  modelo: string;
  paciente_nome: string;
  competencia: string;
  total_sessoes: number;
  pdf_url?: string;
};

type ConvenioOpcao = { id: string; nome: string };

async function fetchConveniosAtivos(): Promise<ConvenioOpcao[]> {
  const { data, error } = await supabase
    .from("convenios")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as ConvenioOpcao[];
}

type LoteResultado = {
  pacienteId: string;
  pacienteNome: string;
  status: "ok" | "erro";
  detalhe: string;
  pdfUrl?: string;
};

function GerarRelatorioDialog({ tipo, onClose }: { tipo: PacienteTipo; onClose: () => void }) {
  const cfg = TIPO_RELATORIO[tipo];
  const now = new Date();
  const [convenioId, setConvenioId] = useState("");
  const [pacienteId, setPacienteId] = useState("");
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [resultado, setResultado] = useState<RelatorioGerado | null>(null);
  const [lote, setLote] = useState<LoteResultado[] | null>(null);
  const [loteRodando, setLoteRodando] = useState(false);
  const queryClient = useQueryClient();

  const conveniosQuery = useQuery({
    queryKey: queryKeys.convenios.all,
    queryFn: fetchConveniosAtivos,
    enabled: tipo === "convenio",
  });

  const pacientesQuery = useQuery({
    queryKey: queryKeys.pacientes.list({ tipo, ativo: true }),
    queryFn: () => fetchPacientes({ tipo, ativo: true }),
  });

  const pacientesFiltrados = (pacientesQuery.data ?? []).filter(
    (p) => tipo !== "convenio" || !convenioId || p.convenioId === convenioId,
  );

  const gerarMutation = useMutation({
    mutationFn: () => gerarRelatorioMensal({ pacienteId, mes, ano }),
    onSuccess: (data) => {
      setResultado(data as RelatorioGerado);
      void queryClient.invalidateQueries({ queryKey: queryKeys.relatorios.byPaciente(pacienteId) });
      toast.success("Relatório gerado com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function gerarEmLote() {
    if (pacientesFiltrados.length === 0) return;
    setLoteRodando(true);
    setLote([]);
    const resultados: LoteResultado[] = [];
    for (const p of pacientesFiltrados) {
      try {
        const data = (await gerarRelatorioMensal({
          pacienteId: p.id,
          mes,
          ano,
        })) as RelatorioGerado;
        resultados.push({
          pacienteId: p.id,
          pacienteNome: p.nome,
          status: "ok",
          detalhe: `${data.total_sessoes} sessão(ões) no período`,
          pdfUrl: data.pdf_url,
        });
      } catch (e) {
        resultados.push({
          pacienteId: p.id,
          pacienteNome: p.nome,
          status: "erro",
          detalhe: e instanceof Error ? e.message : "Erro ao gerar relatório",
        });
      }
      setLote([...resultados]);
    }
    setLoteRodando(false);
    void queryClient.invalidateQueries({ queryKey: ["prontuario", "relatorios"] });
    const ok = resultados.filter((r) => r.status === "ok").length;
    if (ok === resultados.length) toast.success(`${ok} relatório(s) gerado(s) com sucesso`);
    else toast.warning(`${ok}/${resultados.length} relatório(s) gerado(s) — verifique os erros`);
  }

  const paciente = pacientesQuery.data?.find((p) => p.id === pacienteId);
  const convenioSelecionado = conveniosQuery.data?.find((c) => c.id === convenioId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <cfg.icon className="h-5 w-5" />
            Relatório de atendimento — {cfg.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{cfg.descricao}</p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Competência</label>
            <MonthPicker
              mes={mes}
              ano={ano}
              onChange={(m, a) => {
                setMes(m);
                setAno(a);
                setResultado(null);
                setLote(null);
              }}
              className="w-full"
            />
          </div>

          {tipo === "convenio" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Convênio</label>
              <Select
                value={convenioId}
                onValueChange={(v) => {
                  setConvenioId(v);
                  setPacienteId("");
                  setResultado(null);
                  setLote(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o convênio…" />
                </SelectTrigger>
                <SelectContent>
                  {(conveniosQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {tipo === "convenio" ? "Paciente (opcional para gerar 1 de cada vez)" : "Paciente"}
            </label>
            <Select
              value={pacienteId}
              onValueChange={(v) => {
                setPacienteId(v);
                setResultado(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o paciente…" />
              </SelectTrigger>
              <SelectContent>
                {pacientesQuery.isLoading && (
                  <SelectItem value="__loading" disabled>
                    Carregando…
                  </SelectItem>
                )}
                {pacientesFiltrados.length === 0 && (
                  <SelectItem value="__empty" disabled>
                    Nenhum paciente encontrado
                  </SelectItem>
                )}
                {pacientesFiltrados.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {resultado && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Paciente:</span>{" "}
                <span className="font-medium">{resultado.paciente_nome}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Competência:</span> {resultado.competencia}
              </p>
              <p>
                <span className="text-muted-foreground">Sessões no período:</span>{" "}
                {resultado.total_sessoes}
              </p>
              {resultado.pdf_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={() => {
                    void openRelatorioPdf(resultado.pdf_url).catch((e: Error) =>
                      toast.error(e.message),
                    );
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir PDF
                </Button>
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!pacienteId || gerarMutation.isPending}
            onClick={() => gerarMutation.mutate()}
          >
            <FileText className="h-4 w-4 mr-1.5" />
            {gerarMutation.isPending ? "Gerando…" : "Gerar relatório deste paciente"}
          </Button>

          {tipo === "convenio" && convenioId && pacientesFiltrados.length > 0 && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={loteRodando}
              onClick={gerarEmLote}
            >
              {loteRodando ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1.5" />
              )}
              {loteRodando
                ? `Gerando… (${lote?.length ?? 0}/${pacientesFiltrados.length})`
                : `Gerar para todos os ${pacientesFiltrados.length} pacientes de ${convenioSelecionado?.nome ?? "este convênio"}`}
            </Button>
          )}

          {lote && lote.length > 0 && (
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {lote.map((r) => (
                <div key={r.pacienteId} className="flex items-center gap-2 text-sm">
                  {r.status === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#047857]" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span className="flex-1 truncate">{r.pacienteNome}</span>
                  {r.pdfUrl ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-cb-cyan-700 hover:underline"
                      onClick={() => {
                        void openRelatorioPdf(r.pdfUrl).catch((e: Error) => toast.error(e.message));
                      }}
                    >
                      PDF
                    </button>
                  ) : (
                    <span
                      className="shrink-0 truncate text-xs text-muted-foreground"
                      title={r.detalhe}
                    >
                      {r.detalhe}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {paciente && !paciente.email && (
            <p className="text-xs text-muted-foreground">
              Dica: cadastre um e-mail para este paciente para poder enviar o relatório
              automaticamente.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RelatoriosPage() {
  const [tipoSelecionado, setTipoSelecionado] = useState<PacienteTipo | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios por tipo de atendimento</h1>
          <p className="text-sm text-muted-foreground">
            Escolha o tipo de paciente para gerar o relatório de atendimento no modelo
            correspondente. Para convênios, é possível gerar de uma vez para todos os pacientes
            vinculados.
          </p>
        </div>
        <Button variant="outline" asChild className="gap-2">
          <Link to="/app/financeiro">
            <TrendingUp className="h-4 w-4" /> Dashboard Financeiro
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(TIPO_RELATORIO) as PacienteTipo[]).map((tipo) => {
          const cfg = TIPO_RELATORIO[tipo];
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => setTipoSelecionado(tipo)}
              className="rounded-xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${cfg.accent}`}
              >
                <cfg.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-semibold">{cfg.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{cfg.descricao}</p>
            </button>
          );
        })}
      </div>

      {tipoSelecionado && (
        <GerarRelatorioDialog tipo={tipoSelecionado} onClose={() => setTipoSelecionado(null)} />
      )}
    </div>
  );
}
