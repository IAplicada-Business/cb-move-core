import { describe, expect, it } from "vitest";
import {
  buildRelatorioLinhas,
  calcularRodapeFinanceiro,
  calcularRodapeRelatorio,
  countSessoesRealizadas,
  formatFrequenciaRodape,
  inferirCargaHoraria,
} from "./relatorio-atendimento-linhas";

describe("relatorio-atendimento-linhas", () => {
  const sessoes = [
    {
      id: "s1",
      data: "2026-06-02",
      sigla: "P",
      fisioterapeuta_id: "f1",
      fisioterapeutas: { nome: "Lorenzo" },
    },
    {
      id: "s2",
      data: "2026-06-02",
      sigla: "P",
      fisioterapeuta_id: "f2",
      fisioterapeutas: { nome: "William" },
    },
    {
      id: "s3",
      data: "2026-06-05",
      sigla: "P",
      fisioterapeuta_id: "f1",
      fisioterapeutas: { nome: "Lorenzo" },
    },
    {
      id: "s4",
      data: "2026-06-06",
      sigla: "F",
      fisioterapeuta_id: "f1",
      fisioterapeutas: { nome: "Lorenzo" },
    },
  ];

  it("conta sessões P/RC sem multiplicar por fisio", () => {
    expect(countSessoesRealizadas(sessoes)).toBe(3);
  });

  it("grade gera linha por fisio no mesmo dia", () => {
    const linhas = buildRelatorioLinhas(sessoes, [
      { sessao_id: "s1", fisioterapeuta_id: "f1", fisioterapeutas: { nome: "Lorenzo" } },
      { sessao_id: "s1", fisioterapeuta_id: "f2", fisioterapeutas: { nome: "William" } },
      { sessao_id: "s2", fisioterapeuta_id: "f1", fisioterapeutas: { nome: "Lorenzo" } },
    ]);
    expect(linhas).toHaveLength(4);
    expect(linhas.filter((l) => l.data === "2026-06-02")).toHaveLength(3);
    expect(linhas.filter((l) => l.data === "2026-06-05")).toHaveLength(1);
  });

  it("rodapé financeiro = num × valor (caso Diego 26 × 266)", () => {
    const rodape = calcularRodapeFinanceiro(26, 266);
    expect(rodape.valorTotal).toBe(6916);
  });

  it("formatFrequenciaRodape extrai número", () => {
    expect(formatFrequenciaRodape("3x semana duplo")).toBe("3 VEZES POR SEMANA (DUPLA)");
    expect(formatFrequenciaRodape("2x por semana")).toBe("2 VEZES POR SEMANA");
  });

  it("calcularRodapeRelatorio mensalista usa valor mensal fixo", () => {
    const rodape = calcularRodapeRelatorio(26, "mensalista", 266, 6916);
    expect(rodape.valorTotal).toBe(6916);
    expect(rodape.valorSessao).toBe(6916);
    expect(rodape.numSessoes).toBe(26);
  });

  it("calcularRodapeRelatorio por sessão multiplica", () => {
    const rodape = calcularRodapeRelatorio(26, "por_sessao", 266, 6916);
    expect(rodape.valorTotal).toBe(6916);
    expect(rodape.valorSessao).toBe(266);
  });

  it("inferirCargaHoraria detecta duplo", () => {
    expect(inferirCargaHoraria("3x semana duplo")).toBe("2h50");
    expect(inferirCargaHoraria("2x semana")).toBe("1h25");
  });
});
