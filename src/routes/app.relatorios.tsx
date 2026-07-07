import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { KpiCard } from "@/components/domain/KpiCard";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { brl } from "@/lib/format";
import { fetchNFsPorPacienteAno } from "@/lib/queries/notas-fiscais";
import { fetchPacientes } from "@/lib/queries/pacientes";
import {
  fetchFinanceiroKpisPorTipo,
  fetchRelatorioReceitaConvenio,
} from "@/lib/queries/financeiro";
import type { PacienteTipo } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · CB MOVE" }] }),
  component: RelatoriosPage,
});

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPO_KPI: Record<PacienteTipo, { label: string; accent: "cyan" | "magenta" | "purple" | "orange" }> = {
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

function anosDisponiveis() {
  const now = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => now - i);
}

function TabReceitaConvenio() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const compOpts = competenciaOpcoes();

  const kpisQuery = useQuery({
    queryKey: queryKeys.financeiro.kpisPorTipo(ano, mes),
    queryFn: () => fetchFinanceiroKpisPorTipo(mes, ano),
  });

  const tabelaQuery = useQuery({
    queryKey: queryKeys.financeiro.receitaConvenio(ano, mes),
    queryFn: () => fetchRelatorioReceitaConvenio(mes, ano),
  });

  const kpis = kpisQuery.data ?? [];
  const dados = tabelaQuery.data ?? [];
  const loading = kpisQuery.isLoading || tabelaQuery.isLoading;

  const kpiMap = Object.fromEntries(kpis.map((k) => [k.tipo, k]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">Receita por convênio</h2>
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>

      {loading ? (
        <LoadingState />
      ) : dados.length === 0 ? (
        <EmptyState
          title="Sem dados"
          description="Não há cobranças registradas para esta competência."
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
              {dados.map((d) => (
                <TableRow key={d.convenio}>
                  <TableCell className="font-medium">{d.convenio}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.pacientes}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.sessoes}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.nfsEmitidas}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(d.faturado)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{brl(d.recebido)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TabNFsPorPaciente() {
  const [pacienteId, setPacienteId] = useState<string>("");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [exportando, setExportando] = useState(false);
  const anos = anosDisponiveis();

  const pacientes = useQuery({
    queryKey: queryKeys.pacientes.list({ ativo: true }),
    queryFn: () => fetchPacientes({ ativo: true }),
  });

  const nfsQuery = useQuery({
    queryKey: ["relatorios", "nfs_paciente", pacienteId, ano],
    queryFn: () => fetchNFsPorPacienteAno(pacienteId, ano),
    enabled: !!pacienteId,
  });

  const nfs = nfsQuery.data ?? [];
  const total = nfs.reduce((s, n) => s + n.valor, 0);
  const paciente = pacientes.data?.find((p) => p.id === pacienteId);

  async function exportarIR() {
    if (!pacienteId) return;
    setExportando(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("gerar-relatorio-ir", {
        body: { paciente_id: pacienteId, ano },
      });
      if (error) throw new Error(error.message);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-ir-${paciente?.nome ?? pacienteId}-${ano}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">NFs por paciente — Declaração de IR</h2>
        <div className="flex items-center gap-2">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={pacienteId} onValueChange={setPacienteId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Selecione o paciente…" />
            </SelectTrigger>
            <SelectContent>
              {pacientes.isLoading && (
                <SelectItem value="__loading" disabled>Carregando…</SelectItem>
              )}
              {(pacientes.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {nfs.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportarIR} disabled={exportando}>
              <Download className="h-4 w-4 mr-1" />
              {exportando ? "Exportando…" : "Exportar para IR"}
            </Button>
          )}
        </div>
      </div>

      {!pacienteId ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Selecione um paciente"
          description="Escolha um paciente e o ano para ver as NFs emitidas no período."
        />
      ) : nfsQuery.isLoading ? (
        <LoadingState />
      ) : nfs.length === 0 ? (
        <EmptyState
          title="Sem NFs emitidas"
          description={`Nenhuma nota fiscal emitida para ${paciente?.nome ?? "este paciente"} em ${ano}.`}
        />
      ) : (
        <div className="space-y-2">
          {paciente && (
            <div className="rounded-lg border bg-card px-4 py-3 text-sm flex gap-6 flex-wrap">
              <div>
                <span className="text-muted-foreground">Paciente: </span>
                <span className="font-semibold">{paciente.nome}</span>
              </div>
              {paciente.cpf && (
                <div>
                  <span className="text-muted-foreground">CPF: </span>
                  <span className="font-mono">{paciente.cpf}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Ano: </span>
                <span className="font-semibold">{ano}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold text-cb-cyan-600">{brl(total)}</span>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº NF</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nfs.map((nf) => (
                  <TableRow key={nf.id}>
                    <TableCell className="font-mono text-sm">{nf.numero ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {nf.emissao
                        ? new Date(nf.emissao + "T00:00:00").toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell>{nf.destinatarioNome ?? "—"}</TableCell>
                    <TableCell>
                      <span className="text-xs font-medium capitalize text-muted-foreground">
                        {nf.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{brl(nf.valor)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={4} className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{brl(total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground px-1">
            Documento gerado pela CB MOVE Neuroscience — para fins de declaração anual de imposto de renda.
          </p>
        </div>
      )}
    </div>
  );
}

function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Relatórios consolidados</h1>
        <p className="text-sm text-muted-foreground">Análises e exportações financeiras</p>
      </header>

      <Tabs defaultValue="receita-convenio">
        <TabsList>
          <TabsTrigger value="receita-convenio">Receita por convênio</TabsTrigger>
          <TabsTrigger value="nfs-ir">NFs por paciente (IR)</TabsTrigger>
        </TabsList>

        <TabsContent value="receita-convenio" className="mt-4">
          <TabReceitaConvenio />
        </TabsContent>

        <TabsContent value="nfs-ir" className="mt-4">
          <TabNFsPorPaciente />
        </TabsContent>
      </Tabs>
    </div>
  );
}
