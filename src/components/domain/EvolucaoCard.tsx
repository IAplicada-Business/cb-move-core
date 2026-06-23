import { Button } from "@/components/ui/button";
import type { Evolucao } from "@/lib/queries/prontuario";

const FONTE_LABEL: Record<string, string> = {
  manual: "Manual",
  audio_ia: "IA 🎤",
  sites_import: "Google Sites",
};

const MESES_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatDataPT(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")} ${MESES_PT[d.getMonth()]} ${d.getFullYear()}`;
}

export function EvolucaoCard({
  evolucao,
  onEdit,
}: {
  evolucao: Evolucao & { fisioterapeutas?: { nome: string } | null };
  onEdit: (ev: Evolucao) => void;
}) {
  const dataFmt = formatDataPT(evolucao.data);
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{dataFmt}</span>
          {evolucao.fisioterapeutas?.nome && (
            <span>· {evolucao.fisioterapeutas.nome}</span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {FONTE_LABEL[evolucao.fonte] ?? evolucao.fonte}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onEdit(evolucao)}>
          Editar
        </Button>
      </div>
      {evolucao.subjetivo && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">S — Subjetivo</p>
          <p className="text-sm whitespace-pre-wrap">{evolucao.subjetivo}</p>
        </div>
      )}
      {evolucao.objetivo && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">O — Objetivo</p>
          <p className="text-sm whitespace-pre-wrap">{evolucao.objetivo}</p>
        </div>
      )}
      {evolucao.plano && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">P — Plano</p>
          <p className="text-sm whitespace-pre-wrap">{evolucao.plano}</p>
        </div>
      )}
      {!evolucao.subjetivo && !evolucao.objetivo && !evolucao.plano && (
        <p className="text-sm text-muted-foreground italic">Evolução sem conteúdo registrado.</p>
      )}
    </div>
  );
}
