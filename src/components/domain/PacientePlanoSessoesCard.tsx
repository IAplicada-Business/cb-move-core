import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatDateDDMMYY } from "@/lib/format";
import {
  SITUACAO_SESSAO_LABEL,
  type ResumoPlanoSessoesMensal,
  type SituacaoSessaoMensal,
} from "@/lib/domain/plano-sessoes-mensal";
import { cn } from "@/lib/utils";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const SITUACAO_STYLE: Record<SituacaoSessaoMensal, string> = {
  concluida: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30",
  pendente: "bg-cb-cyan-600/10 text-cb-cyan-900 border-cb-cyan-600/30",
  faltou: "bg-destructive/10 text-destructive border-destructive/30",
};

type Props = {
  resumo: ResumoPlanoSessoesMensal;
  agendamentoAtualId?: string | null;
};

function SessaoRow({
  idx,
  indicePlano,
  inicio,
  semanaNoMes,
  situacao,
  situacaoLabel,
  agendamentoAtualId,
  itemId,
  destacarAtual,
  badgeClassName,
}: {
  idx: number;
  indicePlano?: number;
  inicio: string;
  semanaNoMes: number;
  situacao: SituacaoSessaoMensal;
  situacaoLabel: string;
  agendamentoAtualId?: string | null;
  itemId: string;
  destacarAtual?: boolean;
  badgeClassName?: string;
}) {
  const numeroSessao = indicePlano ?? idx + 1;
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs",
        destacarAtual && itemId === agendamentoAtualId && "ring-2 ring-cb-cyan-600/40",
      )}
    >
      <div className="min-w-0">
        <span className="font-medium">Sessão {numeroSessao}</span>
        <span className="text-muted-foreground">
          {" "}
          · {formatDateDDMMYY(inicio)} · Sem. {semanaNoMes}
        </span>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 font-medium",
          badgeClassName ?? SITUACAO_STYLE[situacao],
        )}
      >
        {situacaoLabel}
      </span>
    </li>
  );
}

function FaltanteRow({
  indicePlano,
  dataIso,
}: {
  indicePlano: number;
  dataIso: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-dashed border-cb-orange/40 bg-cb-orange/5 px-2.5 py-1.5 text-xs">
      <span className="text-muted-foreground">
        Sessão {indicePlano}
        {dataIso ? ` · ${formatDateDDMMYY(dataIso)}` : ""} · não agendada
      </span>
      <span className="rounded-full border border-cb-orange/40 bg-cb-orange/10 px-2 py-0.5 font-medium text-cb-orange">
        Faltante
      </span>
    </li>
  );
}

