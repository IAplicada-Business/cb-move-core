import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { supabase } from "@/integrations/supabase/client";
import type { FrequenciaSigla } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/frequencia")({
  head: () => ({ meta: [{ title: "Frequência · CB MOVE" }] }),
  component: FrequenciaPage,
});

// ─── types ───────────────────────────────────────────────────────────────────

type SessaoRow = {
  id: string;
  paciente_id: string;
  data: string;
  hora: string | null;
  sigla: FrequenciaSigla;
  observacoes: string | null;
  fisioterapeuta_id: string | null;
  pacientes?: { nome: string } | null;
  fisioterapeutas?: { nome: string } | null;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const SIGLAS: FrequenciaSigla[] = ["P", "F", "FJ", "NJ", "RC", "NR"];

const SIGLA_COLORS: Record<FrequenciaSigla, string> = {
  P:  "bg-[#F7FEE7] text-cb-lime border-[#BEF264] hover:bg-[#ECFCCB]",
  F:  "bg-[#FDF2F8] text-cb-magenta border-[#FBCFE8] hover:bg-[#FCE7F3]",
  FJ: "bg-[#FFF7ED] text-cb-orange border-[#FED7AA] hover:bg-[#FFEDD5]",
  NJ: "bg-[#FFFBEB] text-yellow-700 border-[#FDE68A] hover:bg-[#FEF3C7]",
  RC: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100 hover:bg-cb-cyan-050",
  NR: "bg-muted text-muted-foreground border-border hover:bg-muted/70",
};

const SIGLA_ACTIVE: Record<FrequenciaSigla, string> = {
  P:  "ring-2 ring-cb-lime ring-offset-1",
  F:  "ring-2 ring-cb-magenta ring-offset-1",
  FJ: "ring-2 ring-cb-orange ring-offset-1",
  NJ: "ring-2 ring-yellow-400 ring-offset-1",
  RC: "ring-2 ring-cb-cyan-600 ring-offset-1",
  NR: "ring-2 ring-border ring-offset-1",
};

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ─── queries ─────────────────────────────────────────────────────────────────

async function fetchSessoesDia(data: string): Promise<SessaoRow[]> {
  const { data: rows, error } = await supabase
    .from("sessoes")
    .select("*, pacientes(nome), fisioterapeutas(nome)")
    .eq("data", data)
    .order("hora");
  if (error) throw error;
  return (rows ?? []) as unknown as SessaoRow[];
}

async function updateSigla(id: string, sigla: FrequenciaSigla): Promise<void> {
  const { error } = await supabase.from("sessoes").update({ sigla }).eq("id", id);
  if (error) throw error;
}

async function updateObs(id: string, observacoes: string): Promise<void> {
  const { error } = await supabase.from("sessoes").update({ observacoes: observacoes || null }).eq("id", id);
  if (error) throw error;
}

// ─── page ─────────────────────────────────────────────────────────────────────

function FrequenciaPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [obsEdits, setObsEdits] = useState<Record<string, string>>({});

  const queryKey = ["sessoes", "dia", date];

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSessoesDia(date),
  });

  const siglaMutation = useMutation({
    mutationFn: ({ id, sigla }: { id: string; sigla: FrequenciaSigla }) =>
      updateSigla(id, sigla),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const obsMutation = useMutation({
    mutationFn: ({ id, obs }: { id: string; obs: string }) => updateObs(id, obs),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  // footer totals
  const totals = SIGLAS.reduce(
    (acc, s) => {
      acc[s] = sessoes.filter((r) => r.sigla === s).length;
      return acc;
    },
    {} as Record<FrequenciaSigla, number>
  );

  function prevDay() {
    setDate(toDateStr(addDays(new Date(date + "T12:00:00"), -1)));
  }
  function nextDay() {
    setDate(toDateStr(addDays(new Date(date + "T12:00:00"), 1)));
  }

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Frequência</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
          />
          <Button variant="outline" size="icon" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <p className="text-sm text-muted-foreground capitalize">{displayDate}</p>

      {isLoading ? (
        <LoadingState />
      ) : sessoes.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Sem sessões neste dia"
          description="Nenhuma sessão registrada para esta data."
        />
      ) : (
        <>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Fisio</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessoes.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.pacientes?.nome ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.hora ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.fisioterapeutas?.nome ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {SIGLAS.map((sig) => (
                          <button
                            key={sig}
                            onClick={() => siglaMutation.mutate({ id: s.id, sigla: sig })}
                            className={cn(
                              "px-2 py-0.5 text-xs font-semibold rounded border transition-colors",
                              SIGLA_COLORS[sig],
                              s.sigla === sig && SIGLA_ACTIVE[sig]
                            )}
                          >
                            {sig}
                          </button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 text-xs min-w-[140px]"
                        value={obsEdits[s.id] ?? s.observacoes ?? ""}
                        onChange={(e) =>
                          setObsEdits((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        onBlur={() => {
                          const val = obsEdits[s.id];
                          if (val !== undefined && val !== (s.observacoes ?? "")) {
                            obsMutation.mutate({ id: s.id, obs: val });
                          }
                        }}
                        placeholder="Observação…"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Footer totals */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
            {SIGLAS.map((sig) => (
              <span key={sig} className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
                SIGLA_COLORS[sig]
              )}>
                <strong>{sig}:</strong> {totals[sig]}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
