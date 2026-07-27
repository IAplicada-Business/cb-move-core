import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { LoadingState } from "@/components/domain/LoadingState";
import { EmptyState } from "@/components/domain/EmptyState";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  fetchExercicios,
  fetchExerciciosRealizados,
  marcarExercicioFeito,
} from "@/lib/queries/exercicios";
import { Dumbbell } from "lucide-react";

export const Route = createFileRoute("/portal/exercicios")({
  component: PortalExercicios,
});

function hoje() {
  return new Date().toISOString().split("T")[0];
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function PortalExercicios() {
  const { pacienteId } = useAuth();
  const qc = useQueryClient();
  const hj = hoje();

  const { data: exercicios = [], isLoading } = useQuery({
    queryKey: ["exercicios", pacienteId],
    queryFn: () => fetchExercicios(pacienteId!),
    enabled: !!pacienteId,
  });

  const { data: realizados = [] } = useQuery({
    queryKey: ["exercicios-realizados", pacienteId, sevenDaysAgo()],
    queryFn: () => fetchExerciciosRealizados(pacienteId!, sevenDaysAgo()),
    enabled: !!pacienteId,
  });

  const marcarMutation = useMutation({
    mutationFn: (exercicioId: string) =>
      marcarExercicioFeito({
        exercicio_id: exercicioId,
        paciente_id: pacienteId!,
        data: hj,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercicios-realizados"] });
      toast.success("Ótimo trabalho!");
    },
    onError: () => toast.error("Não foi possível registrar. Tente novamente."),
  });

  // Map: exercicioId -> realizados nesta semana
  const semanaMap = React.useMemo(() => {
    const map = new Map<string, string[]>(); // exercicioId -> datas
    for (const r of realizados) {
      if (!map.has(r.exercicio_id)) map.set(r.exercicio_id, []);
      map.get(r.exercicio_id)!.push(r.data);
    }
    return map;
  }, [realizados]);

  function feito_hoje(exercicioId: string) {
    return (semanaMap.get(exercicioId) ?? []).includes(hj);
  }

  function vezes_semana(exercicioId: string) {
    return (semanaMap.get(exercicioId) ?? []).length;
  }

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Seus exercícios para fazer em casa</h1>
        <p className="mt-1 text-sm text-muted-foreground">Prescritos pela sua fisioterapeuta</p>
      </div>

      {exercicios.length === 0 && (
        <EmptyState
          icon={<Dumbbell className="h-8 w-8" />}
          title="Nenhum exercício por enquanto"
          description="Sua fisioterapeuta ainda não prescreveu exercícios para casa."
        />
      )}

      <ul className="space-y-4">
        {exercicios.map((ex) => {
          const feitoHoje = feito_hoje(ex.id);
          const vezesSemana = vezes_semana(ex.id);

          return (
            <li key={ex.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              {/* Thumbnail */}
              {ex.midia_url && (
                <div className="mb-3 overflow-hidden rounded-xl">
                  <img
                    src={ex.midia_url}
                    alt={ex.nome}
                    className="h-40 w-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                </div>
              )}

              {/* Nome e descrição */}
              <p className="text-base font-bold text-foreground">{ex.nome}</p>
              {ex.descricao && <p className="mt-1 text-sm text-muted-foreground">{ex.descricao}</p>}

              {/* Séries / repetições */}
              {(ex.series != null || ex.repeticoes != null) && (
                <p className="mt-2 text-sm text-cb-cyan-700 font-medium">
                  {[
                    ex.series != null ? `${ex.series} série${ex.series !== 1 ? "s" : ""}` : null,
                    ex.repeticoes != null
                      ? `${ex.repeticoes} repetição${ex.repeticoes !== 1 ? "ões" : ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" de ")}
                </p>
              )}

              {/* Mini-histórico da semana */}
              <p className="mt-1 text-xs text-muted-foreground">
                Esta semana: {vezesSemana} de {ex.frequencia_semanal} vezes
              </p>

              {/* Botão */}
              <Button
                className="mt-4 w-full"
                variant={feitoHoje ? "outline" : "default"}
                disabled={feitoHoje || marcarMutation.isPending}
                onClick={() => marcarMutation.mutate(ex.id)}
                style={
                  feitoHoje ? undefined : { backgroundColor: "#16a34a", borderColor: "#16a34a" }
                }
              >
                {feitoHoje ? "Feito hoje ✓" : "✓ Fiz hoje"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
