import { cn } from "@/lib/utils";
import type { AgendaSubabaVisao, AgendaVisao } from "@/lib/navigation-search";

const SUBABAS: Array<{ value: AgendaSubabaVisao; label: string }> = [
  { value: "frequencia", label: "Frequência" },
  { value: "divergencias", label: "Divergências" },
  { value: "atualizacoes", label: "Atualizações" },
];

type Props = {
  activeVisao: AgendaVisao;
  onVisaoChange: (visao: AgendaSubabaVisao) => void;
  className?: string;
};

/** Pills de subaba da agenda — padrão visual do prontuário, ao lado de Horários. */
export function AgendaSubabaNav({ activeVisao, onVisaoChange, className }: Props) {
  return (
    <nav
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-2xl bg-cb-cyan-050/60 p-1.5 dark:bg-secondary/60",
        className,
      )}
      aria-label="Subabas da agenda"
    >
      {SUBABAS.map((tab) => {
        const active = activeVisao === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onVisaoChange(tab.value)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
              active
                ? "bg-cb-cyan-600 text-white shadow-[0_4px_14px_rgba(63,181,188,0.35)]"
                : "text-cb-muted hover:text-cb-ink dark:hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
