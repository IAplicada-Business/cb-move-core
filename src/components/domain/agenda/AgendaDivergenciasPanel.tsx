import { AlertTriangle } from "lucide-react";

import { DivergenciaPreviewList } from "@/components/domain/DashboardLists";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { DashboardSection, DashboardSectionBadge } from "@/components/domain/DashboardSection";
import type { DivergenciaProntuario } from "@/lib/queries/dashboard";

type AgendaDivergenciasPanelProps = {
  periodoLabel: string;
  items: DivergenciaProntuario[];
  isLoading: boolean;
};

export function AgendaDivergenciasPanel({
  periodoLabel,
  items,
  isLoading,
}: AgendaDivergenciasPanelProps) {
  if (isLoading) {
    return <LoadingState label="Carregando divergências…" />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8" />}
        title="Nenhuma divergência"
        description={`Todas as sessões realizadas em ${periodoLabel} têm evolução registrada no prontuário.`}
      />
    );
  }

  return (
    <DashboardSection
      eyebrow="Prontuário × agenda"
      accent="magenta"
      title="Divergências"
      badge={<DashboardSectionBadge accent="magenta">{items.length}</DashboardSectionBadge>}
      description={`Sessões realizadas em ${periodoLabel} sem evolução registrada no mesmo dia`}
      noPadding
      bodyClassName="p-5 sm:p-6"
    >
      <DivergenciaPreviewList items={items} />
    </DashboardSection>
  );
}
