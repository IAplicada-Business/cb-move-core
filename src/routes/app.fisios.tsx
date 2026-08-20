import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { assertFisiosAccess } from "@/lib/route-access";

import { EmptyState } from "@/components/domain/EmptyState";
import { FisioCardGrid } from "@/components/domain/FisioCardGrid";
import { LoadingState } from "@/components/domain/LoadingState";
import {
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
} from "@/components/domain/DashboardSection";
import { PageHeader } from "@/components/brand/PageHeader";
import { FisioDetalhesSheet } from "@/components/domain/FisioDetalhesSheet";
import { queryKeys, fisioDetailQueryKeys } from "@/lib/queries";
import {
  fetchFisios,
  toggleFisioAtivo,
  deleteFisio,
  invalidateFisioListQueries,
  type Fisio,
} from "@/lib/queries/fisioterapeutas";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/fisios")({
  head: () => ({ meta: [{ title: "Fisioterapeutas · CB MOVE" }] }),
  beforeLoad: () => assertFisiosAccess(),
  component: FisiosPage,
});

function invalidateFisioDetailQueries(qc: ReturnType<typeof useQueryClient>, fisioId: string) {
  for (const key of fisioDetailQueryKeys(fisioId)) {
    void qc.invalidateQueries({ queryKey: key });
  }
}

function FisiosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<Fisio | null>(null);
  const [viewing, setViewing] = useState<Fisio | null>(null);
  const [showInativos, setShowInativos] = useState(false);

  const { data: fisios = [], isPending: fisiosPending } = useQuery({
    queryKey: [...queryKeys.fisioterapeutas.all, showInativos ? "all" : "ativos"],
    queryFn: () => fetchFisios({ ativosOnly: !showInativos }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => toggleFisioAtivo(id, ativo),
    onSuccess: (_data, { id }) => {
      invalidateFisioListQueries(qc);
      invalidateFisioDetailQueries(qc, id);
      void qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFisio(id),
    onSuccess: (_data, id) => {
      invalidateFisioListQueries(qc);
      invalidateFisioDetailQueries(qc, id);
      toast.success("Fisioterapeuta excluído");
      setDeleting(null);
      setViewing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function goEditInUsuarios(f: Fisio) {
    if (!f.email) {
      toast.error("Cadastre o e-mail do fisioterapeuta em Equipe → Usuários.");
      return;
    }
    setViewing(null);
    void navigate({
      to: "/app/usuarios",
      search: { edit: f.email },
    });
  }

  const ativos = fisios.filter((f) => f.ativo).length;

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Equipe" }, { label: "Usuários" }, { label: "Fisioterapeutas" }]}
        title="Fisioterapeutas"
        description="Equipe clínica — consulte, ative/desativa e exclua profissionais. Novos cadastros em Usuários."
        actions={
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={showInativos} onCheckedChange={setShowInativos} id="show-inativos" />
            <label htmlFor="show-inativos" className="cursor-pointer text-muted-foreground">
              Mostrar inativos
            </label>
          </div>
        }
      />

      {fisiosPending && fisios.length === 0 ? (
        <LoadingState />
      ) : fisios.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Nenhum fisioterapeuta cadastrado"
          description="Cadastre fisioterapeutas em Equipe → Usuários (perfil Fisioterapeuta). Eles aparecerão automaticamente nesta lista."
        />
      ) : (
        <DashboardSection
          eyebrow="Equipe"
          accent="cyan"
          title="Fisioterapeutas"
          badge={
            <DashboardSectionBadge accent="cyan">
              {fisios.length}
              {!showInativos && fisios.length > 0 ? ` · ${ativos} ativos` : ""}
            </DashboardSectionBadge>
          }
          noPadding
        >
          <FisioCardGrid
            fisios={fisios}
            onOpen={setViewing}
            onEdit={goEditInUsuarios}
            onDelete={setDeleting}
            onToggleAtivo={(id, ativo) => toggleMutation.mutate({ id, ativo })}
          />
        </DashboardSection>
      )}

      <FisioDetalhesSheet
        fisio={viewing}
        onClose={() => setViewing(null)}
        onEdit={goEditInUsuarios}
        onDelete={(f) => setDeleting(f)}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fisioterapeuta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.nome}</strong>? Só é possível
              excluir fisioterapeutas sem sessões ou agendamentos vinculados. Caso já tenha
              histórico, use o botão Ativo/Inativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPage>
  );
}
