import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { SIGLA_COLORS } from "@/components/domain/prontuario/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calcularMetricaComparecimento, formatarTaxaComparecimento } from "@/lib/domain/frequencia";
import { queryKeys } from "@/lib/queries";
import { fetchSessoesGradeMensal } from "@/lib/queries/sessoes";
import type { FrequenciaSigla, PacienteTipo } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIGLA_LABEL: Record<FrequenciaSigla, string> = {
  P: "Presente",
  F: "Falta",
  RC: "Reabilitação concluída",
  FJ: "Falta justificada",
  NJ: "Não justificada",
  NR: "Não realizada",
};
const TIPO_LABEL: Record<PacienteTipo, string> = {
  particular: "Particular",
  judicial: "Judicial",
  convenio: "Convênio",
  puc: "PUC",
};

const SIGLA_CELL: Record<FrequenciaSigla, string> = {
  P: "bg-emerald-500/15 text-emerald-700",
  F: "bg-rose-500/15 text-rose-700",
  RC: "bg-cb-cyan-050 text-cb-cyan-800",
  FJ: "bg-orange-500/15 text-orange-700",
  NJ: "bg-amber-500/15 text-amber-700",
  NR: "bg-muted text-muted-foreground",
};

type Props = {
  mes: number;
  ano: number;
  filterFisio: string;
  filterTipo: string;
  filtroTodos: string;
};

