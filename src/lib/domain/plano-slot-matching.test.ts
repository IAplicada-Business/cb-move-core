import { describe, expect, it } from "vitest";
import { gerarSlotsPlanoMensal } from "./padrao-agenda-mensal";
import { mapearAgendamentosAosSlots } from "./plano-slot-matching";

const AIRTON_DIAS = [2, 6, 9, 13, 16, 20, 23, 27] as const;
const TRIPLO_HORAS = ["08:00", "08:50", "09:40"] as const;

function agendamentosAirtonLimpos(): Array<{ id: string; inicio: string; status: string }> {
  const ags: Array<{ id: string; inicio: string; status: string }> = [];
  let n = 1;
  for (const dia of AIRTON_DIAS) {
    for (const hora of TRIPLO_HORAS) {
      ags.push({
        id: String(n++),
        inicio: `2026-07-${String(dia).padStart(2, "0")}T${hora}:00-03:00`,
        status: "agendado",
      });
    }
  }
  return ags;
}

function slotsAirton() {
  return gerarSlotsPlanoMensal({
    mes: 7,
    ano: 2026,
    quantidadeMensal: 24,
    diasSemana: "2ª e 5ª (triplos)",
    frequenciaAtendimento: "2x semana triplo",
  });
}

describe("mapearAgendamentosAosSlots", () => {
  it("plano limpo: 24 slots preenchidos, 0 extras", () => {
    const r = mapearAgendamentosAosSlots(slotsAirton(), agendamentosAirtonLimpos());
    expect(r.faltantesSlots).toHaveLength(0);
    expect(r.extras).toHaveLength(0);
    expect(r.slots.filter((s) => s.agendamento)).toHaveLength(24);
  });

  it("remarcação pontual 16/07 08:00 → 17/07: 1 faltante, 1 extra", () => {
    const ags = agendamentosAirtonLimpos().map((ag) => {
      if (ag.inicio.startsWith("2026-07-16T08:00")) {
        return { ...ag, inicio: "2026-07-17T08:00:00-03:00" };
      }
      return ag;
    });
    const r = mapearAgendamentosAosSlots(slotsAirton(), ags);
    expect(r.faltantesSlots).toHaveLength(1);
    expect(r.faltantesSlots[0].dataIso).toBe("2026-07-16");
    // Casamento por contagem no dia: 08:50 e 09:40 preenchem sessões 1–2; buraco na 3ª
    expect(r.faltantesSlots[0].sessaoNoDia).toBe(3);
    expect(r.extras).toHaveLength(1);
    expect(r.extras[0].inicio).toContain("2026-07-17");
  });

  it("remarcação semana: triplo 16/07 → 17/07: 3 faltantes, 3 extras", () => {
    const ags = agendamentosAirtonLimpos().map((ag) => {
      if (ag.inicio.startsWith("2026-07-16")) {
        return {
          ...ag,
          inicio: ag.inicio.replace("2026-07-16", "2026-07-17"),
        };
      }
      return ag;
    });
    const r = mapearAgendamentosAosSlots(slotsAirton(), ags);
    expect(r.faltantesSlots).toHaveLength(3);
    expect(r.extras).toHaveLength(3);
  });

  it("remarcação série mês: 12 slots vazios, 12 extras", () => {
    const ags = agendamentosAirtonLimpos().map((ag) => {
      const d = ag.inicio.slice(0, 10);
      if (d === "2026-07-16") return { ...ag, inicio: ag.inicio.replace("2026-07-16", "2026-07-17") };
      if (d === "2026-07-20") return { ...ag, inicio: ag.inicio.replace("2026-07-20", "2026-07-21") };
      if (d === "2026-07-23") return { ...ag, inicio: ag.inicio.replace("2026-07-23", "2026-07-24") };
      if (d === "2026-07-27") return { ...ag, inicio: ag.inicio.replace("2026-07-27", "2026-07-28") };
      return ag;
    });
    const r = mapearAgendamentosAosSlots(slotsAirton(), ags);
    expect(r.faltantesSlots).toHaveLength(12);
    expect(r.extras).toHaveLength(12);
  });
});
