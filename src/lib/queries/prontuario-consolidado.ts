import { supabase } from "@/integrations/supabase/client";

export type ProntuarioConsolidadoRow = {
  pacienteId: string;
  pacienteNome: string;
  tipo: string;
  fisioPrincipal: string | null;
  ultimaEvolucaoData: string | null;
  totalEvolucoes: number;
  ultimoRelatorioStatus: string | null;
};

export async function fetchProntuariosConsolidados(search?: string): Promise<ProntuarioConsolidadoRow[]> {
  const { data: pacientes, error: pErr } = await supabase
    .from("pacientes")
    .select("id, nome, tipo, fisioterapeutas(nome)")
    .eq("ativo", true)
    .order("nome");
  if (pErr) throw pErr;

  type PacRow = {
    id: string;
    nome: string;
    tipo: string;
    fisioterapeutas?: { nome: string } | null;
  };

  let rows = (pacientes ?? []) as PacRow[];
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    rows = rows.filter((p) => p.nome.toLowerCase().includes(q));
  }

  const ids = rows.map((p) => p.id);
  if (ids.length === 0) return [];

  const [evolRes, relRes] = await Promise.all([
    supabase
      .from("prontuario_evolucoes")
      .select("paciente_id, data")
      .in("paciente_id", ids),
    supabase
      .from("relatorios_atendimento")
      .select("paciente_id, status, created_at")
      .in("paciente_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  if (evolRes.error) throw evolRes.error;
  if (relRes.error) throw relRes.error;

  const evolPorPaciente = new Map<string, { count: number; last: string | null }>();
  for (const e of evolRes.data ?? []) {
    const cur = evolPorPaciente.get(e.paciente_id) ?? { count: 0, last: null };
    cur.count += 1;
    if (!cur.last || e.data > cur.last) cur.last = e.data;
    evolPorPaciente.set(e.paciente_id, cur);
  }

  const relPorPaciente = new Map<string, string>();
  for (const r of relRes.data ?? []) {
    if (!relPorPaciente.has(r.paciente_id)) {
      relPorPaciente.set(r.paciente_id, r.status);
    }
  }

  return rows.map((p) => {
    const ev = evolPorPaciente.get(p.id);
    return {
      pacienteId: p.id,
      pacienteNome: p.nome,
      tipo: p.tipo,
      fisioPrincipal: p.fisioterapeutas?.nome ?? null,
      ultimaEvolucaoData: ev?.last ?? null,
      totalEvolucoes: ev?.count ?? 0,
      ultimoRelatorioStatus: relPorPaciente.get(p.id) ?? null,
    };
  });
}
