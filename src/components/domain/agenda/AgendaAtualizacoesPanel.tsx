import { useQuery } from "@tanstack/react-query";

import { AgendaPreviewList } from "@/components/domain/DashboardLists";
import { DashboardSection } from "@/components/domain/DashboardSection";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { fetchProximasAgendas } from "@/lib/queries/dashboard";
import { queryKeys } from "@/lib/queries/keys";

type Props = {
  showFisio?: boolean;
  fisioterapeutaId?: string | null;
};

export function AgendaAtualizacoesPanel({ showFisio, fisioterapeutaId }: Props) {
  const { data = [], isLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.proximasAgendas(), fisioterapeutaId ?? "all"],
    queryFn: () => fetchProximasAgendas(50, fisioterapeutaId),
  });

  if (isLoading) {
    return <LoadingState label="Carregando atualizações…" />;
  }

  return (
    <DashboardSection
      eyebrow="Agenda"
      accent="lime"
      title="Próximos agendamentos"
      description="Confirmados ou pendentes nos próximos 7 dias"
      noPadding
      bodyClassName="px-4 pb-2 sm:px-6"
    >
      {data.length === 0 ? (
        <div className="px-2 py-8">
          <EmptyState
            title="Nenhuma agenda próxima"
            description="Novos agendamentos aparecerão aqui."
          />
        </div>
      ) : (
        <AgendaPreviewList items={data} showFisio={showFisio} />
      )}
    </DashboardSection>
  );
}
