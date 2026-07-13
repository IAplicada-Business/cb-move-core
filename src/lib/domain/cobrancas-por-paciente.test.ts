import { describe, expect, it } from "vitest";
import {
  agregarCobrancasPorPaciente,
  calcularKpisDeCobrancas,
} from "./cobrancas-por-paciente";
import type { Cobranca } from "../queries/cobrancas";

function cob(partial: Partial<Cobranca> & Pick<Cobranca, "id" | "pacienteId" | "status" | "valor">): Cobranca {
  return {
    pacienteNome: "Wagner",
    descricao: null,
    servico: null,
    tipo: "particular",
    regime: "mensalista",
    formaPagamento: "boleto",
    competenciaMes: 7,
    competenciaAno: 2026,
    vencimento: "2026-07-15",
    pagoEm: null,
    boletoUrl: null,
    observacoes: null,
    frequenciaAtendimento: null,
    diasSemana: null,
    qtdSessoes: null,
    createdAt: "2026-07-01T00:00:00Z",
    ...partial,
  };
}

describe("agregarCobrancasPorPaciente", () => {
  it("deduplica paciente e calcula progresso", () => {
    const rows = [
      cob({ id: "1", pacienteId: "p1", status: "pago", valor: 500 }),
      cob({ id: "2", pacienteId: "p1", status: "pendente", valor: 500, competenciaMes: 6 }),
      cob({ id: "3", pacienteId: "p2", pacienteNome: "Ana", status: "pago", valor: 300 }),
    ];
    const agg = agregarCobrancasPorPaciente(rows);
    expect(agg).toHaveLength(2);
    const wagner = agg.find((a) => a.pacienteId === "p1")!;
    expect(wagner.progressoLabel).toBe("1 de 2");
    expect(wagner.totalValor).toBe(1000);
    expect(wagner.statusResumo).toBe("parcial");
  });

  it("exclui canceladas do total e progresso", () => {
    const rows = [
      cob({ id: "1", pacienteId: "p1", status: "pago", valor: 400 }),
      cob({ id: "2", pacienteId: "p1", status: "cancelado", valor: 400 }),
    ];
    const [r] = agregarCobrancasPorPaciente(rows);
    expect(r.qtdTotal).toBe(1);
    expect(r.totalValor).toBe(400);
    expect(r.progressoLabel).toBe("1 de 1");
  });
});

describe("calcularKpisDeCobrancas", () => {
  it("segue regra do RPC (exclui cancelado)", () => {
    const kpis = calcularKpisDeCobrancas([
      cob({ id: "1", pacienteId: "p1", status: "pago", valor: 100 }),
      cob({ id: "2", pacienteId: "p1", status: "pendente", valor: 200 }),
      cob({ id: "3", pacienteId: "p1", status: "vencido", valor: 50 }),
      cob({ id: "4", pacienteId: "p1", status: "cancelado", valor: 999 }),
    ]);
    expect(kpis).toEqual({ total: 350, pago: 100, pendente: 200, vencido: 50 });
  });
});
