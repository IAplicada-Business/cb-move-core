import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardInsightBannerProps = {
  conformidadePct: number;
  divergenciaCount: number;
  sessoesRealizadas: number;
  periodoLabel?: string;
  className?: string;
};

/** CTA compacto estilo SaaS (referência Behance) — destaca conformidade do prontuário. */
export function DashboardInsightBanner({
  conformidadePct,
  divergenciaCount,
  sessoesRealizadas,
  periodoLabel = "mês atual",
  className,
}: DashboardInsightBannerProps) {
  const ok = divergenciaCount === 0 && sessoesRealizadas > 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 text-white shadow-[0_16px_40px_rgba(15,75,80,0.28)] sm:p-6",
        ok
          ? "bg-gradient-to-br from-cb-cyan-800 via-cb-cyan-900 to-[#1a4f6e]"
          : "bg-gradient-to-br from-cb-cyan-900 via-[#1a4f6e] to-cb-purple",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
          {ok ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          ) : (
            <AlertTriangle className="h-5 w-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
            Conformidade clínica
          </p>
          <h3 className="mt-1 text-base font-bold leading-snug">
            {ok ? `Prontuário em dia em ${periodoLabel}` : "Regularize evoluções pendentes"}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-white/80">
            {sessoesRealizadas === 0
              ? `Nenhuma sessão realizada em ${periodoLabel}.`
              : ok
                ? `${conformidadePct}% das sessões com evolução registrada.`
                : `${divergenciaCount} sessão(ões) sem evolução — ${conformidadePct}% conformes.`}
          </p>
          {divergenciaCount > 0 && (
            <Button
              size="sm"
              className="mt-4 h-8 rounded-full bg-white px-4 text-xs font-semibold text-cb-cyan-900 hover:bg-white/90"
              asChild
            >
              <Link to="/app/prontuario" search={{ tab: "visao-geral" }}>
                Ver prontuários
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
