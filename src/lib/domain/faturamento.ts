import type { Cobranca } from "../queries/cobrancas";
import type { PacienteTipo } from "../types";

export type MesFaturamento = {
  mes: string;
  particular: number;
  judicial: number;
  convenio: number;
  puc: number;
  total: number;
};

const TIPOS: PacienteTipo[] = ["particular", "judicial", "convenio", "puc"];

export function agregarPorMes(cobrancas: Cobranca[], meses = 6): MesFaturamento[] {
  const now = new Date();
  const buckets: MesFaturamento[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      particular: 0,
      judicial: 0,
      convenio: 0,
      puc: 0,
      total: 0,
    });
  }
  for (const c of cobrancas) {
    if (!["pago", "pendente", "aguardando_convenio", "aguardando_alvara"].includes(c.status))
      continue;
    if (!c.competenciaMes || !c.competenciaAno) continue;
    const idx = buckets.findIndex((_, i) => {
      const ref = new Date(now.getFullYear(), now.getMonth() - (meses - 1 - i), 1);
      return c.competenciaMes === ref.getMonth() + 1 && c.competenciaAno === ref.getFullYear();
    });
    if (idx < 0) continue;
    if (TIPOS.includes(c.tipo)) buckets[idx][c.tipo] += c.valor;
    buckets[idx].total += c.valor;
  }
  return buckets;
}

export function calcularKpis(cobrancas: Cobranca[]) {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  const monthly = cobrancas.filter((c) => c.competenciaMes === mes && c.competenciaAno === ano);
  const receita = monthly.filter((c) => c.status === "pago").reduce((a, c) => a + c.valor, 0);
  const aReceber = monthly
    .filter((c) => ["pendente", "aguardando_convenio", "aguardando_alvara"].includes(c.status))
    .reduce((a, c) => a + c.valor, 0);
  const inadimplencia = monthly
    .filter((c) => c.status === "vencido" || c.status === "atrasado")
    .reduce((a, c) => a + c.valor, 0);
  return { receita, aReceber, inadimplencia };
}
