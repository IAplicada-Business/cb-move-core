import { describe, expect, it } from "vitest";
import {
  avaliarDestinoRemarcacao,
  calcularSemanaDestino,
  checarConflitoRemarcacao,
  listarBlocosDia,
  sugerirDatasPlano,
} from "./remarcacao-disponibilidade";
import type { ResumoPlanoSessoesMensal } from "./plano-sessoes-mensal";

describe("calcularSemanaDestino", () => {
  it("retorna segunda a sexta da semana ISO da data", () => {
    const r = calcularSemanaDestino("2026-07-16");
    expect(r.diasUteis).toHaveLength(5);
    expect(r.diasUteis[0].getDay()).toBe(1);
    expect(r.diasUteis[4].getDay()).toBe(5);
    expect(r.inicio).toMatch(/^2026-07-/);
  });
});

describe("checarConflitoRemarcacao", () => {
  it("detecta overlap no mesmo fisio", () => {
    const r = checarConflitoRemarcacao({
      fisioId: "f1",
      novoInicio: "2026-07-16T09:30:00-03:00",
      duracaoMin: 50,
      excluirIds: new Set(),
      agendamentos: [
        {
          id: "a1",
          fisioterapeuta_id: "f1",
          inicio: "2026-07-16T09:30:00-03:00",
          duracao_min: 50,
          status: "agendado",
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("indisponível");
  });

  it("ignora agendamentos excluídos", () => {
    const r = checarConflitoRemarcacao({
      fisioId: "f1",
      novoInicio: "2026-07-16T09:30:00-03:00",
      duracaoMin: 50,
      excluirIds: new Set(["a1"]),
      agendamentos: [
        {
          id: "a1",
          fisioterapeuta_id: "f1",
          inicio: "2026-07-16T09:30:00-03:00",
          duracao_min: 50,
          status: "agendado",
        },
      ],
    });
    expect(r.ok).toBe(true);
  });
});

describe("listarBlocosDia", () => {
  it("marca bloco ocupado quando há agendamento", () => {
    const blocos = listarBlocosDia({
      fisioId: "f1",
      dataIso: "2026-07-16",
      disponibilidade: [],
      indisponibilidades: [],
      agendamentos: [
        {
          id: "a1",
          fisioterapeuta_id: "f1",
          inicio: "2026-07-16T09:30:00-03:00",
          duracao_min: 50,
          status: "agendado",
          pacientes: { nome: "Airton" },
        },
      ],
    });
    const ocupado = blocos.find((b) => b.horaInicio === "09:30");
    expect(ocupado?.status).toBe("ocupado");
    expect(ocupado?.selecionavel).toBe(false);
  });

  it("marca bloco vago sem agendamento", () => {
    const blocos = listarBlocosDia({
      fisioId: "f1",
      dataIso: "2026-07-16",
      disponibilidade: [],
      indisponibilidades: [],
      agendamentos: [],
    });
    const vago = blocos.find((b) => b.horaInicio === "08:00");
    expect(vago?.status).toBe("vago");
    expect(vago?.selecionavel).toBe(true);
  });
});

describe("avaliarDestinoRemarcacao", () => {
  it("bloqueia destino ocupado", () => {
    const r = avaliarDestinoRemarcacao({
      fisioId: "f1",
      dataIso: "2026-07-16",
      horaInicio: "09:30",
      duracaoMin: 50,
      novoInicio: "2026-07-16T09:30:00-03:00",
      disponibilidade: [],
      indisponibilidades: [],
      excluirIds: new Set(),
      agendamentos: [
        {
          id: "a1",
          fisioterapeuta_id: "f1",
          inicio: "2026-07-16T09:30:00-03:00",
          duracao_min: 50,
          status: "agendado",
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.alertaTipo).toBe("erro");
  });

  it("avisa data fora do plano sem bloquear", () => {
    const r = avaliarDestinoRemarcacao({
      fisioId: "f1",
      dataIso: "2026-07-15",
      horaInicio: "08:00",
      duracaoMin: 50,
      novoInicio: "2026-07-15T08:00:00-03:00",
      disponibilidade: [],
      indisponibilidades: [],
      excluirIds: new Set(),
      agendamentos: [],
      datasPlano: new Set(["2026-07-16", "2026-07-19"]),
    });
    expect(r.ok).toBe(true);
    expect(r.alertaTipo).toBe("aviso");
  });
});

describe("sugerirDatasPlano", () => {
  it("agrega datas de faltantes e itens", () => {
    const resumo: ResumoPlanoSessoesMensal = {
      mes: 7,
      ano: 2026,
      frequenciaLabel: "24x",
      diasSemanaLabel: "2ª e 5ª",
      quantidadeMensal: 24,
      quantidadeExibicao: "24x",
      concluidas: 0,
      pendentes: 1,
      faltas: 0,
      faltantes: 1,
      agendadasNoPlano: 1,
      itens: [
        {
          id: "a1",
          inicio: "2026-07-16T09:30:00-03:00",
          status: "agendado",
          situacao: "pendente",
          semanaNoMes: 3,
          dentroDoPlano: true,
          dataSlotIso: "2026-07-16",
          indicePlano: 1,
        },
      ],
      extras: [],
      faltantesSlots: [{ dataIso: "2026-07-19", indicePlano: 2, sessaoNoDia: 1 }],
      agendamentosInicioMes: [],
    };
    expect(sugerirDatasPlano(resumo)).toEqual(["2026-07-16", "2026-07-19"]);
  });
});