export function PacientePlanoSessoesCard({ resumo, agendamentoAtualId }: Props) {
  const mesLabel = `${MESES[resumo.mes - 1] ?? resumo.mes}/${resumo.ano}`;
  const maxFaltantesVisiveis = 3;
  const [faltantesExpandido, setFaltantesExpandido] = useState(false);
  const faltantesLista =
    resumo.faltantesSlots.length > 0
      ? resumo.faltantesSlots
      : Array.from({ length: resumo.faltantes }, (_, idx) => ({
          indicePlano: resumo.itens.length + idx + 1,
          dataIso: "",
          sessaoNoDia: 1,
        }));
  const faltantesOcultas = Math.max(0, faltantesLista.length - maxFaltantesVisiveis);
  const faltantesExibidas = faltantesExpandido
    ? faltantesLista.length
    : Math.min(faltantesLista.length, maxFaltantesVisiveis);

  useEffect(() => {
    setFaltantesExpandido(false);
  }, [resumo.mes, resumo.ano, resumo.faltantes, resumo.agendadasNoPlano]);

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plano do mês · {mesLabel}
        </p>
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">Sessões no plano: </span>
          <span className="font-semibold">{resumo.quantidadeExibicao}</span>
          {resumo.frequenciaLabel && (
            <span className="text-muted-foreground"> · {resumo.frequenciaLabel}</span>
          )}
          {resumo.diasSemanaLabel && (
            <span className="text-muted-foreground"> · {resumo.diasSemanaLabel}</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-800">
          {resumo.concluidas} concluída{resumo.concluidas === 1 ? "" : "s"}
        </span>
        {resumo.pendentes > 0 && (
          <span className="rounded-full border border-cb-cyan-600/30 bg-cb-cyan-600/10 px-2 py-0.5 text-cb-cyan-900">
            {resumo.pendentes} pendente{resumo.pendentes === 1 ? "" : "s"}
          </span>
        )}
        {resumo.faltas > 0 && (
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive">
            {resumo.faltas} falta{resumo.faltas === 1 ? "" : "s"}
          </span>
        )}
        {resumo.faltantes > 0 && (
          <span className="rounded-full border border-cb-orange/40 bg-cb-orange/10 px-2 py-0.5 text-cb-orange">
            {resumo.faltantes} faltante{resumo.faltantes === 1 ? "" : "s"}
          </span>
        )}
        {resumo.extras.length > 0 && (
          <span className="rounded-full border border-cb-orange/40 bg-cb-orange/10 px-2 py-0.5 text-cb-orange">
            {resumo.extras.length} extra{resumo.extras.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {resumo.itens.length > 0 ? (
        <ul className="space-y-1.5">
          {resumo.itens.map((item, idx) => (
            <SessaoRow
              key={item.id}
              idx={idx}
              indicePlano={item.indicePlano}
              inicio={item.inicio}
              semanaNoMes={item.semanaNoMes}
              situacao={item.situacao}
              situacaoLabel={SITUACAO_SESSAO_LABEL[item.situacao]}
              agendamentoAtualId={agendamentoAtualId}
              itemId={item.id}
              destacarAtual
            />
          ))}
        </ul>
      ) : resumo.faltantes === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma sessão agendada no plano deste mês.</p>
      ) : null}

      {resumo.faltantes > 0 && (
        <ul className="space-y-1.5">
          {resumo.faltantes > 5 ? (
            <li className="rounded-md border border-dashed border-cb-orange/40 bg-cb-orange/5 px-2.5 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-cb-orange">{resumo.faltantes} sessões</span> ainda
              sem horário no plano. Use <span className="font-medium">Novo agendamento</span> com a
              opção de agendar faltantes do plano.
            </li>
          ) : (
            Array.from({ length: faltantesExibidas }).map((_, idx) => {
              const slot = faltantesLista[idx];
              return (
                <FaltanteRow
                  key={`faltante-${slot.indicePlano}-${slot.dataIso || idx}`}
                  indicePlano={slot.indicePlano}
                  dataIso={slot.dataIso || ""}
                />
              );
            })
          )}
          {faltantesOcultas > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setFaltantesExpandido((v) => !v)}
                aria-expanded={faltantesExpandido}
                className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-[11px] font-medium text-cb-cyan-800 hover:bg-muted/40 hover:underline"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform",
                    faltantesExpandido && "rotate-180",
                  )}
                />
                {faltantesExpandido
                  ? `Ocultar ${faltantesOcultas} ${faltantesOcultas === 1 ? "sessão faltante" : "sessões faltantes"}`
                  : `+${faltantesOcultas} ${faltantesOcultas === 1 ? "sessão faltante não exibida" : "sessões faltantes não exibidas"}`}
              </button>
            </li>
          )}
        </ul>
      )}

      {resumo.extras.length > 0 && (
        <div className="space-y-1.5 border-t pt-2">
          <p className="text-[11px] font-medium text-cb-orange">
            {resumo.extras.length} agendamento{resumo.extras.length === 1 ? "" : "s"} fora do plano mensal
          </p>
          <ul className="space-y-1.5">
            {resumo.extras.map((item, idx) => (
              <SessaoRow
                key={item.id}
                idx={idx}
                indicePlano={item.indicePlano}
                inicio={item.inicio}
                semanaNoMes={item.semanaNoMes}
                situacao={item.situacao}
                situacaoLabel="Extra"
                badgeClassName="bg-cb-orange/10 text-cb-orange border-cb-orange/40"
                agendamentoAtualId={agendamentoAtualId}
                itemId={item.id}
                destacarAtual
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
