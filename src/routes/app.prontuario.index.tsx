import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import { PageHeader } from "@/components/brand/PageHeader";
import { AtendimentoAvulsoDialog } from "@/components/domain/prontuario/AtendimentoAvulsoDialog";
import { ProntuarioVisaoGeralTab } from "@/components/domain/prontuario/ProntuarioVisaoGeralTab";
import { DashboardPage } from "@/components/domain/DashboardSection";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { isFisioScopedUser } from "@/lib/permissions";

export const Route = createFileRoute("/app/prontuario/")({
  head: () => ({ meta: [{ title: "Prontuário · CB MOVE" }] }),
  component: ProntuarioIndexPage,
});

function ProntuarioIndexPage() {
  const navigate = useNavigate();
  const { roles, fisioterapeutaId } = useAuth();
  const isFisioScoped = isFisioScopedUser(roles, fisioterapeutaId);
  const [avulsoOpen, setAvulsoOpen] = useState(false);

  function abrirEvolucao(pacienteId: string) {
    navigate({
      to: "/app/prontuario/$pacienteId",
      params: { pacienteId },
      search: { tab: "evolucao-diaria", gravar: true },
    });
  }

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Operação", to: "/app" }, { label: "Prontuário" }]}
        title="Prontuário"
        description="Visão consolidada de todos os prontuários — KPIs e acesso rápido ao prontuário individual."
        actions={
          isFisioScoped ? (
            <Button variant="outline" className="gap-2" onClick={() => setAvulsoOpen(true)}>
              <CalendarPlus className="h-4 w-4" />
              Registrar atendimento avulso
            </Button>
          ) : undefined
        }
      />

      <ProntuarioVisaoGeralTab onOpenPaciente={(pacienteId) => abrirEvolucao(pacienteId)} />

      <AtendimentoAvulsoDialog
        open={avulsoOpen}
        onOpenChange={setAvulsoOpen}
        onRegistered={abrirEvolucao}
      />
    </DashboardPage>
  );
}
