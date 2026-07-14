import type { FrequenciaSigla } from "@/lib/types";
import { SIGLA_COLORS } from "@/components/domain/prontuario/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIGLAS: FrequenciaSigla[] = ["P", "F", "FJ", "NJ", "RC", "NR"];

const SIGLA_HINT: Record<FrequenciaSigla, string> = {
  P: "Presente",
  F: "Falta",
  FJ: "Falta justificada",
  NJ: "Não justificada",
  RC: "Reabilitação concluída",
  NR: "Não realizada",
};

type Props = {
  disabled?: boolean;
  pendingSigla?: FrequenciaSigla | null;
  onSelect: (sigla: FrequenciaSigla) => void;
};

export function RegistroFrequenciaButtons({ disabled, pendingSigla, onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SIGLAS.map((sigla) => (
        <Button
          key={sigla}
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          className={cn(
            "font-mono text-xs font-bold",
            SIGLA_COLORS[sigla],
            pendingSigla === sigla && "ring-2 ring-cb-cyan-600 ring-offset-1",
          )}
          title={SIGLA_HINT[sigla]}
          onClick={() => onSelect(sigla)}
        >
          {sigla}
        </Button>
      ))}
    </div>
  );
}
