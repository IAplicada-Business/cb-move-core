import { useQuery } from "@tanstack/react-query";

import { DashboardRecentActivity } from "@/components/domain/DashboardRecentActivity";
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
    <DashboardRecentActivity
      items={data}
      showFisio={showFisio}
      title="Próximos agendamentos"
      description="Confirmados ou pendentes nos próximos 7 dias"
      limit={5}
    />
  );
}
