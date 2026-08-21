import {
  BellRing,
  CalendarDays,
  CalendarRange,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAgendaSubabaVisao, type AgendaVisao } from "@/lib/navigation-search";

const SUBABAS: Array<{ value: AgendaVisao; label: string; icon: LucideIcon }> = [
  { value: "semana", label: "Agenda geral", icon: CalendarRange },
  { value: "frequencia", label: "Frequência", icon: CalendarDays },
  { value: "divergencias", label: "Divergências", icon: TriangleAlert },
  { value: "atualizacoes", label: "Atualizações", icon: BellRing },
];

type Props = {
  activeVisao: AgendaVisao;
  onVisaoChange: (visao: AgendaVisao) => void;
  className?: string;
};

export function AgendaSubabaNav({ activeVisao, onVisaoChange, className }: Props) {
  const tabsValue = isAgendaSubabaVisao(activeVisao) ? activeVisao : "semana";
  return (
    <Tabs value={tabsValue} onValueChange={(v) => onVisaoChange(v as AgendaVisao)}>
      <TabsList className={className} aria-label="Subabas da agenda">
        {SUBABAS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.value} value={tab.value}>
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
