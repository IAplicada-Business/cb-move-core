import { describe, expect, it } from "vitest";
import {
  filtrarAfetadosRemarcacao,
  simularRemarcacaoImpacto,
} from "./simular-remarcacao-impacto";

const AIRTON_DIAS = [2, 6, 9, 13, 16, 20, 23, 27] as const;
const TRIPLO_HORAS = ["08:00", "08:50", "09:40"] as const;

function agendamentosAirtonLimpos(): Array<{
  id: string;
  inicio: string;
  status: string;
  serie_id: string;
}> {
  const ags: Array<{ id: string; inicio: string; status: string; serie_id: string }> = [];
  let n = 1;
  for (const dia of AIRTON_DIAS) {
    for (const hora of TRIPLO_HORAS) {
      ags.push({
        id: String(n++),
        inicio: `2026-07-${String(dia).padStart(2, "0")}T${hora}:00-03:00`,
        status: "agendado",
        serie_id: "serie-airton",
      });
    }
  }
  return ags;
}

const planoAirton = {
  mes: 7,
  ano: 2026,
  frequenciaLabel: "2x semana triplo",
  diasSemanaLabel: "2ª e 5ª (triplos)",
  qtdSessoesCobranca: 24,
};

describe("filtrarAfetadosRemarcacao", () => {
  const ags = agendamentosAirtonLimpos();
  const origem = ags.find((a) => a.inicio.startsWith("2026-07-16T08:00"))!;

  it("pontual: só o horário de origem", () => {
    expect(filtrarAfetadosRemarcacao(origem, ags, "pontual")).toHaveLength(1);
  });

  it("semana: triplo do dia 16/07", () => {
    const afetados = filtrarAfetadosRemarcacao(origem, ags, "semana");
    expect(afetados).toHaveLength(3);
    expect(afetados.every((a) => a.inicio.startsWith("2026-07-16"))).toBe(true);
  });

  it("serie_mes: futuros do mês a partir de 16/07", () => {
    const afetados = filtrarAfetadosRemarcacao(origem, ags, "serie_mes");
    expect(afetados).toHaveLength(12);
  });
});

describe("simularRemarcacaoImpacto", () => {
  const ags = agendamentosAirtonLimpos();
  const origem = ags.find((a) => a.inicio.startsWith("2026-07-16T08:00"))!;

  it("plano limpo → pontual 16/07→17/07: +1 faltante, +1 extra", () => {
    const impacto = simularRemarcacaoImpacto({
      plano: planoAirton,
      agendamentos: ags,
      origem,
      novoInicio: "2026-07-17T08:00:00-03:00",
      escopo: "pontual",
    });

    expect(impacto).not.toBeNull();
    expect(impacto!.horariosAfetados).toBe(1);
    expect(impacto!.antes.faltantes).toBe(0);
    expect(impacto!.antes.extras).toBe(0);
    expect(impacto!.depois.faltantes).toBe(1);
    expect(impacto!.depois.extras).toBe(1);
    expect(impacto!.depois.noPadrao).toBe(23);
    expect(impacto!.destinosForaDiasSemana).toHaveLength(1);
    expect(impacto!.destinosForaDiasSemana[0].dataIso).toBe("2026-07-17");
    expect(impacto!.avisos.some((a) => a.includes("fora dos dias do plano"))).toBe(true);
  });

  it("semana: 3 faltantes e 3 extras", () => {
    const impacto = simularRemarcacaoImpacto({
      plano: planoAirton,
      agendamentos: ags,
      origem,
      novoInicio: "2026-07-17T08:00:00-03:00",
      escopo: "semana",
    });

    expect(impacto!.horariosAfetados).toBe(3);
    expect(impacto!.depois.faltantes).toBe(3);
    expect(impacto!.depois.extras).toBe(3);
    expect(impacto!.depois.noPadrao).toBe(21);
  });

  it("serie_mes: 12 faltantes e 12 extras", () => {
    const impacto = simularRemarcacaoImpacto({
      plano: planoAirton,
      agendamentos: ags,
      origem,
      novoInicio: "2026-07-17T08:00:00-03:00",
      escopo: "serie_mes",
    });

    expect(impacto!.horariosAfetados).toBe(12);
    expect(impacto!.depois.faltantes).toBe(12);
    expect(impacto!.depois.extras).toBe(12);
    expect(impacto!.depois.noPadrao).toBe(12);
  });

  it("retorna null sem mudança de horário", () => {
    expect(
      simularRemarcacaoImpacto({
        plano: planoAirton,
        agendamentos: ags,
        origem,
        novoInicio: origem.inicio,
        escopo: "pontual",
      }),
    ).toBeNull();
  });
});
