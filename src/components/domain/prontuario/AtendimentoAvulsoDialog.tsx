import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import {
  buscarPacientesAtendimentoAvulso,
  registrarAtendimentoAvulso,
  type PacienteAtendimentoAvulso,
} from "@/lib/queries/atendimento-avulso";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: (pacienteId: string) => void;
};

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDatetimeToIso(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) throw new Error("Data/hora inválida");
  return dt.toISOString();
}

export function AtendimentoAvulsoDialog({ open, onOpenChange, onRegistered }: Props) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<PacienteAtendimentoAvulso | null>(null);
  const [inicioLocal, setInicioLocal] = useState(() => toLocalDatetimeInputValue(new Date()));

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setSelected(null);
      setInicioLocal(toLocalDatetimeInputValue(new Date()));
    }
  }, [open]);

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ["atendimento-avulso", "busca", debouncedQuery],
    queryFn: () => buscarPacientesAtendimentoAvulso(debouncedQuery),
    enabled: open && debouncedQuery.length >= 2,
  });

  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione um paciente");
      return registrarAtendimentoAvulso(selected.id, localDatetimeToIso(inicioLocal));
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: queryKeys.agendamentos.all });
      void qc.invalidateQueries({ queryKey: queryKeys.pacientes.all });
      void qc.invalidateQueries({ queryKey: queryKeys.prontuario.paciente(result.pacienteId) });
      toast.success(`Atendimento registrado — ${formatDateTime(result.inicio)}`);
      onRegistered(result.pacienteId);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-cb-cyan-600" />
            Registrar atendimento avulso
          </DialogTitle>
          <DialogDescription>
            Cria um agendamento retroativo na sua coluna e abre o prontuário para evolução.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="avulso-busca">Buscar paciente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="avulso-busca"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                }}
                placeholder="Digite o nome (mín. 2 letras)…"
                className="pl-9"
                autoFocus
              />
            </div>
            {debouncedQuery.length >= 2 && (
              <div className="max-h-44 overflow-y-auto rounded-md border">
                {isFetching ? (
                  <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                  </p>
                ) : resultados.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum paciente encontrado.
                  </p>
                ) : (
                  resultados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                        selected?.id === p.id ? "bg-cb-cyan-050 font-medium" : ""
                      }`}
                      onClick={() => setSelected(p)}
                    >
                      {p.nome}
                    </button>
                  ))
                )}
              </div>
            )}
            {selected && (
              <p className="text-xs text-cb-cyan-700">
                Selecionado: <span className="font-medium">{selected.nome}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="avulso-inicio">Data e hora do atendimento</Label>
            <Input
              id="avulso-inicio"
              type="datetime-local"
              value={inicioLocal}
              onChange={(e) => setInicioLocal(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-cb-cyan-600 hover:bg-cb-cyan-700"
            disabled={!selected || registrarMutation.isPending}
            onClick={() => registrarMutation.mutate()}
          >
            {registrarMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando…
              </>
            ) : (
              "Registrar e evoluir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
