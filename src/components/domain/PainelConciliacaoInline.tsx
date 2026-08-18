import type { MatchConciliacaoRecente } from "@/lib/conciliacao-matches-recentes";
import { brl, formatDate } from "@/lib/format";
import { DashboardSection, DashboardSectionBadge } from "@/components/domain/DashboardSection";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

const confiancaLabel: Record<MatchConciliacaoRecente["confianca"], string> = {
  alta: "✓ Match alto",
  media: "⚠ Revisar data",
  baixa: "⚠ Baixa confiança",
};

const confiancaCls: Record<MatchConciliacaoRecente["confianca"], string> = {
  alta: "text-green-700",
  media: "text-amber-700",
  baixa: "text-red-700",
};

export function PainelConciliacaoInline({
  matches,
  onAbrirExtrato,
}: {
  matches: MatchConciliacaoRecente[];
  onAbrirExtrato: () => void;
}) {
  if (matches.length === 0) return null;

  return (
    <DashboardSection
      eyebrow="Conciliação"
      accent="orange"
      title="Últimos matches do extrato"
      description="Resultado do último upload Bradesco nesta sessão. Confirme os pagamentos no modal Extrato."
      badge={
        <DashboardSectionBadge accent="orange">
          {matches.length} match{matches.length > 1 ? "es" : ""}
        </DashboardSectionBadge>
      }
      actions={
        <Button variant="outline" size="sm" onClick={onAbrirExtrato}>
          <Upload className="mr-1 h-4 w-4" />
          Abrir extrato
        </Button>
      }
    >
      <ul className="divide-y px-4">
        {matches.slice(0, 8).map((m) => {
          const comp = m.transacao.data
            ? new Date(`${m.transacao.data}T12:00:00`).toLocaleDateString("pt-BR", {
                month: "short",
                year: "numeric",
              })
            : "—";
          return (
            <li
              key={`${m.cobrancaId}-${m.transacao.data}-${m.transacao.valor}`}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{m.pacienteNome}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {comp} · extrato {formatDate(m.transacao.data)} · dif. {m.diasDiferenca}d
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">{brl(m.transacao.valor)}</span>
                <span className={`text-xs font-semibold ${confiancaCls[m.confianca]}`}>
                  {confiancaLabel[m.confianca]}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardSection>
  );
}
