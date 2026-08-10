import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PageHeader } from "@/components/brand/PageHeader";
import { ProntuarioVisaoGeralTab } from "@/components/domain/prontuario/ProntuarioVisaoGeralTab";
import { DashboardPage } from "@/components/domain/DashboardSection";

export const Route = createFileRoute("/app/prontuario/")({
  head: () => ({ meta: [{ title: "Prontuário · CB MOVE" }] }),
  component: ProntuarioIndexPage,
});

function ProntuarioIndexPage() {
  const navigate = useNavigate();

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Operação", to: "/app" }, { label: "Prontuário" }]}
        title="Prontuário"
        description="Visão consolidada de todos os prontuários — KPIs e acesso rápido ao prontuário individual."
      />

      <ProntuarioVisaoGeralTab
        onOpenPaciente={(pacienteId) =>
          navigate({
            to: "/app/prontuario/$pacienteId",
            params: { pacienteId },
            search: { tab: "evolucao-diaria" },
          })
        }
      />
    </DashboardPage>
  );
}
