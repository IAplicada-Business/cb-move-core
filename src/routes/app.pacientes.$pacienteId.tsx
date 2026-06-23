import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, Plus, Dumbbell, User } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/domain/LoadingState";
import { EmptyState } from "@/components/domain/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchExercicios,
  fetchExerciciosRealizados,
  criarExercicio,
  type Exercicio,
} from "@/lib/queries/exercicios";

export const Route = (createFileRoute as any)("/app/pacientes/$pacienteId")({
  component: PacienteDetalhe,
});

type PacienteDetalhe = {
  id: string;
  nome: string;
  tipo: string | null;
  email: string | null;
  telefone: string | null;
  convenios: { nome: string } | null;
};

type ExercicioForm = {
  nome: string;
  descricao: string;
  repeticoes: string;
  series: string;
  frequencia_semanal: string;
};

function semanaInicio() {
  const d = new Date();
  d.setDate(d.getDate() - 28); // 4 semanas
  return d.toISOString().split("T")[0];
}

function PacienteDetalhe() {
  const { pacienteId } = (Route as any).useParams();
  const qc = useQueryClient();
  const [modalAberto, setModalAberto] = React.useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ExercicioForm>({
    defaultValues: { frequencia_semanal: "3" },
  });

  // Dados do paciente
  const { data: paciente, isLoading: loadPac } = useQuery({
    queryKey: ["paciente-detalhe", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pacientes")
        .select("id, nome, tipo, email, telefone, convenios(nome)")
        .eq("id", pacienteId)
        .single();
      if (error) throw error;
      return data as PacienteDetalhe;
    },
    enabled: !!pacienteId,
  });

  // Exercícios
  const { data: exercicios = [], isLoading: loadEx } = useQuery({
    queryKey: ["exercicios", pacienteId],
    queryFn: () => fetchExercicios(pacienteId),
    enabled: !!pacienteId,
  });

  // Realizados últimas 4 semanas
  const { data: realizados = [] } = useQuery({
    queryKey: ["exercicios-realizados", pacienteId, semanaInicio()],
    queryFn: () => fetchExerciciosRealizados(pacienteId, semanaInicio()),
    enabled: !!pacienteId,
  });

  const criarMutation = useMutation({
    mutationFn: (form: ExercicioForm) =>
      criarExercicio({
        paciente_id: pacienteId,
        nome: form.nome,
        descricao: form.descricao || null,
        repeticoes: form.repeticoes ? parseInt(form.repeticoes) : null,
        series: form.series ? parseInt(form.series) : null,
        frequencia_semanal: parseInt(form.frequencia_semanal) || 3,
        ativo: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercicios", pacienteId] });
      toast.success("Exercício prescrito com sucesso!");
      setModalAberto(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Montar tabela de cumprimento
  const realizadosMap = React.useMemo(() => {
    const map = new Map<string, Set<string>>(); // exercicioId -> datas
    for (const r of realizados) {
      if (!map.has(r.exercicio_id)) map.set(r.exercicio_id, new Set());
      map.get(r.exercicio_id)!.add(r.data);
    }
    return map;
  }, [realizados]);

  if (loadPac) return <LoadingState />;
  if (!paciente) return <div className="p-6 text-muted-foreground">Paciente não encontrado.</div>;

  const convenioNome =
    paciente.convenios && typeof paciente.convenios === "object" && "nome" in paciente.convenios
      ? (paciente.convenios as { nome: string }).nome
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/app/pacientes" className="rounded-md p-1.5 hover:bg-accent">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{paciente.nome}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {paciente.tipo ?? "—"}{convenioNome ? ` · ${convenioNome}` : ""}
          </p>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">
            <User className="mr-1.5 h-3.5 w-3.5" />
            Dados
          </TabsTrigger>
          <TabsTrigger value="exercicios">
            <Dumbbell className="mr-1.5 h-3.5 w-3.5" />
            Exercícios
          </TabsTrigger>
        </TabsList>

        {/* Aba Dados */}
        <TabsContent value="dados" className="mt-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Nome</p>
                <p className="mt-1 text-foreground font-medium">{paciente.nome}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Tipo</p>
                <p className="mt-1 text-foreground capitalize">{paciente.tipo ?? "—"}</p>
              </div>
              {paciente.telefone && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Telefone</p>
                  <p className="mt-1 text-foreground">{paciente.telefone}</p>
                </div>
              )}
              {paciente.email && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">E-mail</p>
                  <p className="mt-1 text-foreground">{paciente.email}</p>
                </div>
              )}
              {convenioNome && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Convênio</p>
                  <p className="mt-1 text-foreground">{convenioNome}</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Aba Exercícios */}
        <TabsContent value="exercicios" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {exercicios.length} exercício{exercicios.length !== 1 ? "s" : ""} prescritos
            </p>
            <Button size="sm" onClick={() => setModalAberto(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Prescrever
            </Button>
          </div>

          {loadEx && <LoadingState />}

          {!loadEx && exercicios.length === 0 && (
            <EmptyState
              icon={<Dumbbell className="h-8 w-8" />}
              title="Nenhum exercício prescrito"
              description="Clique em Prescrever para adicionar exercícios para este paciente."
            />
          )}

          {!loadEx && exercicios.length > 0 && (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Exercício</th>
                    <th className="px-4 py-3 text-center">Séries × Reps</th>
                    <th className="px-4 py-3 text-center">Freq/semana</th>
                    <th className="px-4 py-3 text-center">Realizados (4 sem)</th>
                  </tr>
                </thead>
                <tbody>
                  {exercicios.map((ex: Exercicio, i: number) => {
                    const datas = realizadosMap.get(ex.id) ?? new Set<string>();
                    return (
                      <tr key={ex.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        <td className="px-4 py-3 font-medium text-foreground">{ex.nome}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {ex.series != null && ex.repeticoes != null
                            ? `${ex.series} × ${ex.repeticoes}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {ex.frequencia_semanal}×
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-cb-cyan-700">{datas.size}</span>
                          <span className="text-muted-foreground"> dias</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Prescrever */}
      <Dialog open={modalAberto} onOpenChange={(o) => { if (!o) { setModalAberto(false); reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Prescrever exercício</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => criarMutation.mutate(data))} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome do exercício *</Label>
              <Input id="nome" {...register("nome", { required: true })} placeholder="Ex: Agachamento isométrico" />
            </div>
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                {...register("descricao")}
                placeholder="Instruções detalhadas..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="series">Séries</Label>
                <Input id="series" type="number" min="1" {...register("series")} placeholder="3" />
              </div>
              <div>
                <Label htmlFor="repeticoes">Repetições</Label>
                <Input id="repeticoes" type="number" min="1" {...register("repeticoes")} placeholder="10" />
              </div>
              <div>
                <Label htmlFor="freq">Freq/semana</Label>
                <Input id="freq" type="number" min="1" max="7" {...register("frequencia_semanal")} placeholder="3" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setModalAberto(false); reset(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || criarMutation.isPending}>
                {criarMutation.isPending ? "Salvando…" : "Prescrever"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
