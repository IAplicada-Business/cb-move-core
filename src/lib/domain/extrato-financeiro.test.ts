import { describe, expect, it } from "vitest";
import {
  buildExtratoFinanceiro,
  extrairSituacao,
  filtrarExtratoPorConvenio,
  formatPlano,
  grupoReceitaConvenio,
  inferirFrequencia,
  mapExtratoFinanceiroLinha,
  type ExtratoFinanceiroRawRow,
} from "./extrato-financeiro";

const baseRow: ExtratoFinanceiroRawRow = {
  id: "c1",
  paciente_id: "p1",
  tipo: "particular",
  valor: 10280,
  status: "pendente",
  regime: "mensalista",
  servico: "Plano duplo Jun/2026",
  observacoes: "migrado_logjur | Emissão de notas atrasadas, falta 022026 e 032026",
  qtd_sessoes: null,
  frequencia_atendimento: "5x semana duplo",
  dias_semana: "2ª a 6ª (duplos)",
  pago_em: null,
  pacientes: {
    nome: "Alexandre Pires Belser",
    tipo: "particular" as const,
    criado_em: "2025-03-19",
    valor_mensal: 1028,
    valor_sessao: 266,
    regime_cobranca: "mensalista" as const,
    frequencia_atendimento: "5x semana duplo",
    dias_semana: "2ª a 6ª (duplos)",
    convenios: null,
  },
};

describe("extrato-financeiro", () => {
  it("extrai situação do texto migrado", () => {
    expect(extrairSituacao(baseRow.observacoes, "pendente")).toBe(
      "Emissão de notas atrasadas, falta 022026 e 032026",
    );
  });

  it("formata plano e frequência", () => {
    expect(formatPlano("mensalista")).toBe("Mensalista");
    expect(inferirFrequencia("Plano duplo Jun/2026")).toBe("Plano duplo");
  });

  it("mapeia linha com valor previsto e recebido vazio", () => {
    const linha = mapExtratoFinanceiroLinha(baseRow);
    expect(linha.pacienteNome).toBe("Alexandre Pires Belser");
    expect(linha.valorPrevisto).toBe(10280);
    expect(linha.valorRecebido).toBeNull();
    expect(linha.plano).toBe("Mensalista");
    expect(linha.valorUnitario).toBe(1028);
    expect(linha.frequencia).toBe("5x semana duplo");
    expect(linha.diasSemana).toBe("2ª a 6ª (duplos)");
    expect(linha.grupoConvenio).toBe("Particular");
  });

  it("preenche recebido quando status é pago", () => {
    const linha = mapExtratoFinanceiroLinha({
      ...baseRow,
      status: "pago",
      observacoes: "migrado_logjur | PAGO BOLETO",
    });
    expect(linha.valorRecebido).toBe(10280);
    expect(linha.situacao).toBe("PAGO BOLETO");
  });

  it("agrega totais do extrato", () => {
    const resumo = buildExtratoFinanceiro(
      [baseRow, { ...baseRow, id: "c2", valor: 500, status: "pago" }],
      7,
      2026,
    );
    expect(resumo.qtdLinhas).toBe(2);
    expect(resumo.totalPrevisto).toBe(10780);
    expect(resumo.totalRecebido).toBe(500);
  });

  it("agrupa convênio como no RPC de receita", () => {
    expect(grupoReceitaConvenio("convenio", "Unimed")).toBe("Unimed");
    expect(grupoReceitaConvenio("judicial", null)).toBe("Judicial");
  });

  it("usa tipo da cobrança, não do paciente, sem convênio vinculado", () => {
    const linha = mapExtratoFinanceiroLinha({
      ...baseRow,
      tipo: "judicial",
      pacientes: {
        ...baseRow.pacientes!,
        tipo: "particular",
        convenios: null,
      },
    });
    expect(linha.grupoConvenio).toBe("Judicial");
  });

  it("filtra extrato por convênio selecionado", () => {
    const resumo = buildExtratoFinanceiro(
      [
        baseRow,
        {
          ...baseRow,
          id: "c2",
          tipo: "convenio",
          pacientes: {
            ...baseRow.pacientes!,
            nome: "Amanda Pavan",
            tipo: "convenio",
            convenios: { nome: "Unimed" },
          },
        },
      ],
      7,
      2026,
    );
    const filtrado = filtrarExtratoPorConvenio(resumo, "Unimed");
    expect(filtrado.qtdLinhas).toBe(1);
    expect(filtrado.linhas[0]?.pacienteNome).toBe("Amanda Pavan");
  });
});
