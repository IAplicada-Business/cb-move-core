import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { ProntuarioVisaoGeralTab } from "@/components/domain/prontuario/ProntuarioVisaoGeralTab";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const Route = createFileRoute("/app/prontuario/")({
  head: () => ({ meta: [{ title: "Prontuário · CB MOVE" }] }),
  component: ProntuarioIndexPage,
});

function ProntuarioIndexPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Breadcrumb>
          <BreadcrumbList className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/app">Operação</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground">Prontuário</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl font-bold text-foreground">Prontuário</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada de todos os prontuários — KPIs e acesso rápido ao prontuário individual.
        </p>
      </header>

      <ProntuarioVisaoGeralTab
        onOpenPaciente={(pacienteId) =>
          navigate({
            to: "/app/prontuario/$pacienteId",
            params: { pacienteId },
            search: { tab: "evolucao-diaria" },
          })
        }
      />
    </div>
  );
}
