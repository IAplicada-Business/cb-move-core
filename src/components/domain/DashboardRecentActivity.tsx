import { Link } from "@tanstack/react-router";

import {
  BrandTable,
  BrandTableBody,
  BrandTableCell,
  BrandTableHead,
  BrandTableHeader,
  BrandTableRow,
  BrandTableShell,
} from "@/components/brand/BrandTable";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { EmptyState } from "@/components/domain/EmptyState";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { StatusAgendamento } from "@/lib/types";

type RecentAgendaItem = {
  id: string;
  inicio: string;
  pacienteNome: string;
  fisioNome?: string;
  status: StatusAgendamento;
};

/** Tabela compacta de agendas — padrão “Recent Activity” (Behance SaaS). */
export function DashboardRecentActivity({
  items,
  showFisio,
}: {
  items: RecentAgendaItem[];
  showFisio?: boolean;
}) {
  return (
    <BrandTableShell
      eyebrow="Agenda"
      accent="lime"
      title="Atividade recente"
      description="Próximos agendamentos confirmados ou pendentes"
      actions={
        <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
          <Link to="/app/agenda" search={{ visao: "atualizacoes" }}>
            Ver mais
          </Link>
        </Button>
      }
    >
      {items.length === 0 ? (
        <div className="px-6 py-8">
          <EmptyState
            title="Nenhuma agenda próxima"
            description="Novos agendamentos aparecerão aqui."
          />
        </div>
      ) : (
        <BrandTable>
          <BrandTableHeader>
            <BrandTableRow>
              <BrandTableHead>Paciente</BrandTableHead>
              <BrandTableHead>Horário</BrandTableHead>
              <BrandTableHead className="text-right">Status</BrandTableHead>
            </BrandTableRow>
          </BrandTableHeader>
          <BrandTableBody>
            {items.slice(0, 2).map((item) => (
              <BrandTableRow key={item.id}>
                <BrandTableCell>
                  <span className="font-medium text-cb-ink">{item.pacienteNome}</span>
                  {showFisio && item.fisioNome && (
                    <span className="mt-0.5 block text-[11px] text-cb-muted">{item.fisioNome}</span>
                  )}
                </BrandTableCell>
                <BrandTableCell className="whitespace-nowrap text-cb-muted">
                  {formatDateTime(item.inicio)}
                </BrandTableCell>
                <BrandTableCell className="text-right">
                  <StatusBadge kind="agenda" value={item.status} />
                </BrandTableCell>
              </BrandTableRow>
            ))}
          </BrandTableBody>
        </BrandTable>
      )}
    </BrandTableShell>
  );
}
