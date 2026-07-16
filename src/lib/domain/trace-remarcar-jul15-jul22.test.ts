import { describe, expect, it } from "vitest";
import { gerarSlotsPlanoMensal } from "./padrao-agenda-mensal";
import { montarResumoPlanoSessoesMensal } from "./plano-sessoes-mensal";
import { simularRemarcacaoImpacto } from "./simular-remarcacao-impacto";

/** Cenário do canvas: Arthur · 15/07/26 08:00 → 22/07/26 08:00 · escopo pontual */
const ORIGEM_INICIO = "2026-07-15T08:00:00-03:00";
const DESTINO_INICIO = "2026-07-22T08:00:00-03:00";

const planoSegQua12 = {
  mes: 7,
  ano: 2026,
  frequenciaLabel: "2x semana",
  diasSemanaLabel: "2ª e 4ª",
  qtdSessoesCobranca: 12,
};

function agendamentosUmPorSlot(): Array<{
  id: string;
  inicio: string;
  status: string;
  serie_id: string;
}> {
  const slots = gerarSlotsPlanoMensal({
    mes: planoSegQua12.mes,
    ano: planoSegQua12.ano,
    quantidadeMensal: planoSegQua12.qtdSessoesCobranca,
    diasSemana: planoSegQua12.diasSemanaLabel,
    frequenciaAtendimento: planoSegQua12.frequenciaLabel,
  });
  return slots.map((slot, i) => ({
    id: String(i + 1),
    inicio: `${slot.dataIso}T08:00:00-03:00`,
    status: "agendado",
    serie_id: "serie-arthur",
  }));
}

describe("trace remarcar 15/07 → 22/07 (canvas Arthur)", () => {
  it("rastreia cruzaSemana e impacto no plano", () => {
    const startOfIsoWeek = (d: Date) => {
      const copy = new Date(d);
      const day = copy.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      copy.setDate(copy.getDate() + diff);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };
    const isoWeekLabel = (d: Date) => {
      const s = startOfIsoWeek(d);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(s.getDate())}/${pad(s.getMonth() + 1)}`;
    };

    const origemDate = new Date(ORIGEM_INICIO);
    const destinoDate = new Date(DESTINO_INICIO);
    const cruzaSemana =
      startOfIsoWeek(origemDate).getTime() !== startOfIsoWeek(destinoDate).getTime();

    const slots = gerarSlotsPlanoMensal({
      mes: planoSegQua12.mes,
      ano: planoSegQua12.ano,
      quantidadeMensal: planoSegQua12.qtdSessoesCobranca,
      diasSemana: planoSegQua12.diasSemanaLabel,
      frequenciaAtendimento: planoSegQua12.frequenciaLabel,
    });

    const ags = agendamentosUmPorSlot();
    const origem = ags.find((a) => a.inicio === ORIGEM_INICIO)!;

    const antes = montarResumoPlanoSessoesMensal({
      ...planoSegQua12,
      agendamentos: ags,
    });

    const impacto = simularRemarcacaoImpacto({
      plano: planoSegQua12,
      agendamentos: ags,
      origem,
      novoInicio: DESTINO_INICIO,
      escopo: "pontual",
    });

    const trace = {
      cruzaSemana: {
        origem: ORIGEM_INICIO,
        destino: DESTINO_INICIO,
        semanaOrigem: isoWeekLabel(origemDate),
        semanaDestino: isoWeekLabel(destinoDate),
        cruzaSemana,
      },
      slotsTemplate: slots.map((s) => s.dataIso),
      plano: planoSegQua12,
      escopo: "pontual",
      horarioAfetado: origem,
      antes: {
        noPadrao: antes.agendadasNoPlano,
        faltantes: antes.faltantes,
        extras: antes.extras.length,
        faltantesSlots: antes.faltantesSlots.map((s) => s.dataIso),
      },
      depois: impacto,
      avisos: impacto?.avisos ?? [],
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(trace, null, 2));

    expect(cruzaSemana).toBe(true);
    expect(origem).toBeDefined();
    expect(antes.faltantes).toBe(0);
    expect(antes.extras).toHaveLength(0);
    expect(impacto).not.toBeNull();
    expect(impacto!.delta.faltantes).toBe(1);
    expect(impacto!.delta.extras).toBe(1);
    expect(impacto!.avisos.some((a) => a.includes("slot ficará vazio"))).toBe(true);
    expect(impacto!.avisos.some((a) => a.includes("fora do padrão (extra)"))).toBe(true);
    expect(impacto!.avisos.some((a) => a.includes("Plano após remarcação"))).toBe(true);
  });
});