function daysInMonth(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

function toDateStr(ano: number, mes: number, day: number) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Planilha somente leitura — consolidado da tabela sessoes (alinhado ao Prontuário). */
export function FrequenciaMensalGrid({ mes, ano, filterFisio, filterTipo, filtroTodos }: Props) {
  const [busca, setBusca] = useState("");
  const days = daysInMonth(mes, ano);

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.sessoes.gradeMes(mes, ano),
    queryFn: () => fetchSessoesGradeMensal(mes, ano),
  });

  const siglasNoMes = useMemo(() => {
    const set = new Set<FrequenciaSigla>();
    for (const s of data?.sessoes ?? []) set.add(s.sigla);
    const ordem: FrequenciaSigla[] = ["P", "RC", "F", "FJ", "NJ", "NR"];
    return ordem.filter((s) => set.has(s));
  }, [data?.sessoes]);

  const siglaByPacienteDia = useMemo(() => {
    const map = new Map<string, FrequenciaSigla>();
    for (const s of data?.sessoes ?? []) {
      const key = `${s.paciente_id}|${s.data}`;
      if (!map.has(key)) map.set(key, s.sigla);
    }
    return map;
  }, [data?.sessoes]);

  const rows = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.pacientes ?? []).filter((p) => {
      if (filterFisio !== filtroTodos && p.fisioterapeuta_id !== filterFisio) return false;
      if (filterTipo !== filtroTodos && p.tipo !== filterTipo) return false;
      if (q && !p.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data?.pacientes, filterFisio, filterTipo, filtroTodos, busca]);

  function getSigla(pacienteId: string, day: number) {
    return siglaByPacienteDia.get(`${pacienteId}|${toDateStr(ano, mes, day)}`) ?? null;
  }

  function metricaPaciente(pacienteId: string, frequenciaAtendimento: string | null) {
    const siglas: FrequenciaSigla[] = [];
    for (let d = 1; d <= days; d++) {
      const s = getSigla(pacienteId, d);
      if (s) siglas.push(s);
    }
    return calcularMetricaComparecimento(
      siglas.map((sigla) => ({ sigla })),
      {
        qtdSessoesCobranca: data?.cobrancaPorPaciente?.[pacienteId] ?? null,
        frequenciaAtendimento,
      },
    );
  }

  const resumo = useMemo(() => {
    let realizadas = 0;
    let esperadas = 0;
    let faltas = 0;
    for (const p of rows) {
      for (let d = 1; d <= days; d++) {
        const s = siglaByPacienteDia.get(`${p.id}|${toDateStr(ano, mes, d)}`);
        if (s === "F") faltas += 1;
      }
      const m = calcularMetricaComparecimento(
        Array.from({ length: days }, (_, i) => {
          const s = siglaByPacienteDia.get(`${p.id}|${toDateStr(ano, mes, i + 1)}`);
          return s ? { sigla: s } : null;
        }).filter(Boolean) as { sigla: FrequenciaSigla }[],
        {
          qtdSessoesCobranca: data?.cobrancaPorPaciente?.[p.id] ?? null,
          frequenciaAtendimento: p.frequencia_atendimento,
        },
      );
      realizadas += m.realizadas;
      if (m.esperadas != null) esperadas += m.esperadas;
    }
    const taxa = esperadas > 0 ? Math.min(realizadas / esperadas, 1) : null;
    return { pacientes: rows.length, realizadas, esperadas, faltas, taxa };
  }, [rows, siglaByPacienteDia, data?.cobrancaPorPaciente, days, ano, mes]);

  function exportCsv() {
    const header = [
      "Paciente",
      "Tipo",
      ...Array.from({ length: days }, (_, i) => String(i + 1)),
      "Realizadas",
      "Esperadas",
      "Taxa",
    ];
    const lines = [header.join(";")];
    for (const p of rows) {
      const dayCols: string[] = [];
      for (let d = 1; d <= days; d++) dayCols.push(getSigla(p.id, d) ?? "");
      const m = metricaPaciente(p.id, p.frequencia_atendimento);
      lines.push(
        [
          p.nome,
          TIPO_LABEL[p.tipo],
          ...dayCols,
          String(m.realizadas),
          m.esperadas != null ? String(m.esperadas) : "",
          formatarTaxaComparecimento(m.taxa) ?? "",
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(";"),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frequencia_${ano}-${String(mes).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  if (!data) return <LoadingState />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-4 py-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar paciente"
          className="max-w-xs h-9"
        />
        <p className="text-xs text-muted-foreground">
          Consolidado da tabela <strong>sessões</strong> — registre P/F/FJ/NJ/RC/NR no painel do
          agendamento (visão Semana).
          {isFetching ? " · atualizando…" : ""}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={exportCsv}
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Pacientes" value={String(resumo.pacientes)} />
        <Kpi
          label="Presentes (P)"
          value={String(resumo.realizadas)}
          hint={resumo.esperadas > 0 ? `de ${resumo.esperadas} esperadas` : undefined}
        />
        <Kpi label="Faltas (F)" value={String(resumo.faltas)} />
        <Kpi label="Taxa do mês" value={formatarTaxaComparecimento(resumo.taxa) ?? "—"} />
      </div>

      <div className="flex flex-wrap gap-2 text-[11.5px]">
        {(siglasNoMes.length > 0 ? siglasNoMes : (["P", "F"] as FrequenciaSigla[])).map((s) => (
          <span
            key={s}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-bold",
              SIGLA_COLORS[s] ?? SIGLA_CELL[s],
            )}
          >
            {s}
            <span className="font-sans font-medium opacity-80">{SIGLA_LABEL[s]}</span>
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão neste mês"
          description="Marque agendamentos como realizado ou faltou na Agenda, ou execute o backfill histórico para popular sessões anteriores."
        />
      ) : (
        <div className="overflow-auto rounded-xl border bg-card max-h-[min(70vh,820px)]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 min-w-[200px] border border-border bg-cb-cyan-050 px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  Paciente
                </th>
                {Array.from({ length: days }, (_, i) => (
                  <th
                    key={i + 1}
                    className="min-w-[30px] border border-border bg-cb-cyan-050 px-1 py-2 text-center text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {i + 1}
                  </th>
                ))}
                <th className="min-w-[48px] border border-border bg-cb-cyan-050 px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground leading-tight">
                  Real.
                </th>
                <th className="min-w-[48px] border border-border bg-cb-cyan-050 px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground leading-tight">
                  Esper.
                </th>
                <th className="min-w-[48px] border border-border bg-cb-cyan-050 px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground leading-tight">
                  Taxa
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const m = metricaPaciente(p.id, p.frequencia_atendimento);
                return (
                  <tr key={p.id}>
                    <td className="sticky left-0 z-[1] border border-border bg-card px-3 py-2.5 text-left font-medium whitespace-nowrap">
                      {p.nome}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">
                        · {TIPO_LABEL[p.tipo]}
                      </span>
                    </td>
                    {Array.from({ length: days }, (_, i) => {
                      const sigla = getSigla(p.id, i + 1);
                      return (
                        <td
                          key={i + 1}
                          className={cn(
                            "border border-border px-1 py-2 text-center font-mono text-[11px] font-bold",
                            sigla ? SIGLA_CELL[sigla] : "bg-card",
                          )}
                          title={sigla ? SIGLA_LABEL[sigla] : undefined}
                        >
                          {sigla ?? ""}
                        </td>
                      );
                    })}
                    <td className="border border-border bg-cb-cyan-050 px-2 py-2 text-center font-mono text-[11px] font-extrabold text-cb-cyan-800">
                      {m.realizadas}
                    </td>
                    <td className="border border-border px-2 py-2 text-center font-mono text-[11px] font-semibold text-muted-foreground">
                      {m.esperadas ?? "—"}
                    </td>
                    <td className="border border-border px-2 py-2 text-center font-mono text-[11px] font-extrabold text-cb-cyan-800">
                      {formatarTaxaComparecimento(m.taxa) ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p> : null}
    </div>
  );
}
