import { supabase } from "@/integrations/supabase/client";

export type DashboardKpis = {
  receitaMes: number;
  aReceber: number;
  inadimplencia: number;
  nfsEmitidas: number;
};

export type ReceitaMensalItem = {
  mes: string;
  particular: number;
  judicial: number;
  convenio: number;
  puc: number;
  total: number;
};

export async function fetchKpis(): Promise<DashboardKpis> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  const inicioMes = new Date(ano, now.getMonth(), 1).toISOString().split("T")[0];
  const fimMes = new Date(ano, now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [cobResult, nfResult] = await Promise.all([
    supabase
      .from("cobrancas")
      .select("valor, status, pago_em, competencia_mes, competencia_ano")
      .or(`competencia_mes.eq.${mes}.and.competencia_ano.eq.${ano},and(pago_em.gte.${inicioMes},pago_em.lte.${fimMes})`),
    supabase
      .from("notas_fiscais")
      .select("*", { count: "exact", head: true })
      .eq("status", "emitida")
      .gte("emissao", `${ano}-${String(mes).padStart(2, "0")}-01`)
      .lt("emissao", `${String(mes === 12 ? ano + 1 : ano)}-${String(mes === 12 ? 1 : mes + 1).padStart(2, "0")}-01`),
  ]);

  if (cobResult.error) throw cobResult.error;

  const cobs = cobResult.data ?? [];
  const receitaMes = cobs
    .filter((c) => c.status === "pago" && c.pago_em != null && c.pago_em >= inicioMes && c.pago_em <= fimMes)
    .reduce((s, c) => s + Number(c.valor), 0);

  const aReceber = cobs
    .filter((c) => ["pendente", "aguardando_convenio", "aguardando_alvara"].includes(c.status))
    .reduce((s, c) => s + Number(c.valor), 0);

  const inadimplencia = cobs
    .filter((c) => c.status === "vencido" || c.status === "atrasado")
    .reduce((s, c) => s + Number(c.valor), 0);

  return {
    receitaMes,
    aReceber,
    inadimplencia,
    nfsEmitidas: nfResult.count ?? 0,
  };
}

export async function fetchReceitaMensal(anoInicio: number, anoFim: number): Promise<ReceitaMensalItem[]> {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("valor, tipo, competencia_mes, competencia_ano, status")
    .gte("competencia_ano", anoInicio)
    .lte("competencia_ano", anoFim)
    .in("status", ["pago", "pendente", "aguardando_convenio", "aguardando_alvara"]);

  if (error) throw error;

  const buckets: Map<string, ReceitaMensalItem> = new Map();
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      particular: 0,
      judicial: 0,
      convenio: 0,
      puc: 0,
      total: 0,
    });
  }

  for (const c of data ?? []) {
    if (!c.competencia_mes || !c.competencia_ano) continue;
    const key = `${c.competencia_ano}-${String(c.competencia_mes).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const val = Number(c.valor) || 0;
    const tipo = c.tipo as keyof Pick<ReceitaMensalItem, "particular" | "judicial" | "convenio" | "puc">;
    if (tipo in bucket) bucket[tipo] += val;
    bucket.total += val;
  }

  return Array.from(buckets.values());
}
