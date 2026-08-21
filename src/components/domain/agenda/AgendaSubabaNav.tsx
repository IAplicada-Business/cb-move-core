import { BellRing, CalendarDays, TriangleAlert, type LucideIcon } from "lucide-react";

import { InternalTabNav, InternalTabNavButton } from "@/components/brand/InternalTabNav";
import type { AgendaSubabaVisao, AgendaVisao } from "@/lib/navigation-search";
import { cn } from "@/lib/utils";

const SUBABAS: Array<{ value: AgendaSubabaVisao; label: string; icon: LucideIcon }> = [
  { value: "frequencia", label: "Frequência", icon: CalendarDays },
  { value: "divergencias", label: "Divergências", icon: TriangleAlert },
  { value: "atualizacoes", label: "Atualizações", icon: BellRing },
];

type Props = {
  activeVisao: AgendaVisao;
  onVisaoChange: (visao: AgendaSubabaVisao) => void;
  className?: string;
};

export function AgendaSubabaNav({ activeVisao, onVisaoChange, className }: Props) {
  return (
    <InternalTabNav
      className={cn("inline-flex sm:w-auto", className)}
      aria-label="Subabas da agenda"
    >
      {SUBABAS.map((tab) => {
        const Icon = tab.icon;
        const active = activeVisao === tab.value;
        return (
          <InternalTabNavButton
            key={tab.value}
            active={active}
            onClick={() => onVisaoChange(tab.value)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {tab.label}
          </InternalTabNavButton>
        );
      })}
    </InternalTabNav>
  );
}
