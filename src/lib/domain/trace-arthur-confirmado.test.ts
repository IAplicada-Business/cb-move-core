import { describe, expect, it } from "vitest";
import { montarResumoPlanoSessoesMensal } from "./plano-sessoes-mensal";
import { simularRemarcacaoImpacto } from "./simular-remarcacao-impacto";

/** Dados reais Arthur Borba — remarcação confirmada em 15/07/2026 */
const ARTHUR_PLANO = {
  mes: 7,
  ano: 2026,
  frequenciaLabel: "3x semana simples",
  diasSemanaLabel: "2ª 4ª e 6ª (simples)",
  qtdSessoesCobranca: 12,
};

const AGENDAMENTOS_ANTES_REMARCAR = [
  "2026-07-01T08:00:00-03:00",
  "2026-07-03T08:00:00-03:00",
  "2026-07-06T08:00:00-03:00",
  "2026-07-08T08:00:00-03:00",
  "2026-07-10T08:00:00-03:00",
  "2026-07-13T08:00:00-03:00",
  "2026-07-15T08:00:00-03:00",
  "2026-07-17T08:00:00-03:00",
  "2026-07-20T08:00:00-03:00",
  "2026-07-22T08:00:00-03:00",
  "2026-07-24T08:00:00-03:00",
  "2026-07-27T08:00:00-03:00",
].map((inicio, i) => ({
  id: String(i + 1),
  inicio,
  status: "agendado",
  serie_id: "serie-arthur",
}));

describe("trace Arthur confirmado 15/07 08:00 → 20/07 12:40", () => {
  it("reproduz avisos do dialog para o destino real gravado", () => {
    const origem = AGENDAMENTOS_ANTES_REMARCAR.find((a) => a.inicio.startsWith("2026-07-15"))!;
    const impacto = simularRemarcacaoImpacto({
      plano: ARTHUR_PLANO,
      agendamentos: AGENDAMENTOS_ANTES_REMARCAR,
      origem,
      novoInicio: "2026-07-20T12:40:00-03:00",
      escopo: "pontual",
    });

    const antes = montarResumoPlanoSessoesMensal({
      ...ARTHUR_PLANO,
      agendamentos: AGENDAMENTOS_ANTES_REMARCAR,
    });

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          antes: {
            noPadrao: antes.agendadasNoPlano,
            faltantes: antes.faltantes,
            extras: antes.extras.length,
          },
          impacto,
        },
        null,
        2,
      ),
    );

    expect(impacto).not.toBeNull();
    expect(impacto!.avisos.length).toBe(3);
    expect(impacto!.depois.noPadrao).toBe(11);
    expect(impacto!.depois.faltantes).toBe(1);
    expect(impacto!.depois.extras).toBe(1);
  });
});
